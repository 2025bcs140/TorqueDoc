# TorqueDoc API reference

Base URL during local development: `http://<your-LAN-IP>:3000`. A hosted
deployment uses its HTTPS URL. The server binds to `0.0.0.0`, so a phone on the
same network can reach it.

- JSON request bodies use `Content-Type: application/json`.
- Media uploads use `multipart/form-data`.
- Timestamps are ISO 8601 UTC strings.
- When the backend sets `API_ACCESS_TOKEN`, `/auth/register`, `/auth/login` and
  all account/data/AI routes require `X-TorqueDoc-Key: <token>`. The app sends it
  automatically. This is an abuse gate, not user authentication.
- Garage, catalog, diagnosis, history and AI routes additionally require a
  signed-in account: `Authorization: Bearer <opaque-session-token>`.
- `/health` is deliberately public so hosting platforms can probe it.
- `/app` is the Expo web client. Its static assets are public; Express injects
  the shared key into the HTML at request time. `/dashboard` is an
  account-aware owner page that asks for the same email/password login.

## Errors

Every error response has the same shape:

```json
{
  "error": "symptomIds contains duplicate ids",
  "code": "VALIDATION_ERROR",
  "details": { "unknownSymptomIds": ["s_typo"] }
}
```

`details` is optional. Common codes:

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad/missing field, unknown id, wrong vehicle type, or duplicate symptoms. |
| 400 | `INVALID_JSON` | Body is not valid JSON. |
| 400 | `UPLOAD_ERROR` | Multipart parsing failed (unexpected field or too many files). |
| 401 | `UNAUTHORIZED` | Missing/wrong shared key when `API_ACCESS_TOKEN` is configured. |
| 401 | `AUTH_REQUIRED` | Missing, expired or revoked account session. |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password on login. |
| 404 | `NOT_FOUND` | No route, vehicle, guide or diagnosis with that id, or it belongs to another account. |
| 409 | `EMAIL_TAKEN` | Registration email already exists (case-insensitive). |
| 429 | `RATE_LIMITED` | Per-IP request, auth or AI rate limit exceeded. Check `Retry-After`. |
| 413 | `FILE_TOO_LARGE` | Upload exceeds `MAX_UPLOAD_MB` (default 30 MB). |
| 413 | `PHOTO_TOO_LARGE` | Photo exceeds the vision API's 5 MB per-image limit. |
| 413 | `AUDIO_TOO_LARGE` | Audio exceeds the 20 MB audio limit. |
| 413 | `PAYLOAD_TOO_LARGE` | JSON body exceeds 1 MB. |
| 422 | `VIDEO_UNREADABLE` / `VIDEO_NO_FRAMES` | ffmpeg could not read usable frames from the clip. |
| 422 | `AUDIO_UNREADABLE` | ffmpeg could not find a decodable audio track. |
| 500 | `INTERNAL_ERROR` | Unexpected server error (message is generic in production). |
| 502 | `AI_REQUEST_FAILED` | The configured AI provider rejected the request, returned invalid JSON, or timed out. |
| 503 | `AI_NOT_CONFIGURED` | No valid Cloudflare Workers AI credentials (or optional Anthropic key) are set. |
| 503 | `FFMPEG_NOT_FOUND` | Video or audio analysis requested, but ffmpeg/ffprobe are not on `PATH`. |

---

## Service

### `GET /health`

Liveness plus capability probe. Returns `503` if the database cannot be queried.

```json
{
  "ok": true,
  "database": "ok",
  "ai": {
    "configured": false,
    "provider": null,
    "model": null,
    "audioModel": null
  },
  "auth": "required",
  "videoAnalysis": "unavailable",
  "audioAnalysis": "unavailable",
  "uptimeSeconds": 42
}
```

`videoAnalysis` is `"available"` only when both `ffmpeg` and `ffprobe` respond.
`audioAnalysis` additionally requires a Cloudflare provider. Checks are cached
for the life of the process.

### `GET /`

A small JSON index of routes. Browsers (requests whose `Accept` header includes
`text/html`) are redirected to `/app` (or `/dashboard` if no web build is
present), so opening the base URL does not dump raw JSON at a non-developer.

### `GET /app`

The Expo web client. It is served from `backend/web-dist` when present. The HTML
contains a small `window.__TORQUEDOC_CONFIG__` block with the same-origin API
URL and the shared key, injected by the server at request time.

---

## Accounts

TorqueDoc accounts are email/password based. Registering returns an opaque
session token, and every garage, catalog, diagnosis, history and AI request must
send it as `Authorization: Bearer <token>`. Sessions last 30 days. Only a
SHA-256 hash of the token is stored server-side; the raw token is returned once.

