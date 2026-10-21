# TorqueDoc backend

Express 5 + TypeScript API that owns the SQLite database, the diagnosis rule
engine, and both Claude-powered features. The Anthropic key lives only here and
is never sent to the mobile app.

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
# edit .env: add ANTHROPIC_API_KEY (optional)
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
| `ANTHROPIC_API_KEY` | empty | Enables both AI endpoints. Placeholder values are rejected. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Any Messages-API model id. |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout, clamped to 5s–180s. |
| `MAX_UPLOAD_MB` | `30` | Multer file-size limit. Photos are additionally capped at 5 MB for the vision API. |
| `CORS_ORIGIN` | `*` | `*` or a comma-separated allow-list. |
| `LOG_REQUESTS` | `true` | Set `false` for silent tests/benchmarks. |

`backend/.env` and the database files are gitignored. Do not commit real keys.

## Architecture in one paragraph

`index.ts` calls `initDb()` then `createApp()` and listens. `createApp()` is also
imported by the integration tests, which run the real app on an ephemeral port
against a throwaway database. Routes contain only HTTP parsing/validation; all
SQL lives in `db.ts`, and the ranking logic is a pure function in
`services/diagnosisEngine.ts`. That pure function takes a catalog snapshot, so
it can be tested without a database. AI routes use `services/anthropicClient.ts`,
which owns the timeout, retry, JSON extraction, and key handling.

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

The tests do **not** call Anthropic and do not require ffmpeg. The test files
run in separate processes, so the DB path environment variable is set before
importing the app.

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
`ANTHROPIC_API_KEY` is missing or is still the placeholder. Paste a real
`sk-ant-…` key and restart the backend.

**AI returns 502**
Check the backend console. Common causes are an invalid key, no billing/credit,
an unavailable model id, or a timeout. The message is forwarded from Anthropic
without the key.

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

- No authentication or rate limiting. Treat this as a trusted-LAN service.
- Do not expose port 3000 to the internet. If you must, put it behind TLS and
  add auth, per-user ownership, and AI rate limits first (see
  `docs/ARCHITECTURE.md`).
- Request logs do not include bodies or headers, so keys and uploads are not
  written to the console.
- Uploaded media is processed in memory/temp files and is not persisted.
- Error responses hide internal messages in production (`NODE_ENV=production`).
