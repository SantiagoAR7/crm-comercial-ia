import type { Metadata } from 'next';
import { charges, chargeLabels, priceForCustomer } from '../service-coverage';
import { getQuoteResponse } from '../service-quote-link';
import { respondToQuote } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Presupuesto de servicio técnico | Davofrío',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export default async function QuoteResponsePage({ searchParams }: { searchParams: Promise<{ t?: string; r?: string }> }) {
  const { t, r } = await searchParams;
  const response = await getQuoteResponse(typeof t === 'string' ? t : undefined);
  return <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
    <article className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <p className="font-bold text-blue-950">DAVOFRÍO</p>
      <h1 className="text-2xl font-bold">Presupuesto de servicio técnico</h1>
      {response ? (() => {
        const { notice, quote, version, test } = response;
        const outcome = test ? r : quote.decision?.outcome;
        const answered = outcome === 'accepted' || outcome === 'rejected';
        const total = priceForCustomer(notice.payers, quote.amounts);
        return <>
          {test && <p className="rounded-lg bg-blue-50 p-3">Prueba interna. Tu respuesta se simula y no modifica el aviso.</p>}
          <p className="text-sm">Versión {version} · {quote.subject.customer}</p>
          {quote.subject.equipment && <p>{quote.subject.equipment}</p>}
          <p className="whitespace-pre-wrap break-words">{quote.subject.issue}</p>
          <dl className="grid grid-cols-[1fr_auto] gap-2 border-y py-3">
            {charges.map(charge => (notice.payers?.[charge] || 'customer') === 'customer' && <div className="contents" key={charge}>
              <dt>{chargeLabels[charge]}</dt><dd>{money.format((quote.amounts[charge] ?? 0) / 100)}</dd>
            </div>)}
            <dt className="font-bold">Total</dt><dd className="font-bold">{money.format((total ?? 0) / 100)}</dd>
          </dl>
          {answered ? <p role="status">{outcome === 'accepted' ? 'Presupuesto aceptado.' : 'Presupuesto rechazado.'} Gracias por responder.</p>
            : notice.stage === 1 && !quote.decision && <form action={respondToQuote} className="space-y-4">
              <input type="hidden" name="token" value={t} />
              <label className="block text-sm font-semibold">Nombre y apellidos
                <input name="name" required maxLength={120} autoComplete="name" className="mt-1 block w-full rounded-lg border p-2 font-normal" />
              </label>
              <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Confirmo que deseo registrar mi decisión sobre esta versión.</label>
              {r && <p role="status">{r === 'datos' ? 'Indica tu nombre y confirma la decisión.' : 'El presupuesto se está actualizando. Vuelve a intentarlo.'}</p>}
              <div className="flex flex-wrap gap-3">
                <button name="outcome" value="accepted" className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Aceptar presupuesto</button>
                <button name="outcome" value="rejected" className="rounded-lg border border-blue-950 px-4 py-2 font-semibold">Rechazar presupuesto</button>
              </div>
            </form>}
        </>;
      })() : <p>El enlace ha caducado, es incorrecto o corresponde a una versión sustituida. Contacta con Servicio técnico si necesitas el presupuesto vigente.</p>}
    </article>
  </main>;
}
