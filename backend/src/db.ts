import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CATALOG_VERSION, CAUSES, REPAIR_GUIDES, SYMPTOMS } from './data/catalog';
import {
  Database,
  QueryExecutor,
  SqlParameter,
  database,
} from './database';
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
  isMachineType,
} from './types';

/**
 * Domain data access layer.
 *
 * SQLite is the zero-setup local/test database. When `DATABASE_URL` is set,
 * the same SQL runs against persistent Postgres (Neon in the hosted setup) via
 * the async adapter in `database.ts`. Every exported function is async so both
 * backends share one implementation.
 *
 * The schema is created and the catalog is synchronised automatically on
 * startup. There is no separate migration command: schema changes are
 * additive (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).
 */

const SQLITE_SCHEMA = `
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
    user_id TEXT NOT NULL,
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

const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (LOWER(email));

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    nickname TEXT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    mileage INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_user_created
    ON vehicles (user_id, created_at DESC);

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
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    symptom_ids TEXT NOT NULL,
    matches TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_diagnosis_records_vehicle_created
    ON diagnosis_records (vehicle_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_symptoms_category ON symptoms (category);
`;

/**
 * Creates the schema, applies additive migrations, and synchronises the
 * catalog when its version changes. Safe to call more than once.
 */
export async function initDb(): Promise<void> {
  await database.exec(database.dialect === 'postgres' ? POSTGRES_SCHEMA : SQLITE_SCHEMA);
  await migrateVehiclesForAccounts();
  await purgeLegacyVehicles();
  await syncCatalog();
  await cleanupExpiredSessions();

  console.log(`Database ready (${database.dialect}): ${database.target}`);
}

/**
 * The original database had a global garage. Add the ownership column when
 * opening an older SQLite database; new databases already include it in the
 * schema, and Postgres deployments always start with it.
 */
