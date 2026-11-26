import { validCoverageDate } from './service-coverage';

export const leakResults = {
  not_checked: 'No realizado',
  no_leak: 'Sin fugas detectadas',
  leak_found: 'Fuga detectada',
} as const;

export type RefrigerantWork = {
  performedOn: string;
  refrigerant: string;
  chargeGrams: number | null;
  addedGrams: number | null;
  recoveredGrams: number | null;
  leakResult: keyof typeof leakResults;
  followUp: string;
  technicianCredential: string;
};

export const madridDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

const kilograms = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });

export function formatKilograms(grams: number | null) {
  return grams == null ? '—' : kilograms.format(grams / 1000) + ' kg';
}

function grams(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{1,5}(?:[,.]\d{1,3})?$/.test(value.trim())) return undefined;
  const [integer, decimals = ''] = value.trim().replace(',', '.').split('.');
  return Number(integer) * 1000 + Number(decimals.padEnd(3, '0'));
}

function text(form: FormData, name: string, limit: number) {
  const value = form.get(name);
  if (value === null) return '';
  return typeof value === 'string' && value.length <= limit ? value.trim() : null;
}

export function readRefrigerantWork(form: FormData, today = madridDate()): RefrigerantWork | null | undefined {
  if (form.get('recordRefrigerant') !== 'yes') return null;
  const performedOn = text(form, 'refrigerantDate', 10);
  const refrigerant = text(form, 'refrigerantType', 40);
  const followUp = text(form, 'refrigerantFollowUp', 1200);
  const technicianCredential = text(form, 'refrigerantCredential', 100);
  const leakResult = form.get('refrigerantLeakResult');
  const chargeGrams = grams(form.get('refrigerantCharge'));
  const addedGrams = grams(form.get('refrigerantAdded'));
  const recoveredGrams = grams(form.get('refrigerantRecovered'));
  if (!performedOn || !validCoverageDate(performedOn) || performedOn > today || performedOn.slice(0, 4) < '1900' || !refrigerant
    || followUp === null || technicianCredential === null
    || (leakResult !== 'not_checked' && leakResult !== 'no_leak' && leakResult !== 'leak_found')
    || (leakResult === 'leak_found' && !followUp)
    || chargeGrams === undefined || addedGrams === undefined || recoveredGrams === undefined) return undefined;

  return { performedOn, refrigerant, chargeGrams, addedGrams, recoveredGrams, leakResult, followUp, technicianCredential };
}
