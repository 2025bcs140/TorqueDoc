import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * Minimal request log: method, path, status and duration. Deliberately does
 * not log bodies or headers, so API keys and uploaded content never end up in
 * the console.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (!config.logRequests) return next();

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      `[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`
    );
  });

  next();
}
