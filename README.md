# TorqueDoc

A private vehicle diagnostic and repair assistant for cars and motorcycles.
Sign in, save your vehicles, then describe a problem with a checklist, your own
words, a photo/video, or a recorded sound. TorqueDoc returns ranked probable
causes and step-by-step repair guides.

Trailers are intentionally out of scope: they don't have an engine to diagnose
in this sense and would need a different inspection-checklist product.

```
┌─────────────────────────────┐        HTTP/JSON        ┌──────────────────────────────┐
│  app/ — Expo / React Native │  ────────────────────▶  │  backend/ — Express 5        │
│  Auth · Garage · Diagnose   │  ◀────────────────────  │  SQLite · rule engine · AI   │
└─────────────────────────────┘                         └──────────────┬───────────────┘
                                                                         │
                                                      ┌──────────────────┴─────────────────┐
                                                      │ Cloudflare Workers AI (free tier)  │
                                                      │ text · vision · clef-omni audio    │
                                                      │ server-side key, zero retention    │
                                                      └─────────────────────────────────────┘
```

The app holds no catalog data and no provider credentials. The backend owns the
database, account sessions, diagnosis rules, and all AI calls.

## What it does

- **Accounts** — email/password sign-up and sign-in. Each account has a private
  garage and private diagnosis history. Passwords are hashed with scrypt on the
  server; the app stores only an opaque 30-day session token.
- **Garage** — add, edit and delete cars and motorcycles; mileage is editable.
- **Five diagnosis inputs**:
  - **Symptom checklist** — deterministic, explainable, no AI.
  - **Describe it in words** — Workers AI maps free text onto the fixed symptom
    taxonomy, then the deterministic engine ranks causes.
  - **Photo** — Workers AI inspects a close-up for visual clues, then the rule
    engine ranks causes.
  - **Video** — ffmpeg samples three frames server-side; the vision model
    inspects them. The video soundtrack is not analyzed on this path.
  - **Recorded sound** — ffmpeg normalizes a 30-second clip to mono 16 kHz WAV;
    Cloudflare `clef-omni` classifies the dominant sound pattern. Genuine
    matches (brake squeal, brake grind, rough idle, starter click, exhaust rasp,
    chain slap) feed the rule engine. Engine knock, ticking, belt squeal and
    cooling hiss are reported honestly as findings without inventing a catalog
    diagnosis.
- **Ranked causes** — each result shows severity, the share of that cause's
  known signs you supplied, and exactly which signs matched. The number is
  coverage, not a black-box probability.
- **Repair guides** — tools, realistic time estimate, difficulty, numbered
  steps with a local step-progress checklist.
- **History** — every run against a saved vehicle is persisted and can be
  reopened later. Deleting a vehicle deletes its history.
- **OBD-II Bluetooth** — deliberately a disabled placeholder; see Roadmap.

Audio analysis is a **sound-pattern match**, not a confirmed mechanical
diagnosis, and the UI says so. It is also not a voice assistant: recordings are
intended for engine, brake, chain, exhaust, belt and cooling noises.

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo SDK 54, React Native 0.81, TypeScript | Expo Go on the public app stores runs SDK 54; this project is pinned to it so a QR-code scan works. |
| Navigation | React Navigation 7 (native stack + tabs) | Small, typed, no file-based routing magic. |
| API | Express 5 + TypeScript | Boring, well understood, and Express 5 forwards async errors automatically. |
| Database | Node's built-in `node:sqlite` | No native binary to download at install time. Requires **Node 22.5+**. |
| Auth | scrypt password hashes + SHA-256 session hashes | No extra native dependency; raw passwords and session tokens are never stored. |
| AI | Cloudflare Workers AI via `fetch` | Free-tier eligible, no SDK dependency, server-side key only, zero-retention model options. Cloudflare is the primary provider; Anthropic remains an optional paid legacy fallback for text/vision only and is not used by the free deployment. |
| Audio | Cloudflare `@cf/cloudflare/clef-omni` | Typed sound-pattern probabilities, free-tier eligible, roughly 780 tokens per audio minute, zero retention. |
| Video/audio prep | System `ffmpeg` / `ffprobe` | Samples video frames and transcodes/trims audio server-side. |

