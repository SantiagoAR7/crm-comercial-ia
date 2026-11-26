import { charges } from './service-coverage';
import type { ServiceNotice } from './service-store';

export type BillingReview = {
  state: 'review' | 'ready' | 'linked';
  invoiceReference?: string;
  notes: string;
  additionalCharge: boolean;
  reviewedAt: string;
};

export function billingDraft(notice: ServiceNotice) {
  const latestIndex = (notice.quotes?.length || 0) - 1;
  const acceptedIndex = notice.quotes?.[latestIndex]?.decision?.outcome === 'accepted' ? latestIndex : -1;
  const accepted = notice.quotes?.[acceptedIndex];
  const lines = charges.map(charge => ({
    charge,
    payer: notice.payers?.[charge] || 'customer',
    amount: accepted ? accepted.amounts[charge] : notice[charge],
  }));
  const confirmed = lines.every(({ payer, amount }) =>
    payer !== 'pending' && (payer !== 'customer' || (amount !== null && (amount === 0 || Boolean(accepted)))));
  return {
    lines, confirmed,
    version: acceptedIndex + 1,
    total: confirmed ? lines.reduce((sum, line) => sum + (line.payer === 'customer' ? line.amount ?? 0 : 0), 0) : null,
  };
}

export function billingStatus(review?: BillingReview) {
  return review?.state === 'linked' ? 'Factura vinculada'
    : review?.state === 'ready' ? 'Listo para facturar'
    : 'Pendiente de revisión';
}
