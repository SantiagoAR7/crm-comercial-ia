'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess, noticeBelongsToTechnician } from './service-access';
import { incompleteVisitReasons } from './service-visit-outcome';
import { warrantyStatus } from './service-warranty';
import { coversWork, workTypeForOrigin } from './service-contract-rules';
import { getEquipmentContractByReference } from './service-contract-store';
import { issueServiceCertificate } from './service-certificate-store';
import { readWorksheet } from './service-worksheet';
import { elapsedWorkMinutes, maxWorkedMinutes } from './service-work-time';
import { bookVisit } from './service-booking';
import { defaultVisitMinutes, maxVisitMinutes } from './service-appointment-time';
import { assignedTechnician } from './technician-accounts';
import { advanceNotice, availability, coverages, equipmentLabel, getEquipment, getNotice, insertNotice, linkNoticeEquipment, rescheduleNotice, startServiceNotice, recordIncompleteVisit, updateNoticeQuote, visitChangesFor, type ServiceNotice } from './service-store';

import { readRefrigerantWork } from './service-refrigerant';
import { readUsedParts } from './service-parts';
import { canScheduleWithQuote, charges, coveragePayers, priceForCustomer, quoteDeliveryInProgress, validCoverageDate } from './service-coverage';

const base = '/servicio-tecnico';
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

function issueQuote({ customer, equipment, serial, issue }: ServiceNotice, amounts: Record<typeof charges[number], number | null>) {
  return { amounts, issuedAt: new Date().toISOString(), subject: { customer, equipment, serial, issue } };
}

function imageData(value: FormDataEntryValue | null, kind: 'jpeg' | 'png', limit: number): value is string {
  if (typeof value !== 'string' || value.length > limit) return false;
  const prefix = kind === 'jpeg' ? 'data:image/jpeg;base64,/9j/' : 'data:image/png;base64,iVBORw0KGgo';
  return value.startsWith(prefix) && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(value.indexOf(',') + 1));
}

