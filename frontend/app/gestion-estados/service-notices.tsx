import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import CoverageFields from './coverage-fields';
import { chargeLabels, charges, payerLabels, priceForCustomer } from './service-coverage';
import { saveNotice } from './service-actions';
import { availability, equipmentLabel, findRecentEquipmentContract, getEquipment, getNotice, getNoticeHistory, listEquipmentNotices, listNotices, searchEquipment, stages, type ServiceNotice } from './service-store';

const base = '/gestion-estados?seccion=servicio-tecnico';
const control = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';
const primary = 'inline-block rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white hover:bg-blue-900';
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const errors: Record<string, string> = {
  datos: 'Indica el cliente y describe la avería.',
  equipo: 'El equipo no está disponible para vincularlo a este aviso.',
  aviso: 'El aviso no está disponible.',
  estado: 'El aviso cambió de estado. Revisa la información actual.',
  cobertura: 'Confirma la cobertura y su referencia. Si has comprobado el stock, indica el repuesto.',
  vigencia: 'Indica las fechas de un contrato vigente hoy. La fecha final se puede dejar vacía si el contrato es indefinido.',
  fabricante: 'Indica el fabricante y su referencia de autorización.',
  importe: 'Introduce los importes en euros con un máximo de dos decimales.',
  almacen: 'Indica en qué almacén o furgoneta está el repuesto disponible.',
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

function EquipmentSummary({ equipment }: { equipment: NonNullable<Awaited<ReturnType<typeof getEquipment>>> }) {
  const warranty = equipment.warranty_until;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  return <div className="space-y-1 text-sm">
    <p className="font-semibold">{equipmentLabel(equipment)} · {equipment.customer_name || 'Cliente sin nombre'}</p>
    <p>Número de serie {equipment.serial_number || 'sin registrar'}</p>
    <p>{warranty
      ? `Garantía registrada hasta el ${warranty.slice(0, 10).split('-').reverse().join('/')} · ${warranty.slice(0, 10) >= today ? 'Fecha vigente' : 'Fecha vencida'}`
      : 'Fecha de garantía sin registrar'}</p>
    <p>Confirma el contrato o la autorización del fabricante antes de aprobar la cobertura.</p>
  </div>;
}

async function EquipmentSearch({ search, noticeId }: { search?: string; noticeId?: string }) {
  const results = search ? await searchEquipment(search) : [];
  const destination = noticeId ? base + '&aviso=' + noticeId : base + '&nuevo=1';
  return <section className={panel + ' space-y-3'}>
    <h3 className="font-bold">Buscar equipo</h3>
    <form method="get" action="/gestion-estados" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="seccion" value="servicio-tecnico" />
      <input type="hidden" name={noticeId ? 'aviso' : 'nuevo'} value={noticeId || '1'} />
      <label className="min-w-56 flex-1 text-sm font-semibold">
        Cliente o número de serie
        <input className={control} name="buscarEquipo" minLength={2} maxLength={100} required defaultValue={search} />
      </label>
      <button className={primary}>Buscar</button>
    </form>
    {search && (results.length ? <ul className="divide-y divide-slate-200">
      {results.map(item => <li key={item.id} className="py-2">
        <Link className="text-blue-900 underline" href={destination + '&equipo=' + encodeURIComponent(item.id)}>
          {item.customer_name || 'Cliente sin nombre'} · {equipmentLabel(item)} · {item.serial_number || 'Sin número de serie'}
        </Link>
      </li>)}
    </ul> : <p>No se encontraron equipos.</p>)}
  </section>;
}

function CoverageEvidence({ notice }: { notice: ServiceNotice }) {
  const formatDate = (date: string) => date.split('-').reverse().join('/');
  return <>
    {notice.coverageFrom && <span> · Vigencia registrada desde {formatDate(notice.coverageFrom)} hasta {
      notice.coverageUntil ? formatDate(notice.coverageUntil) : 'fecha indefinida'
    }</span>}
    {notice.manufacturer && <span> · {notice.manufacturer}</span>}
  </>;
}

async function EquipmentHistory({ notice, page }: { notice: ServiceNotice; page: number }) {
  if (!notice.equipmentId) return null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [equipment, previous, contract] = await Promise.all([
    getEquipment(notice.equipmentId), listEquipmentNotices(notice.equipmentId, notice.id, page * 10),
    findRecentEquipmentContract(notice.equipmentId, today),
  ]);
  const href = base + '&aviso=' + notice.id + '&paginaEquipo=';
  const contractPayers = contract?.payers;
  return <section className={panel + ' space-y-3'}>
    <h3 className="font-bold">Equipo e historial de intervenciones</h3>
    {equipment ? <EquipmentSummary equipment={equipment} /> : <p>La ficha del equipo no está disponible.</p>}
    {contract && <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-semibold">Último contrato registrado con vigencia en la fecha actual</p>
      <p><Link className="text-blue-900 underline" href={base + '&aviso=' + contract.id}>{contract.reference}</Link>
        <CoverageEvidence notice={contract} />
      </p>
      {contractPayers && <ul className="mt-1 flex flex-wrap gap-x-3">
        {charges.map(charge => <li key={charge}>{chargeLabels[charge]} · {payerLabels[contractPayers[charge]]}</li>)}
      </ul>}
    </div>}
    {previous.length ? <ul className="divide-y divide-slate-200 text-sm">
      {previous.slice(0, 10).map(item => <li key={item.id} className="space-y-1 py-2">
        <Link className="font-semibold text-blue-900 underline" href={base + '&aviso=' + item.id}>
          {new Date(item.createdAt).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })} · {stages[item.stage]} · {item.issue}
        </Link>
        {item.reference && <p>{item.coverage} · {item.reference}<CoverageEvidence notice={item} /></p>}
        {item.stage === 3 && <p className="whitespace-pre-wrap">{item.report}</p>}
      </li>)}
    </ul> : <p>No hay otros avisos vinculados en esta página.</p>}
    <div className="flex gap-4 text-sm text-blue-900">
      {page > 0 && <Link href={href + (page - 1)}>Anteriores</Link>}
      {previous.length > 10 && <Link href={href + (page + 1)}>Siguientes</Link>}
    </div>
  </section>;
}

