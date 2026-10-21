# Architecture

This document explains how TorqueDoc is put together and why, including the
trade-offs that are easy to miss from the code alone.

## Goals and non-goals

**Goals**

- Fast, explainable answers for common car and motorcycle problems.
- Three input modes that converge on one ranking engine, so the result is
  consistent no matter how the user described the problem.
- Keep the AI surface small: AI extracts intent or visual clues, not the final
  answer.
- Run locally with minimal install friction (no native DB binary, no Docker, no
  cloud services required).
- Make the catalog content editable without touching engine code.

**Non-goals**

- Replacing a mechanic, a factory service manual, or a professional inspection.
- Trailers (no engine in the diagnostic sense).
- Live OBD-II telemetry — a disabled placeholder is included in the UI, not an
  implementation.
- Multi-user accounts, cloud sync, or internet-facing deployment.
- Diagnosing intermittent faults from sound alone.

## System context

```
┌──────────────────────────────┐
│ Expo / React Native app      │
│                              │
│ screens → services → fetch   │
│ one VehicleContext for state │
└──────────────┬───────────────┘
               │ HTTP/JSON + multipart
┌──────────────▼───────────────┐
│ Express 5 API                │
│                              │
│ routes → validation → db     │
│         → diagnosis engine   │
│         → Claude client      │
└──────┬───────────────┬───────┘
       │               │
┌──────▼──────┐  ┌─────▼─────────────────┐
│ SQLite file │  │ Anthropic Messages API│
│ node:sqlite │  │ (optional, server key)│
└─────────────┘  └───────────────────────┘
                       ▲
                       │ frames
              ┌────────┴────────┐
              │ ffmpeg/ffprobe  │
              │ system binaries │
              └─────────────────┘
```

The app never talks to Anthropic directly. The key exists only in
`backend/.env`; the app only knows the backend base URL.

## Request flows

### 1. Symptom checklist (deterministic)

```
app: GET /symptoms?vehicleType=car
      → render grouped checkboxes
app: POST /diagnose { vehicleType, symptomIds, vehicleId, source: checklist }
      → validate ids against catalog for vehicle type
      → load catalog snapshot from SQLite
      → pure rule engine ranks causes
      → persist a DiagnosisRecord if vehicleId was supplied
      → return { matches, diagnosisId }
app: navigate to result with matches
```

No network call leaves the local machine. This is the fastest and most
auditable path.

### 2. Free text (AI extraction, deterministic ranking)

```
app: POST /v1/symptoms/interpret { vehicleType, description }
      → send taxonomy + description to Claude
      → validate/filter returned ids against taxonomy
      → return { matchedSymptomIds, summary }
app: POST /diagnose { symptomIds: matchedSymptomIds, source: free_text }
      → same deterministic engine as the checklist
```

The model is deliberately **not** asked for causes, probabilities, or repair
advice. It maps language onto a closed set of ids. Every id is checked against
the catalog, so a hallucinated id cannot reach the ranking engine.

### 3. Photo/video (AI extraction, deterministic ranking)

```
app: POST /v1/media/analyze (multipart: vehicleType, kind, file)
      → multer memory storage, size limit
      → validate kind + MIME type
      → photo: base64 the image directly
      → video: write temp file, ffprobe duration, ffmpeg extract 3 scaled frames
      → send taxonomy + images to Claude
      → validate/filter returned ids, labels, confidence, notes
      → return { matchedSymptomIds, detectedLabels, notes }
app: POST /diagnose { symptomIds, source: media }
      → same engine
```

Video frames are sampled at roughly 20%, 50% and 80% of the clip. Audio is not
sent or analyzed, and the prompt says so explicitly. Temp files are deleted in
a `finally` block.

## Backend layering

