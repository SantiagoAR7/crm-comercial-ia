import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

export const sessionCookieName = 'crm_session';
export const biSessionCookieName = 'bi_session';
const sessionDurationSeconds = 8 * 60 * 60;

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function sign(value) {
  const secret = process.env.CRM_SESSION_SECRET;
  if (!secret) throw new Error('CRM_SESSION_SECRET no está configurado.');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(email, access = 'crm') {
  const payload = Buffer.from(JSON.stringify({
    email,
    access,
    exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds,
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.', 2);
  const expected = sign(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.email || Number(decoded.exp) <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getSession(req, cookieName = sessionCookieName, expectedAccess = 'crm') {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySessionToken(cookies[cookieName]);
  if (!session || session.access !== expectedAccess) return null;
  return session;
}

export function verifyCredentials(email, password, profile = 'crm') {
  const prefix = profile === 'bi' ? 'BI_ACCESS' : 'CRM_ADMIN';
  const configuredLogin = String(
    process.env[`${prefix}_USERNAME`] ||
    process.env[`${prefix}_EMAIL`] ||
    '',
  ).trim().toLowerCase();
  const storedHash = String(process.env[`${prefix}_PASSWORD_HASH`] || '');
  const [algorithm, saltHex, hashHex] = storedHash.split('$');

  if (!configuredLogin || algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  if (String(email || '').trim().toLowerCase() !== configuredLogin) return false;

  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sessionCookie(token, cookieName = sessionCookieName) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}`;
}

export function expiredSessionCookie(cookieName = sessionCookieName) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
}

export function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Autenticación requerida.' });
  req.crmUser = session;
  return next();
}

export function requireBiAuth(req, res, next) {
  const session = getSession(req, biSessionCookieName, 'bi');
  if (!session) return res.status(401).json({ error: 'Autenticación BI requerida.' });
  req.biUser = session;
  return next();
}