async function NoticeDetails({ notice }: { notice: ServiceNotice }) {
  const total = priceForCustomer(notice.payers, notice);
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
          <dt>Referencia</dt><dd>{notice.reference}<CoverageEvidence notice={notice} /></dd>
          <dt>Repuesto</dt><dd>{notice.part || '—'} · {notice.stock}{notice.stockLocation && ' · ' + notice.stockLocation}</dd>
          {charges.map(charge => {
            const payer = notice.payers?.[charge];
            const amount = notice[charge];
            return <div className="contents" key={charge}>
              <dt>{chargeLabels[charge]}</dt>
              <dd>{payer && payer !== 'customer'
                ? payerLabels[payer]
                : amount === null ? 'Importe pendiente' : money.format(amount / 100)}</dd>
            </div>;
          })}
          <dt className="font-bold">Total para el cliente</dt>
          <dd className="font-bold">{total === null ? 'Pendiente de confirmar' : money.format(total / 100)}</dd>
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
        {(await getNoticeHistory(notice.id)).map(entry => <li key={entry.stage}>{stages[entry.stage]} · {
          new Date(entry.changedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
        }</li>)}
      </ol>
    </article>
    {notice.stage === 0 && <NoticeForm id={notice.id} step="0" title="Revisar cobertura y precio">
      <CoverageFields />
      <Field name="part" label="Referencia del repuesto" />
      <Selection name="stock" label="Disponibilidad comprobada" options={availability} />
      <Field name="stockLocation" label="Almacén o furgoneta si hay existencias" />
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

export default async function ServiceNotices({ noticeId, create, error, equipmentId, search, historyPage }: {
  noticeId?: string; create: boolean; error?: string; equipmentId?: string; search?: string; historyPage?: string;
}) {
  const notice = noticeId ? await getNotice(noticeId) : null;
  const notices = !create && !noticeId ? await listNotices() : [];
  const canLink = Boolean(notice && (notice.stage === 0 || !notice.equipmentId));
  const selected = equipmentId && (create || canLink) ? await getEquipment(equipmentId) : null;
  const page = /^\d{1,6}$/.test(historyPage || '') ? Number(historyPage) : 0;
  const message = error ? errors[error] : equipmentId && !selected ? errors.equipo : undefined;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Avisos</h2>
      {create || noticeId
        ? <Link className="font-semibold text-blue-900 underline" href={base}>Volver a avisos</Link>
        : <Link className={primary} href={base + '&nuevo=1'}>Nuevo aviso</Link>}
    </div>
    {message && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-amber-950">{message}</p>}
    {(create || canLink) && <EquipmentSearch search={search} noticeId={create ? undefined : notice?.id} />}
    {notice && selected && !create && <NoticeForm id={notice.id} step="link" title="Vincular equipo">
      <input type="hidden" name="equipmentId" value={selected.id} />
      <EquipmentSummary equipment={selected} />
    </NoticeForm>}
    {create ? <NoticeForm id={randomUUID()} step="create" title="Registrar aviso">
      {selected && <>
        <input type="hidden" name="equipmentId" value={selected.id} />
        <EquipmentSummary equipment={selected} />
        <Link className="text-sm text-blue-900 underline" href={base + '&nuevo=1'}>Quitar selección</Link>
      </>}
      <div className="grid gap-3 sm:grid-cols-2">
        {!selected?.customer_name && <Field name="customer" label="Cliente" required />}
        <Field name="phone" label="Teléfono" type="tel" maxLength={40} />
        {!selected && <>
          <Field name="equipment" label="Equipo o modelo" />
          <Field name="serial" label="Número de serie" />
        </>}
        <Selection name="origin" label="Origen" options={['Teléfono', 'WhatsApp', 'Fabricante', 'Otro']} />
      </div>
      <Notes name="issue" label="Avería comunicada" maxLength={2000} required />
    </NoticeForm> : notice ? <>
      <EquipmentHistory notice={notice} page={page} />
      <NoticeDetails notice={notice} />
    </> : (
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
