import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { CATALOG_VERSION, CAUSES, REPAIR_GUIDES, SYMPTOMS } from './data/catalog';
import { config } from './config';
import {
  Cause,
  DiagnosisMatch,
  DiagnosisRecord,
  DiagnosisSource,
  RepairGuide,
  Symptom,
  User,
  Vehicle,
  VehicleType,
} from './types';

/**
 * SQLite access layer.
 *
 * The schema is created and the catalog is synchronised automatically on
 * startup. There is no separate migration command: this is a single-file
 * local database, and all schema changes so far are additive
 * (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).
 *
 * Every query lives here rather than in route handlers, so SQL is in one
 * place and the catalog/diagnosis services can be unit-tested with plain
 * fixtures (see services/diagnosisEngine.ts).
 */
export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// ---- schema ------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    nickname TEXT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    mileage INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS symptoms (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    vehicle_types TEXT NOT NULL,
    cause_ids TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS causes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    severity TEXT NOT NULL,
    vehicle_types TEXT NOT NULL,
    repair_guide_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS repair_guides (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    vehicle_types TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    tools_needed TEXT NOT NULL,
    steps TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnosis_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    source TEXT NOT NULL,
    symptom_ids TEXT NOT NULL,
    matches TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  );

  CREATE INDEX IF NOT EXISTS idx_diagnosis_records_vehicle_created
    ON diagnosis_records (vehicle_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_symptoms_category ON symptoms (category);
`;

/**
 * Creates the schema, applies additive migrations, and synchronises the
 * catalog when its version changes. Safe to call more than once.
 */
export function initDb(): void {
  db.exec(SCHEMA);
  migrateVehiclesForAccounts();
  syncCatalog();
  cleanupExpiredSessions();

  console.log(`Database ready at ${path.relative(config.backendRoot, config.dbPath) || config.dbPath}`);
}

/**
 * The original database had a global garage. Add the ownership column when
 * opening an older database; new databases already include it in SCHEMA.
 */
function migrateVehiclesForAccounts(): void {
  const columns = db.prepare('PRAGMA table_info(vehicles)').all() as unknown as Array<{
    name: string;
  }>;
  if (!columns.some((column) => column.name === 'user_id')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN user_id TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_user_created
      ON vehicles (user_id, created_at DESC);
  `);
}

