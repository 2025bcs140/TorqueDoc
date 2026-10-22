import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { db } from './db';
import { accessTokenGuard } from './middleware/accessToken';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { aiRateLimiter, apiRateLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLogger';
import vehiclesRouter from './routes/vehicles';
import catalogRouter from './routes/catalog';
import diagnoseRouter from './routes/diagnose';
import diagnosesRouter from './routes/diagnoses';
import aiSymptomsRouter from './routes/aiSymptoms';
import mediaAnalyzeRouter from './routes/mediaAnalyze';
import { isFfmpegAvailable } from './services/videoFrames';
import { renderDashboard } from './dashboard';

/**
 * Builds the Express application without binding a port. `index.ts` listens in
 * production; the integration tests import this and listen on an ephemeral
 * port, which keeps the two entry points in sync.
 */
export function createApp(): express.Express {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (config.env === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  app.use(
    cors({
      origin:
        config.corsOrigin === '*'
          ? '*'
          : config.corsOrigin.split(',').map((origin) => origin.trim()),
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // The Expo web export is served from this process so the browser client has
  // the same origin as the API (no CORS, no separate static-site service). It is
  // built without a token; the token is injected into /app's HTML at request
  // time below. `index: false` keeps `/` free for the API index/redirect.
  const webDist = path.join(__dirname, '..', 'web-dist');
  const webIndex = path.join(webDist, 'index.html');
  const hasWebBuild = existsSync(webIndex);

  if (hasWebBuild) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  }

  app.get('/', (req, res) => {
    // Browsers get the full web client; API clients still get the JSON index.
    if ((req.headers.accept ?? '').includes('text/html')) {
      res.redirect(hasWebBuild ? '/app' : '/dashboard');
      return;
    }

    res.json({
      name: 'TorqueDoc API',
      version: '0.2.0',
      docs: 'See docs/API.md in the repository',
      webApp: 'GET /app',
      dashboard: 'GET /dashboard',
      endpoints: {
        health: 'GET /health',
        vehicles: 'GET|POST /vehicles, GET|PATCH|DELETE /vehicles/:id',
        history: 'GET /vehicles/:id/history?limit=100',
        symptoms: 'GET /symptoms?vehicleType=car|motorcycle',
        repairGuides: 'GET /repair-guides?vehicleType=…, GET /repair-guides/:id',
        catalog: 'GET /catalog',
        diagnose: 'POST /diagnose',
        diagnosis: 'GET /diagnoses/:id',
        interpretSymptoms: 'POST /v1/symptoms/interpret',
        analyzeMedia: 'POST /v1/media/analyze',
      },
    });
  });

  /**
   * Zero-build owner dashboard for browsers. It is served before the access
   * guard because a browser cannot attach X-TorqueDoc-Key to the initial HTML
   * request; the page itself embeds the shared key for its same-origin API
   * calls. Like the APK, this is a demo/owner tool, not user authentication.
   */
  app.get(['/dashboard', '/dashboard/'], (_req, res) => {
    res.type('html').send(renderDashboard(config.apiAccessToken));
  });

  if (hasWebBuild) {
    app.get(['/app', '/app/'], (_req, res) => {
      const token = JSON.stringify(config.apiAccessToken).replace(/</g, '\\u003c');
      const html = readFileSync(webIndex, 'utf8').replace(
        '</head>',
        `<script>window.__TORQUEDOC_CONFIG__ = { apiBaseUrl: window.location.origin, apiAccessToken: ${token} };</script></head>`
      );
      res.setHeader('Cache-Control', 'no-store');
      res.type('html').send(html);
    });
  }

  /**
   * Liveness + capability probe. The mobile app does not poll this, but it is
   * useful when debugging the LAN connection and when checking why an AI
   * feature is unavailable.
   */
  app.get('/health', async (_req, res) => {
    let databaseOk = false;
    try {
      db.prepare('SELECT 1').get();
      databaseOk = true;
    } catch {
      databaseOk = false;
    }

    const ffmpegAvailable = await isFfmpegAvailable();

    res.status(databaseOk ? 200 : 503).json({
      ok: databaseOk,
      database: databaseOk ? 'ok' : 'error',
      ai: {
        configured: Boolean(config.anthropicApiKey),
        model: config.anthropicApiKey ? config.anthropicModel : null,
      },
      videoAnalysis: ffmpegAvailable ? 'available' : 'unavailable',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // `/` and `/health` stay public so hosting health checks work without a
  // secret. Everything below this line is gated when API_ACCESS_TOKEN is set.
  app.use(accessTokenGuard);
  app.use(apiRateLimiter);
  app.use('/v1', aiRateLimiter);

  app.use('/vehicles', vehiclesRouter);
  // These routers declare their own full paths (/symptoms, /diagnose, …).
  app.use('/', catalogRouter);
  app.use('/', diagnoseRouter);
  app.use('/diagnoses', diagnosesRouter);
  app.use('/v1/symptoms', aiSymptomsRouter);
  app.use('/v1/media', mediaAnalyzeRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
