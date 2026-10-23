# TorqueDoc backend

Express 5 + TypeScript API that owns the SQLite database, the diagnosis rule
engine, and both AI-assisted features. The Cloudflare Workers AI credentials
(or optional Anthropic key) live only here and are never sent to the mobile app.

For the full endpoint reference see [`../docs/API.md`](../docs/API.md). For design
decisions and trade-offs see [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Requirements

- **Node.js 22.5+** (Node 24 LTS recommended). This project uses the built-in
  `node:sqlite` module, which does not exist in older Node versions.
- **ffmpeg and ffprobe on `PATH`** — only for video analysis. Photo analysis and
  every non-AI feature work without it.
  - Windows: `winget install Gyan.FFmpeg`, then reopen the terminal.
  - macOS: `brew install ffmpeg`
  - Debian/Ubuntu: `sudo apt install ffmpeg`

## Setup

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (optional)
npm run dev                 # http://localhost:3000
```

`npm run dev` runs `tsx watch`, so edits restart the server automatically. The
server binds to `0.0.0.0` so a phone on the same network can reach it.

On startup it logs:

- the database path,
- whether AI is configured (and which model),
- whether ffmpeg/ffprobe were found.

`GET /health` exposes the same capability information as JSON.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Watch mode with `tsx`. |
| `npm start` | Run once with `tsx` (no watch). |
| `npm run typecheck` | `tsc --noEmit` with strict mode. |
| `npm run build` | Compile to `dist/`. |
| `npm run serve` | Run the compiled `dist/index.js`. |
| `npm test` | Unit + API integration tests using `node:test`. |

## Configuration

All configuration is read in `src/config.ts` and validated at startup. The
backend loads `backend/.env` even when the process is started from a different
directory; values already present in the process environment take precedence.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | `0` lets the OS choose (tests use this). |
| `DB_PATH` | `./torquedoc.db` | Relative paths resolve from `backend/`, not the shell's cwd. |
| `CLOUDFLARE_ACCOUNT_ID` | empty | 32-character Cloudflare account id. Enables both AI endpoints when paired with a token. |
| `CLOUDFLARE_API_TOKEN` | empty | Token with Workers AI access. Server-side only; placeholder values are rejected. |
| `CLOUDFLARE_MODEL` | `@cf/mistralai/mistral-small-3.1-24b-instruct` | Text and vision model id. |
| `CLOUDFLARE_VISION_MODEL` | same as `CLOUDFLARE_MODEL` | Optional separate vision model. Llama 3.2 Vision uses a single image; Mistral accepts multiple frames. |
| `CLOUDFLARE_API_BASE_URL` | `https://api.cloudflare.com/client/v4` | Normally leave unchanged; useful for a mock server in tests. |
| `ANTHROPIC_API_KEY` | empty | Optional legacy fallback. Cloudflare is preferred when both are configured. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Any Anthropic Messages-API model id. |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout, clamped to 5s–180s. |
| `MAX_UPLOAD_MB` | `30` | Multer file-size limit. Photos are additionally capped at 5 MB for the vision API. |
| `CORS_ORIGIN` | `*` | `*` or a comma-separated allow-list. |
| `LOG_REQUESTS` | `true` | Set `false` for silent tests/benchmarks. |
| `API_ACCESS_TOKEN` | empty | Optional shared key for public deployments. When set, all routes except `/` and `/health` require `X-TorqueDoc-Key` or `Authorization: Bearer`. |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so rate limiting sees the real client IP. |
| `RATE_LIMIT_PER_MINUTE` | `240` | Per-IP request cap. |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | Per-IP cap for `/v1/*`. |

`backend/.env` and the database files are gitignored. Do not commit real keys.
For a Docker/Render deployment see [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

Cloudflare Workers AI is the recommended free provider: the Workers Free plan
includes 10,000 Neurons/day with no credit card, and Cloudflare documents zero
retention for standard inference plus no training on submitted Customer Content.
Create an API token with Workers AI access. Missing credentials produce a clear
`503 AI_NOT_CONFIGURED`; the checklist, garage and library keep working.

## Architecture in one paragraph

`index.ts` calls `initDb()` then `createApp()` and listens. `createApp()` is also
imported by the integration tests, which run the real app on an ephemeral port
against a throwaway database. Routes contain only HTTP parsing/validation; all
SQL lives in `db.ts`, and the ranking logic is a pure function in
`services/diagnosisEngine.ts`. That pure function takes a catalog snapshot, so
it can be tested without a database. AI routes call `services/aiClient.ts`,
which selects Cloudflare Workers AI (preferred) or Anthropic. The provider
adapters own the timeout, retry, JSON extraction, and credential handling.

## Database and catalog

SQLite lives at `DB_PATH` (default `backend/torquedoc.db`). The schema is
created automatically with `CREATE TABLE IF NOT EXISTS`; there is no separate
migration command.

The seed catalog is in `src/data/catalog.ts`. It has a `CATALOG_VERSION`
constant:

- Change symptoms/causes/guides → **bump `CATALOG_VERSION`**.
- On the next start, the three catalog tables are replaced in one transaction.
- Diagnosis history stores a snapshot of its matches, so old records remain
  readable.
- Two example vehicles are seeded once, only for a brand-new database. Deleting
  them permanently sets a meta flag so they do not come back.

To start over completely, stop the server and delete `torquedoc.db` (plus any
`-wal`/`-shm` files). They are recreated on the next start.

## Testing

```bash
npm run typecheck
npm test
```

`test/catalog.test.ts` validates the seed content: unique ids, every symptom
pointing at a real cause, every cause pointing at a real guide, guide/cause
vehicle-type compatibility, and no cause without evidence for its types.

`test/diagnosisEngine.test.ts` covers the pure engine, including the regression
where motorcycle confidence incorrectly counted car-only symptoms.

`test/api.test.ts` starts the real app against a temporary database and covers:

- health and API index
- catalog filtering
- vehicle create/read/update/delete and validation
- diagnosis, history, and single-record fetch
- rejecting a vehicle whose type does not match
- deletion cascade
- malformed JSON and 404s
- AI endpoints returning `503 AI_NOT_CONFIGURED`
- media MIME/kind validation, missing files, the 5 MB photo cap, and the ffmpeg-unavailable video path

The tests do **not** call Cloudflare or Anthropic and do not require ffmpeg.
`test/cloudflareClient.test.ts` checks request mapping, response extraction and
the missing-credential error. The test files run in separate processes, so
environment variables are set before importing the app.

## Manual smoke test

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/vehicles
Invoke-RestMethod "http://localhost:3000/symptoms?vehicleType=motorcycle"

$body = @{
  vehicleType = 'car'
  symptomIds = @('s_rough_idle', 's_engine_stalls_idle')
} | ConvertTo-Json

Invoke-RestMethod http://localhost:3000/diagnose `
  -Method Post -ContentType 'application/json' -Body $body
```

## Troubleshooting

**`Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite`**
You are on Node < 22.5. Check `node --version` and upgrade.

**Port 3000 already in use**
Change `PORT` in `.env`, or stop the other process
(`Get-NetTCPConnection -LocalPort 3000` on Windows,
`lsof -i :3000` on macOS/Linux). Remember to update the app's base URL if you
change the port.

**App can't connect, but curl works locally**
The app is probably using `localhost` or a stale LAN IP. See the root README and
`app/README.md`. The backend must be reachable from the phone, not just from the
computer.

**AI returns 503 `AI_NOT_CONFIGURED`**
Neither provider is fully configured. Set `CLOUDFLARE_ACCOUNT_ID` (32 hex
characters) and `CLOUDFLARE_API_TOKEN` (a token with Workers AI access) and
restart the backend. Anthropic remains an optional fallback.

**AI returns 502**
Check the backend console. Common causes are an invalid Cloudflare token, a
token without Workers AI permission, a model unavailable on your plan, a daily
Neuron limit, or a timeout. The upstream message is forwarded without the
credential.

**Video returns 503 `FFMPEG_NOT_FOUND`**
Install ffmpeg and verify **both** commands work in a new terminal:

```bash
ffmpeg -version
ffprobe -version
```

Restart the backend so the cached availability check is refreshed.

**Video returns 422**
The clip may be corrupt, too short, or use a codec ffmpeg cannot decode. Try an
MP4/MOV, or attach a photo.

## Security

- There are no user accounts. A public deployment is a **single shared garage
  and history**, even with `API_ACCESS_TOKEN` set.
- `API_ACCESS_TOKEN` plus per-IP rate limits are an abuse gate for a personal
  demo, not multi-user authentication. For multiple unrelated users, add login,
  per-user ownership, and a multi-instance rate limiter (Redis or the host's
  edge limiter) first.
- Run public deployments behind HTTPS. Render/Railway terminate TLS for you;
  a plain Docker host needs a reverse proxy such as Caddy or nginx.
- Request logs do not include bodies or headers, so keys and uploads are not
  written to the console.
- Uploaded media is processed in memory/temp files and is not persisted.
- Error responses hide internal messages in production (`NODE_ENV=production`).
