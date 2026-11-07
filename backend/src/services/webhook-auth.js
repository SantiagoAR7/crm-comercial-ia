import { timingSafeEqual } from 'node:crypto';

// Read configuration per request so missing configuration always fails closed.
export function requireN8nWebhookAuth(req, res, next) {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  const supplied = req.get('x-cliente-secret') || req.get('x-davofrio-secret');
  if (!expected || !supplied) {
    return res.status(401).json({ error: 'Webhook no autorizado.' });
  }

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return res.status(401).json({ error: 'Webhook no autorizado.' });
  }
  return next();
}