A new account starts with two deletable example vehicles so the app is not
empty. Garage and history data are private to the account that created them.

### `POST /auth/register`

```json
{
  "displayName": "Sam",
  "email": "sam@example.com",
  "password": "correct-horse-battery"
}
```

- `email` required, valid address, case-insensitive.
- `password` required, 8–200 characters.
- `displayName` optional, 2–60 characters; defaults to the email prefix.

`201 Created`:

```json
{
  "token": "tds_4tY...opaque...",
  "expiresAt": "2026-12-04T12:00:00.000Z",
  "user": {
    "id": "7f1d9c6d-...",
    "email": "sam@example.com",
    "displayName": "Sam",
    "createdAt": "2026-11-04T12:00:00.000Z"
  }
}
```

A duplicate email returns `409 EMAIL_TAKEN`. Register and login are rate-limited
per IP.

### `POST /auth/login`

```json
{ "email": "sam@example.com", "password": "correct-horse-battery" }
```

`200 OK` returns the same `{ token, expiresAt, user }` shape. A wrong email or
password both return `401 INVALID_CREDENTIALS` (no account enumeration).

### `GET /auth/me`

Requires a session. Returns:

```json
{ "user": { "id": "7f1d9c6d-...", "email": "sam@example.com", "displayName": "Sam", "createdAt": "..." } }
```

### `POST /auth/logout`

Requires a session. Revokes the current token and returns `204 No Content`.

The app stores only the session token in AsyncStorage. It never stores the
password. A `401 AUTH_REQUIRED` means the session expired or was revoked; sign in
again.

---

## Vehicles

A vehicle is a saved car or motorcycle. `type` is always `"car"` or
`"motorcycle"`. `nickname` may be `null`.

```json
{
  "id": "44e40ba0-3567-41c0-a6de-54cccb88dc4f",
  "type": "car",
  "nickname": "The Daily",
  "make": "Toyota",
  "model": "Corolla",
  "year": 2016,
  "mileage": 78500,
  "createdAt": "2026-07-31T09:40:17.422Z"
}
```

### `GET /vehicles`

```json
{ "vehicles": [ /* Vehicle[] */ ] }
```

Newest first.

### `POST /vehicles`

```json
{
  "type": "car",
  "nickname": "The Daily",
  "make": "Toyota",
  "model": "Corolla",
  "year": 2016,
  "mileage": 78500
}
```

- `type` required, `car` or `motorcycle`
- `make`, `model` required, 1–60 characters after trimming
- `year` integer, 1886 through next calendar year
- `mileage` integer, 0 through 2,000,000
- `nickname` optional, 0–60 characters; empty becomes `null`
- Unknown fields are rejected

Returns `201`:

```json
{ "vehicle": { /* Vehicle */ } }
```

### `GET /vehicles/:id`

```json
{ "vehicle": { /* Vehicle */ } }
```

`404 NOT_FOUND` if it does not exist.

### `PATCH /vehicles/:id`

Any subset of `type`, `nickname`, `make`, `model`, `year`, `mileage`. `nickname:
null` clears it. The merged object is re-validated, so a partial update cannot
produce an invalid vehicle.

```json
{ "mileage": 80000, "nickname": null }
```

Returns the updated vehicle:

```json
{ "vehicle": { /* Vehicle */ } }
```

`400 VALIDATION_ERROR` if no known field is present or an unknown field is sent
(a typo like `milage` is not silently ignored).

### `DELETE /vehicles/:id`

Returns `204 No Content`. Deletes the vehicle **and every diagnosis record**
for it in one transaction.

### `GET /vehicles/:id/history?limit=100`

`limit` is optional, 1–200, default 100. Oldest/newest ordering is newest first.

```json
{
  "history": [
    {
      "id": "0f9c…",
      "vehicleId": "44e4…",
      "source": "checklist",
      "symptomIds": ["s_rough_idle", "s_engine_stalls_idle"],
      "matches": [ /* DiagnosisMatch[] snapshot */ ],
      "createdAt": "2026-08-02T10:14:55.001Z"
    }
  ]
}
```

History stores a snapshot of the matches, so changing the catalog later does
not rewrite past records.

---

## Catalog

### `GET /symptoms?vehicleType=car|motorcycle`

`vehicleType` is required.

```json
{
  "symptoms": [
    {
      "id": "s_wont_start_click",
      "label": "Rapid clicking when you turn the key / press start",
      "category": "starting_charging",
      "vehicleTypes": ["car", "motorcycle"],
      "causeIds": ["c_dead_battery", "c_alternator_failing"]
    }
  ]
}
```

