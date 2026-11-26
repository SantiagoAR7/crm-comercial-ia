import { createHmac, timingSafeEqual } from 'node:crypto';
import { getNotice } from './service-store';

const lifetime = 14 * 24 * 60 * 60 * 1000;
const origin = 'https://crm.iadavofrio.com';

function signature(payload: string) {
  const secret = process.env.SERVICE_DELIVERY_SECRET;
  if (!secret || secret.length < 32) throw new Error('Falta configurar el correo de Servicio técnico');
  return createHmac('sha256', secret).update('davofrio:quote-response:' + payload).digest('base64url');
}

export function quoteResponseUrl(id: string, version: number, test: boolean) {
  const payload = [id, version, Date.now() + lifetime, test ? 'test' : 'client'].join('.');
  return origin + '/servicio-tecnico/responder-presupuesto?t=' + payload + '.' + signature(payload);
}

export async function getQuoteResponse(token: string | undefined) {
  if (!token || token.length > 180) return null;
  const match = /^([a-f0-9-]{36})\.([1-9][0-9]{0,7})\.([0-9]{13})\.(test|client)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const [, id, rawVersion, expiry, scope, digest] = match;
  if (Number(expiry) <= Date.now()) return null;
  const expected = signature(token.slice(0, token.lastIndexOf('.')));
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(digest))) return null;

  const notice = await getNotice(id);
  const version = Number(rawVersion);
  if (!notice || notice.quotes?.length !== version) return null;
  return { notice, quote: notice.quotes[version - 1], version, test: scope === 'test' };
}
