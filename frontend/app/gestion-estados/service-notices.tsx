import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { saveNotice } from './service-actions';
import { availability, coverages, getNotice, getNoticeHistory, listNotices, stages, type ServiceNotice } from './service-store';

const base = '/gestion-estados?seccion=servicio-tecnico';
const control = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';
const primary = 'inline-block rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white hover:bg-blue-900';
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const errors: Record<string, string> = {
  datos: 'Indica el cliente y describe la avería.',
  aviso: 'El aviso no está disponible.',
  estado: 'El aviso cambió de estado. Revisa la información actual.',
  cobertura: 'Confirma la cobertura y su referencia. Si has comprobado el stock, indica el repuesto.',
  importe: 'Introduce los importes en euros con un máximo de dos decimales.',
  contrato: 'Para esta cobertura, indica 0 en mano de obra y desplazamiento.',
  agenda: 'Indica el técnico y una fecha y hora válidas.',
  parte: 'Describe el trabajo e indica los minutos dedicados.',
};

function Field({ label, name, required = false, type = 'text', maxLength = 250 }: {
  label: string; name: string; required?: boolean; type?: string; maxLength?: number;
}) {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>{label}</span>
    <input name={name} required={required} maxLength={maxLength} type={type} className={control} />
  </label>;
}

function Notes({ label, name, maxLength, required }: { label: string; name: string; maxLength: number; required?: boolean }) {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>{label}</span>
    <textarea name={name} className={control} rows={4} maxLength={maxLength} required={required} />
  </label>;
}

