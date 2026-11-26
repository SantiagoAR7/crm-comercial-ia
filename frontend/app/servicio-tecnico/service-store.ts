import type { BillingReview } from './service-billing';
import { randomUUID } from 'node:crypto';
import type { IncompleteVisit } from './service-visit-outcome';
import type { EquipmentWarranty } from './service-warranty';
import type { Worksheet } from './service-worksheet';
import type { RefrigerantWork } from './service-refrigerant';
import type { UsedPart } from './service-parts';
import type { Charge, Payers } from './service-coverage';
export { coverages } from './service-options';

export const stages = ['Recibido', 'Cobertura revisada', 'Visita agendada', 'Parte cerrado'] as const;
export const availability = ['Por comprobar', 'Disponible', 'Sin existencias'] as const;

export type ServiceQuote = {
  amounts: Record<Charge, number | null>;
  subject: Pick<ServiceNotice, 'customer' | 'equipment' | 'serial' | 'issue'>;
  issuedAt: string;
  testDelivery?: { state: 'sending' | 'accepted' | 'failed' | 'unknown'; at: string };
  customerDelivery?: NonNullable<ServiceQuote['testDelivery']> & { recipient: string };
  decision?: { outcome: 'accepted' | 'rejected'; at: string; evidence: string };
};

export type VisitMail = { attempt: string; recipient: string; state: 'sending' | 'accepted' | 'failed' | 'unknown'; at: string; location: string };
export type VisitChange = {
  appointment: string;
  previousAppointment?: string;
  changedAt?: string;
  test?: VisitMail;
  customer?: VisitMail;
};

export type ServiceNotice = {
  billingReview?: BillingReview;
  visitRevision?: string;
  incompleteVisits?: IncompleteVisit[];
  visitChanges?: VisitChange[];
  quoteRevision?: string;
  quotes?: ServiceQuote[];
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
  coverageFrom?: string;
  coverageUntil?: string;
  manufacturer?: string;
  warrantyReference?: string;
  material: number | null;
  labor: number | null;
  travel: number | null;
  part: string;
  stock: string;
  technician: string;
  technicianId?: string;
  appointment: string;
  plannedMinutes?: number;
  startedAt?: string;
  finishedAt?: string;
  worksheetRequired?: boolean;
  worksheet?: Worksheet;
  report: string;
  minutes: number | null;
  usedParts: string;
  consumedParts?: UsedPart[];
  preventiveDate?: string;
  serviceContractId?: string;
  reportPhotos?: string[];
  reportSignature?: string;
  reportSigner?: string;
  refrigerantWork?: RefrigerantWork;
};

type NoticeRow = { id: string; stage: number; record: Omit<ServiceNotice, 'id' | 'stage'> };
type HistoryRow = { stage: number; changed_at: string };
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export async function query<T>(table: string, params: Record<string, string>, init: RequestInit = {}): Promise<T[]> {
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

export async function listNotices() {
  return query<Pick<ServiceNotice, 'id' | 'stage' | 'customer' | 'equipment' | 'origin' | 'appointment'>>('service_notices', {
    select: 'id,stage,customer:record->>customer,equipment:record->>equipment,origin:record->>origin,appointment:record->>appointment',
    order: 'created_at.desc,id.desc', limit: '100',
  });
}

export function listPendingVisits() {
  return query<Pick<ServiceNotice, 'id' | 'customer' | 'incompleteVisits'>>('service_notices', {
    select: 'id,customer:record->>customer,incompleteVisits:record->incompleteVisits',
    stage: 'eq.2', 'record->>appointment': 'eq.', order: 'created_at.desc,id.desc', limit: '100',
  });
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

export async function insertPreventiveNotices(notices: ServiceNotice[]) {
  if (!notices.length) return 0;
  const rows = await query<{ id: string }>('service_notices', { on_conflict: 'id', select: 'id' }, {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(notices.map(({ id, stage, ...record }) => ({ id, stage, record }))),
  });
  return rows.length;
}

export async function advanceNotice({ id, stage, ...record }: ServiceNotice) {
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + (stage - 1), select: 'id',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
    ...(stage === 2 ? {
      'record->>quoteRevision': record.quoteRevision ? 'eq.' + record.quoteRevision : 'is.null',
    } : {}),
    ...(stage === 3 ? {
      ...visitRevisionFilter(record.visitRevision),
      'record->>appointment': 'eq.' + record.appointment,
      'record->>technician': 'eq.' + record.technician,
      'record->>technicianId': record.technicianId ? 'eq.' + record.technicianId : 'is.null',
      'record->>plannedMinutes': record.plannedMinutes == null ? 'is.null' : 'eq.' + record.plannedMinutes,
      'record->>startedAt': record.startedAt ? 'eq.' + record.startedAt : 'is.null',
    } : {}),
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ stage, record }),
  });
  return rows.length === 1;
}

