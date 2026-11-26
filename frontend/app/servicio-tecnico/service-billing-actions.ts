'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess } from './service-access';
import { billingDraft } from './service-billing';
import { getNotice, saveBillingReview } from './service-store';

const base = '/servicio-tecnico';

export async function reviewServiceBilling(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect(base + '/login');
  const id = form.get('notice');
  const notice = typeof id === 'string' ? await getNotice(id) : null;
  if (!notice || notice.stage !== 3) redirect(base + '?vista=facturacion');
  const detail = base + '?aviso=' + notice.id;
  const notes = form.get('billingNotes');
  const state = form.get('billingState');
  const invoiceReference = form.get('invoiceReference');
  const additionalCharge = form.get('additionalCharge') === 'yes';
  const draft = billingDraft(notice);
  if ((state !== 'review' && state !== 'ready' && state !== 'linked') || typeof notes !== 'string' || notes.length > 1500
    || (additionalCharge && !notes.trim()) || (state !== 'review' && (!draft.confirmed || additionalCharge))
    || (state === 'linked' && ((notice.billingReview?.state !== 'ready' && notice.billingReview?.state !== 'linked')
      || typeof invoiceReference !== 'string' || !invoiceReference.trim() || invoiceReference.length > 120))) {
    redirect(detail + '&facturacion=datos#facturacion');
  }
  if (form.get('billingRevision') !== (notice.visitRevision || '') || !await saveBillingReview(notice, {
    state, invoiceReference: state === 'linked' && typeof invoiceReference === 'string' ? invoiceReference.trim() : undefined, notes: notes.trim(), additionalCharge, reviewedAt: new Date().toISOString(),
  })) redirect(detail + '&facturacion=estado#facturacion');
  revalidatePath(base);
  redirect(detail + '&facturacion=guardado#facturacion');
}