export async function saveNotice(form: FormData) {
  const access = await getServiceAccess();
  if (!access) redirect('/servicio-tecnico/login');
  const id = read(form, 'id', 36);
  if (!uuid.test(id)) redirect(base + '?error=datos');
  const detail = base + '?aviso=' + id;
  const step = read(form, 'step', 6);
  if (access.role === 'technician' && step !== '2' && step !== 'start' && step !== 'result') redirect(base + '?vista=ordenes');
  if (step === 'create') {
    const equipmentId = read(form, 'equipmentId', 36);
    const equipment = equipmentId ? await getEquipment(equipmentId) : null;
    if (equipmentId && !equipment) redirect(base + '?nuevo=1&error=equipo');
    const customer = equipment?.customer_name || read(form, 'customer');
    const issue = read(form, 'issue', 2000);
    if (!customer || !issue) redirect(base + '?nuevo=1&error=datos');
    const notice: ServiceNotice = {
      id, stage: 0, worksheetRequired: true, customer, issue, phone: read(form, 'phone', 40) || equipment?.normalized_phone || '',
      equipment: equipment ? equipmentLabel(equipment) : read(form, 'equipment'),
      serial: equipment ? equipment.serial_number || '' : read(form, 'serial'),
      equipmentId: equipment?.id, origin: read(form, 'origin'),
      coverage: coverages[0], reference: '', material: null, labor: null, travel: null,
      part: '', stock: availability[0], technician: '', appointment: '', report: '', minutes: null, usedParts: '',
    };
    await insertNotice(notice);
    revalidatePath(base);
    redirect(detail);
  }

  const notice = await getNotice(id);
  if (!notice) redirect(base + '?error=aviso');
  if (access.role === 'technician' && !noticeBelongsToTechnician(notice, access.account.technicianId)) redirect(base + '?vista=ordenes');
  if (step === 'start' || step === '2' || step === 'result') {
    if (notice.stage !== 2 || !notice.appointment || read(form, 'visitRevision', 36) !== (notice.visitRevision || '')) {
      redirect(detail + '&error=estado');
    }
  }
  if (step === 'result') {
    const reason = incompleteVisitReasons.find(value => value === read(form, 'reason'));
    const work = read(form, 'work', 4000);
    const nextAction = read(form, 'nextAction', 1000);
    if (!reason || !work || !nextAction) redirect(detail + '&error=resultadoVisita');
    if (!await recordIncompleteVisit(notice, {
      appointment: notice.appointment, technician: notice.technician, reason, work, nextAction,
      startedAt: notice.startedAt, recordedAt: new Date().toISOString(),
    })) redirect(detail + '&error=estado');
    revalidatePath(base);
    redirect(detail);
  }
  if (step === 'start') {
    if (notice.stage !== 2) redirect(detail + '&error=estado');
    if (!notice.startedAt && !await startServiceNotice(notice, new Date().toISOString())) redirect(detail + '&error=estado');
    revalidatePath(base);
    redirect(detail + '&iniciada=1');
  }
  if (step === 'link') {
    if (quoteDeliveryInProgress(notice.quotes?.at(-1)?.testDelivery)
      || quoteDeliveryInProgress(notice.quotes?.at(-1)?.customerDelivery)) redirect(detail + '&error=correoPresupuesto');
    const equipment = await getEquipment(read(form, 'equipmentId', 36));
    if (!equipment || notice.stage !== 0 && notice.equipmentId) redirect(detail + '&error=equipo');
    if (!await linkNoticeEquipment(notice, equipment)) redirect(detail + '&error=estado');
    revalidatePath(base);
    redirect(detail);
  }
  if (step === 'quote' || step === 'decide') {
    if (notice.stage !== 1 || read(form, 'quoteRevision', 36) !== (notice.quoteRevision || '')) {
      redirect(detail + '&error=estado');
    }
    const previousRevision = notice.quoteRevision;
    const quotes = [...(notice.quotes || [])];
    const latest = quotes.at(-1);
    if (quoteDeliveryInProgress(latest?.testDelivery) || quoteDeliveryInProgress(latest?.customerDelivery)) redirect(detail + '&error=correoPresupuesto');
    if (step === 'decide') {
      const outcome = read(form, 'outcome');
      const evidence = read(form, 'evidence', 1000);
      if (!latest || latest.decision || !evidence || (outcome !== 'accepted' && outcome !== 'rejected')) {
        redirect(detail + '&error=presupuesto');
      }
      quotes[quotes.length - 1] = { ...latest, decision: { outcome, evidence, at: new Date().toISOString() } };
    } else {
      const amounts = { material: notice.material, labor: notice.labor, travel: notice.travel };
      for (const charge of charges) {
        if ((notice.payers?.[charge] || 'customer') === 'customer') amounts[charge] = cents(form, charge);
      }
      const payers = notice.payers && { ...notice.payers };
      for (const charge of charges) {
        if (payers?.[charge] !== 'pending') continue;
        const payer = form.get('resolve-' + charge);
        if (payer !== 'customer' && payer !== (notice.manufacturer ? 'manufacturer' : 'contract')) {
          redirect(detail + '&error=importePresupuesto');
        }
        payers[charge] = payer;
        amounts[charge] = payer === 'customer' ? cents(form, charge) : null;
      }
      const total = priceForCustomer(payers, amounts);
      if (total === null) redirect(detail + '&error=importePresupuesto');
      if (latest && charges.every(charge => latest.amounts[charge] === amounts[charge])) {
        redirect(detail + '&error=mismoPresupuesto');
      }
      Object.assign(notice, amounts, { payers });
      if (total > 0 || latest) quotes.push(issueQuote(notice, amounts));
    }
    if (!await updateNoticeQuote({ ...notice, quotes, quoteRevision: randomUUID() }, previousRevision)) {
      redirect(detail + '&error=estado');
    }
    revalidatePath(base);
    redirect(detail);
  }
  if (step === 'move' || step === '1') {
    const moving = step === 'move';
    if (moving && notice.startedAt) redirect(detail + '&error=iniciada');
    if (notice.stage !== (moving ? 2 : 1)) redirect(detail + '&error=estado');
    if (!moving && (!canScheduleWithQuote(notice)
      || read(form, 'quoteRevision', 36) !== (notice.quoteRevision || ''))) {
      redirect(detail + '&error=presupuesto');
    }
    const value = read(form, 'technician');
    const technicianId = assignedTechnician(value);
    const technician = technicianId || value;
    const appointment = read(form, 'appointment');
    const rawMinutes = form.get('plannedMinutes');
    const duration = rawMinutes === null ? defaultVisitMinutes : Number(read(form, 'plannedMinutes', 3));
    if (!technician || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(appointment)
      || !validCoverageDate(appointment.slice(0, 10)) || Number(appointment.slice(0, 4)) < 1900
      || Number(appointment.slice(0, 4)) > 9998
      || !Number.isInteger(duration) || duration < 1 || duration > maxVisitMinutes) redirect(detail + '&error=agenda');
    if (moving && (read(form, 'previousAppointment') !== notice.appointment
      || read(form, 'previousTechnician') !== notice.technician
      || read(form, 'previousMinutes', 3) !== String(notice.plannedMinutes ?? ''))) redirect(detail + '&error=estado');
    const changes = moving ? visitChangesFor(notice) : [];
    const current = changes.at(-1);
    if (moving && (quoteDeliveryInProgress(current?.test) || quoteDeliveryInProgress(current?.customer))) {
      redirect(detail + '&error=visitaEnviando');
    }
    const visitChanges = !moving || notice.appointment !== appointment
      ? [...changes, { appointment, previousAppointment: moving && notice.appointment ? notice.appointment : undefined, changedAt: new Date().toISOString() }]
      : changes;
    const result = await bookVisit(notice.id, technician, appointment, duration, () => moving
      ? rescheduleNotice(notice, technician, appointment, duration, technicianId, visitChanges)
      : advanceNotice({ ...notice, stage: 2, technician, appointment, plannedMinutes: duration, technicianId, visitChanges }));
    if (result.conflict) redirect(detail + '&error=solapamiento&conflicto=' + result.conflict);
    if (!result.saved) redirect(detail + '&error=estado');
    revalidatePath(base);
    redirect(detail + (moving && notice.appointment ? '&reprogramada=1' : ''));
  }
  if (step !== String(notice.stage)) redirect(detail + '&error=estado');

  if (notice.stage === 0) {
    const coverage = read(form, 'coverage');
    const reference = read(form, 'reference');
    const stock = read(form, 'stock');
    const part = read(form, 'part');
    const manufacturerCoverage = coverage === 'Garantía de fabricante';
    if (manufacturerCoverage && !reference) redirect(detail + '&error=autorizacion');
    if (!(coverages as readonly string[]).includes(coverage) || coverage === coverages[0]
      || !(availability as readonly string[]).includes(stock) || !reference
      || (stock !== availability[0] && !part)) redirect(detail + '&error=cobertura');
    const date = notice.preventiveDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const warranty = manufacturerCoverage && notice.equipmentId ? (await getEquipment(notice.equipmentId))?.warranty : undefined;
    if (warranty && warrantyStatus(warranty, date) !== 'active') redirect(detail + '&error=garantiaVencida');
    const coverageFrom = coverage === 'Contrato' ? read(form, 'coverageFrom', 20) : warranty?.from || '';
    const coverageUntil = coverage === 'Contrato' ? read(form, 'coverageUntil', 20) : warranty?.until || '';
    const manufacturer = manufacturerCoverage ? read(form, 'manufacturer') : '';
    if (coverage === 'Contrato') {
      const known = notice.equipmentId ? await getEquipmentContractByReference(notice.equipmentId, reference) : null;
      if (known && (!coversWork(known.record.kind, workTypeForOrigin(notice.origin)) || known.record.start > date
        || (known.record.end && known.record.end < date))) redirect(detail + '&error=tipoContrato');
      if (!validCoverageDate(coverageFrom) || coverageFrom > date
        || (coverageUntil && (!validCoverageDate(coverageUntil) || coverageUntil < date))) {
        redirect(detail + '&error=vigencia');
      }
    }
    if (manufacturerCoverage && (!manufacturer || (warranty && manufacturer.toLowerCase() !== warranty.manufacturer.toLowerCase()))) redirect(detail + '&error=fabricante');
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
    if (manufacturerCoverage && charges.some(charge => payers[charge] === 'pending'
      || (payers[charge] === 'customer' && amounts[charge] === null))) redirect(detail + '&error=costeGarantia');
    Object.assign(notice, {
      coverage, reference, coverageFrom, coverageUntil, manufacturer, warrantyReference: warranty?.reference, stock, part, payers,
      stockLocation: stock === 'Disponible' ? stockLocation : '',
      ...amounts,
    });
    if ((priceForCustomer(payers, amounts) ?? 0) > 0) {
      notice.quotes = [issueQuote(notice, amounts)];
      notice.quoteRevision = randomUUID();
    }
  } else if (notice.stage === 2) {
    const report = read(form, 'report', 4000);
    const finishedAt = new Date();
    const rawMinutes = read(form, 'minutes', 4);
    const minutes = form.get('minutesMode') === 'elapsed'
      ? elapsedWorkMinutes(notice.startedAt, finishedAt.getTime())
      : /^\d{1,4}$/.test(rawMinutes) ? Number(rawMinutes) : null;
    if (!report || minutes == null || minutes < 1 || minutes > maxWorkedMinutes) redirect(detail + '&error=parte');
    const worksheet = notice.worksheetRequired || form.get('worksheet') === '1' ? readWorksheet(form, notice.origin) : undefined;
    if (worksheet === null) redirect(detail + '&error=plantilla#cerrar-parte');
    const refrigerantWork = readRefrigerantWork(form);
    if (refrigerantWork === undefined) redirect(detail + '&error=refrigerante#cerrar-parte');
    const consumedParts = readUsedParts(form);
    if (!consumedParts) redirect(detail + '&error=consumo#cerrar-parte');
    const photos = form.getAll('reportPhoto');
    const signature = form.get('reportSignature');
    const signer = read(form, 'reportSigner', 120);
    if (read(form, 'reportEvidenceBusy') === '1' || photos.length > 2
      || !photos.every(photo => imageData(photo, 'jpeg', 175000))
      || (signature && (!imageData(signature, 'png', 95000) || !signer))
      || (signer && !signature)) redirect(detail + '&error=evidencia#cerrar-parte');
    Object.assign(notice, {
      report, minutes, finishedAt: finishedAt.toISOString(), usedParts: read(form, 'usedParts', 2000), consumedParts, worksheet, refrigerantWork: refrigerantWork || undefined,
      reportPhotos: photos, reportSignature: signature || undefined, reportSigner: signer || undefined,
    });
  } else {
    redirect(detail + '&error=estado');
  }
  notice.stage += 1;
  if (!await advanceNotice(notice)) redirect(detail + '&error=estado');
  if (notice.stage === 3 && notice.refrigerantWork?.technicianCredential) {
    try {
      await issueServiceCertificate(notice.id);
    } catch (error) {
      console.error('El parte se cerró y el certificado quedó pendiente de numerar', notice.id, error);
    }
  }
  revalidatePath(base);
  redirect(detail + (notice.stage === 3 ? '&cerrado=1' : ''));
}
