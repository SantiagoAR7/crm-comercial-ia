import type { Charge } from './service-coverage';

export const contractTypes = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  integral: 'Integral',
} as const;

export type ContractType = keyof typeof contractTypes;
export type WorkType = Exclude<ContractType, 'integral'>;
export type ContractRates = Partial<Record<Charge, number>>;

export function contractType(value?: ContractType) {
  return value || 'integral';
}

export function workTypeForOrigin(origin: string): WorkType {
  return origin === 'Preventivo' ? 'preventivo' : 'correctivo';
}

export function coversWork(type: ContractType | undefined, work: WorkType) {
  const effectiveType = contractType(type);
  return effectiveType === 'integral' || effectiveType === work;
}

export function rateCents(raw: FormDataEntryValue | null) {
  if (raw == null || raw === '') return undefined;
  if (typeof raw !== 'string' || !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(raw.trim())) return null;
  const [integer, fraction = ''] = raw.trim().replace(',', '.').split('.');
  return Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
}

export function rateInput(cents?: number) {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}