## Quickstart

Prerequisites: **Node.js 22.5+** (Node 24 works), npm, and — for video or sound
analysis — **ffmpeg** and **ffprobe** on `PATH`.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env and add CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN
npm run dev                   # http://localhost:3000
```

```bash
# 2. App, in a separate terminal
cd app
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:3000
npx expo start
```

Then scan the QR code with Expo Go, or press `i` / `a` for a simulator. Create an
account on the welcome screen. New accounts get two deletable example vehicles.

### Why the LAN IP, not localhost?

Expo Go runs on your phone, not your computer. `localhost` in the app would
point at the phone itself. Find your computer's active IPv4 address:

- **Windows:** `ipconfig` — look for "IPv4 Address" on the adapter connected to
  the same Wi-Fi as the phone. Ignore VirtualBox/Hyper-V adapters.
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

Put it in `app/.env`, including the scheme and port:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
```

Both devices must be on the same network, and the Windows firewall must allow
Node.js on port 3000 the first time you run it. Restart Expo after editing
`.env`; `EXPO_PUBLIC_*` values are inlined at bundle time.

## Configuration

Backend (`backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | API port. |
| `DB_PATH` | `./torquedoc.db` | SQLite file. Relative paths resolve from `backend/`. |
| `CLOUDFLARE_ACCOUNT_ID` | — | Enables Workers AI when paired with a token. |
| `CLOUDFLARE_API_TOKEN` | — | Server-side Workers AI token. Never sent to the app. |
| `CLOUDFLARE_MODEL` | Mistral Small 3.1 | Text/vision model. |
| `CLOUDFLARE_VISION_MODEL` | same as model | Optional separate vision model. |
| `CLOUDFLARE_AUDIO_MODEL` | `@cf/cloudflare/clef-omni` | Audio sound-pattern model. |
| `AI_TIMEOUT_MS` | `60000` | AI request timeout. |
| `MAX_UPLOAD_MB` | `30` | Overall photo/video/audio upload limit; photos are capped at 5 MB by the vision API. |
| `API_ACCESS_TOKEN` | — | Shared abuse-gate key required for login/register and all API routes when set. Not a replacement for user sessions. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `12` | Register/login attempts per IP per minute. |
| `RATE_LIMIT_PER_MINUTE` | `240` | General requests per IP per minute. |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | AI requests per IP per minute. |
| `CORS_ORIGIN` | `*` | `*` or a comma-separated origin allow-list. |
| `LOG_REQUESTS` | `true` | One-line request log. |
| `TRUST_PROXY` | `false` | Set true behind Render/Railway so rate limits see the real IP. |

App (`app/.env`):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend base URL reachable from the phone or browser. |
| `EXPO_PUBLIC_API_ACCESS_TOKEN` | Must match `API_ACCESS_TOKEN` when the backend sets it. Bundled, so treat it as an abuse gate, not a secret. |

## API at a glance

Full reference with request/response examples: [`docs/API.md`](docs/API.md).

```
GET    /health
POST   /auth/register
POST   /auth/login
GET    /auth/me                 (session)
POST   /auth/logout             (session)

GET    /vehicles                (session)
POST   /vehicles                (session)
GET    /vehicles/:id            (session)
PATCH  /vehicles/:id            (session)
DELETE /vehicles/:id            (session)
GET    /vehicles/:id/history    (session)

GET    /symptoms?vehicleType=car|motorcycle        (session)
GET    /repair-guides?vehicleType=car|motorcycle   (session)
GET    /repair-guides/:id                          (session)
GET    /catalog                                    (session)
POST   /diagnose                                   (session)
GET    /diagnoses/:id                              (session)

POST   /v1/symptoms/interpret   (session + AI)
POST   /v1/media/analyze        (session + AI, multipart; photo/video/audio)
```

Send the account session as `Authorization: Bearer <opaque-token>`. When
`API_ACCESS_TOKEN` is configured, send it as `X-TorqueDoc-Key` on login/register
(and optionally on other requests). All errors use
`{ "error": "human-readable", "code": "MACHINE_CODE", "details"?: … }`.

The AI endpoints return `503 AI_NOT_CONFIGURED` when no valid provider key is
set. Video and audio analysis report `503 FFMPEG_NOT_FOUND` when ffmpeg is
missing. An unreadable audio clip returns `422 AUDIO_UNREADABLE`.

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
database. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the trade-offs.

## Audio pipeline

1. The app records up to 30 seconds (`expo-audio`) or accepts an audio file
   (`expo-document-picker`), then uploads it as multipart `kind=audio`.
2. The backend validates the MIME type and size, then ffmpeg transcodes to mono
   16 kHz 16-bit WAV and trims to 30 seconds.
3. The WAV is sent inline as base64 to Cloudflare `clef-omni` with a typed
   question schema: whether an abnormal sound is present, which of 12 sound
   classes is dominant, and an urgency score.
4. Only sound classes with a genuine catalog symptom feed the deterministic
   engine. Other findings are displayed with their confidence and a note; they
   are never forced into a diagnosis.
5. The clip is held in memory/temp files only for the request and is not
   persisted. Cloudflare documents zero data retention for the model.

Keep the Cloudflare account on the **Workers Free** plan: the shared free
allocation is 10,000 Neurons/day and overage fails instead of billing. A
30-second clip is roughly 12 Neurons at clef-omni's input rate, so normal
personal use stays within the free allocation. Do not add a paid Workers plan or
Anthropic credits for this deployment.

## Testing and verification

```bash
cd backend
npm run typecheck
npm test          # 47 tests: engine, catalog integrity, auth, audio mapping, API
```

```bash
cd app
npm run typecheck
npx expo-doctor
```

The backend integration tests start the real Express app on an ephemeral port
with a temporary SQLite file. They cover registration/login, required sessions,
per-account garage isolation, vehicle CRUD, catalog filtering, diagnosis,
history, deletion cascades, AI-disabled behavior, and upload validation. They
do **not** call Cloudflare. Audio request construction and answer interpretation
are covered offline in `test/audioAnalysis.test.ts`.

Live AI responses need Cloudflare credentials. `/health` reports whether AI,
ffmpeg, video analysis and audio analysis are available.

The web client can be built into the backend's static directory:

```bash
cd app
$env:EXPO_NO_DOTENV='1'      # PowerShell
npx expo export --platform web --output-dir '..\backend\web-dist' --clear
```

## Hosted deployment

The public deployment serves the app at `/app`, an account dashboard at
`/dashboard`, and a health check at `/health`:

- App: `https://torquedoc-api.onrender.com/app`
- Dashboard: `https://torquedoc-api.onrender.com/dashboard`
- Health: `https://torquedoc-api.onrender.com/health`

Render's free filesystem is ephemeral. A redeploy can reset accounts, garages
and history. For persistent production use, point `DB_PATH` at a mounted disk or
move the database to a managed SQLite/Postgres service.

## Troubleshooting

**"Couldn't reach the TorqueDoc server at http://…"**
The app prints the exact URL. Check the backend is running, the IP is the
computer's current LAN IP (not `localhost`), the port is included, both devices
are on the same Wi-Fi, and the firewall allows Node on port 3000.

**"Project is incompatible with this version of Expo Go"**
This project is pinned to SDK 54, the version the public-store Expo Go app
runs. Force-close and update Expo Go, then confirm `app/package.json` still has
`"expo": "~54.0.37"`. Do not bump Expo without checking which SDK the store build
supports.

**Sign-in returns 401**
Check the email/password and remember that sessions expire after 30 days. The
account is stored in the backend's SQLite file; a Render redeploy may reset it.

**Audio/video analysis returns 503 `FFMPEG_NOT_FOUND`**
Install ffmpeg and make sure both `ffmpeg` and `ffprobe` are on `PATH`
(`winget install Gyan.FFmpeg` on Windows), then restart the backend. Photo and
checklist diagnosis are unaffected.

**AI returns 503 `AI_NOT_CONFIGURED`**
Put real Cloudflare credentials in `backend/.env` (or the Render environment) and
restart. Placeholder values from `.env.example` are rejected.

**Audio returns a result but no ranked causes**
That is intentional when the model hears a sound outside the current catalog
(for example engine knock or belt squeal). The screen shows the finding and
safety note instead of inventing a diagnosis. Use the checklist for related
signs or have the vehicle inspected.

**Database looks stale after editing the catalog**
The catalog is synchronized on startup using `CATALOG_VERSION` in
`backend/src/data/catalog.ts`. Bump that constant whenever you edit the seed
content. No delete-the-database step is needed.

**Metro/Babel dependency errors**
Run `npx expo install --fix` to snap packages to the SDK 54 set, then
`npx expo-doctor`. `babel-preset-expo` is intentionally an explicit
devDependency so npm hoists one shared copy.

## Security and privacy

- Provider keys are read only by the backend and are never bundled into the app
  or returned by an endpoint.
- Passwords are hashed with scrypt and a unique salt. Session tokens are opaque,
  expire after 30 days, and only their SHA-256 hashes are stored. The app stores
  the session token in AsyncStorage; it never stores the password.
- Garage, diagnosis, history and AI routes require a signed-in account. Every
  vehicle query is scoped to the owning user, and cross-account IDs return 404.
- `API_ACCESS_TOKEN` is an additional abuse gate for public deployments, not a
  replacement for accounts. It is visible in the web runtime config, so do not
  treat it as a secret.
- Uploaded photos, videos and audio are held in memory or temporary files, sent
  to Cloudflare, and not persisted by this backend. Diagnosis records store
  symptom ids and cause labels, not the media.
- AI calls only happen when the user chooses an AI-assisted option. Checklist
  answers never go to an AI provider; they only reach the deterministic engine.
- The SQLite database and `.env` files are gitignored.

## Project layout

```
TorqueDoc/
├── backend/
│   ├── src/
│   │   ├── app.ts                 Express app factory (used by tests)
│   │   ├── index.ts               listen + graceful shutdown
│   │   ├── config.ts              env parsing/validation
│   │   ├── db.ts                  schema, accounts/sessions, catalog sync, queries
│   │   ├── http.ts                validation helpers + HttpError
│   │   ├── middleware/            auth, rate limit, request log, error boundary
│   │   ├── routes/                auth, vehicles, catalog, diagnose, AI
│   │   ├── services/              diagnosis engine, Cloudflare clients, ffmpeg
│   │   └── data/catalog.ts        seed symptoms/causes/repair guides
│   ├── test/                      node:test unit + integration tests
│   └── web-dist/                  generated Expo web build served at /app
├── app/
│   ├── App.tsx                    auth bootstrap, providers, navigation
│   └── src/
│       ├── components/            cards, checklist, buttons, empty/error states
│       ├── navigation/            typed param lists + navigator
│       ├── screens/               auth, garage, diagnose, audio/photo/video, history
│       ├── services/              API areas, auth token/storage, media upload
│       ├── store/                 auth and vehicle contexts
│       ├── theme/                 palette, gradients, type scale
│       └── types/                 shared API types
├── docs/
│   ├── API.md                     endpoint reference
│   ├── ARCHITECTURE.md            design decisions and data flow
│   └── DEPLOYMENT.md              deployment notes
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
4. **More sound classes and catalog content** — add symptoms, causes, guides and
   audio mappings without touching the engine.
5. **Localization** — the engine and UI are content-driven.
