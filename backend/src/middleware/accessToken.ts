import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Optional shared-key gate for public deployments.
 *
 * The mobile client sends the key in `X-TorqueDoc-Key`. A Bearer token is also
 * accepted so curl/Postman are easy to use. This is deliberately not a user
 * authentication system: it protects an internet-facing demo from casual
 * abuse, while the app remains single-tenant. See docs/ARCHITECTURE.md.
 */
export function accessTokenGuard(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiAccessToken) {
    next();
    return;
  }

  const headerKey = req.get('x-torquedoc-key')?.trim() ?? '';
  const authorization = req.get('authorization') ?? '';
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const provided = headerKey || bearer;

  if (!provided || !safeEqual(provided, config.apiAccessToken)) {
    res.status(401).json({
      error: 'A valid TorqueDoc access key is required.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  next();
}
