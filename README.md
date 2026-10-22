# TorqueDoc

A vehicle diagnostic and repair assistant for cars and motorcycles. Describe a
problem — tick symptoms, write it in your own words, or attach a photo/video —
and get a ranked list of probable causes with a step-by-step repair guide.

Trailers are intentionally out of scope: they don't have an engine to diagnose
in this sense and would need a different inspection-checklist product.

```
┌─────────────────────────────┐        HTTP/JSON        ┌──────────────────────────────┐
│  app/ — Expo / React Native │  ────────────────────▶  │  backend/ — Express 5        │
│  Garage · Diagnose · Library│  ◀────────────────────  │  SQLite · rule engine · AI   │
└─────────────────────────────┘                         └──────────────┬───────────────┘
                                                                        │
                                                     ┌──────────────────┴─────────────────┐
                                                     │ Anthropic Claude (optional, server- │
                                                     │ side key only): free-text mapping   │
                                                     │ and photo/video visual inspection   │
                                                     └─────────────────────────────────────┘
```

The app holds no catalog data and no API keys. The backend owns the database,
the diagnosis rules, and both AI calls.

## What it does

- **Garage** — add, edit and delete cars and motorcycles; mileage is editable.
- **Diagnosis** — three input modes:
  - **Symptom checklist** — deterministic, explainable, no AI.
  - **Describe it in words** — Claude maps free text onto the fixed symptom
    taxonomy, then the same deterministic engine ranks causes.
  - **Photo / video** — Claude inspects a photo or three sampled video frames
    for visual clues, maps them to symptoms, then the rule engine ranks causes.
- **Ranked causes** — each result shows severity, the share of that cause's
  known signs you reported, and exactly which signs matched. No black-box
  probability score.
- **Repair guides** — tools, realistic time estimate, difficulty, numbered
  steps with a local step-progress checklist.
- **History** — every run against a saved vehicle is persisted and can be
  reopened later. Deleting a vehicle deletes its history.
- **OBD-II Bluetooth** — deliberately a disabled placeholder; see Roadmap.

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo SDK 54, React Native 0.81, TypeScript | Expo Go on the public app stores runs SDK 54; this project is pinned to it so a QR-code scan works. Newer SDKs need a sideloaded Expo Go or a developer build. |
| Navigation | React Navigation 7 (native stack + tabs) | Small, typed, no file-based routing magic. |
| API | Express 5 + TypeScript | Boring, well understood, and Express 5 forwards async errors automatically. |
| Database | Node's built-in `node:sqlite` | No native binary to download at install time — the failure mode that broke the earlier scaffold. Requires **Node 22.5+**. |
| AI | Anthropic Messages API via `fetch` | No SDK dependency. The key lives only in `backend/.env`. |
| Video | System `ffmpeg` / `ffprobe` | Samples frames server-side; Claude does not accept video directly. Photo analysis does not need ffmpeg. |

## Quickstart

Prerequisites: **Node.js 22.5+** (Node 24 works), npm, and — only for video
analysis — **ffmpeg** on `PATH`.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env and add ANTHROPIC_API_KEY (optional; everything else works without it)
npm run dev                   # http://localhost:3000
```

```bash
# 2. App, in a separate terminal
cd app
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: use the hosted URL or http://<your-LAN-IP>:3000
npx expo start
```

Then scan the QR code with Expo Go, or press `i` / `a` for a simulator.

### Hosted backend (recommended) or same Wi-Fi?

A hosted backend lets Expo Go work anywhere, not only on the same Wi-Fi as the
development machine. This repository includes a Render Blueprint and a Docker
image; the reviewed API for this copy is live at
`https://torquedoc-api.onrender.com`. Deployment steps, costs, and the free-plan
persistence caveat are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Point the app at it in `app/.env`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://torquedoc-api.onrender.com
EXPO_PUBLIC_API_ACCESS_TOKEN=<the backend API_ACCESS_TOKEN>
```

For local development instead, run `npm run dev` in `backend/` and use the
computer's active IPv4 address (Windows `ipconfig`, macOS
`ipconfig getifaddr en0`, Linux `hostname -I`), not `localhost`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
```

Expo Go runs on the phone, so `localhost` would point at the phone itself. Both
devices must be on the same network, and the firewall must allow Node on port
3000. Restart Expo after editing `.env`; `EXPO_PUBLIC_*` values are inlined at
bundle time. If the app cannot reach the backend, it shows the exact base URL it
tried.

## Configuration

