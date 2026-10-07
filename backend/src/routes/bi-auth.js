import { Router } from 'express';
import {
  biSessionCookieName,
  createSessionToken,
  expiredSessionCookie,
  getSession,
  sessionCookie,
  verifyCredentials,
} from '../services/auth.js';

export const biAuthRouter = Router();
const attempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;
const maxAttempts = 5;

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

biAuthRouter.post('/login', (req, res) => {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && entry.expiresAt > now && entry.count >= maxAttempts) {
    return res.status(429).json({ error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' });
  }

  const { username, email, password } = req.body || {};
  const login = username || email;
  if (!verifyCredentials(login, password, 'bi')) {
    const activeEntry = entry && entry.expiresAt > now
      ? entry
      : { count: 0, expiresAt: now + attemptWindowMs };
    activeEntry.count += 1;
    attempts.set(key, activeEntry);
    return res.status(401).json({ error: 'Correo o contraseña BI incorrectos.' });
  }

  attempts.delete(key);
  const normalizedUsername = String(login).trim().toLowerCase();
  const token = createSessionToken(normalizedUsername, 'bi');
  res.setHeader('Set-Cookie', sessionCookie(token, biSessionCookieName));
  return res.json({ data: { username: normalizedUsername, access: 'bi' } });
});

biAuthRouter.get('/session', (req, res) => {
  const session = getSession(req, biSessionCookieName, 'bi');
  if (!session) return res.status(401).json({ error: 'Sesión BI no válida.' });
  return res.json({ data: { username: session.email, access: 'bi' } });
});

biAuthRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', expiredSessionCookie(biSessionCookieName));
  return res.json({ ok: true });
});
