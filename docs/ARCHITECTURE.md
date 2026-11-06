# Architecture

TorqueDoc is a small, self-hosted vehicle diagnostic system. The Expo client is
a thin UI over an Express API; the API owns accounts, the private garage, the
deterministic diagnosis engine, every AI call, and all persistence.

## Goals and non-goals

**Goals**

- Cars and motorcycles only; trailers are intentionally out of scope.
- Private per-account garages and diagnosis history.
- Five input modes: checklist, free text, photo, video, recorded sound.
- Ranked causes with an inspectable explanation, not an opaque score.
- Repair guides with tools, time, difficulty and numbered steps.
- Free-tier-friendly AI with zero-retention settings and server-side keys.
- Works in public-store Expo Go (SDK 54) and as a hosted web app.

**Non-goals**

- A workshop management system, invoicing, parts ordering or multi-technician
  roles.
- Live OBD-II yet. The UI has a disabled placeholder; the transport and PID
  layer are deliberately deferred.
- Medical-grade or safety-certified diagnosis. Results are decision support.
- Storing uploaded photos, videos or audio. Only diagnosis snapshots persist.

## System context

```
┌─────────────────────────────┐        HTTPS/JSON        ┌──────────────────────────────┐
│ app/ — Expo / React Native │  ────────────────────▶  │ backend/ — Express 5        │
│ Auth · Garage · Diagnose   │  ◀────────────────────  │ SQLite · rule engine · AI   │
│ Expo Go · web client       │                         │ ffmpeg · web-dist           │
└─────────────────────────────┘                         └──────────────┬───────────────┘
                                                                        │
                                                     ┌──────────────────┴─────────────────┐
                                                     │ Cloudflare Workers AI (free tier)  │
                                                     │ Mistral text/vision · clef-omni    │
                                                     │ server-side key · zero retention  │
                                                     └────────────────────────────────────┘
```

The app contains no catalog and no provider credentials. The backend serves the
static Expo web build at `/app`, the account dashboard at `/dashboard`, and a
public liveness/capability probe at `/health`.

## Request flows

### 1. Account sign-up / sign-in

1. The app calls `POST /auth/register` or `POST /auth/login` with email and
   password. When `API_ACCESS_TOKEN` is configured, it also sends the shared
   `X-TorqueDoc-Key` abuse gate.
2. The backend normalizes the email, verifies the password against a scrypt hash
   (or a dummy hash for unknown emails to reduce timing leaks), creates an
   opaque `tds_…` token, stores only its SHA-256 hash in `sessions`, and returns
   the raw token once.
3. The app stores the token in AsyncStorage (`torquedoc.session.v1`) and sends
   it as `Authorization: Bearer <token>` on garage, catalog, diagnosis and AI
   requests.
4. Middleware attaches the user to the request. Data routes call `requireUser`
   and every vehicle query includes `user_id = ?`. A valid id owned by another
   account returns `404`, not `403`, to avoid leaking existence.
5. Sessions expire after 30 days. Logout revokes the current token; a 401 causes
   the app to clear the stored token and show the sign-in screen.

The shared API key is **not** account authentication. It is bundled into the web
runtime config and the APK, so it only raises the cost of casual abuse. Real
authorization comes from the session and per-user ownership checks.

### 2. Symptom checklist (deterministic)

1. The app fetches the symptom catalog for the vehicle type.
2. The user selects symptoms and optionally supplies free-text notes.
3. `POST /diagnose` validates the ids and runs the pure engine.
4. If `vehicleId` is supplied, the API verifies ownership and stores a
   `diagnosis_records` row with a snapshot of the ranked matches.

No AI is involved on this path, and checklist answers never go to an AI provider.

### 3. Free text (AI extraction, deterministic ranking)

1. `POST /v1/symptoms/interpret` sends the description and the vehicle's symptom
   taxonomy to the configured text model.
