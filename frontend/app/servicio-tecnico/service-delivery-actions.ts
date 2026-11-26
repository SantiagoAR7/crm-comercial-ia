'use server';

import { createHmac, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess } from './service-access';
import { claimServiceDelivery, finishServiceDelivery, type DeliveryState } from './service-delivery-store';
import { getServiceCertificate } from './service-certificate-store';
import { renderServicePdf } from './service-pdf';
import { quoteMailBody, quoteMailSubject } from './service-quote-mail';
import { quoteResponseUrl } from './service-quote-link';
import { quoteDeliveryInProgress } from './service-coverage';
import { getNotice, updateNoticeQuote, updateVisitMail, visitChangesFor, type VisitMail } from './service-store';

import { visitMessage, visitSubject } from './service-visit-mail';

const base = '/servicio-tecnico';
const email = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i;
const testAddress = 'transformaciondigital@davofrio.com';

function read(form: FormData, key: string, max: number) {
  const value = form.get(key);
  return typeof value === 'string' && value.length <= max ? value.trim() : '';
}

async function deliver(secret: string, payload: {
  to: string; subject: string; message: string; file?: string; filename?: string; noticeType?: 'visit'; attempt: string; test: boolean;
}): Promise<{ result: Exclude<DeliveryState, 'sending'>; reference?: string }> {
  const body = JSON.stringify(payload);
  const time = String(Date.now());
  const signature = createHmac('sha256', secret).update('davofrio:service-delivery:' + time + ':').update(body).digest('hex');
  try {
    const response = await fetch(process.env.SERVICE_DELIVERY_ENDPOINT || 'http://crm-api:4000/api/service-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delivery-time': time, 'x-delivery-signature': signature },
      body, cache: 'no-store', signal: AbortSignal.timeout(39000),
    });
    const outcome = await response.json();
    if (response.status === 202 && outcome.outcome === 'accepted') {
      return { result: 'accepted', reference: typeof outcome.reference === 'string' ? outcome.reference : undefined };
    }
    if (outcome.outcome === 'failed') return { result: 'failed' };
  } catch {
    // Graph may already have accepted the message.
  }
  return { result: 'unknown' };
}

export async function sendServiceDocument(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect(base + '/login');
  const id = read(form, 'notice', 36);
  const kind = read(form, 'kind', 12);
  if (kind !== 'parte' && kind !== 'certificado') redirect(base);
  const details = base + (form.get('inline') === '1' && kind === 'parte'
    ? '?aviso=' + encodeURIComponent(id)
    : '?vista=entrega&tipo=' + kind + '&aviso=' + encodeURIComponent(id));
  const notice = await getNotice(id);
  if (!notice || notice.stage !== 3 || (kind === 'certificado' && !notice.refrigerantWork?.technicianCredential)) redirect(details);
  const mode = read(form, 'mode', 10);
  const isTest = mode === 'test';
  const to = isTest ? testAddress : read(form, 'recipient', 254).toLowerCase();
  const rawSubject = read(form, 'subject', 150);
  const subject = isTest ? '[PRUEBA] ' + rawSubject : rawSubject;
  const message = read(form, 'message', 4000);
  if (!['test', 'send'].includes(mode) || !email.test(to) || !rawSubject || /[\r\n]/.test(rawSubject) || !message
    || (!isTest && form.get('confirmRecipient') !== 'yes')) redirect(details + '&resultado=datos');

  const secret = process.env.SERVICE_DELIVERY_SECRET;
  if (!secret || secret.length < 32) redirect(details + '&resultado=config');
  const certificate = kind === 'certificado' ? await getServiceCertificate(notice.id) : null;
  if (kind === 'certificado' && !certificate) redirect(details + '&resultado=numero');
  let file: string;
  try {
    file = (await renderServicePdf(notice, kind, certificate)).toString('base64');
  } catch {
    redirect(details + '&resultado=pdf');
  }
  if (file.length > 3_900_000) redirect(details + '&resultado=pdf');

  const delivery = await claimServiceDelivery(id, kind, to, isTest);
  if (!delivery) redirect(details + '&resultado=duplicado');
  const { result, reference } = await deliver(secret, {
    to, subject, message, file, filename: kind + '-davofrio-' + id + '.pdf', attempt: delivery.attempt, test: isTest,
  });
  try {
    if (!await finishServiceDelivery(delivery, result, reference)) redirect(details + '&resultado=unknown');
  } catch {
    redirect(details + '&resultado=unknown');
  }
  revalidatePath(base);
  redirect(details + '&resultado=' + result);
}