async function migrateVehiclesForAccounts(): Promise<void> {
  if (database.dialect === 'sqlite') {
    const { rows } = await database.query<{ name: string }>('PRAGMA table_info(vehicles)');
    if (!rows.some((column) => column.name === 'user_id')) {
      await database.exec('ALTER TABLE vehicles ADD COLUMN user_id TEXT');
    }
  }

  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_user_created
      ON vehicles (user_id, created_at DESC);
  `);
}

/**
 * Removes rows that cannot belong to a real account:
 *
 *  - pre-account vehicles with no owner at all;
 *  - vehicles from the old first-account migration whose timestamps are
 *    earlier than the account itself.
 *
 * Neither group is safe to show to any user. Diagnosis snapshots are deleted
 * with them, and the old one-time claim marker is removed so an ancient
 * deployment cannot resurrect the behaviour.
 */
async function purgeLegacyVehicles(): Promise<void> {
  const removed = await database.transaction(async (tx) => {
    const unowned = await tx.query<{ id: string }>(
      'SELECT id FROM vehicles WHERE user_id IS NULL'
    );
    const inherited = await tx.query<{ id: string }>(
      `SELECT v.id
         FROM vehicles v
         JOIN users u ON u.id = v.user_id
        WHERE v.created_at < u.created_at`
    );

    const ids = Array.from(new Set([...unowned.rows, ...inherited.rows].map((row) => row.id)));
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      await tx.query(
        `DELETE FROM diagnosis_records WHERE vehicle_id IN (${placeholders})`,
        ids
      );
      await tx.query(`DELETE FROM vehicles WHERE id IN (${placeholders})`, ids);
    }

    // Older builds could leave diagnosis rows behind if a vehicle was deleted
    // outside the normal API path.
    await tx.query(
      `DELETE FROM diagnosis_records
        WHERE NOT EXISTS (
          SELECT 1 FROM vehicles WHERE vehicles.id = diagnosis_records.vehicle_id
        )`
    );
    await tx.query("DELETE FROM meta WHERE key = 'legacy_vehicles_claimed'");

    return {
      unowned: unowned.rows.length,
      inherited: inherited.rows.length,
      total: ids.length,
    };
  });

  if (removed.total > 0) {
    console.log(
      `Purged ${removed.total} unowned or inherited vehicle(s) and their diagnosis history ` +
        `(${removed.unowned} unowned, ${removed.inherited} inherited).`
    );
  }
}

async function getMeta(key: string): Promise<string | null> {
  const { rows } = await database.query<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

async function setMeta(tx: QueryExecutor, key: string, value: string): Promise<void> {
  await tx.query(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

async function syncCatalog(): Promise<void> {
  if ((await getMeta('catalog_version')) === CATALOG_VERSION) return;

  await database.transaction(async (tx) => {
    // Diagnosis history stores a snapshot of its matches, so replacing the
    // catalog does not invalidate previous records.
    await tx.query('DELETE FROM symptoms');
    await tx.query('DELETE FROM causes');
    await tx.query('DELETE FROM repair_guides');

    for (const guide of REPAIR_GUIDES) {
      await tx.query(
        `INSERT INTO repair_guides
           (id, title, vehicle_types, category, difficulty, estimated_minutes, tools_needed, steps)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guide.id,
          guide.title,
          JSON.stringify(guide.vehicleTypes),
          guide.category,
          guide.difficulty,
          guide.estimatedMinutes,
          JSON.stringify(guide.toolsNeeded),
          JSON.stringify(guide.steps),
        ]
      );
    }

    for (const cause of CAUSES) {
      await tx.query(
        `INSERT INTO causes (id, label, severity, vehicle_types, repair_guide_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          cause.id,
          cause.label,
          cause.severity,
          JSON.stringify(cause.vehicleTypes),
          cause.repairGuideId,
        ]
      );
    }

    for (const symptom of SYMPTOMS) {
      await tx.query(
        `INSERT INTO symptoms (id, label, category, vehicle_types, cause_ids)
         VALUES (?, ?, ?, ?, ?)`,
        [
          symptom.id,
          symptom.label,
          symptom.category,
          JSON.stringify(symptom.vehicleTypes),
          JSON.stringify(symptom.causeIds),
        ]
      );
    }

    await setMeta(tx, 'catalog_version', CATALOG_VERSION);
  });

  console.log(
    `Catalog synced (${CATALOG_VERSION}): ${SYMPTOMS.length} symptoms, ${CAUSES.length} causes, ${REPAIR_GUIDES.length} repair guides.`
  );
}

/**
 * Give a brand-new account the same two example vehicles the demo app has
 * always started with. They belong to that user only and can be deleted.
 */
async function seedExampleVehiclesForUser(
  tx: QueryExecutor,
  userId: string
): Promise<void> {
  const { rows } = await tx.query<{ count: string | number }>(
    'SELECT COUNT(*) AS count FROM vehicles WHERE user_id = ?',
    [userId]
  );
  if (Number(rows[0]?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  await tx.query(
    `INSERT INTO vehicles (id, user_id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), userId, 'car', 'The Daily', 'Toyota', 'Corolla', 2016, 78_500, now]
  );
  await tx.query(
    `INSERT INTO vehicles (id, user_id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), userId, 'motorcycle', 'Weekend Bike', 'Honda', 'CB500F', 2020, 9_200, now]
  );
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

export async function createUser(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<User> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const email = input.email.toLowerCase();

  await database.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO users (id, email, display_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, email, input.displayName, input.passwordHash, createdAt]
    );

    await seedExampleVehiclesForUser(tx, id);
  });

  return { id, email, displayName: input.displayName, createdAt };
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { rows } = await database.query<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] ? parseUserRow(rows[0]) : undefined;
}

export async function getUserCredentialsByEmail(
  email: string
): Promise<{ user: User; passwordHash: string } | undefined> {
  const { rows } = await database.query<UserRow>(
    'SELECT * FROM users WHERE LOWER(email) = ?',
    [email.toLowerCase()]
  );
  return rows[0]
    ? { user: parseUserRow(rows[0]), passwordHash: rows[0].password_hash }
    : undefined;
}

export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: string }> {
  await cleanupExpiredSessions();

  const token = `tds_${randomBytes(32).toString('base64url')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await database.query(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hashSessionToken(token), userId, now.toISOString(), expiresAt, now.toISOString()]
  );

  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string): Promise<User | undefined> {
  if (!token.startsWith('tds_')) return undefined;

  const now = new Date().toISOString();
  const { rows } = await database.query<UserRow>(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashSessionToken(token), now]
  );

  return rows[0] ? parseUserRow(rows[0]) : undefined;
}

export async function revokeSession(token: string): Promise<void> {
  if (!token.startsWith('tds_')) return;
  await database.query('DELETE FROM sessions WHERE token_hash = ?', [
    hashSessionToken(token),
  ]);
}

export async function cleanupExpiredSessions(): Promise<void> {
  await database.query('DELETE FROM sessions WHERE expires_at <= ?', [
    new Date().toISOString(),
  ]);
}

// ---- catalog -----------------------------------------------------------

export async function getAllSymptoms(): Promise<Symptom[]> {
  const { rows } = await database.query<SymptomRow>(
    'SELECT * FROM symptoms ORDER BY category, label'
  );
  return rows.map(parseSymptomRow);
}

export async function getSymptomsForVehicleType(
  vehicleType: VehicleType
): Promise<Symptom[]> {
  return (await getAllSymptoms()).filter((symptom) =>
    symptom.vehicleTypes.includes(vehicleType)
  );
}

export async function getAllCauses(): Promise<Cause[]> {
  const { rows } = await database.query<CauseRow>('SELECT * FROM causes ORDER BY label');
  return rows.map(parseCauseRow);
}

