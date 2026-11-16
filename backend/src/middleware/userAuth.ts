import { NextFunction, Request, Response } from 'express';
import { getUserBySessionToken } from '../db';
import { User } from '../types';

declare global {
  namespace Express {
    interface Request {
      /** Set by attachUser when a valid TorqueDoc session token is present. */
      user?: User;
    }
  }
}

export function getSessionToken(req: Request): string {
  const authorization = req.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return '';
  return authorization.slice(7).trim();
}

/**
 * Resolve an optional user session. Invalid/expired tokens are left unset so
 * the shared-key guard can still allow public endpoints such as login.
 */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getSessionToken(req);
    if (token) {
      req.user = await getUserBySessionToken(token);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Sign in to continue.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
}
