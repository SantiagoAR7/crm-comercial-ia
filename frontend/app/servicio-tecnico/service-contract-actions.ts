'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getServiceAccess } from './service-access';
import { charges, coveragePayers, validCoverageDate } from './service-coverage';
import { coversWork, rateCents, type ContractRates } from './service-contract-rules';
import { contractId, getContract, writeContract } from './service-contract-store';
import { addDays, generateContractNotices, madridToday } from './service-preventives';
import { getEquipment } from './service-store';

const base = '/servicio-tecnico?vista=contratos';

function input(form: FormData, key: string, maximum = 120) {
  const value = form.get(key);
  return typeof value === 'string' && value.length <= maximum ? value.trim() : '';
}

export async function saveServiceContract(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect('/servicio-tecnico/login');
  const id = input(form, 'id', 36);
  const previousRevision = input(form, 'revision', 36);
  const details = base + (previousRevision ? '&contrato=' + encodeURIComponent(id) : '&nuevoContrato=1');
  const reference = input(form, 'reference');
  const start = input(form, 'start', 10);
  const end = input(form, 'end', 10);
  const rawKind = form.get('kind') ?? 'integral';
  if (rawKind !== 'preventivo' && rawKind !== 'correctivo' && rawKind !== 'integral') redirect(details + '&errorContrato=datos');
  const kind = rawKind;
  const preventive = coversWork(kind, 'preventivo');
  const firstVisit = preventive ? input(form, 'firstVisit', 10) : '';
  const months = preventive ? Number(input(form, 'months', 2)) : 0;
  const rates: ContractRates = {};
  for (const charge of charges) {
    const value = rateCents(form.get('rate-' + charge));
    if (value === null) redirect(details + '&errorContrato=tarifa');
    if (value !== undefined) rates[charge] = value;
  }
  const responseHours = Number(input(form, 'responseHours', 3));
  const rawEquipment = [...new Set(form.getAll('equipment'))];
  const payers = coveragePayers('Contrato', form);
  if (!contractId.test(id) || (previousRevision && !contractId.test(previousRevision))
    || !reference || !validCoverageDate(start) || Number(start.slice(0, 4)) < 1900
    || (preventive && (!validCoverageDate(firstVisit) || firstVisit < start || Number(firstVisit.slice(0, 4)) > 9998
      || !Number.isInteger(months) || months < 1 || months > 36))
    || (form.get('end') && (!validCoverageDate(end) || end < (firstVisit || start)))
    || !Number.isInteger(responseHours) || responseHours < 1 || responseHours > 720
    || rawEquipment.length < 1 || rawEquipment.length > 25
    || !rawEquipment.every(value => typeof value === 'string' && contractId.test(value))
    || !payers || Object.values(payers).includes('pending')) redirect(details + '&errorContrato=datos');
  const equipmentIds = rawEquipment as string[];
  const equipment = await Promise.all(equipmentIds.map(getEquipment));
  const customer = equipment[0]?.customer_name;
  const customerId = equipment[0]?.id_cliente;
  if (!customer || equipment.some(item => !item || (customerId != null
    ? String(item.id_cliente) !== String(customerId)
    : item.id_cliente != null || item.customer_name !== customer))) redirect(details + '&errorContrato=equipos');

  const written = await writeContract({ id, revision: randomUUID(), record: {
    reference, customer, equipmentIds, kind, rates, start, end, firstVisit, months, responseHours, payers,
  } }, previousRevision);
  if (!written) redirect(base + '&contrato=' + id + '&errorContrato=estado');
  redirect(base + '&contrato=' + id + '&guardado=1');
}

export async function generateServicePreventives(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect('/servicio-tecnico/login');
  const contract = await getContract(input(form, 'id', 36));
  if (!contract) redirect(base + '&errorContrato=datos');
  const detail = base + '&contrato=' + contract.id;
  if (!coversWork(contract.record.kind, 'preventivo')) redirect(detail + '&errorContrato=sinPreventivos');
  if (input(form, 'revision', 36) !== contract.revision) redirect(detail + '&errorContrato=estado');
  const through = input(form, 'through', 10);
  const today = madridToday();
  const limit = addDays(today, 366);
  if (!validCoverageDate(through) || through < today || through > limit) redirect(detail + '&errorContrato=horizonte');
  const { created, expected, unavailable } = await generateContractNotices(contract, today, through);
  redirect(detail + '&generados=' + created + '&previstos=' + expected + '&noDisponibles=' + unavailable);
}