| File | Responsibility |
|---|---|
| `src/config.ts` | Read and validate environment once; resolve `DB_PATH` against `backend/`, not `cwd`. Reject placeholder API keys. |
| `src/db.ts` | Open SQLite, create schema, synchronise catalog, map rows to domain types, all queries. |
| `src/http.ts` | `HttpError` plus small validation helpers used by routes. |
| `src/app.ts` | Build the Express app (middleware, routes, 404, error boundary) without listening. |
| `src/index.ts` | Initialise DB, listen on `0.0.0.0`, log capabilities, graceful shutdown. |
| `src/middleware/` | Request logging and the single error handler. |
| `src/routes/` | HTTP concerns only: parse input, 404s, status codes. |
| `src/services/diagnosisEngine.ts` | Pure ranking function. No database import. |
| `src/services/anthropicClient.ts` | Timeout, retry, JSON extraction, error mapping. |
| `src/services/videoFrames.ts` | ffmpeg availability and frame extraction. |
| `src/data/catalog.ts` | Seed symptoms, causes, repair guides, `CATALOG_VERSION`. |

Splitting `app.ts` from `index.ts` is what lets the integration tests start the
real app on port 0 without spawning a child process.

## Database

SQLite via Node's built-in `node:sqlite` (`DatabaseSync`). This avoids a native
binary at install time. It is marked experimental by Node, which is acceptable
here because only this backend process opens the file and the API surface used
is small (`prepare`, `run`, `get`, `all`, `exec`, `close`).

Pragmas on open:

```sql
PRAGMA journal_mode = WAL;      -- readers don't block the writer
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### Tables

```
vehicles (id PK, type, nickname, make, model, year, mileage, created_at)
symptoms (id PK, label, category, vehicle_types JSON, cause_ids JSON)
causes (id PK, label, severity, vehicle_types JSON, repair_guide_id)
repair_guides (id PK, title, vehicle_types JSON, category, difficulty,
               estimated_minutes, tools_needed JSON, steps JSON)
diagnosis_records (id PK, vehicle_id FK → vehicles.id, source,
                   symptom_ids JSON, matches JSON, created_at)
meta (key PK, value)
```

Indexes: `(vehicle_id, created_at DESC)` on diagnosis records and `category` on
symptoms.

JSON is stored as text rather than normalised join tables because the catalog is
small, read-mostly, and always consumed as whole objects. Joining five tables to
render one symptom would add complexity without a measurable benefit at this
scale.

### Catalog synchronisation

`CATALOG_VERSION` in `src/data/catalog.ts`. On startup:

1. Create tables/indexes if missing.
2. Read `meta.catalog_version`.
3. If it differs, replace symptoms/causes/repair guides inside
   `BEGIN IMMEDIATE … COMMIT`, then write the new version.
4. Set `example_vehicles_seeded` exactly once, so deleting every vehicle does
   not resurrect the two sample vehicles after a restart.

Diagnosis records store a snapshot of their matches, so replacing the catalog
does not invalidate history. This is why no foreign key from
`diagnosis_records.matches` to causes/guides is needed.

Deleting a vehicle explicitly deletes its diagnosis rows in the same
transaction. The table predates a cascade action and SQLite cannot add
`ON DELETE CASCADE` to an existing table, so the explicit delete is both
portable and obvious.

## Diagnosis engine

`diagnose(selectedSymptomIds, vehicleType, catalog)` is a pure function:

```
applicableSymptoms = symptoms where vehicleTypes includes vehicleType
applicableCauses   = causes   where vehicleTypes includes vehicleType

for each applicable cause:
  linked  = applicableSymptoms where causeIds includes cause.id
  matched = linked where id ∈ selected
  if linked is empty or matched is empty: skip
  confidence = matched.length / linked.length
  return { cause, confidence, matchedSymptomIds, matchedSymptoms,
           totalLinkedSymptoms }