Backend (`backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | API port. |
| `DB_PATH` | `./torquedoc.db` | SQLite file. Relative paths resolve from `backend/`. |
| `ANTHROPIC_API_KEY` | — | Enables both AI endpoints. Placeholders are rejected. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Claude model id. |
| `AI_TIMEOUT_MS` | `60000` | Anthropic request timeout. |
| `MAX_UPLOAD_MB` | `30` | Overall photo/video upload limit; photos are capped at 5 MB by the vision API. |
| `CORS_ORIGIN` | `*` | `*` or a comma-separated origin allow-list. |
| `LOG_REQUESTS` | `true` | One-line request log. |
| `API_ACCESS_TOKEN` | — | Optional shared key for public deployments. Requires `X-TorqueDoc-Key` on every route except `/` and `/health`. |
| `TRUST_PROXY` | `false` | Set `true` behind Render/Railway so rate limiting sees the real client IP. |
| `RATE_LIMIT_PER_MINUTE` | `240` | Per-IP request cap. |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | Per-IP cap for the AI endpoints. |

App (`app/.env`):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend base URL reachable from the phone. |
| `EXPO_PUBLIC_API_ACCESS_TOKEN` | Must match the backend's `API_ACCESS_TOKEN` when configured. Bundled into the app, so it is an abuse gate, not user authentication. |

## API at a glance

Full reference with request/response examples: [`docs/API.md`](docs/API.md).

```
GET    /health
GET    /vehicles
POST   /vehicles
GET    /vehicles/:id
PATCH  /vehicles/:id
DELETE /vehicles/:id
GET    /vehicles/:id/history?limit=100
GET    /symptoms?vehicleType=car|motorcycle
GET    /repair-guides?vehicleType=car|motorcycle
GET    /repair-guides/:id
GET    /catalog
POST   /diagnose
GET    /diagnoses/:id
POST   /v1/symptoms/interpret       (AI)
POST   /v1/media/analyze            (AI, multipart)
```

All errors use `{ "error": "human-readable", "code": "MACHINE_CODE", "details"?: … }`.
The AI endpoints return `503 AI_NOT_CONFIGURED` when no valid key is set, and
`502 AI_REQUEST_FAILED` when Anthropic rejects or times out. Video analysis
reports `503 FFMPEG_NOT_FOUND` before the AI step if ffmpeg is missing.

## How the diagnosis engine works

Each symptom in the catalog lists the causes it can indicate. Each cause lists
the repair guide. The engine:

1. Filters symptoms and causes to those that apply to the vehicle type.
2. For each cause, finds its linked symptoms **for that vehicle type**.
3. `confidence` = matched linked symptoms / total linked symptoms.
4. Keeps causes with at least one match and sorts by confidence, then number
   of matched signs, then severity, then label.

This is intentionally coverage, not probability. A cause with one known sign
can reach 100% from a single checkbox, so the UI always shows **"2 of 3
signs"** next to the percentage. The engine is pure and unit-tested without a
database. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the trade-offs
and why the earlier version's vehicle-type bug mattered.

## Testing and verification

```bash
cd backend
npm run typecheck
npm test          # 29 tests: engine, catalog integrity, real API on a throwaway DB
```

```bash
cd app
npm run typecheck
npx expo-doctor
```

The backend integration tests start the real Express app on an ephemeral port
with a temporary SQLite file, exercise vehicle CRUD, catalog filtering,
diagnosis, history, validation, deletion cascades, AI-disabled behaviour and
upload validation, then clean up. They do **not** call Anthropic.

Live AI responses need your own `ANTHROPIC_API_KEY`; everything up to the
Anthropic request is covered by tests. Video analysis additionally needs
`ffmpeg`/`ffprobe`; `/health` reports whether they were found.

The app bundle can be checked without a device:

```bash
cd app
npx expo export --platform android
```

## Troubleshooting

**"Couldn't reach the TorqueDoc server at https://…"**
The app prints the exact URL. Check the hosted backend is awake and `/health`
returns 200. If you use a LAN backend instead, confirm the IP is the computer's
current address (not `localhost`), the port is included, both devices are on the
same Wi-Fi, and the firewall allows Node on port 3000.

**401 UNAUTHORIZED**
`EXPO_PUBLIC_API_ACCESS_TOKEN` does not match the backend's
`API_ACCESS_TOKEN`. Copy the exact value and restart Expo; public env values are
baked into the bundle.

**"Project is incompatible with this version of Expo Go"**
This project is pinned to SDK 54, the version the public-store Expo Go app
runs. If Expo Go still complains, force-close and update Expo Go, then confirm
`app/package.json` still has `"expo": "~54.0.37"`. Do not bump Expo without
checking which SDK the store build supports. `expo.dev/go` can supply a
specific SDK build as a sideload.

**Video analysis returns 503 `FFMPEG_NOT_FOUND`**
Install ffmpeg and make sure both `ffmpeg` and `ffprobe` are on `PATH`
(`winget install Gyan.FFmpeg` on Windows), then restart the backend. Photo
analysis is unaffected.

**AI returns 503 `AI_NOT_CONFIGURED`**
Put a real key in `backend/.env` and restart. The placeholder value from
`.env.example` is intentionally rejected.

**Database looks stale after editing the catalog**
The catalog is synchronised on startup using `CATALOG_VERSION` in
`backend/src/data/catalog.ts`. Bump that constant whenever you edit the seed
content. No delete-the-database step is needed.

**Metro/Babel dependency errors**
Run `npx expo install --fix` to snap packages to the SDK 54 set, then
`npx expo-doctor`. `babel-preset-expo` is intentionally an explicit
devDependency so npm hoists one shared copy.

## Deployment

The repository includes `render.yaml` (a Render Blueprint) and
`backend/Dockerfile` (Node 24 with ffmpeg). The reviewed public API for this
copy is live at `https://torquedoc-api.onrender.com`; `app/.env` points at it.
Step-by-step instructions, environment variables, persistence caveats, and EAS
build notes are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Security and privacy

- The Anthropic key is read only by the backend and is never bundled into the
  app or returned by an endpoint.
- A public deployment can require `API_ACCESS_TOKEN`, a shared key checked on
  every route except `/` and `/health`, plus per-IP rate limits. The app bundles
  the key, so this is an abuse gate, **not user authentication**.
- The API still has **one shared garage and history**. Do not invite multiple
  unrelated users until login and per-user ownership are added.
- Render's free filesystem is ephemeral; garage/history data resets on redeploy
  or wake. Attach a paid disk or use a host with persistent storage for durable
  records. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- Uploaded media is held in memory, sent to Anthropic, and not persisted by
  this backend. Diagnosis records store symptom ids and cause labels, not the
  media.
- AI calls only happen when the user chooses an AI-assisted option. The
  checklist never leaves the backend.
- The SQLite database and `.env` files are gitignored.

## Project layout

```
TorqueDoc/
├── backend/
│   ├── src/
│   │   ├── app.ts                 Express app factory (used by tests)
│   │   ├── index.ts               listen + graceful shutdown
│   │   ├── config.ts              env parsing/validation
│   │   ├── db.ts                  schema, catalog sync, queries
│   │   ├── http.ts                validation helpers + HttpError
│   │   ├── middleware/            access key, rate limit, request log, errors
│   │   ├── routes/                vehicles, catalog, diagnose, diagnoses, AI
│   │   ├── services/              diagnosis engine, Claude client, ffmpeg
│   │   └── data/catalog.ts        seed symptoms/causes/repair guides
│   ├── test/                      node:test unit + integration tests
│   ├── Dockerfile                 production image (Node 24 + ffmpeg)
│   └── .dockerignore
├── app/
│   ├── App.tsx                    providers + navigation + error boundary
│   └── src/
│       ├── components/            cards, checklist, buttons, empty/error states
│       ├── navigation/            typed param lists + navigator
│       ├── screens/               one file per screen
│       ├── services/              one function per API area
│       ├── store/                 vehicle context
│       ├── theme/                 colors, spacing, labels
│       └── types/                 shared API types
├── docs/
│   ├── API.md                     endpoint reference
│   ├── ARCHITECTURE.md            design decisions and data flow
│   └── DEPLOYMENT.md              Render, Docker, env, EAS
├── render.yaml                   Render Blueprint (free demo)
├── README.md
└── .gitignore
```

## Roadmap

1. **OBD-II Bluetooth** — `react-native-ble-plx` plus an ELM327 protocol layer:
   discover/connect, read live PIDs, read and clear stored fault codes, and map
   codes into the existing diagnosis flow. Biggest lift, deliberately last.
2. **Search across the garage** — the library has search; the garage list is
   still a plain list.
3. **Offline catalog cache** — the app currently requires the backend. A
   read-only SQLite/AsyncStorage cache of the catalog and guides would make the
   checklist usable without a network.
4. **Auth and multi-user history** if this ever leaves a trusted LAN.
5. **More catalog content / localization** — the engine is content-driven; add
   symptoms, causes and guides without touching code.
