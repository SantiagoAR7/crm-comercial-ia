import { createHash } from 'node:crypto';
import { listPreventiveContracts, type ServiceContract } from './service-contract-store';
import { coversWork } from './service-contract-rules';
import { preventiveDates } from './service-preventive-dates';
import { availability, coverages, equipmentLabel, getEquipment, insertPreventiveNotices, type ServiceNotice } from './service-store';

export const madridToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

export function addDays(day: string, days: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

function preventiveId(equipmentId: string, date: string) {
  const value = createHash('sha256').update('davofrio:preventive:' + equipmentId + ':' + date).digest('hex');
  return [value.slice(0, 8), value.slice(8, 12), '8' + value.slice(13, 16), '8' + value.slice(17, 20), value.slice(20, 32)].join('-');
}

export async function generateContractNotices(contract: ServiceContract, from: string, through: string) {
  const terms = contract.record;
  if (!coversWork(terms.kind, 'preventivo')) return { created: 0, expected: 0, unavailable: 0 };
  const first = terms.start > from ? terms.start : from;
  const last = terms.end && terms.end < through ? terms.end : through;
  const days = first <= last ? preventiveDates(terms.firstVisit, terms.months, first, last) : [];
  if (!days.length) return { created: 0, expected: 0, unavailable: 0 };
  const equipment = await Promise.all(terms.equipmentIds.map(getEquipment));
  const notices = equipment.flatMap((item): ServiceNotice[] => item ? days.map(date => ({
    id: preventiveId(item.id, date), stage: 0, customer: terms.customer,
    phone: item.normalized_phone || '', equipmentId: item.id, equipment: equipmentLabel(item),
    serial: item.serial_number || '', issue: 'Revisión preventiva prevista para el ' + date.split('-').reverse().join('/'),
    origin: 'Preventivo', worksheetRequired: true, preventiveDate: date, serviceContractId: contract.id, coverage: coverages[0],
    reference: '', material: null, labor: null, travel: null, part: '', stock: availability[0],
    technician: '', appointment: '', report: '', minutes: null, usedParts: '',
  })) : []);
  const created = await insertPreventiveNotices(notices);
  return { created, expected: notices.length, unavailable: equipment.filter(item => !item).length };
}

export async function generateDailyPreventives(today = madridToday()) {
  const from = addDays(today, -7);
  const through = addDays(today, 30);
  const totals = { from, through, contracts: 0, created: 0, unavailable: 0, failed: 0 };
  let cursor = '';
  for (;;) {
    const batch = await listPreventiveContracts(from, through, cursor);
    for (const contract of batch) {
      totals.contracts++;
      try {
        const result = await generateContractNotices(contract, from, through);
        totals.created += result.created;
        totals.unavailable += result.unavailable;
      } catch (error) {
        totals.failed++;
        console.error('No se pudo generar el preventivo del contrato ' + contract.id, error);
      }
    }
    if (batch.length < 25) return totals;
    cursor = batch[batch.length - 1].id;
  }
}
