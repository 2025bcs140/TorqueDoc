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

  app.get('/', (_req, res) => {
    res.json({
      name: 'TorqueDoc API',
      version: '0.2.0',
      docs: 'See docs/API.md in the repository',
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
