export const chargeLabels = {
  material: 'Material',
  labor: 'Mano de obra',
  travel: 'Desplazamiento',
} as const;

export type Charge = keyof typeof chargeLabels;
export const charges = Object.keys(chargeLabels) as Charge[];

export const payerLabels = {
  customer: 'Cliente',
  contract: 'Contrato',
  manufacturer: 'Fabricante',
  pending: 'Pendiente de verificar',
} as const;

export type Payer = keyof typeof payerLabels;
export type Payers = Record<Charge, Payer>;

export function coveragePayers(coverage: string, form: FormData): Payers | null {
  if (coverage === 'Contrato') {
    return readPayers(form, 'contract', { material: 'customer', labor: 'contract', travel: 'contract' });
  }
  if (coverage === 'Fuera de cobertura') {
    return { material: 'customer', labor: 'customer', travel: 'customer' };
  }
  if (coverage !== 'Garantía de fabricante') return null;
  return readPayers(form, 'manufacturer');
}

function readPayers(form: FormData, provider: 'contract' | 'manufacturer', defaults?: Payers): Payers | null {
  const allowed: string[] = ['customer', provider, 'pending'];
  const entries = charges.map(charge => form.get('payer-' + charge));
  if (entries.every(value => value === null) && defaults) return defaults;
  if (!entries.every(value => typeof value === 'string' && allowed.includes(value))) return null;
  const [material, labor, travel] = entries as Payer[];
  return { material, labor, travel };
}

export function validCoverageDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function canScheduleWithQuote(notice: Pick<import('./service-store').ServiceNotice,
  Charge | 'payers' | 'quotes'>) {
  const total = priceForCustomer(notice.payers, notice);
  const latest = notice.quotes?.at(-1);
  return total !== null && (latest ? latest.decision?.outcome === 'accepted' : total === 0);
}

export function priceForCustomer(
  payers: Payers | undefined,
  amounts: Record<Charge, number | null>,
) {
  let total = 0;
  for (const charge of charges) {
    const payer = payers?.[charge];
    if (payer === 'pending') return null;
    if (payer === 'contract' || payer === 'manufacturer') continue;
    const amount = amounts[charge];
    if (amount === null) return null;
    total += amount;
  }
  return total;
}

export function quoteDeliveryInProgress(delivery: { state: string; at: string } | undefined) {
  return delivery?.state === 'sending' && Date.now() - Date.parse(delivery.at) < 120_000;
}
