import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
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

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    nickname TEXT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    mileage INTEGER NOT NULL,
    created_at TEXT NOT NULL
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
 * Creates the schema, synchronises the catalog when its version changes, and
 * seeds the two example vehicles exactly once for a brand-new database.
 * Safe to call more than once.
 */
export function initDb(): void {
  db.exec(SCHEMA);
  syncCatalog();
  seedExampleVehiclesOnce();

  console.log(`Database ready at ${path.relative(config.backendRoot, config.dbPath) || config.dbPath}`);
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

function seedExampleVehiclesOnce(): void {
  if (getMeta('example_vehicles_seeded') === '1') return;

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM vehicles').get() as { count: number };
  if (count === 0) {
    withTransaction(() => {
      const insert = db.prepare(
        `INSERT INTO vehicles (id, type, nickname, make, model, year, mileage, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const now = new Date().toISOString();
      insert.run(randomUUID(), 'car', 'The Daily', 'Toyota', 'Corolla', 2016, 78_500, now);
      insert.run(randomUUID(), 'motorcycle', 'Weekend Bike', 'Honda', 'CB500F', 2020, 9_200, now);
    });
    console.log('Seeded 2 example vehicles (delete them from the app whenever you like).');
  }

  // Set even when vehicles already existed (e.g. an older database), so the
  // examples never reappear after the user deletes every vehicle.
  setMeta('example_vehicles_seeded', '1');
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

export function listVehicles(): Vehicle[] {
  const rows = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all() as unknown as VehicleRow[];
  return rows.map(parseVehicleRow);
}

export function getVehicleById(id: string): Vehicle | undefined {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow | undefined;
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

export function createVehicle(input: NewVehicleInput): Vehicle {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO vehicles (id, type, nickname, make, model, year, mileage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
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
export function updateVehicle(id: string, patch: VehiclePatch): Vehicle | undefined {
  const existing = getVehicleById(id);
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

  return getVehicleById(id);
}

/** Deletes a vehicle and its diagnosis history in one transaction. */
export function deleteVehicle(id: string): boolean {
  if (!getVehicleById(id)) return false;

  withTransaction(() => {
    // Explicit delete rather than relying on ON DELETE CASCADE: the
    // diagnosis_records table was created before cascade was added, and
    // SQLite cannot add a foreign-key action to an existing table.
    db.prepare('DELETE FROM diagnosis_records WHERE vehicle_id = ?').run(id);
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
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

export function getDiagnosisById(id: string): DiagnosisRecord | undefined {
  const row = db.prepare('SELECT * FROM diagnosis_records WHERE id = ?').get(id) as
    | DiagnosisRecordRow
    | undefined;
  return row ? parseDiagnosisRecordRow(row) : undefined;
}

export function getDiagnosisHistoryForVehicle(vehicleId: string, limit = 100): DiagnosisRecord[] {
  const rows = db
    .prepare(
      'SELECT * FROM diagnosis_records WHERE vehicle_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?'
    )
    .all(vehicleId, limit) as unknown as DiagnosisRecordRow[];
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
