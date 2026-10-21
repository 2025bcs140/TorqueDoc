import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Centralised, validated configuration.
 *
 * Everything that reads `process.env` should do it here rather than at the
 * point of use. That keeps defaults, types and validation in one place and
 * makes the server fail loudly (or degrade predictably) when something is
 * misconfigured.
 *
 * `backend/` is the project root. Relative `DB_PATH` values are resolved
 * against it, not against whatever directory the process happened to start
 * in, so `npm run dev` and `node dist/index.js` behave the same way.
 */
const BACKEND_ROOT = path.resolve(__dirname, '..');

// Load backend/.env regardless of the shell's current directory. Existing
// process environment variables still win, which is what the tests rely on.
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

const rawDbPath = readString('DB_PATH', 'torquedoc.db');
const dbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(BACKEND_ROOT, rawDbPath);

/**
 * Reject obvious placeholders (for example the `sk-ant` value shipped in
 * `.env.example`) so the AI endpoints return a helpful 503 instead of
 * forwarding a guaranteed-401 request to Anthropic.
 */
const rawApiKey = readString('ANTHROPIC_API_KEY', '');
const anthropicApiKey =
  rawApiKey.startsWith('sk-ant-') && rawApiKey.length >= 20 ? rawApiKey : null;

export const config = {
  env: readString('NODE_ENV', 'development'),
  backendRoot: BACKEND_ROOT,
  port: readInt('PORT', 3000, 0, 65535),
  dbPath,

  anthropicApiKey,
  anthropicModel: readString('ANTHROPIC_MODEL', 'claude-sonnet-5-5'),
  aiTimeoutMs: readInt('AI_TIMEOUT_MS', 60_000, 5_000, 180_000),

  maxUploadMb: readInt('MAX_UPLOAD_MB', 30, 1, 200),
  corsOrigin: readString('CORS_ORIGIN', '*'),
  logRequests: readString('LOG_REQUESTS', 'true') !== 'false',
} as const;

export const MAX_UPLOAD_BYTES = config.maxUploadMb * 1024 * 1024;
