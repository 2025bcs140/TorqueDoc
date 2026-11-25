# Deployment

TorqueDoc has three deployable pieces:

1. **`backend/`** — the Express API, Postgres/SQLite storage, diagnosis engine
   and the only place AI credentials are read. This must be reachable from the
   phone.
2. **`app/` (mobile)** — the Expo client. Expo Go can load it from a development
   server, or Gradle/EAS can produce a standalone Android build. Its API URL is
   baked in at bundle time, so deploy the backend first.
3. **`app/` (web)** — the same Expo client exported for browsers and served by
   the API at `/app`, or deployed as a static site on Vercel. It needs no local
   Metro server or phone install.

The repository includes `render.yaml` for a one-click Render Blueprint,
`vercel.json` for the static web frontend, and `backend/Dockerfile` for any
Docker host. The optional `API_ACCESS_TOKEN` gate
and in-process rate limiter are additional abuse controls for a small public
deployment. Accounts and opaque bearer sessions provide the actual sign-in and
per-user ownership checks. The shared token is embedded in the APK and either
injected into the web HTML at request time (Render) or inlined into the static
Vercel bundle at build time, so treat it as an abuse gate, not a user login.

## Option A — Render Blueprint

1. In the Render dashboard, choose **New → Blueprint**.
2. Connect the GitHub repository and select the `main` branch.
3. Render reads `render.yaml`, creates the API service `torquedoc-api`, and
   generates `API_ACCESS_TOKEN`. The browser client is served by the same
   service at `/app`.