sort by confidence desc, matched count desc, severity desc, label asc
```

### Why coverage, not probability

A rule engine does not have enough data to produce a calibrated probability.
Reporting `73%` would imply a statistical model that does not exist. Instead the
number means:

> “Two of the three signs we know to be associated with this cause are present.”

For that reason the UI shows `2 of 3 signs` next to the percentage and lists the
matched symptom labels. The disclaimer appears on every result screen.

Known limitations, accepted for now:

- One-sign causes reach 100% easily. The matched-count tie-break helps, but a
  future version could apply a prior or require a minimum evidence count.
- Positive evidence only; there is no negative weighting for “this sign is
  present, so that cause is less likely”.
- Multiple simultaneous faults are possible; the ranking is not a partition.
- The catalog is intentionally small. Content quality matters more than engine
  sophistication at this stage.

### The vehicle-type bug fixed in this pass

The original engine computed each cause's linked symptoms using **all**
symptoms, then filtered causes by vehicle type. A motorcycle diagnosis therefore
counted car-only symptoms as “missing”, silently diluting every score. For
example, a cause with two motorcycle signs and one car-only sign would report
`1/3` instead of `1/2`. The engine now filters symptoms by vehicle type before
computing coverage, and there is a regression test for exactly this case.

The route also validates every submitted symptom id against the catalog for the
vehicle type, rather than silently ignoring typos. This matters because a
partial selection can make a different cause look stronger.

## AI design

- **Model:** `claude-sonnet-5-5` by default, configurable with
  `ANTHROPIC_MODEL`. The model id is not hard-coded in route handlers.
- **Transport:** `fetch` to the Messages API with `anthropic-version:
  2023-06-01`, a 60s timeout (`AI_TIMEOUT_MS`), and one retry on 429/5xx/529.
- **Key handling:** read once in `config.ts`. Values that do not look like an
  Anthropic key (`sk-ant-…`, at least 20 chars) are treated as unconfigured, so
  the placeholder from `.env.example` produces a helpful 503 instead of a
  guaranteed 401.
- **JSON discipline:** both prompts demand JSON only; the client strips markdown
  fences and extracts the outermost object. If parsing fails, the request fails
  with a clear 502 instead of passing malformed data downstream.
- **Output validation:** returned ids are intersected with the exact taxonomy
  sent in the prompt. Extra ids are dropped. Labels and notes are length-capped;
  confidences are clamped to 0–1 (and divided by 100 if the model returns a
  percentage).
- **No AI in the ranking:** the same engine handles checklist, free text, and
  media, which keeps results reproducible and testable.
- **Privacy:** photos/videos are held in memory (or a temp directory for
  ffmpeg), sent to Anthropic, and deleted afterward. They are never written to
  the SQLite database. Only symptom ids and cause snapshots are stored.

## Media pipeline details

- `multer.memoryStorage()` with `files: 1` and `fileSize: MAX_UPLOAD_MB`.
- Photos are additionally capped at 5 MB before any AI call, matching the
  vision API's per-image limit; the global limit still applies to video uploads.
- MIME allow-list per `kind`; a video uploaded as `photo` is rejected before any
  AI call. `application/octet-stream` is accepted for video because some React
  Native uploads do not set a precise type; ffmpeg probes the actual content.
- Frames are scaled to at most 1280px wide (`scale=min(1280,iw):-2`) and encoded
  as JPEG quality 3 to keep uploads and token costs predictable.
- `ffprobe` reads duration (10s timeout); each frame extraction is bounded to
  20s. If duration is unreadable, the code falls back to the first frame. If
  ffmpeg disappears after startup, `ENOENT` is mapped to
  `FfmpegNotFoundError` rather than being swallowed as “no frames”.
- Temp directories are removed in `finally`.

## Mobile app

```
App.tsx
  SafeAreaProvider
    ErrorBoundary
      VehicleProvider (vehicles + CRUD, single source of truth)
        NavigationContainer
          Root stack (AddVehicle, VehicleDetail, DiagnoseHome, …)
            Main tabs (Garage, Library)