function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getMeta(key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string): void {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

function syncCatalog(): void {
  if (getMeta('catalog_version') === CATALOG_VERSION) return;

  withTransaction(() => {
    // Diagnosis history stores a snapshot of its matches, so replacing the
    // catalog does not invalidate previous records.
    db.exec('DELETE FROM symptoms; DELETE FROM causes; DELETE FROM repair_guides;');

    const insertGuide = db.prepare(
      `INSERT INTO repair_guides
         (id, title, vehicle_types, category, difficulty, estimated_minutes, tools_needed, steps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const guide of REPAIR_GUIDES) {
      insertGuide.run(
        guide.id,
        guide.title,
        JSON.stringify(guide.vehicleTypes),
        guide.category,
        guide.difficulty,
        guide.estimatedMinutes,
        JSON.stringify(guide.toolsNeeded),
        JSON.stringify(guide.steps)
      );
    }

    const insertCause = db.prepare(
      `INSERT INTO causes (id, label, severity, vehicle_types, repair_guide_id)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const cause of CAUSES) {
      insertCause.run(
        cause.id,
        cause.label,
        cause.severity,
        JSON.stringify(cause.vehicleTypes),
        cause.repairGuideId
      );
    }

    const insertSymptom = db.prepare(
      `INSERT INTO symptoms (id, label, category, vehicle_types, cause_ids)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const symptom of SYMPTOMS) {
      insertSymptom.run(
        symptom.id,
        symptom.label,
        symptom.category,
        JSON.stringify(symptom.vehicleTypes),
        JSON.stringify(symptom.causeIds)
      );
    }

    setMeta('catalog_version', CATALOG_VERSION);
  });

  console.log(
    `Catalog synced (${CATALOG_VERSION}): ${SYMPTOMS.length} symptoms, ${CAUSES.length} causes, ${REPAIR_GUIDES.length} repair guides.`
  );
}

/**
 * Give a brand-new account the same two example vehicles the demo app has
 * always started with. They belong to that user only and can be deleted.
 */
function seedExampleVehiclesForUser(userId: string): void {
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM vehicles WHERE user_id = ?')
    .get(userId) as { count: number };
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO vehicles (id, user_id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = new Date().toISOString();
  insert.run(randomUUID(), userId, 'car', 'The Daily', 'Toyota', 'Corolla', 2016, 78_500, now);
  insert.run(randomUUID(), userId, 'motorcycle', 'Weekend Bike', 'Honda', 'CB500F', 2020, 9_200, now);
}

/**
 * The first account created after upgrading an old single-tenant deployment
 * inherits the pre-account garage instead of silently losing it. The marker
 * makes this a one-time migration; later accounts get their own examples.
 */
function claimLegacyVehicles(userId: string): void {
  if (getMeta('legacy_vehicles_claimed') === '1') return;

  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM vehicles WHERE user_id IS NULL')
    .get() as { count: number };
  if (count > 0) {
    db.prepare('UPDATE vehicles SET user_id = ? WHERE user_id IS NULL').run(userId);
    console.log(`Assigned ${count} pre-account vehicle(s) to the first account.`);
  }
  setMeta('legacy_vehicles_claimed', '1');
}

// ---- row <-> domain mapping -------------------------------------------

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface VehicleRow {
  id: string;
  type: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  created_at: string;
}

interface SymptomRow {
  id: string;
  label: string;
  category: string;
  vehicle_types: string;
  cause_ids: string;
}

interface CauseRow {
  id: string;
  label: string;
  severity: string;
  vehicle_types: string;
  repair_guide_id: string;
}

interface RepairGuideRow {
  id: string;
  title: string;
  vehicle_types: string;
  category: string;
  difficulty: string;
  estimated_minutes: number;
  tools_needed: string;
  steps: string;
}

interface DiagnosisRecordRow {
  id: string;
  vehicle_id: string;
  source: string;
  symptom_ids: string;
  matches: string;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

function parseUserRow(row: Pick<UserRow, 'id' | 'email' | 'display_name' | 'created_at'>): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

function parseVehicleRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    type: row.type as VehicleType,
    nickname: row.nickname,
    make: row.make,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    createdAt: row.created_at,
  };
}

function parseSymptomRow(row: SymptomRow): Symptom {
  return {
    id: row.id,
    label: row.label,
    category: row.category as Symptom['category'],
    vehicleTypes: parseJson<VehicleType[]>(row.vehicle_types, []),
    causeIds: parseJson<string[]>(row.cause_ids, []),
  };
}

function parseCauseRow(row: CauseRow): Cause {
  return {
    id: row.id,
    label: row.label,
    severity: row.severity as Cause['severity'],
    vehicleTypes: parseJson<VehicleType[]>(row.vehicle_types, []),
    repairGuideId: row.repair_guide_id,
  };
}

function parseRepairGuideRow(row: RepairGuideRow): RepairGuide {
  return {
    id: row.id,
    title: row.title,
    vehicleTypes: parseJson<VehicleType[]>(row.vehicle_types, []),
    category: row.category as RepairGuide['category'],
    difficulty: row.difficulty as RepairGuide['difficulty'],
    estimatedMinutes: row.estimated_minutes,
    toolsNeeded: parseJson<string[]>(row.tools_needed, []),
    steps: parseJson<string[]>(row.steps, []),
  };
}

/**
 * Older diagnosis rows (written before `matchedSymptoms` was added) only
 * stored symptom ids. Normalise them so every consumer sees the same shape.
 */
function parseMatch(value: unknown): DiagnosisMatch | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const cause = raw.cause as Cause | undefined;
  if (!cause || typeof cause !== 'object') return null;

  const matchedSymptomIds = Array.isArray(raw.matchedSymptomIds)
    ? raw.matchedSymptomIds.filter((id): id is string => typeof id === 'string')
    : [];
  const matchedSymptoms = Array.isArray(raw.matchedSymptoms)
    ? raw.matchedSymptoms
        .filter((s): s is { id: string; label: string } => {
          if (!s || typeof s !== 'object') return false;
          const candidate = s as Record<string, unknown>;
          return typeof candidate.id === 'string' && typeof candidate.label === 'string';
        })
        .map((s) => ({ id: s.id, label: s.label }))
    : [];

  return {
    cause,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
    matchedSymptomIds,
    matchedSymptoms,
    totalLinkedSymptoms:
      typeof raw.totalLinkedSymptoms === 'number'
        ? raw.totalLinkedSymptoms
        : matchedSymptomIds.length,
  };
}

function parseDiagnosisRecordRow(row: DiagnosisRecordRow): DiagnosisRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    source: row.source as DiagnosisSource,
    symptomIds: parseJson<string[]>(row.symptom_ids, []),
    matches: parseJson<unknown[]>(row.matches, [])
      .map(parseMatch)
      .filter((match): match is DiagnosisMatch => match !== null),
    createdAt: row.created_at,
  };
}

// ---- accounts and sessions ---------------------------------------------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createUser(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): User {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  withTransaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.email.toLowerCase(), input.displayName, input.passwordHash, createdAt);

    claimLegacyVehicles(id);
    seedExampleVehiclesForUser(id);
  });

  return { id, email: input.email.toLowerCase(), displayName: input.displayName, createdAt };
}

export function getUserById(id: string): User | undefined {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? parseUserRow(row) : undefined;
}

export function getUserCredentialsByEmail(
  email: string
): { user: User; passwordHash: string } | undefined {
  const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as
    | UserRow
    | undefined;
  return row ? { user: parseUserRow(row), passwordHash: row.password_hash } : undefined;
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  cleanupExpiredSessions();

  const token = `tds_${randomBytes(32).toString('base64url')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(hashSessionToken(token), userId, now.toISOString(), expiresAt, now.toISOString());

  return { token, expiresAt };
}

export function getUserBySessionToken(token: string): User | undefined {
  if (!token.startsWith('tds_')) return undefined;

  const now = new Date().toISOString();
  const row = db
    .prepare(
      `SELECT u.*
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(hashSessionToken(token), now) as UserRow | undefined;

  return row ? parseUserRow(row) : undefined;
}

export function revokeSession(token: string): void {
  if (!token.startsWith('tds_')) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}

export function cleanupExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

// ---- catalog -----------------------------------------------------------

export function getAllSymptoms(): Symptom[] {
  const rows = db.prepare('SELECT * FROM symptoms ORDER BY category, label').all() as unknown as SymptomRow[];
  return rows.map(parseSymptomRow);
}

export function getSymptomsForVehicleType(vehicleType: VehicleType): Symptom[] {
  return getAllSymptoms().filter((symptom) => symptom.vehicleTypes.includes(vehicleType));
}

export function getAllCauses(): Cause[] {
  const rows = db.prepare('SELECT * FROM causes ORDER BY label').all() as unknown as CauseRow[];
  return rows.map(parseCauseRow);
}

export function getAllRepairGuides(): RepairGuide[] {
  const rows = db.prepare('SELECT * FROM repair_guides ORDER BY title').all() as unknown as RepairGuideRow[];
  return rows.map(parseRepairGuideRow);
}

export function getRepairGuidesForVehicleType(vehicleType: VehicleType): RepairGuide[] {
  return getAllRepairGuides().filter((guide) => guide.vehicleTypes.includes(vehicleType));
}

export function getRepairGuideById(id: string): RepairGuide | undefined {
  const row = db.prepare('SELECT * FROM repair_guides WHERE id = ?').get(id) as
    | RepairGuideRow
    | undefined;
  return row ? parseRepairGuideRow(row) : undefined;
}

// ---- vehicles ----------------------------------------------------------

export function listVehicles(userId: string): Vehicle[] {
  const rows = db
    .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as unknown as VehicleRow[];
  return rows.map(parseVehicleRow);
}

export function getVehicleById(id: string, userId: string): Vehicle | undefined {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(id, userId) as
    | VehicleRow
    | undefined;
  return row ? parseVehicleRow(row) : undefined;
}

export interface NewVehicleInput {
  type: VehicleType;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export function createVehicle(input: NewVehicleInput, userId: string): Vehicle {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO vehicles (id, user_id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    input.type,
    input.nickname,
    input.make,
    input.model,
    input.year,
    input.mileage,
    createdAt
  );

  return { id, ...input, createdAt };
}

export type VehiclePatch = Partial<Omit<NewVehicleInput, 'nickname'>> & {
  nickname?: string | null;
};

/**
 * Applies a partial update. Callers are expected to have validated the merged
 * result; this function only persists it.
 */
export function updateVehicle(
  id: string,
  patch: VehiclePatch,
  userId: string
): Vehicle | undefined {
  const existing = getVehicleById(id, userId);
  if (!existing) return undefined;

  const next = {
    type: patch.type ?? existing.type,
    nickname: patch.nickname === undefined ? existing.nickname : patch.nickname,
    make: patch.make ?? existing.make,
    model: patch.model ?? existing.model,
    year: patch.year ?? existing.year,
    mileage: patch.mileage ?? existing.mileage,
  };

  db.prepare(
    'UPDATE vehicles SET type = ?, nickname = ?, make = ?, model = ?, year = ?, mileage = ? WHERE id = ?'
  ).run(next.type, next.nickname, next.make, next.model, next.year, next.mileage, id);

  return getVehicleById(id, userId);
}

/** Deletes a vehicle and its diagnosis history in one transaction. */
export function deleteVehicle(id: string, userId: string): boolean {
  if (!getVehicleById(id, userId)) return false;

  withTransaction(() => {
    // Explicit delete rather than relying on ON DELETE CASCADE: the
    // diagnosis_records table was created before cascade was added, and
    // SQLite cannot add a foreign-key action to an existing table.
    db.prepare('DELETE FROM diagnosis_records WHERE vehicle_id = ?').run(id);
    db.prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?').run(id, userId);
  });
  return true;
}

// ---- diagnosis history -------------------------------------------------

export function recordDiagnosis(
  vehicleId: string,
  source: DiagnosisSource,
  symptomIds: string[],
  matches: DiagnosisMatch[]
): DiagnosisRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO diagnosis_records (id, vehicle_id, source, symptom_ids, matches, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, vehicleId, source, JSON.stringify(symptomIds), JSON.stringify(matches), createdAt);

  return { id, vehicleId, source, symptomIds, matches, createdAt };
}

export function getDiagnosisById(id: string, userId: string): DiagnosisRecord | undefined {
  const row = db
    .prepare(
      `SELECT d.*
         FROM diagnosis_records d
         JOIN vehicles v ON v.id = d.vehicle_id
        WHERE d.id = ? AND v.user_id = ?`
    )
    .get(id, userId) as DiagnosisRecordRow | undefined;
  return row ? parseDiagnosisRecordRow(row) : undefined;
}

export function getDiagnosisHistoryForVehicle(
  vehicleId: string,
  userId: string,
  limit = 100
): DiagnosisRecord[] {
  const rows = db
    .prepare(
      `SELECT d.*
         FROM diagnosis_records d
         JOIN vehicles v ON v.id = d.vehicle_id
        WHERE d.vehicle_id = ? AND v.user_id = ?
        ORDER BY d.created_at DESC, d.rowid DESC
        LIMIT ?`
    )
    .all(vehicleId, userId, limit) as unknown as DiagnosisRecordRow[];
  return rows.map(parseDiagnosisRecordRow);
}

// ---- lifecycle ---------------------------------------------------------

export function closeDb(): void {
  try {
    db.close();
  } catch {
    // Already closed (for example when the test runner calls this twice).
  }
}
