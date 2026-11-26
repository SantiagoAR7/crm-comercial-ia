import type { ContractRates, ContractType, WorkType } from './service-contract-rules';
import type { Payers } from './service-coverage';
import { query } from './service-store';

export type ContractTerms = {
  reference: string;
  customer: string;
  equipmentIds: string[];
  kind?: ContractType;
  rates?: ContractRates;
  start: string;
  end: string;
  firstVisit: string;
  months: number;
  responseHours: number;
  payers: Payers;
};

export type ServiceContract = { id: string; revision: string; record: ContractTerms };
export const contractId = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fields = 'id,revision,record';

export async function getContract(id: string) {
  if (!contractId.test(id)) return null;
  const [row] = await query<ServiceContract>('service_contracts', { select: fields, id: 'eq.' + id });
  return row ?? null;
}

export function listContracts(offset: number) {
  return query<ServiceContract>('service_contracts', { select: fields, order: 'created_at.desc,id.desc', limit: '31', offset: String(offset) });
}

export function listPreventiveContracts(from: string, through: string, after: string) {
  return query<ServiceContract>('service_contracts', {
    select: fields, 'record->>start': 'lte.' + through,
    and: '(or(record->>end.eq."",record->>end.gte.' + from + '),or(record->>kind.is.null,record->>kind.in.(preventivo,integral)))',
    ...(after ? { id: 'gt.' + after } : {}), order: 'id.asc', limit: '25',
  });
}

export function listEquipmentContracts(equipmentId: string) {
  return query<ServiceContract>('service_contracts', {
    select: fields, record: 'cs.' + JSON.stringify({ equipmentIds: [equipmentId] }),
    order: 'record->>start.desc,created_at.desc,id.desc', limit: '50',
  });
}

export async function getEquipmentContractByReference(equipmentId: string, reference: string) {
  const [row] = await query<ServiceContract>('service_contracts', {
    select: fields, record: 'cs.' + JSON.stringify({ equipmentIds: [equipmentId] }),
    'record->>reference': 'eq.' + reference,
    order: 'record->>start.desc,created_at.desc,id.desc', limit: '1',
  });
  return row ?? null;
}

export async function getEffectiveContract(equipmentId: string, date: string, work: WorkType) {
  const [row] = await query<ServiceContract>('service_contracts', {
    select: fields, record: 'cs.' + JSON.stringify({ equipmentIds: [equipmentId] }),
    'record->>start': 'lte.' + date,
    and: '(or(record->>end.eq."",record->>end.gte.' + date + '),or(record->>kind.is.null,record->>kind.in.(integral,' + work + ')))',
    order: 'record->>start.desc,created_at.desc,id.desc', limit: '1',
  });
  return row ?? null;
}

export async function writeContract(contract: ServiceContract, previousRevision: string) {
  const rows = await query<{ id: string }>('service_contracts', {
    select: 'id', ...(previousRevision ? { id: 'eq.' + contract.id, revision: 'eq.' + previousRevision } : { on_conflict: 'id' }),
  }, {
    method: previousRevision ? 'PATCH' : 'POST',
    headers: { Prefer: previousRevision ? 'return=representation' : 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(contract),
  });
  return rows.length === 1;
}
