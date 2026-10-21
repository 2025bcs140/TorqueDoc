import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-process fixed-window limiter. It is intentionally dependency-free
 * and good enough for a single Render/Railway instance. A multi-instance
 * deployment should move this to Redis or the platform's edge limiter.
 */
function createRateLimiter(max: number) {
  const buckets = new Map<string, Bucket>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    if (config.env === 'test') {
      next();
      return;
    }

    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';

    // Opportunistic cleanup instead of a permanent interval: the map stays
    // small even on a long-running process.
    if (buckets.size > 2_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + 60_000 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter} seconds.`,
        code: 'RATE_LIMITED',
      });
      return;
    }

    next();
  };
}

export const apiRateLimiter = createRateLimiter(config.rateLimitPerMinute);
export const aiRateLimiter = createRateLimiter(config.aiRateLimitPerMinute);
