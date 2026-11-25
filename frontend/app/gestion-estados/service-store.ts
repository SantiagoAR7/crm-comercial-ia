import type { Payers } from './service-coverage';
export { coverages } from './service-options';

export const stages = ['Recibido', 'Cobertura revisada', 'Visita agendada', 'Parte cerrado'] as const;
export const availability = ['Por comprobar', 'Disponible', 'Sin existencias'] as const;

export type ServiceNotice = {
  id: string;
  stage: number;
  customer: string;
  phone: string;
  equipment: string;
  equipmentId?: string;
  serial: string;
  issue: string;
  origin: string;
  coverage: string;
  payers?: Payers;
  stockLocation?: string;
  reference: string;
  material: number | null;
  labor: number | null;
  travel: number | null;
  part: string;
  stock: string;
  technician: string;
  appointment: string;
  report: string;
  minutes: number | null;
  usedParts: string;
};

type NoticeRow = { id: string; stage: number; record: Omit<ServiceNotice, 'id' | 'stage'> };
type HistoryRow = { stage: number; changed_at: string };
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

async function query<T>(table: string, params: Record<string, string>, init: RequestInit = {}): Promise<T[]> {
  const url = process.env.SERVICE_SUPABASE_URL;
  const key = process.env.SERVICE_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase para Servicio técnico.');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  const endpoint = new URL('/rest/v1/' + table, url);
  endpoint.search = new URLSearchParams(params).toString();
  const response = await fetch(endpoint, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Supabase rechazó la operación de Servicio técnico (HTTP ${response.status}).`);
  return response.json() as Promise<T[]>;
}

function toNotice({ id, stage, record }: NoticeRow): ServiceNotice {
  return { ...record, id, stage };
}

export async function listNotices(): Promise<ServiceNotice[]> {
  const rows = await query<NoticeRow>('service_notices', {
    select: 'id,stage,record', order: 'created_at.desc,id.desc', limit: '100',
  });
  return rows.map(toNotice);
}

export async function getNotice(id: string): Promise<ServiceNotice | null> {
  if (!uuid.test(id)) return null;
  const [row] = await query<NoticeRow>('service_notices', { select: 'id,stage,record', id: 'eq.' + id });
  return row ? toNotice(row) : null;
}

export async function getNoticeHistory(id: string) {
  const rows = await query<HistoryRow>('service_notice_history', {
    select: 'stage,changed_at', notice_id: 'eq.' + id, order: 'stage.asc',
  });
  return rows.map(row => ({ stage: row.stage, changedAt: row.changed_at }));
}

export async function insertNotice({ id, stage, ...record }: ServiceNotice) {
  await query<{ id: string }>('service_notices', { on_conflict: 'id', select: 'id' }, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ id, stage, record }),
  });
}

export async function advanceNotice({ id, stage, ...record }: ServiceNotice) {
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + (stage - 1), select: 'id',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ stage, record }),
  });
  return rows.length === 1;
}

type Equipment = {
  id: string;
  customer_name: string | null;
  normalized_phone: string | null;
  brand: string | null;
  model: string | null;
  equipment_type: string | null;
  serial_number: string | null;
  warranty_until: string | null;
};

const equipmentFields = 'id,customer_name,normalized_phone,brand,model,equipment_type,serial_number,warranty_until';

export function equipmentLabel(equipment: Equipment) {
  return [equipment.brand, equipment.model].filter(Boolean).join(' ') || equipment.equipment_type || 'Equipo';
}

export async function searchEquipment(search: string) {
  const term = search.trim().slice(0, 100).replace(/[%*_"\\]/g, '').trim();
  if (term.length < 2) return [];
  return query<Equipment>('installations', {
    select: equipmentFields,
    or: '(customer_name.ilike."%' + term + '%",serial_number.ilike."%' + term + '%")',
    order: 'customer_name.asc,id.asc', limit: '25',
  });
}

export async function getEquipment(id: string) {
  if (!uuid.test(id)) return null;
  const [equipment] = await query<Equipment>('installations', { select: equipmentFields, id: 'eq.' + id });
  return equipment ?? null;
}

export async function listEquipmentNotices(id: string, exclude: string, offset: number) {
  const rows = await query<NoticeRow & { created_at: string }>('service_notices', {
    select: 'id,stage,record,created_at', 'record->>equipmentId': 'eq.' + id,
    id: 'neq.' + exclude, order: 'created_at.desc,id.desc', limit: '11', offset: String(offset),
  });
  return rows.map(row => ({ ...toNotice(row), createdAt: row.created_at }));
}

export async function linkNoticeEquipment(notice: ServiceNotice, equipment: Equipment) {
  const { id, stage, ...record } = notice;
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + stage, select: 'id',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record: {
      ...record, equipmentId: equipment.id, equipment: equipmentLabel(equipment), serial: equipment.serial_number || '',
    } }),
  });
  return rows.length === 1;
}