4. For free-text, photo, video and recorded-sound features, add
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the service's
   **Environment** tab:

   1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages)
      (no credit card is required for Workers Free).
   2. Open [Workers AI](https://dash.cloudflare.com/?to=/:account/ai/workers-ai)
      and select **Use REST API**.
   3. Select **Create a Workers AI API Token**, review the prefilled
      `Workers AI - Read` permission, and create it. Copy the token. Do not put
      it in `app/.env` or the repository.
   4. Copy the **Account ID** shown on the same page (32 hexadecimal
      characters).
   5. Leave both values unset to keep the AI routes disabled with a clear
      `503 AI_NOT_CONFIGURED`.

   These two variables are declared with `sync: false` in `render.yaml`. A
   Blueprint sync does **not** copy or create them; it only creates the
   non-secret `CLOUDFLARE_MODEL` value. Add both keys in the service's
   **Environment** tab and click **Save, rebuild, and deploy**. If the sync
   details only mention `CLOUDFLARE_MODEL`, the secrets still need this step.

   The free plan includes 10,000 Neurons/day. Cloudflare's Workers AI data
   policy states **zero retention** for standard inference requests and **no
   training** on Customer Content. The default
   `@cf/mistralai/mistral-small-3.1-24b-instruct` handles text and images, and
   `CLOUDFLARE_AUDIO_MODEL` defaults to `@cf/cloudflare/clef-omni` for sound.
   Higher-end models may require a paid Workers plan; the defaults are available
   on the free allocation. If you need a cheaper vision fallback, set
   `CLOUDFLARE_VISION_MODEL=@cf/meta/llama-3.2-11b-vision-instruct`; it accepts
   one image per request, so the adapter sends the first video frame. Llama 3.2
   Vision also requires a one-time Meta license agreement: send
   `{"prompt":"agree"}` to the model before using it.

   Keep the account on the **Workers Free** plan. The free allocation is
   10,000 Neurons/day shared by all Workers AI models; requests beyond it fail
   instead of charging a card. A 30-second sound clip costs roughly 12 Neurons.
   Anthropic remains an optional text/vision fallback in the code for legacy
   deployments, but it is a paid service and is **not** used or required by this
   project. Do not set `ANTHROPIC_API_KEY` for a free deployment; Anthropic
   cannot analyze recorded sound.
5. Create a free Neon Postgres database for durable accounts, garages and
   history:

   1. Sign in at <https://neon.tech> and create a project. The free plan has no
      card requirement and no 30-day database expiry.
   2. Open **Connect** and copy the **pooled** connection string, including
      `?sslmode=require`.
   3. In Render's **Environment** tab, add `DATABASE_URL` with that value and
      redeploy. `render.yaml` declares it as a non-synced secret, so the value
      belongs in the dashboard rather than the repository.
   4. Confirm `https://torquedoc-api.onrender.com/health` reports
      `"databaseProvider": "postgres"`. Register an account, add an asset, run
      a check, then restart the Render service and confirm the data is still
      present.

6. Wait for the API health check at `/health` to pass. The public URL is
   normally `https://torquedoc-api.onrender.com`.
7. Copy the generated `API_ACCESS_TOKEN` value from Render if you are building
   the mobile app yourself.
8. In `app/.env`:

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=https://torquedoc-api.onrender.com
   EXPO_PUBLIC_API_ACCESS_TOKEN=<the value from Render>
   ```

9. Restart Expo (`Ctrl+C`, then `npx expo start`) because `EXPO_PUBLIC_*`
   values are inlined by Metro. Scan the QR code with Expo Go.

### Hosted web client and dashboard

Once the service is live:

- The full app is at `https://torquedoc-api.onrender.com/app`. It uses the same
  account, private garage, checklist, diagnosis, history, sound and repair-guide
  flows as the phone app.
- A service-console dashboard is at
  `https://torquedoc-api.onrender.com/dashboard`. It signs in with the same
  email/password account, hides the garage until authenticated, and shows only
  the signed-in account's vehicles and diagnosis history.
- Opening `https://torquedoc-api.onrender.com/` in a browser redirects to
  `/app`. API clients that request JSON still receive the route index.
- The same web client can be hosted on Vercel; see **Option C** below. The
  Render `/app` build remains available as a fallback.

The browser build is committed in `backend/web-dist` so the Docker image can
serve it without a separate static-site service. Express injects the shared API
token into `/app`'s HTML at request time; the token is not in the bundle. To
rebuild it after changing the app:

```powershell
cd app
$env:EXPO_NO_DOTENV='1'
npx expo export --platform web --output-dir '..\backend\web-dist' --clear
```

macOS/Linux:

```bash
cd app
EXPO_NO_DOTENV=1 npx expo export --platform web --output-dir ../backend/web-dist --clear
```

Build without `.env` so the bundle does not bake in a token. Rebuild after
changing `app/` code, then commit `backend/web-dist` and redeploy the API. If you
rotate `API_ACCESS_TOKEN`, only a restart/redeploy is needed; the new value is
read from the server environment at request time. Provider AI keys are never
injected into the web HTML.

### Important: free-plan persistence

Render's free web service has an **ephemeral filesystem**, so production does
not use SQLite at `/data`. Accounts, sessions, garages and diagnosis history are
stored in free **Neon Postgres** via `DATABASE_URL`. Neon's free plan is durable,
has no 30-day database expiry, and is reached over the network, so a Render
restart, redeploy or sleep/wake cycle does not erase data.

Without `DATABASE_URL` the backend falls back to SQLite. That is intentional for
local development and tests, not for a public free Render deployment.

The free Render instance also spins down after inactivity, so the first request
after a nap is slower. The app waits up to 75 seconds for normal calls and up to
200 seconds for large AI media calls to cover cold starts. The backend caps video
analysis below its 180-second AI ceiling.

## Option B — any Docker host

Build from the repository root:

```bash
docker build -f backend/Dockerfile -t torquedoc-api ./backend
```

For durable storage, pass a Postgres connection string (Neon or another
provider). The named-volume SQLite example remains useful for an offline demo:

```bash
docker volume create torquedoc-data
docker run --rm -p 3000:3000 \
  -v torquedoc-data:/data \
  -e PORT=3000 \
  -e DATABASE_URL=postgresql://user:password@host/db?sslmode=require \
  -e API_ACCESS_TOKEN=replace-with-a-random-32-character-value \
  -e CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id \
  -e CLOUDFLARE_API_TOKEN=your-workers-ai-token \
  -e CLOUDFLARE_AUDIO_MODEL=@cf/cloudflare/clef-omni \
  -e TRUST_PROXY=true \
  torquedoc-api
```

The image contains `ffmpeg` and `ffprobe`, so video and recorded-sound analysis
work without a host-level install. Check it with:

```bash
curl https://your-host.example/health
```

A healthy response looks like:

```json
{
  "ok": true,
  "database": "ok",
  "ai": {
    "configured": true,
    "provider": "cloudflare",
    "model": "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "audioModel": "@cf/cloudflare/clef-omni"
  },
  "auth": "required",
  "videoAnalysis": "available",
  "audioAnalysis": "available",
  "uptimeSeconds": 12
}
```

## Option C — Vercel web frontend (API on Render)

Vercel can host the Expo web client while Render continues to host the API,
Neon Postgres, ffmpeg and Cloudflare AI calls. This is the recommended split:
Vercel's serverless request-size and duration limits are below TorqueDoc's
media pipeline limits, so do **not** move the upload/AI routes to Vercel
functions.

1. Deploy the API first with **Option A** and note its public URL and
   `API_ACCESS_TOKEN`.
2. Import the GitHub repository into Vercel. The current project is linked to
   `2025bcs140/TorqueDoc` with production branch `main`; pushes to `main`
   auto-deploy. Keep the **Root Directory** at the repository root (`./`); the
   root `vercel.json` handles the `app/` subfolder. For a one-off CLI deploy,
   use `npx vercel link --yes --project torquedoc` and
   `npx vercel deploy --prod` after adding the variables in step 3. Its
   settings are:
   - install: `cd app && npm ci`
   - build: `cd app && npm run export:web`
   - output: `app/dist`
3. In Vercel, add these variables for **Production** and **Preview**, then
   deploy:

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=https://torquedoc-api.onrender.com
   EXPO_PUBLIC_API_ACCESS_TOKEN=<the same value as Render's API_ACCESS_TOKEN>
   ```

   Do not add `DATABASE_URL`, `CLOUDFLARE_*` or `ANTHROPIC_API_KEY` to Vercel.
   The static client only needs the public API URL and the shared abuse-gate
   key. Provider and database credentials stay on Render.
4. Open the Vercel production URL. The current deployment is
   `https://torquedoc-swart.vercel.app`; it serves the app at `/` and `/app`
   also rewrites to the app. If Vercel Authentication is enabled under
   **Project Settings → Deployment Protection**, disable it for a public app.
   The account dashboard remains at
   `https://torquedoc-api.onrender.com/dashboard`.
5. Render currently sets `CORS_ORIGIN=*`, which covers Vercel preview and
   production URLs. If you narrow it, include each Vercel origin you use
   (preview deployments get unique hostnames) and redeploy the API.
6. `render.yaml` sets Render's `PUBLIC_APP_URL` to the current Vercel
   production URL so referral links generated by the profile API point at the
   Vercel app. Change it if you use a custom domain. If you use both Vercel and
   Render `/app`, choose one as the primary referral target.
7. `EXPO_PUBLIC_*` values are inlined at build time. After changing either
   variable, redeploy the Vercel project; restarting is not enough. If you
   rotate `API_ACCESS_TOKEN`, update Render and Vercel together, then rebuild
   any installed mobile binary.

The Vercel project is Git-linked, so pushes to `main` create production
deployments automatically. The CLI flow remains available for one-off deploys.

The committed `backend/web-dist` build remains available as a Render fallback.
Vercel builds a fresh `app/dist` from source, so it does not depend on that
folder.

## Environment variables

| Variable | Required on a public host | Notes |
|---|---|---|
| `PORT` | Usually provided by the host | Render sets this automatically. |
| `DATABASE_URL` | Yes on Render | Pooled Neon/Postgres URL with `?sslmode=require`. Enables durable hosted storage. |
| `DB_PATH` | Local fallback only | SQLite path used only when `DATABASE_URL` is unset. Relative paths resolve from `backend/`. |
| `API_ACCESS_TOKEN` | Strongly recommended | 16+ characters. The app sends it as `X-TorqueDoc-Key`. This is an abuse gate, not a password. |
| `TRUST_PROXY` | Yes behind a proxy | Makes rate limiting use `X-Forwarded-For` correctly. |
| `CLOUDFLARE_ACCOUNT_ID` | For AI features | 32-character Cloudflare account id. |
| `CLOUDFLARE_API_TOKEN` | For AI features | Token with Workers AI access. Server-side only; never put it in `app/.env` or the repository. |
| `CLOUDFLARE_MODEL` | Optional | Defaults to `@cf/mistralai/mistral-small-3.1-24b-instruct`. |
| `CLOUDFLARE_VISION_MODEL` | Optional | Separate vision model id; defaults to `CLOUDFLARE_MODEL`. |
| `CLOUDFLARE_AUDIO_MODEL` | Optional | Defaults to `@cf/cloudflare/clef-omni`; used only for recorded sound. |
| `ANTHROPIC_API_KEY` | Optional fallback | Server-side only. Cloudflare is preferred when both are configured. Anthropic cannot analyze audio. |
| `PUBLIC_APP_URL` | Optional | Public origin used for referral links. This deployment sets it to the Vercel URL in `render.yaml`; defaults to the request origin when unset. |
| `CORS_ORIGIN` | Optional | Keep `*` for the mobile app and Vercel/Render web origins, or narrow it to the exact origins you use. |
| `MAX_UPLOAD_MB` | Optional | Default 100 MB overall upload ceiling. Photos are capped at 5 MB, audio at 20 MB, and video uses `MAX_VIDEO_MB`. |
| `MAX_VIDEO_MB` | Optional | Default 80 MB video upload limit. The app records up to 60 seconds and scales its AI timeout with file size/duration. |
| `RATE_LIMIT_PER_MINUTE` | Optional | Default 240 requests/minute per IP. |
| `AI_RATE_LIMIT_PER_MINUTE` | Optional | Default 10 AI requests/minute per IP. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Optional | Default 12 register/login requests/minute per IP. |

### Vercel frontend variables

These are build-time values for the static web client, not Render secrets:

| Variable | Required on Vercel | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | The Render API origin, e.g. `https://torquedoc-api.onrender.com`. No trailing slash needed. |
| `EXPO_PUBLIC_API_ACCESS_TOKEN` | When the API sets `API_ACCESS_TOKEN` | Must match Render. It is inlined into the browser bundle, so treat it as an abuse gate, not a secret. |

## Security checklist

- [ ] GitHub repository is private, or you are comfortable with the source
      being public. No `.env` file or database is committed.
- [ ] `CLOUDFLARE_API_TOKEN` (and optional `ANTHROPIC_API_KEY`) is set only in
      the hosting provider's secret store.
- [ ] `API_ACCESS_TOKEN` is set and the app's value matches it. Remember it is
      an abuse gate, not a user credential.
- [ ] Vercel has only the two `EXPO_PUBLIC_*` variables; database and provider
      credentials are not present in the static project.
- [ ] If Render's `CORS_ORIGIN` is narrowed, the Vercel production/preview
      origins are included.
- [ ] HTTPS is enabled by the host (Render and Vercel do this automatically).
- [ ] `/health` passes and `ai.configured`, `videoAnalysis` and `audioAnalysis`
      are what you expect.
- [ ] Accounts and garages are private per user. Use distinct test accounts to
      confirm one account cannot see another's assets or history.
- [ ] `DATABASE_URL` points at the intended Neon database. Restart the Render
      service and verify an account, garage asset and diagnosis survive.
- [ ] You understand that Render's free filesystem is ephemeral; do not rely on
      SQLite for hosted production data.

## Building the app for stores

Expo Go is enough for testing, but it is not a deployed app binary. You can
build a direct-install APK locally with Gradle (no Expo account needed):

```bash
cd app
npx expo prebuild --platform android
# make sure app/.env has the hosted API URL and token
cd android
./gradlew assembleRelease
```

The APK is written to
`app/android/app/build/outputs/apk/release/app-release.apk`. A native rebuild is
required after adding `expo-audio`, changing permissions, or changing native
config; a JS reload is not enough. The generated Android project uses the
template debug keystore for release signing, so this is a demo build, not a Play
Store upload. Publish the APK on the repository's **Releases** page so testers
can install it directly.

Alternatively, configure EAS:

```bash
cd app
npx eas-cli build --platform android
```

Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_API_ACCESS_TOKEN` in the EAS
build profile (or in the environment that runs `eas build`) before building.
The app must use HTTPS outside development; iOS/Android release builds reject
cleartext HTTP by default.