Categories: `engine`, `starting_charging`, `brakes`, `cooling`, `exhaust`,
`drive_chain_clutch`.

### `GET /repair-guides?vehicleType=car|motorcycle`

```json
{
  "repairGuides": [
    {
      "id": "rg_battery",
      "title": "Test and replace the battery",
      "vehicleTypes": ["car", "motorcycle"],
      "category": "starting_charging",
      "difficulty": "easy",
      "estimatedMinutes": 20,
      "toolsNeeded": ["Multimeter", "Socket set"],
      "steps": ["…"]
    }
  ]
}
```

### `GET /repair-guides/:id`

```json
{ "repairGuide": { /* RepairGuide */ } }
```

### `GET /catalog`

Everything, unfiltered, for tooling and future clients.

```json
{ "symptoms": [ /* Symptom[] */ ], "repairGuides": [ /* RepairGuide[] */ ] }
```

---

## Diagnosis

### `POST /diagnose`

```json
{
  "vehicleType": "car",
  "symptomIds": ["s_rough_idle", "s_engine_stalls_idle"],
  "vehicleId": "44e40ba0-3567-41c0-a6de-54cccb88dc4f",
  "source": "checklist"
}
```

- `vehicleType` required.
- `symptomIds` required, non-empty, unique, at most 60, every id must exist
  **and apply to that vehicle type**.
- `vehicleId` optional. If present it must exist and its `type` must match
  `vehicleType`; this prevents logging a car diagnosis against a motorcycle.
- `source` optional: `checklist` (default), `free_text`, `media`, `audio`.

Response:

```json
{
  "matches": [
    {
      "cause": {
        "id": "c_spark_plug_fouled",
        "label": "Fouled or worn spark plug(s)",
        "severity": "medium",
        "vehicleTypes": ["car", "motorcycle"],
        "repairGuideId": "rg_spark_plugs"
      },
      "confidence": 0.6666666666666666,
      "matchedSymptomIds": ["s_rough_idle", "s_engine_stalls_idle"],
      "matchedSymptoms": [
        { "id": "s_rough_idle", "label": "Rough or uneven idle" },
        { "id": "s_engine_stalls_idle", "label": "Engine stalls or dies at idle" }
      ],
      "totalLinkedSymptoms": 3
    }
  ],
  "diagnosisId": "0f9c…"
}
```

`diagnosisId` is `null` when no `vehicleId` was supplied. `confidence` is the
share of that cause's applicable known signs the user reported — **coverage,
not a probability**. Matches are sorted by confidence, then number of matched
signs, then severity (`urgent` first), then label. Causes with zero matches are
omitted. The ranked matches are snapshotted into the record when `vehicleId` is
present.

Possible `400` details:

```json
{
  "error": "Unknown symptom id(s) for a motorcycle: s_check_engine_steady",
  "code": "VALIDATION_ERROR",
  "details": { "unknownSymptomIds": ["s_check_engine_steady"] }
}
```

### `GET /diagnoses/:id`

Fetches one saved record. Used by the app's history detail screen.

```json
{ "diagnosis": { /* DiagnosisRecord */ } }
```

---

## AI features

Both endpoints are optional. They return `503 AI_NOT_CONFIGURED` when the
backend has no valid AI credentials, and `502 AI_REQUEST_FAILED` on an upstream
failure. Cloudflare Workers AI is preferred; set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. Text/vision use `CLOUDFLARE_MODEL` (default
`@cf/mistralai/mistral-small-3.1-24b-instruct`); sound uses
`CLOUDFLARE_AUDIO_MODEL` (default `@cf/cloudflare/clef-omni`). Keep the
Cloudflare account on Workers Free: 10,000 Neurons/day are included, and
requests beyond that fail instead of billing. Anthropic remains an optional
paid text/vision fallback in the code, configured with `ANTHROPIC_API_KEY` and
`ANTHROPIC_MODEL`; it is not required, is not used in the free deployment, and
cannot analyze audio.

### `POST /v1/symptoms/interpret`

```json
{
  "vehicleType": "car",
  "description": "There's a high-pitched squeal and a grinding noise whenever I brake."
}
```

`description` is required, 3–2,000 characters after trimming. The backend sends
the description plus the vehicle's symptom taxonomy to the configured AI
provider and filters the reply to known ids.

```json
{
  "matchedSymptomIds": ["s_squeal_braking", "s_grinding_braking"],
  "summary": "Brakes squeal and grind when stopping."
}
```

This endpoint does **not** run the diagnosis engine. The app calls `/diagnose`
with the returned ids, which keeps the ranking deterministic and auditable.

### `POST /v1/media/analyze`

