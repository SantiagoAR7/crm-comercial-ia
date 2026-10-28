import { Router } from 'express';
import {
  createSessionToken,
  expiredSessionCookie,
  getSession,
  prospectingSessionCookieName,
  sessionCookie,
  verifyCredentials,
} from '../services/auth.js';

export const prospectingAuthRouter = Router();
const attempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;
const maxAttempts = 5;

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

prospectingAuthRouter.post('/login', (req, res) => {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && entry.expiresAt > now && entry.count >= maxAttempts) {
    return res.status(429).json({ error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' });
  }

  const { username, email, password } = req.body || {};
  const login = username || email;
  if (!verifyCredentials(login, password, 'prospecting')) {
    const activeEntry = entry && entry.expiresAt > now
      ? entry
      : { count: 0, expiresAt: now + attemptWindowMs };
    activeEntry.count += 1;
    attempts.set(key, activeEntry);
    return res.status(401).json({ error: 'Usuario o contraseña de prospección incorrectos.' });
  }

  attempts.delete(key);
  const normalizedUsername = String(login).trim().toLowerCase();
  const token = createSessionToken(normalizedUsername, 'prospecting');
  res.setHeader('Set-Cookie', sessionCookie(token, prospectingSessionCookieName));
  return res.json({ data: { username: normalizedUsername, access: 'prospecting' } });
});

prospectingAuthRouter.get('/session', (req, res) => {
  const session = getSession(req, prospectingSessionCookieName, 'prospecting');
  if (!session) return res.status(401).json({ error: 'Sesión de prospección no válida.' });
  return res.json({ data: { username: session.email, access: 'prospecting' } });
});

prospectingAuthRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', expiredSessionCookie(prospectingSessionCookieName));
  return res.json({ ok: true });
});