export type Equipment = {
  id: string;
  customer_name: string | null;
  id_cliente?: string | number | null;
  normalized_phone: string | null;
  brand: string | null;
  model: string | null;
  equipment_type: string | null;
  serial_number: string | null;
  warranty_until: string | null;
  warranty?: EquipmentWarranty;
  location?: string;
  refrigerant?: string;
  chargeGrams?: number | null;
};

const equipmentFields = 'id,id_cliente,customer_name,normalized_phone,brand,model,equipment_type,serial_number,warranty_until';

export function equipmentLabel(equipment: Equipment) {
  return [equipment.brand, equipment.model].filter(Boolean).join(' ') || equipment.equipment_type || 'Equipo';
}

type EquipmentProfile = { id: string; revision: string; record: Omit<Equipment, 'id'> };

export async function searchEquipment(search: string) {
  const term = search.trim().slice(0, 100).replace(/[%*_"\\]/g, '').trim();
  if (term.length < 2) return [];
  const [base, profiles] = await Promise.all([
    query<Equipment>('installations', {
      select: equipmentFields,
      or: '(customer_name.ilike."%' + term + '%",serial_number.ilike."%' + term + '%")',
      order: 'customer_name.asc,id.asc', limit: '25',
    }),
    query<EquipmentProfile>('service_equipment', {
      select: 'id,record',
      or: '(record->>customer_name.ilike."%' + term + '%",record->>serial_number.ilike."%' + term + '%")',
      order: 'id.asc', limit: '25',
    }),
  ]);
  const missing = base.filter(item => !profiles.some(profile => profile.id === item.id)).map(item => item.id);
  const overlays = missing.length ? await query<EquipmentProfile>('service_equipment', {
    select: 'id,record', id: 'in.(' + missing.join(',') + ')',
  }) : [];
  const result = new Map(base.map(item => [item.id, item]));
  for (const profile of [...profiles, ...overlays]) result.set(profile.id, { ...profile.record, id: profile.id });
  const needle = term.toLowerCase();
  return [...result.values()].filter(item => [item.customer_name, item.serial_number].some(value => value?.toLowerCase().includes(needle)))
    .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '', 'es')).slice(0, 25);
}

export async function getEquipmentDetails(id: string) {
  if (!uuid.test(id)) return { equipment: null, revision: '' };
  const [profile] = await query<EquipmentProfile>('service_equipment', { select: 'id,revision,record', id: 'eq.' + id });
  if (profile) return { equipment: { ...profile.record, id }, revision: profile.revision };
  const [equipment] = await query<Equipment>('installations', { select: equipmentFields, id: 'eq.' + id });
  return { equipment: equipment ?? null, revision: '' };
}

export async function getEquipment(id: string) {
  return (await getEquipmentDetails(id)).equipment;
}

export async function saveEquipmentProfile({ id, ...record }: Equipment, revision: string, nextRevision: string) {
  const rows = await query<{ id: string }>('service_equipment', {
    select: 'id', ...(revision ? { id: 'eq.' + id, revision: 'eq.' + revision } : { on_conflict: 'id' }),
  }, {
    method: revision ? 'PATCH' : 'POST',
    headers: { Prefer: revision ? 'return=representation' : 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ id, revision: nextRevision, record }),
  });
  return rows.length === 1;
}

export async function listEquipmentNotices(id: string, exclude: string, offset: number) {
  const rows = await query<Pick<ServiceNotice, 'id' | 'stage' | 'issue' | 'coverage' | 'reference' | 'coverageFrom' | 'coverageUntil' | 'manufacturer' | 'report'> & { created_at: string }>('service_notices', {
    select: 'id,stage,created_at,issue:record->>issue,coverage:record->>coverage,reference:record->>reference,coverageFrom:record->>coverageFrom,coverageUntil:record->>coverageUntil,manufacturer:record->>manufacturer,report:record->>report', 'record->>equipmentId': 'eq.' + id,
    ...(exclude ? { id: 'neq.' + exclude } : {}), order: 'created_at.desc,id.desc', limit: '11', offset: String(offset),
  });
  return rows.map(row => ({ ...row, createdAt: row.created_at }));
}

