# TorqueDoc app

Expo (React Native + TypeScript) client for TorqueDoc. It holds no catalog,
provider keys, or passwords: accounts, the private garage, symptoms, repair
guides, diagnosis and history all live in the backend in `../backend`.

The app targets **Expo SDK 54**, the SDK currently shipped by public-store Expo
Go. Keep that pin until the store builds move.

## Requirements

- Node.js 22.5+ (same as the backend)
- The backend running locally or a hosted HTTPS instance
- **Expo Go** on a phone, or an iOS simulator / Android emulator
- A microphone for sound capture (the simulator's microphone support varies)

## Setup

```bash
cd app
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env — see below
npx expo start
```

Start the backend first:

```bash
cd ../backend
npm run dev
```

Scan the QR code with Expo Go, or press `i` / `a` in the Expo terminal for a
simulator.

### Set the backend URL

Hosted backend (works from Expo Go anywhere):

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-service.onrender.com
EXPO_PUBLIC_API_ACCESS_TOKEN=the-backend-shared-key
```

Same-Wi-Fi development against `npm run dev`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
```

For the LAN option, use your computer's **LAN IP**, not `localhost`, and include
the port. Find it with:

- **Windows:** `ipconfig` — use the IPv4 address on the adapter connected to the
  same Wi-Fi as the phone. Ignore VirtualBox/Hyper-V adapters
  (`192.168.56.x` is often a host-only adapter a phone cannot reach).
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

Both devices need to be on the same network. The first time the backend starts,
allow Node.js through the Windows firewall on port 3000.

`EXPO_PUBLIC_*` variables are inlined by Metro at bundle time. **Restart Expo**
after changing `.env` (and reload the app). If the URL is malformed, the app
shows a clear error instead of a generic network failure.

The access token is bundled into the app. It is an abuse gate for a public URL,
**not** user authentication. The signed-in account provides the real
authorization. See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for hosting
instructions and [`../docs/API.md`](../docs/API.md) for the auth endpoints.

A free Render instance sleeps after inactivity, so the first request can take
50 seconds or more. Normal requests wait up to 75 seconds; AI requests wait up
to 90 seconds. A paid instance or a host without spin-down removes that delay.

## Accounts and private data

The app opens on a gradient sign-in screen. New users create an account with a
display name, email and password (8–200 characters). Registering returns an
opaque session token that is stored in AsyncStorage (`torquedoc.session.v1`).
Passwords are typed only on the auth screen and are never stored by the app.

- Each account has its own garage and diagnosis history.
- New accounts receive two deletable example vehicles.
- Sessions last 30 days. A `401` clears the local session and returns to
  sign-in.
- Signing out clears the local session immediately; the token is revoked on the
  server in the background.
- The dashboard at `/dashboard` uses the same account.

No account ever inherits another account's vehicles. New accounts start with
two private example vehicles, and the backend purges pre-account or
migration-inherited rows on startup.

## What's in the app

### Screens

| Screen | Purpose |
|---|---|
| **Auth** | Gradient sign-in / create-account screen with validation and a session boot state. |
| **Garage** (tab) | Private vehicle list, add button, pull-to-refresh, empty/error states. |
| **Repair library** (tab) | All guides, filter by car/motorcycle, search titles and tools. |
| **Add / edit vehicle** | One form for both modes; per-field validation; edit prefilled. |
| **Vehicle detail** | Specs, entry points to diagnose/library/history, edit and delete (with confirmation). |
| **Diagnose home** | Checklist, free text, photo/video, recorded sound, or the disabled OBD placeholder. |
| **Symptom checklist** | Grouped checkboxes, selected count, clear, retry. |
| **Free text** | Prompt, character counter, examples, AI interpretation, then the same rule engine. |
| **Camera capture** | Camera or library, photo or video, preview, size guard, analysis. |
| **Audio capture** | Record up to 30 s or pick an audio file, add a context hint, analyze, show findings. |
| **Diagnosis result** | Ranked prescription cards, matched signs, severity, AI summary, safety note. |
| **History** | Saved runs for a vehicle, top causes, source, date; opens detail. |
| **History detail** | Full saved matches, refetched by id from `/diagnoses/:id`. |
| **Repair guide detail** | Metadata, tools, safety note, numbered steps with local progress checkboxes. |

### Flow

```
AuthScreen
  └─ Authenticated app
       └─ Garage
            ├─ VehicleDetail
            │    ├─ DiagnoseHome
            │    │    ├─ SymptomChecklist ─┐
            │    │    ├─ FreeTextSymptom ──┼─▶ DiagnosisResult ─▶ RepairGuideDetail
            │    │    ├─ CameraCapture ────┤
            │    │    └─ AudioCapture ─────┘
            │    ├─ RepairLibrary ─▶ RepairGuideDetail
            │    └─ History ─▶ HistoryDetail ─▶ RepairGuideDetail
            └─ AddVehicle
```

All diagnosis inputs call the same backend `/diagnose` endpoint. The app never
computes a diagnosis locally. Photo, video and sound analysis only extract
candidate symptoms/findings; the deterministic backend engine ranks causes.

## Project structure

```
App.tsx                     providers, navigation theme, error boundary
src/
  components/               reusable UI
    ChecklistItem.tsx
    EmptyState.tsx
    ErrorBanner.tsx
    ErrorBoundary.tsx
    PrescriptionCard.tsx    ranked cause + coverage + matched signs
    PrimaryButton.tsx
    RepairGuideCard.tsx
    VehicleCard.tsx
  navigation/
    AppNavigator.tsx        stack + bottom tabs, auth switch
    types.ts                typed route params
  screens/                  one screen per file, including AuthScreen and AudioCaptureScreen
  services/
    apiClient.ts            base URL, timeout, bearer/shared-key headers, errors
    authStorage.ts          AsyncStorage session token/user
    authToken.ts            in-memory token + 401 handler
    vehicleService.ts
    catalogService.ts
    diagnosisService.ts
    aiSymptomService.ts
    imageRecognitionService.ts  photo/video/audio multipart upload
  store/
    AuthContext.tsx         session boot, sign-in/register/sign-out
    VehicleContext.tsx      garage CRUD + single source of truth
  theme/tokens.ts           midnight/cyan/amber palette, gradients, type scale
  types/index.ts            API-shaped domain types
```

### Networking and auth lifecycle

`services/apiClient.ts` is the only place that calls `fetch`:

- trims and normalises `EXPO_PUBLIC_API_BASE_URL`, rejects malformed values with
  a specific message,
- adds the shared `X-TorqueDoc-Key` abuse gate when configured,
- adds `Authorization: Bearer <session>` for the signed-in account,
- 75s timeout for normal requests (20s for the session boot check), 90s for AI
  (`AI_TIMEOUT_MS` on the backend is 60s, so the client margin is deliberate),
- converts non-2xx responses into `ApiError` with the backend's `code`,
- handles `204 No Content` for DELETE,
- does **not** set `Content-Type` on FormData, so React Native can add its own
  multipart boundary,
- clears the stored session and returns to auth on a `401 AUTH_REQUIRED`; a
  wrong shared deployment key (`401 UNAUTHORIZED`) is shown as a config error.

`AuthContext` restores the saved session at boot and validates it with
`GET /auth/me`. `VehicleContext` is mounted only while a user is signed in, so
one account's garage cannot leak into another's session.

### State and navigation

`AuthContext` owns the token/user; `VehicleContext` owns the garage. Diagnosis
results are passed through navigation params because they are immutable
snapshots; history detail refetches by id. There is no Redux/Zustand dependency.

### Theme and accessibility

The palette is a midnight “diagnostic workshop”: deep navy surfaces, cyan
structure, amber for diagnostic attention, red for danger. Gradients and
card shadows are in `theme/tokens.ts`. Typography uses system fonts so there are
no font assets to load.

Key controls have accessibility roles/labels/states and a minimum 44pt touch
target. Severity is never communicated by color alone — the label is always
present. The audio screen calls its result “findings”, explains that a
recording is not a confirmed diagnosis, and never pretends the model heard a
problem when it did not.

## Media capture

| Kind | App source | Limits | What happens |
|---|---|---|---|
| Photo | Camera or library (`expo-image-picker`) | JPEG/PNG/WebP/GIF, 5 MB | Sent to the vision model as an image. |
| Video | Camera or library (`expo-image-picker`) | MP4/MOV/WebM/AVI/3GP/MKV, 30 MB upload; at most 15 s recorded | Backend extracts up to three frames with ffmpeg. |
| Sound | Microphone (`expo-audio`) or file picker (`expo-document-picker`) | MP3/WAV/M4A/AAC/OGG/Opus/WebM, 20 MB, trimmed to 30 s | Backend transcodes to mono 16 kHz WAV and sends typed questions to `clef-omni`. |

The sound screen supports a context hint (`At idle`, `When revving`,
`When braking`, `When turning`, `When starting`, `Not sure`). Recording
auto-stops at 30 seconds and can be stopped manually. On web the recording is a
`MediaRecorder` blob; the backend strips MIME parameters such as
`audio/webm;codecs=opus` before validating.

Audio is processed only for the request and is not stored in SQLite. Only the
resulting symptom ids/findings and ranked diagnosis are saved.

## Permissions

`app.json` declares:

- iOS: camera, photo library and microphone usage strings. The microphone is
  used by the sound screen, not only by video recording.
- Android: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `RECORD_AUDIO`.

The `expo-image-picker`, `expo-audio` and `expo-asset` config plugins keep these
permission strings and native assets in sync. Expo Go uses its own host-app
permissions; a standalone build needs a rebuild after changing them.

Camera, library and microphone denials show an explanation with an “Open
settings” action where available. Photos over 5 MB, videos over 30 MB and audio
over 20 MB are refused before uploading; the backend enforces every limit
independently.

## Video and sound analysis

The vision model accepts images, not raw video. The app uploads the raw clip and
the backend uses system `ffmpeg` to sample up to three frames. Videos are not
transcribed or listened to on the photo/video path.

For sound, ffmpeg transcodes and trims the clip, then Cloudflare
`@cf/cloudflare/clef-omni` answers typed sound-pattern questions. Only genuine
catalog sounds (brake squeal/grind, rough idle, starter click, exhaust rasp,
chain slap) feed the deterministic engine. Engine knock, ticking, belt squeal and
cooling hiss are reported as findings with a safety-oriented note rather than a
forced cause.

If ffmpeg is not installed, photos still work and video/audio return a clear
`FFMPEG_NOT_FOUND` message from the backend. If Cloudflare credentials are
missing, AI features return `503 AI_NOT_CONFIGURED`; the checklist, garage and
library keep working.

## Verification

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android   # production Metro bundle, no device needed
```

There is no Jest/Detox suite in the app yet; the backend has the automated
tests. See the root README for the full verification commands.

`npx expo-doctor` passes 16/18 in this workspace. The two warnings are expected:
its `.expo` ignore check trips even though `app/.gitignore` covers `.expo/`, and
the local `android/` prebuild folder is intentionally gitignored while
`app.json` holds native config. Run
`npx expo prebuild --platform android --no-install` before a native release if
you change native config (permissions, plugins, version, splash), then rebuild.

## Troubleshooting

**“Couldn't reach the TorqueDoc server at https://…”**
The message includes the exact URL. Check:

1. The hosted backend is running and `/health` returns 200 in a browser.
2. `EXPO_PUBLIC_API_BASE_URL` is HTTPS and has no trailing slash.
3. `EXPO_PUBLIC_API_ACCESS_TOKEN` matches the backend's `API_ACCESS_TOKEN`
   (when one is configured).
4. Expo was restarted after editing `.env`; public env values are baked in.
5. If using a LAN backend instead: the phone and computer are on the same
   Wi-Fi, the URL uses the computer's LAN IP (not `localhost`), includes the
   port, and the firewall allows Node on that port.

**Works in a simulator but not on a phone**
A simulator can reach the host's `localhost`; a physical phone cannot. Use a
hosted HTTPS URL, or the computer's LAN IP, for the phone.

**401 UNAUTHORIZED**
The app's `EXPO_PUBLIC_API_ACCESS_TOKEN` does not match the backend's
`API_ACCESS_TOKEN`. Copy the exact value and restart Expo. This is separate from
`401 AUTH_REQUIRED`, which means the account session expired or was revoked;
sign in again.

**“Project is incompatible with this version of Expo Go”**
This project is SDK 54. Update/force-close Expo Go, confirm
`app/package.json` still has `"expo": "~54.0.37"`, or use a matching Expo Go
build from `expo.dev/go`. Do not bump the SDK casually.

**Metro cache or Babel errors after installing packages**
```bash
npx expo start -c
npx expo install --fix
npx expo-doctor
```
`babel-preset-expo` is an explicit devDependency so npm hoists a single copy;
removing it can produce “Cannot find module babel-preset-expo” after upgrades.
`expo-asset` is an explicit dependency because `expo-audio` needs it; keeping it
pinned to the SDK 54 line avoids duplicate native modules.

**Camera or microphone permission prompt never appears**
Check the OS settings for Expo Go (iOS) or the TorqueDoc/Expo Go app (Android),
grant camera/photos/microphone, then return to the screen. The in-app error
includes an “Open settings” shortcut where the platform supports it.

**Recording works but playback/upload is empty**
Give the app microphone permission and record for at least a second. On a
simulator, use the host microphone input. On web, the browser must allow the
microphone and the page must be served over HTTPS or `localhost`.

**Photo upload fails at 5 MB**
The vision API accepts images up to 5 MB each. Choose a smaller image or lower
the camera resolution; this cap is independent of `MAX_UPLOAD_MB`.

**Video or audio upload fails at the size limit**
Record a shorter clip or lower the resolution. The video ceiling is
`MAX_UPLOAD_MB` (30 MB) and is mirrored in `CameraCaptureScreen.tsx`; audio is
capped at 20 MB and 30 seconds. Keep the app and backend limits in sync.

**AI features say not configured**
That comes from the backend (`503 AI_NOT_CONFIGURED`). Add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to `backend/.env` and restart
the backend. The checklist still works without AI. Audio also needs ffmpeg.
`/health` reports `videoAnalysis` and `audioAnalysis` availability.

**HTTP works in Expo Go but might not in a standalone build**
Expo Go allows cleartext LAN traffic during development. Store builds should use
HTTPS. For a production build, point `EXPO_PUBLIC_API_BASE_URL` at an HTTPS
endpoint and add the necessary ATS/Android network-security configuration.

## Roadmap

1. OBD-II Bluetooth input (ELM327) alongside the five existing input modes.
2. Offline cache for catalog/guides, with queued diagnosis sync.
3. Search/filter on the Garage list.
4. Optional “edit this diagnosis note” and delete-history actions.
5. A small Jest/React Native Testing Library suite for form validation and
   result rendering.
6. More audio sound classes and matching catalog content, kept in step with the
   deterministic engine.
