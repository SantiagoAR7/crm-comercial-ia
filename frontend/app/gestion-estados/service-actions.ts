'use server';

import { redirect } from 'next/navigation';
import { hasSession } from './session';
import { advanceNotice, availability, coverages, getNotice, insertNotice, type ServiceNotice } from './service-store';

import { charges, coveragePayers } from './service-coverage';

const base = '/gestion-estados?seccion=servicio-tecnico';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function read(form: FormData, name: string, limit = 250) {
  const value = form.get(name);
  return typeof value === 'string' && value.length <= limit ? value.trim() : '';
}

function cents(form: FormData, name: string) {
  const raw = read(form, name, 12).replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) return null;
  return Math.round(Number(raw) * 100);
}

export async function saveNotice(form: FormData) {
  if (!await hasSession()) redirect('/gestion-estados/login');
  const id = read(form, 'id', 36);
  if (!uuid.test(id)) redirect(base + '&error=datos');
  const detail = base + '&aviso=' + id;
  const step = read(form, 'step', 6);
  if (step === 'create') {
    const customer = read(form, 'customer');
    const issue = read(form, 'issue', 2000);
    if (!customer || !issue) redirect(base + '&nuevo=1&error=datos');
    const notice: ServiceNotice = {
      id, stage: 0, customer, issue, phone: read(form, 'phone', 40),
      equipment: read(form, 'equipment'), serial: read(form, 'serial'), origin: read(form, 'origin'),
      coverage: coverages[0], reference: '', material: null, labor: null, travel: null,
      part: '', stock: availability[0], technician: '', appointment: '', report: '', minutes: null, usedParts: '',
    };
    await insertNotice(notice);
    redirect(detail);
  }

  const notice = await getNotice(id);
  if (!notice) redirect(base + '&error=aviso');
  if (step !== String(notice.stage)) redirect(detail + '&error=estado');

  if (notice.stage === 0) {
    const coverage = read(form, 'coverage');
    const reference = read(form, 'reference');
    const stock = read(form, 'stock');
    const part = read(form, 'part');
    if (!(coverages as readonly string[]).includes(coverage) || coverage === coverages[0]
      || !(availability as readonly string[]).includes(stock) || !reference
      || (stock !== availability[0] && !part)) redirect(detail + '&error=cobertura');
    const payers = coveragePayers(coverage, form);
    if (!payers) redirect(detail + '&error=cobertura');
    const stockLocation = read(form, 'stockLocation');
    if (stock === 'Disponible' && !stockLocation) redirect(detail + '&error=almacen');
    const amounts = { material: null, labor: null, travel: null } as Record<typeof charges[number], number | null>;
    for (const charge of charges) {
      if (payers[charge] !== 'customer') continue;
      const amount = cents(form, charge);
      if (read(form, charge, 100) && amount === null) redirect(detail + '&error=importe');
      amounts[charge] = amount;
    }
    Object.assign(notice, {
      coverage, reference, stock, part, payers,
      stockLocation: stock === 'Disponible' ? stockLocation : '',
      ...amounts,
    });
  } else if (notice.stage === 1) {
    const technician = read(form, 'technician');
    const appointment = read(form, 'appointment');
    if (!technician || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(appointment)
      || !Number.isFinite(Date.parse(appointment))) redirect(detail + '&error=agenda');
    Object.assign(notice, { technician, appointment });
  } else if (notice.stage === 2) {
    const report = read(form, 'report', 4000);
    const minutes = read(form, 'minutes', 4);
    if (!report || !/^\d{1,4}$/.test(minutes) || Number(minutes) === 0) redirect(detail + '&error=parte');
    Object.assign(notice, { report, minutes: Number(minutes), usedParts: read(form, 'usedParts', 2000) });
  } else {
    redirect(detail + '&error=estado');
  }
  notice.stage += 1;
  if (!await advanceNotice(notice)) redirect(detail + '&error=estado');
  redirect(detail);
}
