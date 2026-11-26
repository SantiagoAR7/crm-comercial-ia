import { charges, validCoverageDate, type Charge } from './service-coverage';

export type WarrantyPayer = 'manufacturer' | 'customer' | 'pending';
export type EquipmentWarranty = {
  manufacturer: string;
  reference: string;
  from: string;
  until: string;
  payers: Record<Charge, WarrantyPayer>;
};

export const warrantyStatusLabels = {
  active: 'Garantía vigente',
  expired: 'Garantía vencida',
  future: 'Garantía aún no vigente',
} as const;

export function warrantyStatus(warranty: EquipmentWarranty, date: string) {
  return date < warranty.from ? 'future' : date > warranty.until ? 'expired' : 'active';
}

function value(form: FormData, key: string, max: number) {
  const raw = form.get(key);
  return typeof raw === 'string' && raw.length <= max ? raw.trim() : '';
}

export function readEquipmentWarranty(form: FormData): EquipmentWarranty | null | undefined {
  if (form.get('hasWarranty') !== 'yes') return null;
  const manufacturer = value(form, 'warrantyManufacturer', 120);
  const reference = value(form, 'warrantyReference', 120);
  const from = value(form, 'warrantyFrom', 10);
  const until = value(form, 'warrantyUntil', 10);
  if (!manufacturer || !reference || !validCoverageDate(from) || !validCoverageDate(until) || until < from) return undefined;
  const payers = {} as EquipmentWarranty['payers'];
  for (const charge of charges) {
    const payer = form.get('warranty-payer-' + charge);
    if (payer !== 'manufacturer' && payer !== 'customer' && payer !== 'pending') return undefined;
    payers[charge] = payer;
  }
  return { manufacturer, reference, from, until, payers };
}