2. The model returns symptom ids and a one-line restatement.
3. The backend filters ids to the known taxonomy and vehicle type.
4. The app calls `/diagnose` with the validated ids. The ranking stays
   deterministic and auditable; the model only performs extraction.

### 4. Photo / video (AI extraction, deterministic ranking)

1. The app uploads `kind=photo` or `kind=video` to `/v1/media/analyze` as
   multipart data.
2. Photos go directly to the vision model as a base64 image after MIME and size
   checks (5 MB per image).
3. Videos are written to a temp directory. `ffprobe` reads the duration and
   `ffmpeg` extracts up to three JPEG frames at roughly 20%, 50% and 80% of the
   clip, scaled down for the model.
4. The model returns visual labels, optional symptom ids, and notes. Ids are
   filtered against the catalog for that vehicle type.
5. The app calls `/diagnose` with any matched ids. If none match, the findings
   are shown without inventing a diagnosis.
6. Temp files are deleted in a `finally` block. The video soundtrack is not
   analyzed on this path; sound has its own endpoint mode.

### 5. Recorded sound (AI sound-pattern classification)

1. The app records up to 30 seconds with `expo-audio`, or selects an audio file
   with `expo-document-picker`, and uploads it as `kind=audio` with an optional
   context (`When braking`, `At idle`, etc.).
2. The backend validates the MIME type and 20 MB audio limit, then `ffmpeg`
   transcodes to **mono 16 kHz 16-bit WAV** and trims to 30 seconds. This keeps
   the request small and matches the model's preferred input.
3. The WAV is sent inline as base64 to Cloudflare `@cf/cloudflare/clef-omni`.
   The request defines typed questions:
   - `sound_present`: yes/no probability.
   - `dominant_sound`: one of 12 classes (`brake_squeal`, `brake_grind`,
     `engine_knock`, `engine_tick`, `belt_squeal`, `exhaust_rasp`,
     `chain_slap`, `starter_click`, `cooling_hiss`, `rough_idle`, and normal
     alternatives).
   - `urgency`: a 0–3 score.
4. Only classes with a genuine catalog mapping feed the deterministic engine:
   brake squeal/grind, rough idle, starter click, exhaust rasp and chain slap.
   Engine knock, ticking, belt squeal and cooling hiss are returned as findings
   with a safety-oriented note rather than forced into a weak diagnosis.
5. The clip exists only in memory/temp files for the request. It is not written
   to SQLite or retained by the backend after the response.

## Backend layering

| Path | Responsibility |
|---|---|
| `src/app.ts` | Express app factory: middleware order, routers, static web build, health/API metadata. Used by tests without binding a port. |
| `src/index.ts` | Listens, logs the bound URL, handles graceful shutdown. |
| `src/config.ts` | Parses and validates env once; resolves `DB_PATH` relative to `backend/`. |
| `src/db.ts` | Schema, additive migrations, catalog sync, users/sessions, vehicle/history queries. |
| `src/http.ts` | `HttpError`, body validation helpers, consistent error shape. |
| `src/middleware/accessToken.ts` | Shared-key abuse gate; lets a valid user session through. |
| `src/middleware/userAuth.ts` | Attaches a user from a bearer session token; `requireUser`. |
| `src/middleware/rateLimit.ts` | In-memory per-IP limits for general, AI and auth traffic. |
| `src/routes/auth.ts` | Register/login/me/logout, password and email validation. |
| `src/routes/vehicles.ts` | Account-scoped garage CRUD. |
| `src/routes/diagnose.ts` | Validation and deterministic diagnosis, optional history write. |
| `src/routes/diagnoses.ts` | Account-scoped history list/detail/delete. |
| `src/routes/aiSymptoms.ts` | Free-text extraction. |
| `src/routes/mediaAnalyze.ts` | Multipart validation and photo/video/audio dispatch. |
| `src/services/diagnosisEngine.ts` | Pure ranking logic. No DB or AI imports. |
| `src/services/aiClient.ts` | Selects Cloudflare or optional Anthropic for text/vision. |
| `src/services/cloudflareClient.ts` | Workers AI request mapping, timeout, retry, JSON extraction. |
| `src/services/audioAnalysis.ts` | clef-omni request builder, typed-answer parsing, sound-to-symptom mapping. |
| `src/services/audioClip.ts` | ffmpeg transcode/trim to mono 16 kHz WAV and base64. |
| `src/services/videoFrames.ts` | ffmpeg availability, duration, frame extraction, temp cleanup. |
| `src/services/passwords.ts` | scrypt hash/verify and a startup dummy hash. |
| `src/dashboard.ts` | Server-rendered account dashboard over the same API. |