`multipart/form-data` with:

| Field | Value |
|---|---|
| `vehicleType` | `car` or `motorcycle` |
| `kind` | `photo`, `video` or `audio` |
| `file` | The image, video or audio file |
| `context` | Optional audio hint: `At idle`, `When revving`, `When braking`, `When turning`, `When starting`, `Not sure` |

Photos: JPEG, PNG, WebP or GIF, up to 5 MB each (the vision API's per-image
limit). Videos: MP4, MOV, WebM, AVI, 3GP or MKV; the backend extracts up to three
JPEG frames with ffmpeg. The overall multipart upload limit is `MAX_UPLOAD_MB`
(30 by default). For videos, the app records at most 15 seconds.

Audio: MP3, WAV, M4A/AAC, OGG/Opus or WebM, up to 20 MB. ffmpeg transcodes the
clip to mono 16 kHz 16-bit WAV and trims it to 30 seconds before sending it to
`clef-omni`. The model returns typed sound probabilities; only genuine catalog
sounds (brake squeal, brake grind, rough idle, starter click, exhaust rasp,
chain slap) become `matchedSymptomIds`. Engine knock, ticking, belt squeal and
cooling hiss are returned in `detectedLabels` and `notes` without forcing a
catalog diagnosis. Audio is processed for the request only and is not stored.

```json
{
  "matchedSymptomIds": ["s_squeal_braking"],
  "detectedLabels": [
    { "label": "Brake squeal", "confidence": 0.82 }
  ],
  "notes": "Audio model's best match: Brake squeal (82% sound-match confidence). This is a sound-pattern match, not a confirmed mechanical diagnosis."
}
```

If nothing maps to a known symptom, `matchedSymptomIds` is empty and `notes`
explains what happened; `detectedLabels` may still list visual details that did
not correspond to a symptom. `matchedSymptomIds` is filtered to ids that exist
for the supplied vehicle type; `detectedLabels` is capped at 20; `notes` is
capped at 1,000 characters.

Possible failures:

- `400` wrong `kind`, missing file, or an unsupported MIME type (checked before
  calling the AI provider)
- `413 FILE_TOO_LARGE`
- `413 PHOTO_TOO_LARGE` (image over the vision API's 5 MB limit)
- `413 AUDIO_TOO_LARGE` (audio over 20 MB)
- `422 VIDEO_UNREADABLE` / `VIDEO_NO_FRAMES`
- `422 AUDIO_UNREADABLE`
- `503 FFMPEG_NOT_FOUND`
- `503 AI_NOT_CONFIGURED`

Sound findings are **not** a confirmed mechanical diagnosis, and the app says
so. A clip with no abnormal sound returns an empty `matchedSymptomIds` with a
note.

---

## Examples

PowerShell (when `API_ACCESS_TOKEN` is set, add
`"X-TorqueDoc-Key" = $env:TORQUEDOC_KEY` to the headers as well):

```powershell
# Health
Invoke-RestMethod http://localhost:3000/health

# Create an account (returns a session token)
$register = @{
  displayName = 'Sam'; email = 'sam@example.com'; password = 'correct-horse-battery'
} | ConvertTo-Json
$auth = Invoke-RestMethod http://localhost:3000/auth/register `
  -Method Post -ContentType 'application/json' -Body $register
$headers = @{ Authorization = "Bearer $($auth.token)" }

# Add a car
$body = @{
  type = 'car'; make = 'Mazda'; model = '3'; year = 2019; mileage = 42000
} | ConvertTo-Json
$created = Invoke-RestMethod http://localhost:3000/vehicles `
  -Method Post -ContentType 'application/json' -Headers $headers -Body $body

# Diagnose
$diagnose = @{
  vehicleType = 'car'
  symptomIds = @('s_rough_idle', 's_engine_stalls_idle')
  vehicleId = $created.vehicle.id
  source = 'checklist'
} | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/diagnose `
  -Method Post -ContentType 'application/json' -Headers $headers -Body $diagnose
```

curl (macOS/Linux):

```bash
curl -s http://localhost:3000/health | jq

TOKEN=$(curl -s -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"sam@example.com","password":"correct-horse-battery"}' | jq -r .token)

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/symptoms?vehicleType=motorcycle" | jq

curl -s -X POST http://localhost:3000/diagnose \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"vehicleType":"car","symptomIds":["s_rough_idle","s_engine_stalls_idle"]}' | jq

# Recorded sound (20 MB / 30 seconds max)
curl -s -X POST http://localhost:3000/v1/media/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F vehicleType=car -F kind=audio -F context='When braking' \
  -F file=@brake-squeal.m4a | jq
```
