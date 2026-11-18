# TorqueDoc user guide

TorqueDoc is a private garage and repair assistant for cars, motorcycles and
three kinds of workshop machine: drilling machines, milling machines and lifting
machines. It runs in Expo Go, a standalone Android build, and in a browser at
`/app`. A separate service console is available at `/dashboard`.

## 1. Create an account or sign in

1. Open the app or `https://torquedoc-api.onrender.com/app`.
2. New users choose **Create account**, enter a display name, email and a
   password of at least 8 characters.
3. Returning users sign in with the same email and password. The app restores
   the opaque session token from secure device storage.
4. The session lasts 30 days. Signing out revokes it on the server.

Accounts are isolated. Every garage asset, diagnosis and history request is
scoped to the signed-in account; another account cannot read or change it even
if it knows an id.

## 2. Add an asset

From the **Garage** tab choose **Add asset** and pick one of:

| Type | Usage field | Catalog |
|---|---|---|
| Car | Mileage (miles) | Live NHTSA vPIC makes/models, curated fallback, manual entry |
| Motorcycle | Mileage (miles) | Live NHTSA vPIC makes/models, curated fallback, manual entry |
| Drilling machine | Operating hours | Curated machine makers plus manual entry |
| Milling machine | Operating hours | Curated machine makers plus manual entry |
| Lifting machine | Operating hours | Curated machine makers plus manual entry |

A nickname is optional. Make, model and year are used in cards, diagnosis
history and repair guidance. If the online catalog is unavailable, the form
falls back to the bundled list and still accepts typed make/model values. Live
catalog results are cached by the backend.

## 3. Run a diagnosis

Open an asset from **Garage** and choose a diagnosis input:

- **Symptom checklist** — tick every sign you notice. This path is fully
  deterministic and works without AI.
- **Describe the problem** — write a short description. Workers AI maps it onto
  the catalog's known symptom ids; the deterministic engine ranks causes.
- **Photo** — attach or take a close-up. Photos are limited to 5 MB.
- **Video** — record or select a clip up to 60 seconds and 80 MB. The backend
  samples up to three frames with ffmpeg; the soundtrack is not analyzed on this
  path.
- **Sound** — record up to 30 seconds or choose an audio file. ffmpeg creates a
  mono 16 kHz WAV and Cloudflare `clef-omni` classifies the sound pattern.

A result shows causes ordered by matched evidence, severity, a coverage
percentage (not a calibrated probability), the exact symptoms that matched, and
a link to a step-by-step repair guide. Results are decision support, not a
safety certification.

When the run is started from a saved asset, the backend stores a snapshot in
**Service history**. Changing the catalog later does not rewrite old records.

## 4. History and repair guides

- **History** lists saved runs for the selected asset with source, date, symptom
  count and top cause.
- Opening a record shows the saved ranked matches and links to guides.
- A repair guide includes difficulty, estimated time, tools, safety notes and
  numbered steps with local progress checkboxes.
- Deleting an asset also deletes its history. On web, use the browser
  confirmation shown by the delete action.

## 5. Profile

The **Profile** tab shows:

- Display name, email, member-since date and a workshop status
  (`New workshop`, `Ready`, or `In the bay`).
- Counts for assets, machines and diagnoses, including this month.
- The latest and recent diagnosis activity with links back to history.
- A referral code/link derived from the account id. **Share referral** copies the
  link on web or opens the native share sheet.
- Storage provider (Postgres in production, SQLite locally) and sign-out.

## 6. Browser dashboard

`https://torquedoc-api.onrender.com/dashboard` is a service console that uses the
same account as the app.

1. Sign in with your TorqueDoc email and password. The garage stays hidden until
   the session is verified.
2. Use the navy sidebar: **Dashboard**, **Garage**, **Diagnose**, **History**,
   **Activity**, and **Logout**.
3. Add or edit assets, run a symptom check, review ranked causes, and open the
   repair guide without leaving the console.
4. Data is fetched from the account-scoped API; the console only caches the
   opaque session token in browser storage.

## 7. AI and privacy

- Cloudflare Workers AI is the only AI provider required by the free
  deployment. It handles text, vision and `clef-omni` audio analysis using a
  server-side key.
- Uploaded photos, videos and audio are processed for the request and are not
  stored in the database. History stores symptom ids, labels and ranked matches.
- Cloudflare's standard Workers AI inference is zero-retention and does not
  train on submitted content. The app states this before media analysis.
- Without Cloudflare credentials, AI buttons return `503 AI_NOT_CONFIGURED`.
  Checklist diagnosis, garage, history and repair guides remain fully usable.
- Without ffmpeg, photo analysis still works but video and sound return
  `FFMPEG_NOT_FOUND`. The production Docker image installs ffmpeg.

## 8. Common limits

| Item | Limit |
|---|---|
| Photo | 5 MB |
| Video | 80 MB, 60 seconds |
| Audio | 20 MB, 30 seconds |
| Overall multipart upload | 100 MB |
| Password | 8–200 characters |
| Session | 30 days |
| AI video analysis timeout | below the backend's 180-second ceiling |

The app and backend enforce these independently. A backend rejection is shown
as a readable error rather than a silent failure.

## 9. Troubleshooting

- **Cold start** — a free Render service may take 30–60 seconds to wake. Normal
  requests wait up to 75 seconds; media AI calls scale up to 200 seconds.
- **Invalid credentials** — check the email casing and password. Emails are
  case-insensitive; passwords are not.
- **Live vehicle catalog unavailable** — the form automatically uses the
  curated fallback. You can always type the make and model manually.
- **Camera/microphone permissions** — grant them in the browser or operating
  system settings, then retry. On web, the page must be served over HTTPS or
  `localhost`.
- **Video/audio unavailable** — the host needs ffmpeg. `/health` reports
  `videoAnalysis` and `audioAnalysis` capability.
- **Hosted data resets** — the backend is using SQLite on Render's ephemeral
  filesystem. Set a pooled Neon `DATABASE_URL` in the Render environment; see
  [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 10. Local quick start

```bash
cd backend
npm install
copy .env.example .env
npm run dev

# in another terminal
cd app
npm install
copy .env.example .env
npx expo start
```

The SQLite fallback and seeded catalog are created automatically. Use
`npm test` in `backend/` for the API and diagnosis suite, and
`npm run typecheck` in both packages before committing changes.