export async function getAllRepairGuides(): Promise<RepairGuide[]> {
  const { rows } = await database.query<RepairGuideRow>(
    'SELECT * FROM repair_guides ORDER BY title'
  );
  return rows.map(parseRepairGuideRow);
}

export async function getRepairGuidesForVehicleType(
  vehicleType: VehicleType
): Promise<RepairGuide[]> {
  return (await getAllRepairGuides()).filter((guide) =>
    guide.vehicleTypes.includes(vehicleType)
  );
}

export async function getRepairGuideById(id: string): Promise<RepairGuide | undefined> {
  const { rows } = await database.query<RepairGuideRow>(
    'SELECT * FROM repair_guides WHERE id = ?',
    [id]
  );
  return rows[0] ? parseRepairGuideRow(rows[0]) : undefined;
}

// ---- vehicles ----------------------------------------------------------

export async function listVehicles(userId: string): Promise<Vehicle[]> {
  const { rows } = await database.query<VehicleRow>(
    'SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(parseVehicleRow);
}

export async function getVehicleById(
  id: string,
  userId: string
): Promise<Vehicle | undefined> {
  const { rows } = await database.query<VehicleRow>(
    'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] ? parseVehicleRow(rows[0]) : undefined;
}

export interface NewVehicleInput {
  type: VehicleType;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export async function createVehicle(
  input: NewVehicleInput,
  userId: string
): Promise<Vehicle> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await database.query(
    `INSERT INTO vehicles (id, user_id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.type,
      input.nickname,
      input.make,
      input.model,
      input.year,
      input.mileage,
      createdAt,
    ]
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
export async function updateVehicle(
  id: string,
  patch: VehiclePatch,
  userId: string
): Promise<Vehicle | undefined> {
  const existing = await getVehicleById(id, userId);
  if (!existing) return undefined;

  const next = {
    type: patch.type ?? existing.type,
    nickname: patch.nickname === undefined ? existing.nickname : patch.nickname,
    make: patch.make ?? existing.make,
    model: patch.model ?? existing.model,
    year: patch.year ?? existing.year,
    mileage: patch.mileage ?? existing.mileage,
  };

  await database.query(
    `UPDATE vehicles
        SET type = ?, nickname = ?, make = ?, model = ?, year = ?, mileage = ?
      WHERE id = ? AND user_id = ?`,
    [
      next.type,
      next.nickname,
      next.make,
      next.model,
      next.year,
      next.mileage,
      id,
      userId,
    ]
  );

  return getVehicleById(id, userId);
}

/** Deletes a vehicle and its diagnosis history in one transaction. */
export async function deleteVehicle(id: string, userId: string): Promise<boolean> {
  if (!(await getVehicleById(id, userId))) return false;

  await database.transaction(async (tx) => {
    // Explicit delete rather than relying on ON DELETE CASCADE: older SQLite
    // tables were created before the cascade was added.
    await tx.query('DELETE FROM diagnosis_records WHERE vehicle_id = ?', [id]);
    await tx.query('DELETE FROM vehicles WHERE id = ? AND user_id = ?', [id, userId]);
  });
  return true;
}

// ---- diagnosis history -------------------------------------------------

export async function recordDiagnosis(
  vehicleId: string,
  userId: string,
  source: DiagnosisSource,
  symptomIds: string[],
  matches: DiagnosisMatch[]
): Promise<DiagnosisRecord | undefined> {
  // Keep the ownership check in the data layer as well as the route. A future
  // caller cannot accidentally attach a diagnosis to somebody else's vehicle.
  if (!(await getVehicleById(vehicleId, userId))) return undefined;

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await database.query(
    `INSERT INTO diagnosis_records (id, vehicle_id, source, symptom_ids, matches, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, source, JSON.stringify(symptomIds), JSON.stringify(matches), createdAt]
  );

  return { id, vehicleId, source, symptomIds, matches, createdAt };
}

export async function getDiagnosisById(
  id: string,
  userId: string
): Promise<DiagnosisRecord | undefined> {
  const { rows } = await database.query<DiagnosisRecordRow>(
    `SELECT d.*
       FROM diagnosis_records d
       JOIN vehicles v ON v.id = d.vehicle_id
      WHERE d.id = ? AND v.user_id = ?`,
    [id, userId]
  );
  return rows[0] ? parseDiagnosisRecordRow(rows[0]) : undefined;
}

export async function getDiagnosisHistoryForVehicle(
  vehicleId: string,
  userId: string,
  limit = 100
): Promise<DiagnosisRecord[]> {
  const { rows } = await database.query<DiagnosisRecordRow>(
    `SELECT d.*
       FROM diagnosis_records d
       JOIN vehicles v ON v.id = d.vehicle_id
      WHERE d.vehicle_id = ? AND v.user_id = ?
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ?`,
    [vehicleId, userId, limit]
  );
  return rows.map(parseDiagnosisRecordRow);
}

// ---- profile -----------------------------------------------------------

export interface ProfileActivity {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleType: VehicleType;
  source: DiagnosisSource;
  createdAt: string;
  symptomCount: number;
  topCause: {
    label: string;
    severity: Cause['severity'];
    confidence: number;
  } | null;
}

export interface ProfileOverview {
  status: 'new' | 'active' | 'idle';
  stats: {
    assets: number;
    vehicles: number;
    machines: number;
    diagnoses: number;
    diagnosesThisMonth: number;
    lastDiagnosisAt: string | null;
  };
  latestActivity: ProfileActivity | null;
  recentActivity: ProfileActivity[];
}

interface ProfileActivityRow {
  id: string;
  vehicle_id: string;
  source: string;
  symptom_ids: string;
  matches: string;
  created_at: string;
  nickname: string | null;
  make: string;
  model: string;
  vehicle_type: string;
}

function parseProfileActivity(row: ProfileActivityRow): ProfileActivity {
  const matches = parseJson<unknown[]>(row.matches, [])
    .map(parseMatch)
    .filter((match): match is DiagnosisMatch => match !== null);
  const top = matches[0];

  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.nickname?.trim() || `${row.make} ${row.model}`,
    vehicleType: row.vehicle_type as VehicleType,
    source: row.source as DiagnosisSource,
    createdAt: row.created_at,
    symptomCount: parseJson<string[]>(row.symptom_ids, []).length,
    topCause: top
      ? {
          label: top.cause.label,
          severity: top.cause.severity,
          confidence: top.confidence,
        }
      : null,
  };
}

/**
 * Account dashboard data. Everything is derived from the same account-scoped
 * vehicles and diagnosis history used by the rest of the API, so a profile can
 * never leak another user's activity.
 */
export async function getProfileOverview(
  userId: string,
  recentLimit = 8
): Promise<ProfileOverview> {
  const vehicles = await listVehicles(userId);
  const [totalRows, monthRows, activityRows] = await Promise.all([
    database.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
         FROM diagnosis_records d
         JOIN vehicles v ON v.id = d.vehicle_id
        WHERE v.user_id = ?`,
      [userId]
    ),
    database.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
         FROM diagnosis_records d
         JOIN vehicles v ON v.id = d.vehicle_id
        WHERE v.user_id = ? AND d.created_at >= ?`,
      [userId, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()]
    ),
    database.query<ProfileActivityRow>(
      `SELECT d.id, d.vehicle_id, d.source, d.symptom_ids, d.matches, d.created_at,
              v.nickname, v.make, v.model, v.type AS vehicle_type
         FROM diagnosis_records d
         JOIN vehicles v ON v.id = d.vehicle_id
        WHERE v.user_id = ?
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT ?`,
      [userId, recentLimit]
    ),
  ]);

  const recentActivity = activityRows.rows.map(parseProfileActivity);
  const diagnoses = Number(totalRows.rows[0]?.count ?? 0);
  const lastDiagnosisAt = recentActivity[0]?.createdAt ?? null;
  const latestAge = lastDiagnosisAt ? Date.now() - new Date(lastDiagnosisAt).getTime() : null;

  return {
    status:
      diagnoses === 0
        ? 'new'
        : latestAge !== null && latestAge <= 7 * 24 * 60 * 60 * 1_000
          ? 'active'
          : 'idle',
    stats: {
      assets: vehicles.length,
      vehicles: vehicles.filter((vehicle) => !isMachineType(vehicle.type)).length,
      machines: vehicles.filter((vehicle) => isMachineType(vehicle.type)).length,
      diagnoses,
      diagnosesThisMonth: Number(monthRows.rows[0]?.count ?? 0),
      lastDiagnosisAt,
    },
    latestActivity: recentActivity[0] ?? null,
    recentActivity,
  };
}

/** Stable, non-secret referral code derived from the account id. */
export function getReferralCode(userId: string): string {
  const digest = createHash('sha256')
    .update(`torquedoc-referral:${userId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `TD-${digest.slice(0, 4)}-${digest.slice(4)}`;
}

// ---- lifecycle / diagnostics ------------------------------------------

export async function checkDatabase(): Promise<void> {
  await database.healthCheck();
}

export async function closeDb(): Promise<void> {
  await database.close();
}

/**
 * Escape hatch for maintenance scripts and integration tests that need to
 * create a specific pre-migration row. It is not exposed through Express.
 */
export async function executeSql<T = Record<string, unknown>>(
  sql: string,
  params: SqlParameter[] = []
): Promise<T[]> {
  const { rows } = await database.query<T>(sql, params);
  return rows;
}

export const databaseTarget = database.target;
export const databaseDialect: Database['dialect'] = database.dialect;
