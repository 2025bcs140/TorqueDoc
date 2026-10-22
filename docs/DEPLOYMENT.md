# Deployment

TorqueDoc has three deployable pieces:

1. **`backend/`** — the Express API, SQLite database, diagnosis engine and the
   only place the Anthropic key is read. This must be reachable from the phone.
2. **`app/` (mobile)** — the Expo client. Expo Go can load it from a development
   server, or Gradle/EAS can produce a standalone Android build. Its API URL is
   baked in at bundle time, so deploy the backend first.
3. **`app/` (web)** — the same Expo client exported for browsers. The Render
   Blueprint builds this as the static site `torquedoc-web`, which needs no
   local Metro server or phone install.

The repository includes `render.yaml` for a one-click Render Blueprint and
`backend/Dockerfile` for any Docker host. The optional `API_ACCESS_TOKEN` gate
and in-process rate limiter are intended for a personal/demo deployment, not a
multi-tenant product. The token is embedded in the APK and static web bundle,
so treat it as an abuse gate, not as a user login.

## Option A — Render Blueprint

1. In the Render dashboard, choose **New → Blueprint**.
2. Connect the GitHub repository and select the `main` branch.
3. Render reads `render.yaml`, creates the API service `torquedoc-api`, the
   static web client `torquedoc-web`, and generates `API_ACCESS_TOKEN`.
4. Add `ANTHROPIC_API_KEY` in the API service's **Environment** tab if you want
   the free-text, photo and video features. Leave it unset to keep the AI routes
   disabled with a clear `503`.
5. Wait for the API health check at `/health` to pass. The public URLs are
   normally `https://torquedoc-api.onrender.com` and
   `https://torquedoc-web.onrender.com`.
6. Copy the generated `API_ACCESS_TOKEN` value from Render if you are building
   the mobile app yourself. The static web build receives the same value through
   the Blueprint's `fromService` reference.
7. In `app/.env`:

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=https://torquedoc-api.onrender.com
   EXPO_PUBLIC_API_ACCESS_TOKEN=<the value from Render>
   ```

8. Restart Expo (`Ctrl+C`, then `npx expo start`) because `EXPO_PUBLIC_*`
   values are inlined by Metro. Scan the QR code with Expo Go.

### Hosted web client and dashboard

Once the Blueprint sync completes:

- The full app is at `https://torquedoc-web.onrender.com`. It uses the same
  garage, checklist, diagnosis, history and repair-guide flows as the phone app.
- The API also serves a lightweight owner dashboard at
  `https://torquedoc-api.onrender.com/dashboard`.
- Opening `https://torquedoc-api.onrender.com/` in a browser redirects to that
  dashboard. API clients that request JSON still receive the route index.

The static site is rebuilt whenever `app/` changes. If you rotate
`API_ACCESS_TOKEN`, trigger a new web deploy so the new token is baked into the
bundle. Free static sites and free web services are separate Render resources;
the static site stays available even when the API service is waking up, but its
first data request still waits for the API cold start.

### Important: free-plan persistence

Render's free web service has an **ephemeral filesystem**. The SQLite file at
`/data/torquedoc.db` works while the instance is running, but garage and history
records reset when the service redeploys or wakes from sleep. For durable data,
upgrade the service to a paid instance and uncomment the disk block in
`render.yaml` (or attach a 1 GB disk mounted at `/data` in the dashboard).

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
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e TRUST_PROXY=true \
  torquedoc-api
```

The image contains `ffmpeg` and `ffprobe`, so video analysis works without a
host-level install. Check it with:

```bash
curl https://your-host.example/health
```

A healthy response looks like:

```json
{
  "ok": true,
  "database": "ok",
  "ai": { "configured": true, "model": "claude-sonnet-5-5" },
  "videoAnalysis": "available",
  "uptimeSeconds": 12
}
```

## Environment variables

| Variable | Required on a public host | Notes |
|---|---|---|
| `PORT` | Usually provided by the host | Render sets this automatically. |
| `DB_PATH` | Yes | Use a path on the persistent volume, e.g. `/data/torquedoc.db`. |
| `API_ACCESS_TOKEN` | Strongly recommended | 16+ characters. The app sends it as `X-TorqueDoc-Key`. |
| `TRUST_PROXY` | Yes behind a proxy | Makes rate limiting use `X-Forwarded-For` correctly. |
| `ANTHROPIC_API_KEY` | For AI features | Server-side only; never put it in `app/.env` or the repository. |
| `CORS_ORIGIN` | Optional | Keep `*` for the mobile app and Render static site, or narrow it to your web origin. |
| `MAX_UPLOAD_MB` | Optional | Default 30 MB. Photos are separately capped at 5 MB. |
| `RATE_LIMIT_PER_MINUTE` | Optional | Default 240 requests/minute per IP. |
| `AI_RATE_LIMIT_PER_MINUTE` | Optional | Default 10 AI requests/minute per IP. |

## Security checklist

- [ ] GitHub repository is private, or you are comfortable with the source
      being public. No `.env` file or database is committed.
- [ ] `ANTHROPIC_API_KEY` is set only in the hosting provider's secret store.
- [ ] `API_ACCESS_TOKEN` is set and the app's value matches it.
- [ ] HTTPS is enabled by the host (Render does this automatically).
- [ ] `/health` passes and `ai.configured` is what you expect.
- [ ] You understand this is a single shared garage/history, not per-user data.
      Do not invite multiple unrelated users until real authentication and a
      per-user schema are added.

## Building the app for stores

Expo Go is enough for testing, but it is not a deployed app binary. To produce
an installable build, configure an Expo account and EAS:

```bash
cd app
npx eas-cli build --platform android
```

Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_API_ACCESS_TOKEN` in the EAS
build profile (or in the environment that runs `eas build`) before building.
The app must use HTTPS outside development; iOS/Android release builds reject
cleartext HTTP by default.
