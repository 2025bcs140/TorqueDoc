# TorqueDoc app

Expo (React Native + TypeScript) mobile app. It holds no catalog data and no AI
keys: vehicles, symptoms, repair guides, diagnosis and history all come from the
backend in `../backend`.

## Requirements

- Node.js 22.5+ (same as the backend)
- The backend running on the same network
- **Expo Go** on a phone, or an iOS simulator / Android emulator
- This project is pinned to **Expo SDK 54**, because that is the SDK the
  public-store Expo Go app runs. Do not bump `expo` without checking which SDK
  the store build supports; newer SDKs require a sideloaded Expo Go or a
  development build.

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

Then scan the QR code with Expo Go, or press `i` / `a` in the Expo terminal for a
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
  (`192.168.56.x` is often a host-only adapter that a phone cannot reach).
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

Both devices need to be on the same network. The first time the backend starts,
allow Node.js through the Windows firewall on port 3000.

`EXPO_PUBLIC_*` variables are inlined by Metro at bundle time. **Restart Expo**
after changing `.env` (and reload the app). If the URL is malformed, the app
shows a clear error instead of a generic network failure.

The token is bundled into the app. It stops a public URL from being an open AI
proxy, but it is not user authentication. See
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for hosting instructions.

A free Render instance sleeps after inactivity, so the first request can take
50 seconds or more. Normal requests wait up to 75 seconds; AI requests wait up
to 90 seconds. A paid instance or a host without spin-down removes that delay.

## What's in the app

### Screens

| Screen | Purpose |
|---|---|
| **Garage** (tab) | Vehicle list, add button, pull-to-refresh, empty/error states. |
| **Repair library** (tab) | All guides, filter by car/motorcycle, search titles and tools. |
| **Add / edit vehicle** | One form for both modes; per-field validation; edit prefilled. |
| **Vehicle detail** | Specs, entry points to diagnose/library/history, edit and delete (with confirmation). |
| **Diagnose home** | Choose checklist, free text, photo/video, or the disabled OBD placeholder. |
| **Symptom checklist** | Grouped checkboxes, selected count, clear, retry. |
| **Free text** | Prompt, character counter, examples, AI interpretation, then the same rule engine. |
| **Camera capture** | Camera or library, photo or video, preview, size guard, analysis. |
| **Diagnosis result** | Ranked prescription cards, matched signs, severity, AI summary, safety note. |
| **History** | Saved runs for a vehicle, top causes, source, date; opens detail. |
| **History detail** | Full saved matches, refetched by id from `/diagnoses/:id`. |
| **Repair guide detail** | Metadata, tools, safety note, numbered steps with local progress checkboxes. |

### Flow

```
Garage
  └─ VehicleDetail
       ├─ DiagnoseHome
       │    ├─ SymptomChecklist ─┐
       │    ├─ FreeTextSymptom ──┼─▶ DiagnosisResult ─▶ RepairGuideDetail
       │    └─ CameraCapture ────┘
       ├─ RepairLibrary ─▶ RepairGuideDetail
       └─ History ─▶ HistoryDetail ─▶ RepairGuideDetail
```

All three diagnosis inputs call the same backend `/diagnose` endpoint. The app
never computes a diagnosis locally.

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
    AppNavigator.tsx        stack + bottom tabs
    types.ts                typed route params
  screens/                  one screen per file
  services/
    apiClient.ts            base URL, timeout, errors, 204 handling
    vehicleService.ts
    catalogService.ts
    diagnosisService.ts
    aiSymptomService.ts
    imageRecognitionService.ts
  store/VehicleContext.tsx  garage CRUD + single source of truth
  theme/tokens.ts           colors, spacing, type scale, label helpers
  types/index.ts            API-shaped domain types
```

### Networking

`services/apiClient.ts` is the only place that calls `fetch`:

- trims and normalises `EXPO_PUBLIC_API_BASE_URL`, rejects malformed values with
  a specific message,
- 20s timeout for normal requests, 90s for AI (`AI_TIMEOUT_MS` on the backend is
  60s, so the client margin is deliberate),
- converts non-2xx responses into `ApiError` with the backend's `code`,
- handles `204 No Content` for DELETE,
- does **not** set `Content-Type` on FormData, so React Native can add its own
  multipart boundary.

### State and navigation

One `VehicleContext` owns the garage list and CRUD. Diagnosis results are passed
through navigation params because they are immutable snapshots; history detail
refetches by id. There is no Redux/Zustand dependency and no local persistence.

### Theme and accessibility

The palette is a dark “diagnostic workshop”: graphite surfaces, steel blue
structure, amber for diagnostic attention, red for danger. Typography uses
system fonts so there are no font assets to load; `expo-font` is available if
you want to add a display face later.

Key controls have accessibility roles/labels/states and a minimum 44pt touch
target. Severity is never communicated by color alone — the label is always
present.

## Permissions

`app.json` declares:

- iOS: camera, photo library and microphone usage strings. Audio is not analyzed;
  the microphone string exists because the system camera can record video with
  sound.
- Android: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `RECORD_AUDIO`.

The `expo-image-picker` config plugin keeps these permission strings in sync for
future development/builds; Expo Go uses its own host-app permissions.

Camera and library permission denials show an explanation with an “Open
settings” action. Photos over 5 MB or videos over 30 MB are refused before
uploading; the backend enforces both limits independently.

## Video analysis

The vision model accepts images, not raw video. The app uploads the raw clip,
and the backend uses system `ffmpeg` to sample up to three frames. Audio is not
analyzed. If ffmpeg is not installed, photos still work and video returns a
clear `FFMPEG_NOT_FOUND` message from the backend.

The app records at most 15 seconds and requests medium video quality on iOS to
keep uploads under the 30 MB video limit.

## Verification

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android   # production Metro bundle, no device needed
```

There is no Jest/Detox suite yet; the backend has the automated tests. See the
root README for the full verification commands.

`npx expo-doctor` should pass all checks on a fresh clone. If it flags `.expo`
after a local run, confirm `app/.gitignore` still contains `.expo/`.

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
`API_ACCESS_TOKEN`. Copy the exact value and restart Expo.

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

**Camera permission prompt never appears**
Check the OS settings for Expo Go (iOS) or the TorqueDoc/Expo Go app (Android),
grant camera/photos, then return to the screen. The in-app error includes an
“Open settings” shortcut.

**Photo upload fails at 5 MB**
The vision API accepts images up to 5 MB each. Choose a smaller image or lower
the camera resolution; this cap is independent of `MAX_UPLOAD_MB`.

**Video upload fails at 30 MB**
Record a shorter clip, or lower the resolution. The limit is
`MAX_UPLOAD_MB` on the backend and is mirrored in
`CameraCaptureScreen.tsx`; keep them in sync if you change it.

**AI features say not configured**
That comes from the backend (`503 AI_NOT_CONFIGURED`). Add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to `backend/.env` and restart
the backend. The checklist still works without AI.

**HTTP works in Expo Go but might not in a standalone build**
Expo Go allows cleartext LAN traffic during development. Store builds should use
HTTPS. For a production build, point `EXPO_PUBLIC_API_BASE_URL` at an HTTPS
endpoint and add the necessary ATS/Android network-security configuration.

## Roadmap

1. OBD-II Bluetooth input (ELM327) alongside the three existing sources.
2. Offline cache for catalog/guides, with queued diagnosis sync.
3. Search/filter on the Garage list.
4. Optional “edit this diagnosis note” and delete-history actions.
5. A small Jest/React Native Testing Library suite for form validation and
   result rendering.