export async function sendQuote(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect(base + '/login');
  const notice = await getNotice(read(form, 'notice', 36));
  if (!notice) redirect(base);
  const details = base + '?aviso=' + notice.id;
  const quotes = notice.quotes?.slice() || [];
  const quote = quotes.at(-1);
  const mode = read(form, 'mode', 10);
  const test = mode === 'test';
  const recipient = test ? testAddress : read(form, 'recipient', 254).toLowerCase();
  if ((!test && (mode !== 'send' || form.get('confirmRecipient') !== 'yes')) || !email.test(recipient)) {
    redirect(details + '&error=destinoPresupuesto');
  }
  const delivery = test ? quote?.testDelivery : quote?.customerDelivery;
  if (notice.stage !== 1 || !quote || quote.decision || !notice.quoteRevision
    || read(form, 'quoteRevision', 36) !== notice.quoteRevision
    || quoteDeliveryInProgress(quote.testDelivery) || quoteDeliveryInProgress(quote.customerDelivery)
    || (delivery && delivery.state !== 'failed')) redirect(details + '&error=estado');
  const secret = process.env.SERVICE_DELIVERY_SECRET;
  if (!secret || secret.length < 32) redirect(details + '&error=configPresupuesto');
  let file: string;
  try {
    file = (await renderServicePdf(notice, 'presupuesto', null, quotes.length)).toString('base64');
  } catch {
    redirect(details + '&error=pdfPresupuesto');
  }
  if (file.length > 3_900_000) redirect(details + '&error=pdfPresupuesto');

  const claim = randomUUID();
  const current = { ...notice, quotes, quoteRevision: claim };
  const deliveryKey = test ? 'testDelivery' : 'customerDelivery';
  const at = new Date().toISOString();
  quotes[quotes.length - 1] = { ...quote, [deliveryKey]: { state: 'sending', at, recipient } };
  if (!await updateNoticeQuote(current, notice.quoteRevision)) redirect(details + '&error=estado');

  const { result } = await deliver(secret, {
    to: recipient,
    subject: (test || recipient === testAddress ? '[PRUEBA] ' : '') + quoteMailSubject(quotes.length),
    message: quoteMailBody(quoteResponseUrl(notice.id, quotes.length, test)),
    file, filename: 'presupuesto-davofrio-' + notice.id + '-v' + quotes.length + '.pdf',
    attempt: claim, test,
  });
  quotes[quotes.length - 1] = { ...quote, [deliveryKey]: { state: result, at, recipient } };
  const saved = await updateNoticeQuote({ ...current, quoteRevision: randomUUID() }, claim).catch(() => false);
  if (!saved) redirect(details + '&error=correoPresupuestoSinConfirmar');
  revalidatePath(base);
  redirect(details);
}

export async function sendVisitMail(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect(base + '/login');
  const notice = await getNotice(read(form, 'notice', 36));
  if (!notice) redirect(base);
  const details = base + '?aviso=' + notice.id;
  const changes = visitChangesFor(notice).slice();
  const current = changes.at(-1);
  if (notice.stage !== 2 || notice.startedAt || !current || current.appointment !== notice.appointment
    || read(form, 'visitRevision', 36) !== (notice.visitRevision || '')
    || read(form, 'visitNumber', 10) !== String(changes.length)
    || read(form, 'appointment', 16) !== notice.appointment) redirect(details + '&error=estado');
  const mode = read(form, 'mode', 10);
  const test = mode === 'test';
  const recipient = test ? testAddress : read(form, 'recipient', 254).toLowerCase();
  const location = read(form, 'location', 500);
  if ((!test && (mode !== 'send' || form.get('confirmRecipient') !== 'yes')) || !email.test(recipient) || !location) {
    redirect(details + '&error=visitaDatos');
  }
  const key = test ? 'test' : 'customer';
  const previous = current[key];
  if (quoteDeliveryInProgress(current.test) || quoteDeliveryInProgress(current.customer)
    || (previous && previous.state !== 'failed')) redirect(details + '&error=visitaDuplicado');
  const secret = process.env.SERVICE_DELIVERY_SECRET;
  if (!secret || secret.length < 32) redirect(details + '&error=configPresupuesto');
  const attempt = randomUUID();
  const pending: VisitMail = { attempt, at: new Date().toISOString(), state: 'sending', recipient, location };
  changes[changes.length - 1] = { ...current, [key]: pending };
  if (!await updateVisitMail(notice, changes, attempt)) redirect(details + '&error=estado');

  const { result } = await deliver(secret, {
    to: recipient, subject: (test ? '[PRUEBA] ' : '') + visitSubject(notice.id, current),
    message: visitMessage(notice.id, current, location), noticeType: 'visit', test, attempt,
  });

  for (let retry = 0; retry < 3; retry++) {
    const latest = await getNotice(notice.id).catch(() => null);
    if (!latest) break;
    const timeline = visitChangesFor(latest).slice();
    const index = timeline.findIndex(change => change[key]?.attempt === attempt);
    if (index < 0) break;
    timeline[index] = { ...timeline[index], [key]: { ...pending, state: result } };
    if (await updateVisitMail(latest, timeline, randomUUID()).catch(() => false)) {
      revalidatePath(base);
      redirect(details);
    }
  }
  redirect(details + '&error=visitaSinConfirmar');
}
