import { Router } from 'express';
import {
  createSession,
  createUser,
  getUserCredentialsByEmail,
  revokeSession,
} from '../db';
import { badRequest, isPlainObject } from '../http';
import { authRateLimiter } from '../middleware/rateLimit';
import { getSessionToken, requireUser } from '../middleware/userAuth';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../services/passwords';

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

function parseEmail(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('email is required');
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw badRequest('Enter a valid email address');
  }
  return email;
}

function parsePassword(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('password is required');
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw badRequest(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  return value;
}

function parseDisplayName(value: unknown, email: string): string {
  if (value === undefined || value === null || value === '') {
    const fallback = email.split('@')[0]?.trim();
    return (fallback || 'Driver').slice(0, 60);
  }
  if (typeof value !== 'string') throw badRequest('displayName must be a string');
  const displayName = value.trim();
  if (displayName.length < 2) {
    throw badRequest('displayName must be at least 2 characters');
  }
  if (displayName.length > 60) {
    throw badRequest('displayName must be at most 60 characters');
  }
  return displayName;
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field(s): ${unknown.join(', ')}`, { allowed });
  }
}

router.post('/register', authRateLimiter, (req, res) => {
  if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object');
  rejectUnknownFields(req.body, ['email', 'password', 'displayName']);

  const email = parseEmail(req.body.email);
  const password = parsePassword(req.body.password);
  const displayName = parseDisplayName(req.body.displayName, email);

  if (getUserCredentialsByEmail(email)) {
    res.status(409).json({
      error: 'An account with that email already exists. Sign in instead.',
      code: 'EMAIL_TAKEN',
    });
    return;
  }

  const user = createUser({
    email,
    displayName,
    passwordHash: hashPassword(password),
  });
  const session = createSession(user.id);

  res.status(201).json({
    token: session.token,
    expiresAt: session.expiresAt,
    user,
  });
});

router.post('/login', authRateLimiter, (req, res) => {
  if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object');
  rejectUnknownFields(req.body, ['email', 'password']);

  const email = parseEmail(req.body.email);
  const password = parsePassword(req.body.password);

  const credentials = getUserCredentialsByEmail(email);
  // Always verify against a real hash so an unknown email and a wrong password
  // take comparable time.
  const valid = verifyPassword(password, credentials?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!credentials || !valid) {
    res.status(401).json({
      error: 'Email or password is incorrect.',
      code: 'INVALID_CREDENTIALS',
    });
    return;
  }

  const session = createSession(credentials.user.id);
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: credentials.user,
  });
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireUser, (req, res) => {
  revokeSession(getSessionToken(req));
  res.status(204).end();
});

export default router;