export async function findRecentEquipmentContract(id: string, today: string) {
  const [row] = await query<Pick<ServiceNotice, 'id' | 'reference' | 'coverageFrom' | 'coverageUntil' | 'manufacturer' | 'payers'>>('service_notices', {
    select: 'id,reference:record->>reference,coverageFrom:record->>coverageFrom,coverageUntil:record->>coverageUntil,manufacturer:record->>manufacturer,payers:record->payers',
    'record->>equipmentId': 'eq.' + id,
    'record->>coverage': 'eq.Contrato', 'record->>coverageFrom': 'lte.' + today,
    or: '(record->>coverageUntil.eq."",record->>coverageUntil.gte.' + today + ')',
    stage: 'gte.1', order: 'created_at.desc,id.desc', limit: '1',
  });
  return row ?? null;
}

export async function linkNoticeEquipment(notice: ServiceNotice, equipment: Equipment) {
  const { id, stage, ...record } = notice;
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + stage, select: 'id',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
    'record->>quoteRevision': record.quoteRevision ? 'eq.' + record.quoteRevision : 'is.null',
    ...(stage === 2 ? {
      'record->>appointment': 'eq.' + record.appointment,
      'record->>technician': 'eq.' + record.technician,
      'record->>technicianId': record.technicianId ? 'eq.' + record.technicianId : 'is.null',
      'record->>plannedMinutes': record.plannedMinutes == null ? 'is.null' : 'eq.' + record.plannedMinutes,
      'record->>startedAt': record.startedAt ? 'eq.' + record.startedAt : 'is.null',
    } : {}),
    ...visitRevisionFilter(record.visitRevision),
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record: {
      ...record, equipmentId: equipment.id, equipment: equipmentLabel(equipment), serial: equipment.serial_number || '',
    } }),
  });
  return rows.length === 1;
}

export type ScheduledVisit = Pick<ServiceNotice, 'id' | 'stage' | 'customer' | 'equipment' | 'technician' | 'technicianId' | 'appointment' | 'origin'> & { plannedMinutes?: string | null };

const scheduledFields = 'id,stage,customer:record->>customer,equipment:record->>equipment,technician:record->>technician,appointment:record->>appointment,technicianId:record->>technicianId,plannedMinutes:record->>plannedMinutes,origin:record->>origin';

function technicianFilter(id: string) {
  return '(record->>technicianId.eq."' + id + '",and(record->>technicianId.is.null,record->>technician.eq."' + id + '"))';
}

export function listTechnicianActivity(id: string, offset: number) {
  return query<ScheduledVisit>('service_notices', {
    select: scheduledFields, stage: 'in.(2,3)', or: technicianFilter(id),
    order: 'record->>appointment.desc,id.desc', limit: '41', offset: String(offset),
  });
}

export function listRefrigerantWork(year: number, offset: number) {
  return query<Pick<ServiceNotice, 'id' | 'customer' | 'equipment' | 'technician'> & { refrigerantWork: RefrigerantWork }>('service_notices', {
    select: 'id,customer:record->>customer,equipment:record->>equipment,technician:record->>technician,refrigerantWork:record->refrigerantWork',
    stage: 'eq.3', and: '(record->refrigerantWork->>performedOn.gte.' + year + '-01-01,record->refrigerantWork->>performedOn.lte.' + year + '-12-31)',
    order: 'record->refrigerantWork->>performedOn.desc,id.desc', limit: '31', offset: String(offset),
  });
}

export function listPreventiveNotices(today: string, overdue: boolean, offset: number) {
  return query<ScheduledVisit & { preventiveDate: string }>('service_notices', {
    select: scheduledFields + ',preventiveDate:record->>preventiveDate',
    stage: 'in.(0,1,2)', 'record->>origin': 'eq.Preventivo',
    'record->>preventiveDate': (overdue ? 'lt.' : 'gte.') + today,
    order: 'record->>preventiveDate.asc,id.asc', limit: '31', offset: String(offset),
  });
}

export async function listScheduledVisits(date: string, technician: string, offset: number, openOnly = false, technicianId?: string, through = date) {
  return query<ScheduledVisit>('service_notices', {
    select: scheduledFields,
    stage: openOnly ? 'eq.2' : 'in.(2,3)',
    and: '(record->>appointment.gte.' + date + 'T00:00,record->>appointment.lte.' + through + 'T23:59)',
    ...(technicianId ? { or: technicianFilter(technicianId) }
      : technician ? { 'record->>technician': 'eq.' + technician } : {}),
    order: 'record->>technician.asc,record->>appointment.asc,id.asc', limit: '41', offset: String(offset),
  });
}

