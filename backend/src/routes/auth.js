import { Router } from 'express';
import {
  createSessionToken,
  expiredSessionCookie,
  getSession,
  sessionCookie,
  verifyCredentials,
} from '../services/auth.js';

export const authRouter = Router();
const attempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;
const maxAttempts = 5;

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

authRouter.post('/login', (req, res) => {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && entry.expiresAt > now && entry.count >= maxAttempts) {
    return res.status(429).json({ error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' });
  }

  const { email, password } = req.body || {};
  if (!verifyCredentials(email, password)) {
    const activeEntry = entry && entry.expiresAt > now
      ? entry
      : { count: 0, expiresAt: now + attemptWindowMs };
    activeEntry.count += 1;
    attempts.set(key, activeEntry);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  attempts.delete(key);
  const normalizedEmail = String(email).trim().toLowerCase();
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(normalizedEmail)));
  return res.json({ data: { email: normalizedEmail } });
});

authRouter.get('/session', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sesión no válida.' });
  return res.json({ data: { email: session.email } });
});

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', expiredSessionCookie());
  return res.json({ ok: true });
});
