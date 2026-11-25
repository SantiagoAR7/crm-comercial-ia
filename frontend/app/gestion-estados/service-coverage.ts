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
    return { material: 'customer', labor: 'contract', travel: 'contract' };
  }
  if (coverage === 'Fuera de cobertura') {
    return { material: 'customer', labor: 'customer', travel: 'customer' };
  }
  if (coverage !== 'Garantía de fabricante') return null;
  const allowed = ['customer', 'manufacturer', 'pending'];
  const material = form.get('payer-material');
  const labor = form.get('payer-labor');
  const travel = form.get('payer-travel');
  if (![material, labor, travel].every(value => typeof value === 'string' && allowed.includes(value))) return null;
  return { material: material as Payer, labor: labor as Payer, travel: travel as Payer };
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