export function listOpenVisitsAround(exclude: string, from: string, before: string, offset: number) {
  return query<Pick<ScheduledVisit, 'id' | 'technician' | 'technicianId' | 'appointment' | 'plannedMinutes'>>('service_notices', {
    select: 'id,technician:record->>technician,technicianId:record->>technicianId,appointment:record->>appointment,plannedMinutes:record->>plannedMinutes',
    stage: 'eq.2', id: 'neq.' + exclude,
    and: '(record->>appointment.gte.' + from + ',record->>appointment.lt.' + before + ')',
    order: 'record->>appointment.asc,id.asc', limit: '100', offset: String(offset),
  });
}

export async function startServiceNotice(notice: ServiceNotice, startedAt: string) {
  const { id, stage, ...record } = notice;
  const rows = await query<{ id: string }>('service_notices', {
    select: 'id', id: 'eq.' + id, stage: 'eq.2',
    'record->>startedAt': 'is.null', 'record->>appointment': 'eq.' + record.appointment,
    'record->>technician': 'eq.' + record.technician,
    'record->>technicianId': record.technicianId ? 'eq.' + record.technicianId : 'is.null',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
    'record->>plannedMinutes': record.plannedMinutes == null ? 'is.null' : 'eq.' + record.plannedMinutes,
    ...visitRevisionFilter(record.visitRevision),
  }, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record: { ...record, startedAt } }),
  });
  return rows.length === 1;
}

export async function rescheduleNotice(notice: ServiceNotice, technician: string, appointment: string, plannedMinutes: number, technicianId: string | undefined, visitChanges: VisitChange[]) {
  const { id, stage, ...record } = notice;
  const rows = await query<{ id: string }>('service_notices', {
    select: 'id', id: 'eq.' + id, stage: 'eq.2',
    'record->>appointment': 'eq.' + record.appointment,
    'record->>technician': 'eq.' + record.technician,
      'record->>technicianId': record.technicianId ? 'eq.' + record.technicianId : 'is.null',
      'record->>plannedMinutes': record.plannedMinutes == null ? 'is.null' : 'eq.' + record.plannedMinutes,
      'record->>startedAt': record.startedAt ? 'eq.' + record.startedAt : 'is.null',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
    ...visitRevisionFilter(record.visitRevision),
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record: { ...record, technician, appointment, plannedMinutes, technicianId, visitChanges, visitRevision: randomUUID() } }),
  });
  return rows.length === 1;
}

export async function updateNoticeQuote({ id, stage, ...record }: ServiceNotice, previousRevision?: string) {
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + stage, select: 'id',
    'record->>quoteRevision': previousRevision ? 'eq.' + previousRevision : 'is.null',
    'record->>equipmentId': record.equipmentId ? 'eq.' + record.equipmentId : 'is.null',
  }, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record }),
  });
  return rows.length === 1;
}

function visitRevisionFilter(revision?: string) {
  return { 'record->>visitRevision': revision ? 'eq.' + revision : 'is.null' };
}

export function visitChangesFor(notice: ServiceNotice): VisitChange[] {
  return notice.visitChanges || (notice.appointment ? [{ appointment: notice.appointment }] : []);
}

export function recordIncompleteVisit(notice: ServiceNotice, visit: IncompleteVisit) {
  return updateVisitRecord(notice, {
    visitChanges: visitChangesFor(notice),
    incompleteVisits: [...(notice.incompleteVisits || []), visit],
    visitRevision: randomUUID(), appointment: '', startedAt: undefined,
  });
}

export function updateVisitMail(notice: ServiceNotice, visitChanges: VisitChange[], visitRevision: string) {
  return updateVisitRecord(notice, { visitChanges, visitRevision });
}

async function updateVisitRecord(notice: ServiceNotice, update: Partial<ServiceNotice>) {
  const { id, stage, ...record } = notice;
  const rows = await query<{ id: string }>('service_notices', {
    id: 'eq.' + id, stage: 'eq.' + stage, select: 'id',
    ...visitRevisionFilter(notice.visitRevision),
    'record->>appointment': 'eq.' + notice.appointment,
    'record->>startedAt': notice.startedAt ? 'eq.' + notice.startedAt : 'is.null',
    'record->>equipmentId': notice.equipmentId ? 'eq.' + notice.equipmentId : 'is.null',
    'record->>technician': 'eq.' + notice.technician,
    'record->>plannedMinutes': notice.plannedMinutes == null ? 'is.null' : 'eq.' + notice.plannedMinutes,
  }, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ record: { ...record, ...update } }),
  });
  return rows.length === 1;
}


export function saveBillingReview(notice: ServiceNotice, review: BillingReview) {
  return updateVisitRecord(notice, { billingReview: review, visitRevision: randomUUID() });
}
