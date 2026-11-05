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
 * The mobile client sends the key in `X-TorqueDoc-Key`. A valid user session
 * (attached earlier by attachUser) is also sufficient, so the app can use the
 * standard `Authorization: Bearer <session>` header. A shared Bearer token is
 * still accepted for curl/Postman. Per-user authentication is enforced by
 * requireUser on all garage and diagnosis routes.
 */
export function accessTokenGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }

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