Routers are mounted in `app.ts`; `attachUser` resolves an optional account
session, the access gate validates the optional shared key, and `requireUser`
protects every route below the auth router. AI routes sit behind both the general
and AI rate limiters.

## Database

SQLite via Node's built-in `node:sqlite` (Node 22.5+). One connection, WAL mode,
foreign keys on. This avoids a native npm binary on Windows and is sufficient for
a single instance.

### Tables

| Table | Purpose |
|---|---|
| `users` | `id`, unique case-insensitive `email`, `display_name`, scrypt `password_hash`, `created_at`. |
| `sessions` | SHA-256 `token_hash`, `user_id`, `created_at`, `expires_at`, `last_seen_at`. Cascades on user delete. |
| `vehicles` | Account-owned car/motorcycle. New databases require a non-null `user_id`; upgraded databases use a nullable column only long enough for startup cleanup. |
| `symptoms` | Catalog symptom, category, applicable vehicle types, linked cause ids (JSON). |
| `causes` | Catalog cause, severity, applicable types, repair guide id (JSON types). |
| `repair_guides` | Tools, steps, category, difficulty, estimated minutes. |
| `diagnosis_records` | Vehicle id, source, symptom ids, full match snapshot, timestamp. |
| `meta` | Catalog version. |

History stores the **match snapshot**, so catalog edits do not rewrite past
results. Deleting a vehicle cascades to its diagnosis records.

### Migrations and legacy data

Migrations are additive and run on startup:

- New `users` and `sessions` tables are created if absent.
- `vehicles.user_id` is added if an older database lacks it, and the index is
  created afterward.
- Startup cleanup deletes every vehicle that has no owner, plus vehicles whose
  `created_at` predates their owner's account. The second rule removes rows
  inherited from the old first-account migration. Their diagnosis records are
  deleted in the same transaction.
- No account ever claims unowned or pre-account vehicles. Every new account
  starts with two example vehicles that belong only to it.
- Every vehicle read, update, delete, diagnosis write and history query includes
  the authenticated account id. A cross-account request returns `404`.
- The catalog is replaced only when `CATALOG_VERSION` changes; diagnosis history
  keeps its snapshots.

## Diagnosis engine

Each symptom lists the causes it can indicate. Each cause lists the repair guide.
Given selected symptom ids and a vehicle type:

1. Filter symptoms and causes to those that apply to the vehicle type.
2. For each cause, find its linked symptoms **for that vehicle type**.
3. `confidence = matched linked symptoms / total linked symptoms`.
4. Keep causes with at least one match.
5. Sort by confidence, then matched count, then severity, then label.

### Why coverage, not probability

The score is explainable: “2 of 3 known signs for this cause.” It is not a
calibrated probability and the UI says so. A cause with only one known sign can
reach 100% from a single checkbox, which is why every result also displays the
matched signs and totals.

### The vehicle-type filter

A cause can apply to both cars and motorcycles but have different linked
symptoms for each. The engine intersects causes and symptoms with the supplied
vehicle type before counting. Otherwise a car-only symptom could inflate a
motorcycle cause's coverage.

## AI design

- **Provider:** Cloudflare Workers AI when `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` are set. Anthropic remains an optional paid text/vision
  fallback; it is not used by the free deployment and is never used for audio.
