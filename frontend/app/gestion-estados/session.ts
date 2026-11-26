import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const cookieName = 'workflow_demo_session';
export const serviceCookieName = 'technical_service_session';
export const duration = 60 * 60 * 8;

export function equals(a: string, b: string) {
  const digest = (value: string) => createHmac('sha256', process.env.WORKFLOW_SESSION_SECRET ?? '').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function sign(expires: string, scope: 'workflow' | 'service' = 'workflow') {
  const secret = process.env.WORKFLOW_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac('sha256', secret).update(`${scope === 'service' ? 'technical-service' : 'workflow-demo'}:${expires}`).digest('hex');
}

export async function hasSession(scope: 'workflow' | 'service' = 'workflow') {
  const token = (await cookies()).get(scope === 'service' ? serviceCookieName : cookieName)?.value;
  if (!token) return false;
  const [expires, version, signature, extra] = token.split('.');
  if (extra || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !/^[a-f0-9]{64}$/.test(version || '')) return false;
  const expected = sign(expires + ':' + version, scope);
  if (!expected || !signature || !equals(signature, expected)) return false;
  try {
    const response = await fetch((process.env.WORKFLOW_INTERNAL_API_URL || 'http://crm-api:4000') + '/api/account-recovery/workflow-version', {cache:'no-store',signal:AbortSignal.timeout(15000)});
    return response.ok && (await response.json()).version === version;
  } catch { return false; }
}