function Selection({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>{label}</span>
    <select name={name} className={control}>{options.map(option => <option key={option}>{option}</option>)}</select>
  </label>;
}

function NoticeForm({ id, step, title, children }: {
  id: string; step: string; title: string; children: React.ReactNode;
}) {
  return <form action={saveNotice} className={panel + ' space-y-4'}>
    <h2 className="text-lg font-bold">{title}</h2>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="step" value={step} />
    {children}
    <button className={primary}>Guardar</button>
  </form>;
}

function NoticeDetails({ notice }: { notice: ServiceNotice }) {
  const costs = [['Material', notice.material], ['Mano de obra', notice.labor], ['Desplazamiento', notice.travel]] as const;
  const total = costs.every(([, amount]) => amount !== null)
    ? money.format(costs.reduce((sum, [, amount]) => sum + (amount ?? 0), 0) / 100)
    : 'Pendiente de confirmar';
  return <div className="grid gap-5 xl:grid-cols-2">
    <article className={panel + ' space-y-3'}>
      <h2 className="text-xl font-bold">{notice.customer}</h2>
      <p className="text-sm font-semibold text-blue-900">{stages[notice.stage]}</p>
      <p className="whitespace-pre-wrap">{notice.issue}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Teléfono</dt><dd>{notice.phone || '—'}</dd>
        <dt>Equipo</dt><dd>{notice.equipment || '—'}</dd>
        <dt>Número de serie</dt><dd>{notice.serial || '—'}</dd>
        <dt>Origen</dt><dd>{notice.origin || '—'}</dd>
        <dt>Cobertura</dt><dd>{notice.coverage}</dd>
        {notice.stage >= 1 && <>
          <dt>Referencia</dt><dd>{notice.reference}</dd>
          <dt>Repuesto</dt><dd>{notice.part || '—'} · {notice.stock}</dd>
          {costs.map(([label, amount]) => <div className="contents" key={label}>
            <dt>{label}</dt><dd>{amount === null ? 'Pendiente' : money.format(amount / 100)}</dd>
          </div>)}
          <dt className="font-bold">Total</dt><dd className="font-bold">{total}</dd>
        </>}
        {notice.stage >= 2 && <>
          <dt>Técnico</dt><dd>{notice.technician}</dd>
          <dt>Visita</dt><dd>{notice.appointment.replace('T', ' ')} · hora local de la visita</dd>
        </>}
        {notice.stage === 3 && <>
          <dt>Minutos trabajados</dt><dd>{notice.minutes}</dd>
          <dt>Piezas usadas</dt><dd className="whitespace-pre-wrap">{notice.usedParts || '—'}</dd>
          <dt>Trabajo realizado</dt><dd className="whitespace-pre-wrap">{notice.report}</dd>
        </>}
      </dl>
      <h3 className="border-t pt-3 font-bold">Historial</h3>
      <ol className="space-y-1 text-sm">
        {getNoticeHistory(notice.id).map(entry => <li key={entry.stage}>{stages[entry.stage]} · {
          new Date(entry.changedAt.replace(' ', 'T')).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
        }</li>)}
      </ol>
    </article>
    {notice.stage === 0 && <NoticeForm id={notice.id} step="0" title="Revisar cobertura y precio">
      <Selection name="coverage" label="Cobertura" options={coverages} />
      <Field name="reference" label="Confirmación de contrato, fabricante o motivo de exclusión" required />
      <Field name="part" label="Referencia del repuesto" />
      <Selection name="stock" label="Disponibilidad comprobada" options={availability} />
      <p className="text-sm text-slate-600">Indica 0 € para conceptos cubiertos. Deja vacío el importe que esté pendiente de confirmar.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field name="material" label="Material (€)" maxLength={10} />
        <Field name="labor" label="Mano de obra (€)" maxLength={10} />
        <Field name="travel" label="Desplazamiento (€)" maxLength={10} />
      </div>
    </NoticeForm>}
    {notice.stage === 1 && <NoticeForm id={notice.id} step="1" title="Agendar la visita">
      <Field name="technician" label="Técnico" required />
      <Field name="appointment" label="Fecha y hora local de la visita" type="datetime-local" required />
    </NoticeForm>}
    {notice.stage === 2 && <NoticeForm id={notice.id} step="2" title="Cerrar el parte">
      <Notes name="report" label="Trabajo realizado" maxLength={4000} required />
      <Field name="minutes" label="Minutos trabajados" type="number" required />
      <Notes name="usedParts" label="Piezas utilizadas" maxLength={2000} />
    </NoticeForm>}
  </div>;
}

export default function ServiceNotices({ noticeId, create, error }: { noticeId?: string; create: boolean; error?: string }) {
  const notice = noticeId ? getNotice(noticeId) : null;
  const notices = !create && !noticeId ? listNotices() : [];
  const message = error ? errors[error] : undefined;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Avisos</h2>
      {create || noticeId
        ? <Link className="font-semibold text-blue-900 underline" href={base}>Volver a avisos</Link>
        : <Link className={primary} href={base + '&nuevo=1'}>Nuevo aviso</Link>}
    </div>
    {message && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-amber-950">{message}</p>}
    {create ? <NoticeForm id={randomUUID()} step="create" title="Registrar aviso">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="customer" label="Cliente" required />
        <Field name="phone" label="Teléfono" type="tel" maxLength={40} />
        <Field name="equipment" label="Equipo o modelo" />
        <Field name="serial" label="Número de serie" />
        <Selection name="origin" label="Origen" options={['Teléfono', 'WhatsApp', 'Fabricante', 'Otro']} />
      </div>
      <Notes name="issue" label="Avería comunicada" maxLength={2000} required />
    </NoticeForm> : notice ? <NoticeDetails notice={notice} /> : (
      <div className={panel}>
        {notices.length ? <ul className="divide-y divide-slate-200">
          {notices.map(item => <li key={item.id}>
            <Link className="flex flex-wrap justify-between gap-2 py-3 hover:text-blue-700" href={base + '&aviso=' + item.id}>
              <span className="font-semibold">{item.customer} {item.equipment && '· ' + item.equipment}</span>
              <span className="text-sm">{stages[item.stage]}</span>
            </Link>
          </li>)}
        </ul> : <p>{noticeId ? 'Aviso no encontrado.' : 'Todavía no hay avisos registrados.'}</p>}
      </div>
    )}
  </section>;
}