- **Models:** `CLOUDFLARE_MODEL` (default Mistral Small 3.1) handles text and
  vision; `CLOUDFLARE_VISION_MODEL` can override vision; `CLOUDFLARE_AUDIO_MODEL`
  defaults to `@cf/cloudflare/clef-omni`.
- **Transport:** direct `fetch` to the Workers AI REST endpoint with a 60s
  timeout (`AI_TIMEOUT_MS`) and one retry on 429/5xx. No vendor SDK, no key in
  the app.
- **Contract:** AI returns candidate symptom ids/labels/notes; the backend
  validates ids against the catalog. Free text and media never rank causes
  directly.
- **Audio:** typed `noul` / `choice` / `score` questions with probabilities, not
  free-form generation. Only genuine catalog classes map to symptoms.
- **Failure behavior:** missing credentials → `503 AI_NOT_CONFIGURED`; missing
  ffmpeg → `503 FFMPEG_NOT_FOUND`; unreadable media → `422`; upstream failure or
  invalid output → `502 AI_REQUEST_FAILED`. Photo/checklist diagnosis still
  work when AI or ffmpeg is absent.
- **Credential handling:** read once in `config.ts`; never logged or returned.
  The web build receives only the shared abuse-gate key, never provider keys.
- **Privacy:** media is held in memory/temp files for the request and deleted
  afterward. Cloudflare documents zero retention and no training on standard
  Workers AI inputs; the UI states this and links the choice to a user action.

## Media pipeline details

- Photos: JPEG/PNG/WebP/GIF, 5 MB per image. MIME is checked before any AI call.
- Video: MP4/MOV/WebM/AVI/3GP/MKV, global upload limit `MAX_UPLOAD_MB`. The app
  records at most 15 seconds; the backend extracts up to three frames.
- Audio: MP3/WAV/M4A/AAC/OGG/WebM, 20 MB, trimmed to 30 seconds and transcoded to
  mono 16 kHz WAV. Files are uploaded as multipart `kind=audio`.
- `application/octet-stream` is accepted only where the client cannot supply a
  better type, then validated by ffmpeg. A video uploaded as audio is rejected
  before inference where the MIME type makes it obvious.
- Rate limits: 10 AI requests/min/IP, 240 general requests/min/IP, 12 auth
  attempts/min/IP. In-memory and therefore per-instance; a multi-instance
  deployment should move these to Redis or the edge.

## Mobile app

```
App.tsx
└── AuthProvider (session boot, login/register/logout)
    └── gradient splash / AuthScreen / NavigationContainer
        └── VehicleProvider (account-scoped garage + CRUD)
            └── Root native stack
                ├── Main tabs: Garage, Library
                └── AddVehicle, VehicleDetail, DiagnoseHome,
                    SymptomChecklist, FreeText, Camera, Audio,
                    DiagnosisResult, RepairGuideDetail, History, HistoryDetail
```

- **State:** `AuthContext` owns the session token/user; `VehicleContext` owns the
  garage and refreshes after sign-in or CRUD. Both are small React contexts, no
  Redux.
- **API access:** `apiFetch` injects the shared key and bearer token, applies a
  timeout, and maps network/HTTP errors into user-facing messages. A 401 clears
  the session and returns the app to sign-in.
- **Media:** `imageRecognitionService` uploads photo/video/audio and normalizes
  browser `File`/blob handling. Video/audio preparation is server-side.
- **Audio:** `AudioCaptureScreen` handles microphone permission, 30-second
  recording with auto-stop, file selection, a context hint, playback-free
  preview metadata, upload progress and findings. The screen explicitly says
  this is not a voice assistant.
- **Theme:** tokens in `src/theme/tokens.ts` define the midnight/cyan/amber
  palette, gradients, shadows and type scale. Components use the tokens rather
  than hard-coded colors.
- **Web:** the same app is exported to `backend/web-dist`; the server injects
  the same-origin API URL and shared key. AsyncStorage maps to localStorage.

