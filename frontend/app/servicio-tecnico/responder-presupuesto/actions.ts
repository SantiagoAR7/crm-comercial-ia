'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getQuoteResponse } from '../service-quote-link';
import { quoteDeliveryInProgress } from '../service-coverage';
import { updateNoticeQuote } from '../service-store';

const base = '/servicio-tecnico/responder-presupuesto';

export async function respondToQuote(form: FormData) {
  const token = form.get('token');
  const outcome = form.get('outcome');
  const name = form.get('name');
  if (typeof token !== 'string') redirect(base);
  const response = await getQuoteResponse(token);
  if (!response) redirect(base);
  const path = base + '?t=' + encodeURIComponent(token);
  const { notice, quote, version, test } = response;
  if (typeof name !== 'string' || !name.trim() || name.length > 120
    || (outcome !== 'accepted' && outcome !== 'rejected') || form.get('confirm') !== 'yes') redirect(path + '&r=datos');
  if (test) redirect(path + '&r=' + outcome);
  if (notice.stage !== 1 || quote.decision || !notice.quoteRevision) redirect(path);
  if (quoteDeliveryInProgress(quote.customerDelivery) || quoteDeliveryInProgress(quote.testDelivery)) redirect(path + '&r=espera');

  const quotes = [...(notice.quotes || [])];
  quotes[version - 1] = { ...quote, decision: {
    outcome, at: new Date().toISOString(), evidence: 'Respuesta por enlace privado · ' + name.trim(),
  } };
  if (!await updateNoticeQuote({ ...notice, quotes, quoteRevision: randomUUID() }, notice.quoteRevision)) {
    redirect(path + '&r=conflicto');
  }
  redirect(path);
}
