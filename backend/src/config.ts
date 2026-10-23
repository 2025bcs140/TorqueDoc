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
 * Reject obvious placeholders (for example the values shipped in
 * `.env.example`) so the AI endpoints return a helpful 503 instead of
 * forwarding a guaranteed-401 request upstream.
 *
 * Cloudflare account ids are 32 hex characters. API tokens are longer; the
 * placeholder prefixes are rejected so a copied `.env.example` cannot make
 * `/health` claim that AI is ready.
 */
const rawAnthropicApiKey = readString('ANTHROPIC_API_KEY', '');
const anthropicApiKey =
  rawAnthropicApiKey.startsWith('sk-ant-') && rawAnthropicApiKey.length >= 20
    ? rawAnthropicApiKey
    : null;

const rawCloudflareAccountId = readString('CLOUDFLARE_ACCOUNT_ID', '');
const cloudflareAccountId = /^[a-f0-9]{32}$/i.test(rawCloudflareAccountId)
  ? rawCloudflareAccountId
  : null;

const rawCloudflareApiToken = readString('CLOUDFLARE_API_TOKEN', '');
const cloudflareApiToken =
  rawCloudflareApiToken.length >= 20 && !/^(your|replace|changeme)/i.test(rawCloudflareApiToken)
    ? rawCloudflareApiToken
    : null;

const cloudflareModel = readString(
  'CLOUDFLARE_MODEL',
  '@cf/mistralai/mistral-small-3.1-24b-instruct'
);
const cloudflareVisionModel = readString('CLOUDFLARE_VISION_MODEL', cloudflareModel);
const anthropicModel = readString('ANTHROPIC_MODEL', 'claude-sonnet-5-5');

/** Cloudflare is preferred when both credentials are present. */
const aiProvider: 'cloudflare' | 'anthropic' | null =
  cloudflareAccountId && cloudflareApiToken
    ? 'cloudflare'
    : anthropicApiKey
      ? 'anthropic'
      : null;

/**
 * Optional shared key for any internet-facing deployment. When set, every
 * route except `/` and `/health` requires `X-TorqueDoc-Key` (or a Bearer
 * token). It is not a replacement for per-user accounts, but it stops a
 * public URL from being an open proxy to the configured AI provider.
 */
const apiAccessToken = readString('API_ACCESS_TOKEN', '');
if (apiAccessToken.length > 0 && apiAccessToken.length < 16) {
  throw new Error('API_ACCESS_TOKEN must be at least 16 characters when set');
}

export const config = {
  env: readString('NODE_ENV', 'development'),
  backendRoot: BACKEND_ROOT,
  port: readInt('PORT', 3000, 0, 65535),
  dbPath,

  anthropicApiKey,
  anthropicModel,

  cloudflareAccountId,
  cloudflareApiToken,
  cloudflareApiBaseUrl: readString(
    'CLOUDFLARE_API_BASE_URL',
    'https://api.cloudflare.com/client/v4'
  ),
  cloudflareModel,
  cloudflareVisionModel,

  aiProvider,
  aiModel:
    aiProvider === 'cloudflare'
      ? cloudflareModel
      : aiProvider === 'anthropic'
        ? anthropicModel
        : null,
  aiConfigured: aiProvider !== null,
  aiTimeoutMs: readInt('AI_TIMEOUT_MS', 60_000, 5_000, 180_000),

  maxUploadMb: readInt('MAX_UPLOAD_MB', 30, 1, 200),
  corsOrigin: readString('CORS_ORIGIN', '*'),
  logRequests: readString('LOG_REQUESTS', 'true') !== 'false',

  apiAccessToken,
  trustProxy: readString('TRUST_PROXY', 'false') === 'true',
  rateLimitPerMinute: readInt('RATE_LIMIT_PER_MINUTE', 240, 10, 10_000),
  aiRateLimitPerMinute: readInt('AI_RATE_LIMIT_PER_MINUTE', 10, 1, 1_000),
} as const;

export const MAX_UPLOAD_BYTES = config.maxUploadMb * 1024 * 1024;
