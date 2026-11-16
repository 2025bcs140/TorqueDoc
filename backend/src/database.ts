import { DatabaseSync } from 'node:sqlite';
import { Pool, PoolClient } from 'pg';
import { config } from './config';

/**
 * Small async SQL adapter used by the domain layer in `db.ts`.
 *
 * SQLite keeps local development and tests zero-setup. Postgres is used when
 * `DATABASE_URL` is set, which is what makes hosted accounts and garages survive
 * Render restarts and redeploys.
 *
 * Domain SQL uses `?` placeholders everywhere; the Postgres adapter translates
 * them to `$1`, `$2`, … without touching question marks inside strings or
 * comments.
 */
export type SqlParameter = string | number | null | Buffer;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface QueryExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParameter[]
  ): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

export interface Database extends QueryExecutor {
  readonly dialect: 'sqlite' | 'postgres';
  readonly target: string;
  transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

function runSqliteQuery(
  db: DatabaseSync,
  sql: string,
  params: SqlParameter[]
): QueryResult<unknown> {
  const statement = db.prepare(sql);
  const isRead = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(sql);

  if (isRead) {
    return {
      rows: statement.all(...params) as unknown[],
      rowCount: 0,
    };
  }

  const result = statement.run(...params);
  return {
    rows: [],
    rowCount: Number(result.changes),
  };
}

class SqliteDatabase implements Database {
  readonly dialect = 'sqlite' as const;
  readonly target: string;

  private readonly db: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.target = filePath;
    this.db = new DatabaseSync(filePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
  }

  /**
   * `node:sqlite` exposes one synchronous connection. Serialising every
   * operation keeps a request's queries from interleaving with an open
   * transaction. The queue is only needed on the local/test path; Postgres uses
   * a real connection pool.
   */
  private enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameter[] = []
  ): Promise<QueryResult<T>> {
    return this.enqueue(
      () => runSqliteQuery(this.db, sql, params) as QueryResult<T>
    );
  }

  async exec(sql: string): Promise<void> {
    await this.enqueue(() => {
      this.db.exec(sql);
    });
  }

  async transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const tx: QueryExecutor = {
          query: async <R = Record<string, unknown>>(
            sql: string,
            params: SqlParameter[] = []
          ) => runSqliteQuery(this.db, sql, params) as QueryResult<R>,
          exec: async (sql: string) => {
            this.db.exec(sql);
          },
        };
        const result = await fn(tx);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }

  async healthCheck(): Promise<void> {
    const statement = this.db.prepare('SELECT 1');
    statement.get();
  }

  async close(): Promise<void> {
    await this.enqueue(() => {
      try {
        this.db.close();
      } catch {
        // Already closed (for example when shutdown runs twice).
      }
    });
  }
}

/**
 * Replace `?` placeholders while leaving quoted literals and comments alone.
 * Our domain SQL avoids Postgres JSON operators, so this is unambiguous.
 */
function toPostgresPlaceholders(sql: string): string {
  let result = '';
  let index = 0;
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      result += char;
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      result += char;
      if (char === '*' && next === '/') {
        result += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      result += char;
      if (char === quote) {
        if (next === quote) {
          result += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      result += char + next;
      i += 1;
      lineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      result += char + next;
      i += 1;
      blockComment = true;
      continue;
    }

    if (char === "'" || char === '"') {
      result += char;
      quote = char;
      continue;
    }

    if (char === '?') {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

class PostgresQueryExecutor implements QueryExecutor {
  constructor(private readonly client: Pool | PoolClient) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameter[] = []
  ): Promise<QueryResult<T>> {
    const result = await this.client.query(toPostgresPlaceholders(sql), params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async exec(sql: string): Promise<void> {
    // No parameters here, so node-postgres uses the simple-query protocol and
    // accepts a multi-statement schema script.
    await this.client.query(toPostgresPlaceholders(sql));
  }
}

class PostgresDatabase implements Database {
  readonly dialect = 'postgres' as const;
  readonly target = 'Postgres (DATABASE_URL)';

  private readonly pool: Pool;
  private readonly executor: PostgresQueryExecutor;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    this.pool.on('error', (error) => {
      console.error('Unexpected Postgres pool error:', error);
    });
    this.executor = new PostgresQueryExecutor(this.pool);
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameter[] = []
  ): Promise<QueryResult<T>> {
    return this.executor.query<T>(sql, params);
  }

  exec(sql: string): Promise<void> {
    return this.executor.exec(sql);
  }

  async transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx = new PostgresQueryExecutor(client);
    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original failure; the pool will discard a broken client.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const database: Database = config.databaseUrl
  ? new PostgresDatabase(config.databaseUrl)
  : new SqliteDatabase(config.dbPath);
