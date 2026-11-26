export type UsedPart = {
  reference: string;
  units: number;
  location: string;
};

export const maxUsedParts = 12;

export function readUsedParts(form: FormData): UsedPart[] | null {
  const references = form.getAll('usedPartReference');
  const amounts = form.getAll('usedPartUnits');
  const locations = form.getAll('usedPartLocation');
  if (references.length > maxUsedParts || amounts.length !== references.length || locations.length !== references.length) return null;
  const parts: UsedPart[] = [];
  for (const [index, raw] of references.entries()) {
    const rawAmount = amounts[index];
    const rawLocation = locations[index];
    if (typeof raw !== 'string' || typeof rawAmount !== 'string' || typeof rawLocation !== 'string') return null;
    const reference = raw.trim();
    const amount = rawAmount.trim().replace(',', '.');
    const location = rawLocation.trim();
    if (!reference && !amount && !location) continue;
    if (!reference || reference.length > 120 || !location || location.length > 120
      || !/^\d{1,6}(?:\.\d{1,3})?$/.test(amount) || Number(amount) <= 0) return null;
    parts.push({ reference, units: Number(amount), location });
  }
  return parts;
}
