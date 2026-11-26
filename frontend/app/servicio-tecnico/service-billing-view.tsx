import Link from 'next/link';
import { chargeLabels, payerLabels } from './service-coverage';
import { billingDraft, billingStatus } from './service-billing';
import { reviewServiceBilling } from './service-billing-actions';
import { formatWorkTime } from './service-work-time';
import { query, type ServiceNotice } from './service-store';

const base = '/servicio-tecnico';
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function ServiceBillingDraft({ notice, result }: { notice: ServiceNotice; result?: string }) {
  const draft = billingDraft(notice);
  const review = notice.billingReview;
  return <section id="facturacion" className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-lg font-bold">Borrador para facturación</h2>
    <p>{billingStatus(review)}{review && ' · ' + formatWorkTime(review.reviewedAt)}</p>
    <p>{draft.version ? 'Presupuesto aceptado · versión ' + draft.version : 'Sin presupuesto aceptado'} · {notice.coverage}</p>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {draft.lines.map(({ charge, payer, amount }) => <div className="contents" key={charge}>
        <dt>{chargeLabels[charge]} · {payerLabels[payer]}</dt>
        <dd>{payer === 'customer' ? amount == null ? 'Importe pendiente' : money.format(amount / 100) : '—'}</dd>
      </div>)}
      <dt className="font-bold">Total confirmado del cliente</dt>
      <dd className="font-bold">{draft.total == null ? 'Pendiente de revisión' : money.format(draft.total / 100)}</dd>
    </dl>
    <h3 className="font-semibold">Datos del parte</h3>
    <p className="whitespace-pre-wrap break-words">{notice.report}</p>
    <p>{notice.minutes ?? '—'} min registrados</p>
    {!!notice.consumedParts?.length && <ul className="list-disc pl-5">
      {notice.consumedParts.map((part, index) => <li key={index}>{part.reference} · {part.units} ud. · {part.location}</li>)}
    </ul>}
    {notice.usedParts && <p className="whitespace-pre-wrap break-words">{notice.usedParts}</p>}
    <form action={reviewServiceBilling} className="space-y-3">
      <input type="hidden" name="notice" value={notice.id} />
      <input type="hidden" name="billingRevision" value={notice.visitRevision || ''} />
      {result && <p role="status">{result === 'guardado' ? 'Revisión guardada.' : result === 'estado' ? 'El aviso cambió. Revisa los datos y vuelve a intentarlo.' : 'Revisa los importes y documenta cualquier cargo adicional antes de continuar.'}</p>}
      <label className="flex items-center gap-2"><input type="checkbox" name="additionalCharge" value="yes" defaultChecked={review?.additionalCharge} /> Hay un cargo adicional pendiente de aprobación</label>
      <label className="block font-semibold">Notas de revisión
        <textarea name="billingNotes" maxLength={1500} rows={3} defaultValue={review?.notes} className="block w-full rounded-lg border p-2 font-normal" />
      </label>
      {review?.state !== 'review' && review && <label className="block font-semibold">Referencia de la factura emitida
        <input name="invoiceReference" maxLength={120} defaultValue={review.invoiceReference}
          className="block w-full rounded-lg border p-2 font-normal" />
      </label>}
      <div className="flex flex-wrap gap-3">
        <button name="billingState" value="review" className="rounded-lg border px-3 py-2">Guardar para revisión</button>
        {draft.confirmed && review?.state !== 'linked' && <button name="billingState" value="ready" className="rounded-lg bg-blue-950 px-3 py-2 font-semibold text-white">Marcar listo para facturar</button>}
        {(review?.state === 'ready' || review?.state === 'linked') && <button name="billingState" value="linked" className="rounded-lg border px-3 py-2">Guardar referencia de factura</button>}
      </div>
    </form>
  </section>;
}

export async function ServiceBillingQueue({ page }: { page?: string }) {
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const size = 30;
  const rows = await query<{ id: string; customer: string; billingReview: ServiceNotice['billingReview'] }>('service_notices', {
    stage: 'eq.3', select: 'id,customer:record->>customer,billingReview:record->billingReview',
    order: 'created_at.desc,id.desc', offset: String(index * size), limit: String(size + 1),
  });
  const href = base + '?vista=facturacion';
  return <section className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Por facturar</h2>
    {rows.length ? <ul className="divide-y">
      {rows.slice(0, size).map(notice => <li key={notice.id} className="flex flex-wrap justify-between gap-2 py-3">
        <Link className="font-semibold text-blue-900 underline" href={base + '?aviso=' + notice.id + '#facturacion'}>{notice.customer}</Link>
        <span>{billingStatus(notice.billingReview)}</span>
      </li>)}
    </ul> : <p>No hay partes cerrados en esta página.</p>}
    <nav aria-label="Páginas de facturación" className="flex gap-4 text-sm font-semibold text-blue-900">
      {index > 0 && <Link href={href + '&paginaFacturacion=' + (index - 1)}>Anterior</Link>}
      {rows.length > size && <Link href={href + '&paginaFacturacion=' + (index + 1)}>Siguiente</Link>}
    </nav>
  </section>;
}
