# Deployment

TorqueDoc has three deployable pieces:

1. **`backend/`** — the Express API, SQLite database, diagnosis engine and the
   only place AI credentials are read. This must be reachable from the phone.
2. **`app/` (mobile)** — the Expo client. Expo Go can load it from a development
   server, or Gradle/EAS can produce a standalone Android build. Its API URL is
   baked in at bundle time, so deploy the backend first.
3. **`app/` (web)** — the same Expo client exported for browsers and served by
   the API at `/app`. It needs no local Metro server or phone install.

The repository includes `render.yaml` for a one-click Render Blueprint and
`backend/Dockerfile` for any Docker host. The optional `API_ACCESS_TOKEN` gate
and in-process rate limiter are additional abuse controls for a small public
deployment. Accounts and opaque bearer sessions provide the actual sign-in and
per-user ownership checks. The shared token is embedded in the APK and injected
into the web HTML at request time, so treat it as an abuse gate, not a user
login.

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
5. Wait for the API health check at `/health` to pass. The public URL is
   normally `https://torquedoc-api.onrender.com`.
6. Copy the generated `API_ACCESS_TOKEN` value from Render if you are building
   the mobile app yourself.
7. In `app/.env`:

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=https://torquedoc-api.onrender.com
   EXPO_PUBLIC_API_ACCESS_TOKEN=<the value from Render>
   ```

8. Restart Expo (`Ctrl+C`, then `npx expo start`) because `EXPO_PUBLIC_*`
   values are inlined by Metro. Scan the QR code with Expo Go.

### Hosted web client and dashboard

Once the service is live:

- The full app is at `https://torquedoc-api.onrender.com/app`. It uses the same
  account, private garage, checklist, diagnosis, history, sound and repair-guide
  flows as the phone app.
- A lightweight account dashboard is at
  `https://torquedoc-api.onrender.com/dashboard`. It signs in with the same
  email/password account and hides the garage until authenticated.
- Opening `https://torquedoc-api.onrender.com/` in a browser redirects to
  `/app`. API clients that request JSON still receive the route index.

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

Render's free web service has an **ephemeral filesystem**. The SQLite file at
`/data/torquedoc.db` works while the instance is running, but accounts, sessions,
garages and history reset when the service redeploys or wakes from sleep. For
durable data, upgrade the service to a paid instance and uncomment the disk block
in `render.yaml` (or attach a 1 GB disk mounted at `/data` in the dashboard).

The free instance also spins down after a period of inactivity, so the first
request after a nap is slower. The app waits up to 75 seconds for normal calls
and 90 seconds for AI calls to cover that cold start; a paid instance or a host
without spin-down removes the delay.

## Option B — any Docker host

Build from the repository root:

```bash
docker build -f backend/Dockerfile -t torquedoc-api ./backend
```

Run with a named volume so SQLite survives container replacement:

```bash
docker volume create torquedoc-data
docker run --rm -p 3000:3000 \
  -v torquedoc-data:/data \
  -e PORT=3000 \
  -e DB_PATH=/data/torquedoc.db \
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

## Environment variables

| Variable | Required on a public host | Notes |
|---|---|---|
| `PORT` | Usually provided by the host | Render sets this automatically. |
| `DB_PATH` | Yes | Use a path on the persistent volume, e.g. `/data/torquedoc.db`. |
| `API_ACCESS_TOKEN` | Strongly recommended | 16+ characters. The app sends it as `X-TorqueDoc-Key`. This is an abuse gate, not a password. |
| `TRUST_PROXY` | Yes behind a proxy | Makes rate limiting use `X-Forwarded-For` correctly. |
| `CLOUDFLARE_ACCOUNT_ID` | For AI features | 32-character Cloudflare account id. |
| `CLOUDFLARE_API_TOKEN` | For AI features | Token with Workers AI access. Server-side only; never put it in `app/.env` or the repository. |
| `CLOUDFLARE_MODEL` | Optional | Defaults to `@cf/mistralai/mistral-small-3.1-24b-instruct`. |
| `CLOUDFLARE_VISION_MODEL` | Optional | Separate vision model id; defaults to `CLOUDFLARE_MODEL`. |
| `CLOUDFLARE_AUDIO_MODEL` | Optional | Defaults to `@cf/cloudflare/clef-omni`; used only for recorded sound. |
| `ANTHROPIC_API_KEY` | Optional fallback | Server-side only. Cloudflare is preferred when both are configured. Anthropic cannot analyze audio. |
| `CORS_ORIGIN` | Optional | Keep `*` for the mobile app and Render static site, or narrow it to your web origin. |
| `MAX_UPLOAD_MB` | Optional | Default 30 MB. Photos are separately capped at 5 MB and audio at 20 MB (30 seconds). |
| `RATE_LIMIT_PER_MINUTE` | Optional | Default 240 requests/minute per IP. |
| `AI_RATE_LIMIT_PER_MINUTE` | Optional | Default 10 AI requests/minute per IP. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Optional | Default 12 register/login requests/minute per IP. |

## Security checklist

- [ ] GitHub repository is private, or you are comfortable with the source
      being public. No `.env` file or database is committed.
- [ ] `CLOUDFLARE_API_TOKEN` (and optional `ANTHROPIC_API_KEY`) is set only in
      the hosting provider's secret store.
- [ ] `API_ACCESS_TOKEN` is set and the app's value matches it. Remember it is
      an abuse gate, not a user credential.
- [ ] HTTPS is enabled by the host (Render does this automatically).
- [ ] `/health` passes and `ai.configured`, `videoAnalysis` and `audioAnalysis`
      are what you expect.
- [ ] Accounts and garages are private per user. Use distinct test accounts to
      confirm one account cannot see another's vehicles or history.
- [ ] You understand that a free Render filesystem is ephemeral and can reset
      all accounts, garages and history. Attach a disk for durable data.

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