```

- **Navigation:** React Navigation 7 native stack + bottom tabs. Param lists are
  typed in `src/navigation/types.ts`; every screen receives typed route params.
- **State:** one `VehicleContext` for the garage. Diagnosis results are passed
  through navigation params (they are immutable snapshots); history detail
  refetches by id, independent of the original result screen.
- **Services:** one module per API area, all using `apiFetch`. The client
  normalises the base URL, applies a 20s timeout (90s for AI), converts non-2xx
  responses into `ApiError` with the backend's `code`, and handles `204`.
- **Theme:** tokens for a dark “diagnostic workshop” palette, spacing, radii,
  type scale, severity colors, and label helpers. Amber is reserved for
  diagnostic attention; red for danger.
- **Safe areas:** tab screens with custom headers (`Garage`, `Library`) use
  `useSafeAreaInsets`; stack screens use the navigator header.
- **Accessibility:** buttons and checklist rows have roles, labels, states, and
  at least a 44pt touch target. Result cards expose coverage as text, not color
  alone.
- **Error handling:** `ErrorBanner` for recoverable API failures, `EmptyState`
  for genuinely empty data, and a top-level `ErrorBoundary` for render crashes.
- **No offline mode:** every screen requires the backend. The UI says so rather
  than implying cached data. Offline catalog caching is on the roadmap.

## Decisions and trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| `node:sqlite` instead of Prisma/Drizzle | No native install step; zero ORM learning curve | Experimental API; no migration tooling; hand-written SQL |
| Catalog in TypeScript seed, synced by version | Simple content edits; one source of truth | Bump `CATALOG_VERSION` manually; full replace on change |
| AI outputs symptom ids only | Auditable, deterministic ranking; cheap prompts | Taxonomy must cover the language users actually use |
| Coverage score | Explainable, no false statistical confidence | One-sign causes look strong; no negative evidence |
| No auth | Frictionless LAN development | Must never be exposed publicly |
| Expo SDK 54 pin | Works in public-store Expo Go | Newer SDK features unavailable until Expo Go catches up |
| Frame extraction, not video upload to model | Claude has no native video input | Audio and motion nuance are lost |
| No shared types package | Simple Metro/TS setup | Backend and app type definitions must be kept in sync manually |
| No state library | Small app; context is enough | Prop/context growth if the app becomes much larger |
| In-memory uploads | Simple, no orphaned files | Bounded by `MAX_UPLOAD_MB`; large clips cost RAM briefly; photos have a 5 MB vision cap |

## Security and operational notes

- API has no authentication or rate limiting. It is a trusted-LAN tool. Before
  exposing it, add: TLS termination, bearer auth or sessions, per-user vehicle
  ownership, rate limits on AI endpoints, and a strict CORS allow-list.
- The API key is never returned by any endpoint. Logs contain method, path,
  status and duration only — not bodies or headers.
- Error responses in production hide internal messages; the full error is logged
  server-side.
- Graceful shutdown on SIGINT/SIGTERM closes the HTTP server and the database,
  with a 5s forced-exit guard.
- WAL mode allows concurrent reads while a write is in progress. This app is
  single-writer by nature, so no connection pool is needed.

## Testing strategy

- **Unit:** the diagnosis engine with hand-built fixtures. Covers vehicle-type
  filtering, the confidence regression, empty input, sorting, severity ties and
  unknown-id detection.
- **Integration:** the real Express app against a temporary SQLite file on an
  ephemeral port. Covers health, API index, catalog filtering, vehicle CRUD,
  validation, unknown fields, diagnosis + history, wrong-vehicle rejection,
  deletion cascade, malformed JSON, 404s, AI-disabled 503s, and upload MIME
  validation.
- **Not covered:** live Anthropic calls (requires a key, non-deterministic) and
  ffmpeg extraction (machine-dependent). `/health` and startup logs make those
  capability gaps visible.
- **App:** TypeScript strict typecheck plus a Metro production bundle export.
  There is no Jest/Detox suite yet; see Roadmap.

## Roadmap, with architectural notes

1. **OBD-II over Bluetooth** — `react-native-ble-plx` + an ELM327 command layer
   in the app or backend. Normalise fault codes into the same symptom/cause
   shape so the existing engine and UI can rank them. Requires a new input
   source (`source: 'obd'`) and code-to-symptom mapping table.
2. **Offline catalog cache** — cache the catalog/guides in AsyncStorage or
   SQLite; queue diagnosis runs for sync. Would add a cache-version header and
   conflict policy.
3. **Search and filter for the garage** — trivial UI work once the list grows.
4. **More catalog content** — the highest-leverage improvement. The engine is
   only as good as the symptom/cause graph.
5. **Auth** — if this leaves a trusted LAN. Add users, vehicle ownership checks,
   and per-user AI quotas.
6. **Calibrated ranking** — only if enough real outcomes are collected. Until
   then, coverage plus explicit matched signs is more honest than a fake score.
