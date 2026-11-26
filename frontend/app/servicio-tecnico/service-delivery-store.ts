import { createHash, randomUUID } from 'node:crypto';
import type { ServiceDocument } from './service-document';
import { query } from './service-store';

export type DeliveryState = 'sending' | 'accepted' | 'failed' | 'unknown';
type CompletedAttempt = { state: 'failed'; attempted_at: string; completed_at: string | null };
export type Delivery = {
  id: string;
  notice_id: string;
  kind: ServiceDocument;
  recipient: string;
  is_test: boolean;
  state: DeliveryState;
  attempt: string;
  attempted_at: string;
  completed_at: string | null;
  provider_reference: string | null;
  previous: CompletedAttempt[];
};

export function listServiceDeliveries(notice: string) {
  return query<Delivery>('service_deliveries', { notice_id: 'eq.' + notice, order: 'attempted_at.desc,id.desc', limit: '30' });
}

function deliveryId(notice: string, kind: ServiceDocument, recipient: string, test: boolean) {
  const value = createHash('sha256').update(JSON.stringify([notice, kind, recipient, test])).digest('hex');
  return [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20, 32)].join('-');
}

export async function claimServiceDelivery(notice: string, kind: ServiceDocument, recipient: string, test: boolean) {
  const id = deliveryId(notice, kind, recipient, test);
  const attempt = randomUUID();
  const attempted_at = new Date().toISOString();
  const [created] = await query<Delivery>('service_deliveries', { on_conflict: 'id' }, {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ id, notice_id: notice, kind, recipient, is_test: test, state: 'sending', attempt, attempted_at }),
  });
  if (created) return created;

  const [previous] = await query<Delivery>('service_deliveries', { id: 'eq.' + id, state: 'eq.failed' });
  if (!previous) return null;
  const [retry] = await query<Delivery>('service_deliveries', {
    id: 'eq.' + id, state: 'eq.failed', attempt: 'eq.' + previous.attempt,
  }, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      state: 'sending', attempt, attempted_at, completed_at: null, provider_reference: null,
      previous: [...previous.previous, { state: 'failed', attempted_at: previous.attempted_at, completed_at: previous.completed_at }],
    }),
  });
  return retry ?? null;
}

export async function finishServiceDelivery(delivery: Delivery, state: Exclude<DeliveryState, 'sending'>, reference?: string) {
  const rows = await query<{ id: string }>('service_deliveries', {
    id: 'eq.' + delivery.id, attempt: 'eq.' + delivery.attempt, state: 'eq.sending', select: 'id',
  }, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ state, completed_at: new Date().toISOString(), provider_reference: reference || null }),
  });
  return rows.length === 1;
}