## Decisions and trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Email/password accounts with opaque sessions | Private garages and history without OAuth setup | Users manage another password; no social login |
| scrypt + SHA-256 session hashes | Strong at rest, no native dependency | Hash verification costs CPU on login |
| Shared `API_ACCESS_TOKEN` plus sessions | Cheap abuse gate for a public demo | Bundled token is not a secret |
| Deterministic engine after AI extraction | Auditable ranking, AI cannot invent causes | AI is limited to the fixed taxonomy |
| Coverage confidence | Explainable and testable | Not a calibrated probability |
| Built-in `node:sqlite` | No native install headaches | Requires Node 22.5+; single writer |
| Render free filesystem | Zero-cost public demo | Data resets on redeploy/sleep |
| Expo SDK 54 pin | Works in public-store Expo Go | Newer SDK features unavailable |
| ffmpeg frames for video | Vision model accepts images, not raw video | Motion and audio nuance lost |
| clef-omni typed audio questions | Structured probabilities, free-tier eligible, zero retention | Only the defined sound classes; knock/tick reported without a catalog diagnosis |
| In-memory rate limiting | No extra service for one instance | Resets on restart; per-instance only |

## Security and operational notes

- Provider keys are server-side only. The app bundle contains the API base URL
  and shared abuse-gate key, never Cloudflare/Anthropic credentials.
- Passwords are never logged or returned. The API exposes only
  `{ id, email, displayName, createdAt }`.
- Sessions are opaque and hashed at rest; 30-day expiry. Logout revokes the
  current session. Use HTTPS in production.
- Every vehicle, history and diagnosis query is account-scoped. Cross-account
  ids are `404`.
- Rate limits are per-IP and in-memory. For multiple instances, add a shared
  store and put auth behind a WAF/challenge.
- Render's free disk is ephemeral. For durable data, mount a paid disk at
  `/data` or move to a managed database.
- The Docker image installs ffmpeg so video and sound work in production.
  Locally, install ffmpeg or expect `FFMPEG_NOT_FOUND`.
- Uploaded media is not persisted. Diagnosis history stores ids and labels.
- `backend/.env`, `app/.env` and SQLite files are gitignored. The web build does
  not embed provider keys.

## Testing strategy

- **Unit:** pure diagnosis engine, catalog integrity, AI request/response
  mapping, audio request construction and sound-to-symptom interpretation, and
  Cloudflare adapter behavior.
- **Integration:** the real Express app on an ephemeral port with a throwaway
  SQLite file. Covers required sessions, registration/login, duplicate email,
  wrong credentials, per-account isolation, vehicle CRUD, catalog filtering,
  diagnosis, history, deletion cascades, AI-disabled behavior, and
  photo/video/audio upload validation.
- **Not covered automatically:** live Cloudflare/Anthropic calls, device
  microphone recording, and real Expo Go UI gestures. These need credentials or
  a device. `/health` reports capability availability.

Run `npm run typecheck && npm test` in `backend/` and
`npm run typecheck` in `app/`. `expo-doctor` warns about the local, gitignored
`android/` prebuild folder and its `.expo` ignore check; both warnings are
expected for this project layout.

## Roadmap, with architectural notes

1. **OBD-II Bluetooth** — `react-native-ble-plx` plus an ELM327 protocol layer:
   discover/connect, live PIDs, read/clear stored codes, and feed codes into the
   existing diagnosis flow. Needs a native build and permission changes.
2. **Search across the garage** — the library has search; the garage list is a
   plain list.
3. **Offline catalog cache** — a read-only AsyncStorage/SQLite cache of catalog
   and guides would make the checklist work without a network.
4. **More audio classes and catalog content** — extend `audioAnalysis.ts`,
   symptom/cause data and guides together so the deterministic mapping stays
   honest.
5. **Shared rate limiting and durable database** — Redis/edge rate limit and
   Postgres or a mounted SQLite disk for multi-instance production.
6. **Localization** — content-driven engine and UI.
