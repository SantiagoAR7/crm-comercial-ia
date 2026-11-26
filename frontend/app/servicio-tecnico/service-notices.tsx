import { ServiceBillingDraft } from './service-billing-view';
import ServiceDelivery from './service-delivery';
import { downloadUrl } from './service-document';
import { incompleteVisitReasons } from './service-visit-outcome';
import { listPendingVisits, visitChangesFor } from './service-store';
import ServiceWarrantySummary from './service-warranty-summary';
import { warrantyStatus } from './service-warranty';
import { contractType, contractTypes, coversWork, workTypeForOrigin } from './service-contract-rules';
import ServiceWorksheetFields from './service-worksheet-fields';
import ServiceWorksheetSummary from './service-worksheet-summary';
import ServiceWorkMinutes from './service-work-minutes';
import { visitDate, visitMailLabel, visitSubject } from './service-visit-mail';
import { quoteMailBody, quoteMailSubject } from './service-quote-mail';
import { sendQuote, sendVisitMail } from './service-delivery-actions';
import { elapsedWorkMinutes, formatWorkTime } from './service-work-time';
import ServiceRefrigerantFields from './service-refrigerant-fields';
import ServiceRefrigerantSummary from './service-refrigerant-summary';
import { madridDate } from './service-refrigerant';
import { maxVisitMinutes, minutesForVisit } from './service-appointment-time';
import { noticeBelongsToTechnician } from './service-access';
import { technicianOptions } from './technician-accounts';
import { getEffectiveContract, type ServiceContract } from './service-contract-store';
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import ServiceUsedParts from './service-used-parts';
import ServicePartsList from './service-parts-list';
import ReportEvidence from './service-report-evidence';
import CoverageFields from './coverage-fields';
import { canScheduleWithQuote, chargeLabels, charges, payerLabels, priceForCustomer, quoteDeliveryInProgress } from './service-coverage';
import { saveNotice } from './service-actions';
import { availability, equipmentLabel, findRecentEquipmentContract, getEquipment, getNotice, getNoticeHistory, listEquipmentNotices, listNotices, searchEquipment, stages, type Equipment, type ServiceNotice } from './service-store';

const base = '/servicio-tecnico';
const control = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';
const primary = 'inline-block rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white hover:bg-blue-900';
const quoteDeliveryLabels = {
  sending: 'En proceso', accepted: 'Aceptado por Microsoft', failed: 'Rechazado', unknown: 'Sin confirmación',
};
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const errors: Record<string, string> = {
  datos: 'Indica el cliente y describe la avería.',
  equipo: 'El equipo no está disponible para vincularlo a este aviso.',
  aviso: 'El aviso no está disponible.',
  estado: 'El aviso cambió mientras lo editabas. Revisa la información actual.',
  tipoContrato: 'Ese contrato no cubre el tipo de intervención o no está vigente en la fecha aplicable.',
  cobertura: 'Confirma la cobertura y su referencia. Si has comprobado el stock, indica el repuesto.',
  vigencia: 'Indica las fechas de un contrato vigente hoy. La fecha final se puede dejar vacía si el contrato es indefinido.',
  autorizacion: 'Falta la autorización del fabricante para esta intervención. El aviso sigue pendiente de verificar.',
  destinoPresupuesto: 'Indica y confirma el correo del destinatario del presupuesto.',
  configPresupuesto: 'Falta configurar el correo de Servicio técnico.',
  pdfPresupuesto: 'No se pudo preparar el PDF del presupuesto.',
  correoPresupuestoSinConfirmar: 'El envío quedó sin confirmar. Revisa el buzón de Davofrío.',
  resultadoVisita: 'Selecciona un motivo y describe lo ocurrido y la próxima acción.',
  visitaEnviando: 'Espera a que termine el correo de la visita antes de reprogramarla.',
  visitaDatos: 'Indica la ubicación de la visita y confirma el correo del destinatario.',
  visitaDuplicado: 'Ya existe un envío en curso o registrado para esta cita.',
  visitaSinConfirmar: 'El resultado del envío quedó sin confirmar. Revisa el buzón antes de reenviar.',
  correoPresupuesto: 'Espera a que termine el envío de prueba y vuelve a abrir el aviso.',
  presupuesto: 'Para agendar, confirma los importes y registra la aceptación del presupuesto vigente.',
  importePresupuesto: 'Confirma quién paga cada concepto e indica un importe válido para todos los cargos del cliente.',
  mismoPresupuesto: 'Cambia al menos un importe para emitir otra versión.',
  garantiaVencida: 'La garantía registrada no está vigente para la fecha de la intervención.',
  costeGarantia: 'Confirma quién paga cada concepto y el importe de los que paga el cliente. El aviso sigue pendiente de verificar.',
  fabricante: 'Indica el fabricante y su referencia de autorización.',
  importe: 'Introduce los importes en euros con un máximo de dos decimales.',
  almacen: 'Indica en qué almacén o furgoneta está el repuesto disponible.',
  iniciada: 'La intervención ya empezó y su horario no se puede reprogramar desde aquí.',
  solapamiento: 'El técnico ya tiene otra visita que ocupa parte de ese horario.',
  agenda: 'Indica el técnico y una fecha y hora válidas.',
  plantilla: 'Selecciona el resultado de cada comprobación e indica lo ocurrido si marcaste alguna incidencia.',
  refrigerante: 'Revisa la fecha, el refrigerante y las cantidades. Si se detectó una fuga, indica la actuación o el seguimiento.',
  consumo: 'Revisa la referencia, la cantidad y el almacén o furgoneta de cada repuesto.',
  evidencia: 'Espera a que se preparen las fotos y añade el nombre y la firma juntos si el cliente está presente.',
  parte: 'Describe el trabajo e indica los minutos dedicados.',
};

function Field({ label, name, required = false, type = 'text', maxLength = 250, defaultValue, list }: {
  label: string; name: string; required?: boolean; type?: string; maxLength?: number; defaultValue?: string; list?: string;
}) {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>{label}</span>
    <input name={name} required={required} maxLength={maxLength} type={type} defaultValue={defaultValue} list={list} className={control} />
  </label>;
}

function VisitDuration({ value }: { value?: number }) {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>Duración prevista (minutos)</span>
    <input name="plannedMinutes" type="number" min={1} max={maxVisitMinutes} required
      defaultValue={minutesForVisit(value)} className={control} />
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

function NoticeForm({ id, step, title, children, anchor }: {
  id: string; step: string; title: string; children: React.ReactNode; anchor?: string;
}) {
  return <form action={saveNotice} id={anchor} className={panel + ' space-y-4'}>
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
    {!equipment.warranty && <p>{warranty
      ? `Garantía registrada hasta el ${warranty.slice(0, 10).split('-').reverse().join('/')} · ${warranty.slice(0, 10) >= today ? 'Fecha vigente' : 'Fecha vencida'}`
      : 'Fecha de garantía sin registrar'}</p>}
    <p>Confirma el contrato o la autorización del fabricante antes de aprobar la cobertura.</p>
  </div>;
}

async function EquipmentSearch({ search, noticeId }: { search?: string; noticeId?: string }) {
  const results = search ? await searchEquipment(search) : [];
  const destination = noticeId ? base + '?aviso=' + noticeId : base + '?nuevo=1';
  return <section className={panel + ' space-y-3'}>
    <h3 className="font-bold">Buscar equipo</h3>
    <form method="get" action="/servicio-tecnico" className="flex flex-wrap items-end gap-2">
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

function CoverageEvidence({ notice }: { notice: Pick<ServiceNotice, 'coverageFrom' | 'coverageUntil' | 'manufacturer'> }) {
  const formatDate = (date: string) => date.split('-').reverse().join('/');
  return <>
    {notice.coverageFrom && <span> · Vigencia registrada desde {formatDate(notice.coverageFrom)} hasta {
      notice.coverageUntil ? formatDate(notice.coverageUntil) : 'fecha indefinida'
    }</span>}
    {notice.manufacturer && <span> · {notice.manufacturer}</span>}
  </>;
}

async function EquipmentHistory({ notice, page, effective, equipment }: { notice: ServiceNotice; page: number; effective: ServiceContract | null; equipment: Equipment | null }) {
  if (!notice.equipmentId) return null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [previous, contract] = await Promise.all([
    listEquipmentNotices(notice.equipmentId, notice.id, page * 10),
    effective ? null : findRecentEquipmentContract(notice.equipmentId, today),
  ]);
  const href = base + '?aviso=' + notice.id + '&paginaEquipo=';
  const contractPayers = contract?.payers;
  return <section className={panel + ' space-y-3'}>
    <h3 className="font-bold">Equipo e historial de intervenciones</h3>
    {equipment ? <EquipmentSummary equipment={equipment} /> : <p>La ficha del equipo no está disponible.</p>}
    {equipment?.warranty && <ServiceWarrantySummary warranty={equipment.warranty} date={notice.preventiveDate || today} />}
    {effective && <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-semibold">Contrato aplicable a la intervención</p>
      <Link className="text-blue-900 underline" href={base + '?vista=contratos&contrato=' + effective.id}>{effective.record.reference}</Link>
      <p>{contractTypes[contractType(effective.record.kind)]}
        {coversWork(effective.record.kind, 'preventivo') && ' · revisión cada ' + effective.record.months + ' meses'}
        {' · respuesta en '}{effective.record.responseHours} h</p>
      <ul className="mt-1 flex flex-wrap gap-x-3">
        {charges.map(charge => <li key={charge}>{chargeLabels[charge]} · {payerLabels[effective.record.payers[charge]]}</li>)}
      </ul>
    </div>}
    {!effective && contract && <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-semibold">Referencia de contrato anotada en un aviso anterior</p>
      <p><Link className="text-blue-900 underline" href={base + '?aviso=' + contract.id}>{contract.reference}</Link>
        <CoverageEvidence notice={contract} />
      </p>
      {contractPayers && <ul className="mt-1 flex flex-wrap gap-x-3">
        {charges.map(charge => <li key={charge}>{chargeLabels[charge]} · {payerLabels[contractPayers[charge]]}</li>)}
      </ul>}
    </div>}
    {previous.length ? <ul className="divide-y divide-slate-200 text-sm">
      {previous.slice(0, 10).map(item => <li key={item.id} className="space-y-1 py-2">
        <Link className="font-semibold text-blue-900 underline" href={base + '?aviso=' + item.id}>
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

async function NoticeDetails({ notice, effective, technician, equipment, deliveryResult, billingResult }: { notice: ServiceNotice; effective: ServiceContract | null; technician?: string; equipment: Equipment | null; deliveryResult?: string; billingResult?: string }) {
  const total = priceForCustomer(notice.payers, notice);
  const pendingVisit = notice.stage === 2 && !notice.appointment;
  const visitChanges = !technician ? visitChangesFor(notice) : [];
  const currentVisit = visitChanges.at(-1);
  const priorRecipient = visitChanges.slice().reverse().find(change => change.customer)?.customer?.recipient;
  const canSendVisit = notice.stage === 2 && !pendingVisit && !notice.startedAt && currentVisit
    && !quoteDeliveryInProgress(currentVisit.test) && !quoteDeliveryInProgress(currentVisit.customer)
    && (!currentVisit.test || currentVisit.test.state === 'failed'
      || !currentVisit.customer || currentVisit.customer.state === 'failed');
  const currentQuote = notice.quotes?.at(-1);
  const options = !technician ? technicianOptions() : [];
  return <div className="grid gap-5 xl:grid-cols-2">
    <article className={panel + ' space-y-3'}>
      <h2 className="text-xl font-bold">{notice.customer}</h2>
      <p className="text-sm font-semibold text-blue-900">{pendingVisit ? 'Pendiente de otra visita' : stages[notice.stage]}</p>
      <p className="whitespace-pre-wrap">{notice.issue}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Teléfono</dt><dd>{notice.phone || '—'}</dd>
        <dt>Equipo</dt><dd>{notice.equipment || '—'}</dd>
        <dt>Número de serie</dt><dd>{notice.serial || '—'}</dd>
        {equipment?.location && <><dt>Ubicación de la instalación</dt><dd>{equipment.location}</dd></>}
        <dt>Origen</dt><dd>{notice.origin || '—'}</dd>
        {notice.preventiveDate && <><dt>Revisión prevista</dt><dd>{notice.preventiveDate.split('-').reverse().join('/')}</dd></>}
        <dt>Cobertura</dt><dd>{notice.coverage}</dd>
        {!technician && notice.stage >= 1 && <>
          <dt>{notice.manufacturer ? 'Autorización del fabricante' : 'Referencia'}</dt><dd>{notice.reference}<CoverageEvidence notice={notice} /></dd>
          {notice.warrantyReference && <><dt>Referencia de garantía del equipo</dt><dd>{notice.warrantyReference}</dd></>}
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
        {notice.stage >= 2 && notice.appointment && <>
          <dt>Técnico</dt><dd>{notice.technician}</dd>
          <dt>Visita</dt><dd>{notice.appointment.replace('T', ' ')} · hora local de la visita</dd>
          <dt>Duración prevista</dt><dd>{minutesForVisit(notice.plannedMinutes)} min{!notice.plannedMinutes && ' estimados'}</dd>
        </>}
        {notice.startedAt && <><dt>Inicio de intervención</dt><dd>{formatWorkTime(notice.startedAt)}</dd></>}
        {notice.finishedAt && <><dt>Cierre de intervención</dt><dd>{formatWorkTime(notice.finishedAt)}</dd></>}
        {notice.stage === 3 && <>
          <dt>Minutos trabajados</dt><dd>{notice.minutes}</dd>
          <dt>Piezas usadas</dt><dd><ServicePartsList parts={notice.consumedParts} notes={notice.usedParts} /></dd>
          <dt>Trabajo realizado</dt><dd className="whitespace-pre-wrap">{notice.report}</dd>
        </>}
      </dl>
      {!technician && equipment && <Link className="font-semibold text-blue-900 underline"
        href={base + '?vista=equipos&equipo=' + equipment.id}>Abrir ficha de equipo</Link>}
      {notice.stage === 3 && <>
        {notice.worksheet && <ServiceWorksheetSummary worksheet={notice.worksheet} />}
        {notice.refrigerantWork && <ServiceRefrigerantSummary work={notice.refrigerantWork} />}
        <div className="flex flex-wrap gap-2">
          <p>{notice.reportSignature ? 'Firma del cliente registrada' : 'Parte sin firma del cliente'}</p>
          <Link className={primary} href={base + '?vista=parte&aviso=' + notice.id}>Ver parte de trabajo</Link>
          <a className="font-semibold text-blue-900 underline" href={downloadUrl(notice.id, 'parte')}>Descargar PDF final</a>
          {notice.refrigerantWork?.technicianCredential && <Link className={primary} href={base + '?vista=certificado&aviso=' + notice.id}>
            Ver certificado de intervención
          </Link>}
        </div>
      </>}
      <h3 className="border-t pt-3 font-bold">Historial</h3>
      <ol className="space-y-1 text-sm">
        {(await getNoticeHistory(notice.id)).map(entry => <li key={entry.stage}>{stages[entry.stage]} · {
          new Date(entry.changedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
        }</li>)}
      </ol>
    </article>
    {!technician && notice.stage === 3 && <ServiceBillingDraft notice={notice} result={billingResult} />}
    {!technician && notice.stage === 3 && <ServiceDelivery id={notice.id} kind="parte" result={deliveryResult} inline />}
    {!technician && <datalist id="technician-options">{options.map(account => <option key={account.username} value={account.technicianId} />)}</datalist>}
    {notice.stage === 0 && <NoticeForm id={notice.id} step="0" title="Revisar cobertura y precio">
      <CoverageFields contract={effective?.record} warranty={equipment?.warranty
        && warrantyStatus(equipment.warranty, notice.preventiveDate || madridDate()) === 'active' ? equipment.warranty : undefined} />
      <Field name="part" label="Referencia del repuesto" />
      <Selection name="stock" label="Disponibilidad comprobada" options={availability} />
      <Field name="stockLocation" label="Almacén o furgoneta si hay existencias" />
    </NoticeForm>}
    {!technician && !!notice.quotes?.length && <article className={panel + ' space-y-3'}>
      <h3 className="font-bold">Presupuestos del aviso</h3>
      <ol className="space-y-3">
        {notice.quotes.map((quote, index) => <li key={index} className="rounded-lg border p-3 text-sm">
          <a className="font-semibold text-blue-900 underline"
            href={'/servicio-tecnico/documento?' + new URLSearchParams({ aviso: notice.id, tipo: 'presupuesto', version: String(index + 1) })}>
            Descargar presupuesto PDF · versión {index + 1}
          </a>
          <p>{formatWorkTime(quote.issuedAt)} · {money.format((priceForCustomer(notice.payers, quote.amounts) ?? 0) / 100)}</p>
          <p>{quote.decision?.outcome === 'accepted' ? 'Aceptado' : quote.decision ? 'Rechazado' : quote === currentQuote ? 'Pendiente de respuesta' : 'Sustituido'}</p>
          {quote.testDelivery && <p>Correo de prueba · {quoteDeliveryLabels[quote.testDelivery.state === 'sending' && !quoteDeliveryInProgress(quote.testDelivery) ? 'unknown' : quote.testDelivery.state]} · {formatWorkTime(quote.testDelivery.at)}</p>}
          {notice.stage === 1 && quote === currentQuote && !quote.decision
            && (!quote.testDelivery || quote.testDelivery.state === 'failed') && <form action={sendQuote} className="mt-2">
              <input type="hidden" name="notice" value={notice.id} />
              <input type="hidden" name="quoteRevision" value={notice.quoteRevision || ''} />
              <button name="mode" value="test" className="font-semibold text-blue-900 underline">Enviar prueba a transformaciondigital@davofrio.com</button>
            </form>}
          {quote.customerDelivery && <p>Correo al cliente · {quote.customerDelivery.recipient} · {quoteDeliveryLabels[quote.customerDelivery.state === 'sending' && !quoteDeliveryInProgress(quote.customerDelivery) ? 'unknown' : quote.customerDelivery.state]} · {formatWorkTime(quote.customerDelivery.at)}</p>}
          {notice.stage === 1 && quote === currentQuote && !quote.decision
            && (!quote.customerDelivery || quote.customerDelivery.state === 'failed') && <details className="mt-2">
              <summary className="cursor-pointer font-semibold text-blue-900">Preparar correo al cliente</summary>
              <form action={sendQuote} className="mt-3 space-y-2">
                <input type="hidden" name="notice" value={notice.id} />
                <input type="hidden" name="quoteRevision" value={notice.quoteRevision || ''} />
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold">{quoteMailSubject(index + 1)}</p>
                  <p className="whitespace-pre-wrap">{quoteMailBody('[Enlace privado de esta versión]')}</p>
                  <p>Adjunto · Presupuesto PDF, versión {index + 1}</p>
                </div>
                <label className="block font-semibold">Correo del destinatario
                  <input name="recipient" type="email" maxLength={254} required defaultValue={quote.customerDelivery?.recipient}
                    className="block w-full rounded-lg border p-2 font-normal" />
                </label>
                <label className="flex items-center gap-2"><input name="confirmRecipient" type="checkbox" value="yes" required /> Confirmo el destinatario y el envío de esta versión</label>
                <button name="mode" value="send" className="rounded-lg bg-blue-950 px-3 py-2 font-semibold text-white">Enviar presupuesto al cliente</button>
              </form>
            </details>}
          {quote.decision && <p className="whitespace-pre-wrap break-words">{formatWorkTime(quote.decision.at)} · {quote.decision.evidence}</p>}
        </li>)}
      </ol>
    </article>}
    {!technician && notice.stage === 1 && currentQuote && !currentQuote.decision && <NoticeForm id={notice.id} step="decide" title="Registrar respuesta del cliente">
      <input type="hidden" name="quoteRevision" value={notice.quoteRevision || ''} />
      <label className="block text-sm font-semibold">Respuesta
        <select name="outcome" required className="block w-full rounded-lg border p-2" defaultValue="">
          <option value="">Selecciona una respuesta</option>
          <option value="accepted">Aceptado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">Evidencia de la respuesta
        <textarea name="evidence" required maxLength={1000} className="block w-full rounded-lg border p-2"
          placeholder="Indica el canal, quién respondió y la referencia de la confirmación" />
      </label>
    </NoticeForm>}
    {!technician && notice.stage === 1 && (total !== 0 || currentQuote) && <NoticeForm id={notice.id} step="quote"
      title={currentQuote ? 'Emitir nueva versión del presupuesto' : 'Confirmar importes del cliente'}>
      <input type="hidden" name="quoteRevision" value={notice.quoteRevision || ''} />
      {charges.map(charge => {
        const payer = notice.payers?.[charge] || 'customer';
        if (payer !== 'customer' && payer !== 'pending') return null;
        const amount = notice[charge];
        return <div key={charge} className="space-y-2">
          {payer === 'pending' && <label className="block text-sm font-semibold">Quién paga · {chargeLabels[charge]}
            <select name={'resolve-' + charge} className="block w-full rounded-lg border p-2" required defaultValue="">
              <option value="">Selecciona quién paga</option>
              <option value="customer">Cliente</option>
              <option value={notice.manufacturer ? 'manufacturer' : 'contract'}>{notice.manufacturer ? 'Fabricante' : 'Contrato'}</option>
            </select>
          </label>}
          <Field name={charge} label={chargeLabels[charge] + ' a cargo del cliente (€)'} required={payer === 'customer'}
            defaultValue={amount == null ? '' : (amount / 100).toFixed(2).replace('.', ',')} />
        </div>;
      })}
    </NoticeForm>}
    {!technician && notice.stage === 1 && canScheduleWithQuote(notice) && <NoticeForm id={notice.id} step="1" title="Agendar la visita">
      <input type="hidden" name="quoteRevision" value={notice.quoteRevision || ''} />
      <Field name="technician" label="Técnico" list="technician-options" required />
      <Field name="appointment" label="Fecha y hora local de la visita" type="datetime-local" required />
      <VisitDuration />
    </NoticeForm>}
    {currentVisit && <article className={panel + ' space-y-3'}>
      <h3 className="font-bold">Historial de citas y correos</h3>
      <ol className="space-y-2">
        {visitChanges.map((change, index) => <li key={index} className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{change.previousAppointment ? 'Reprogramación' : 'Cita'} · {visitDate(change.appointment)}</p>
          {change.previousAppointment && <p>Fecha anterior · {visitDate(change.previousAppointment)}</p>}
          {change.changedAt && <p>Registrada el {formatWorkTime(change.changedAt)}</p>}
          {([['Prueba', change.test], ['Cliente', change.customer]] as const).map(([label, mail]) => mail && <p key={label}>
            {label} · {mail.recipient} · {visitMailLabel(mail)} · {formatWorkTime(mail.at)}<br />Ubicación comunicada · {mail.location}
          </p>)}
        </li>)}
      </ol>
      {canSendVisit && <details>
        <summary className="cursor-pointer font-semibold text-blue-900">{currentVisit.previousAppointment ? 'Preparar aviso de reprogramación' : 'Preparar confirmación de visita'}</summary>
        <form action={sendVisitMail} className="mt-3 space-y-3 text-sm">
          <input type="hidden" name="notice" value={notice.id} />
          <input type="hidden" name="visitRevision" value={notice.visitRevision || ''} />
          <input type="hidden" name="visitNumber" value={visitChanges.length} />
          <input type="hidden" name="appointment" value={currentVisit.appointment} />
          <p className="font-semibold">{visitSubject(notice.id, currentVisit)}</p>
          <Field name="location" label="Ubicación de la visita" required maxLength={500}
            defaultValue={currentVisit.customer?.location || currentVisit.test?.location || equipment?.location} />
          {(!currentVisit.customer || currentVisit.customer.state === 'failed') && <>
            <Field name="recipient" label="Correo del destinatario" type="email" maxLength={254} required
              defaultValue={priorRecipient || currentQuote?.customerDelivery?.recipient} />
            <label className="flex items-center gap-2"><input name="confirmRecipient" type="checkbox" value="yes" required /> Confirmo el destinatario y el horario de la visita</label>
            <button name="mode" value="send" className="rounded-lg bg-blue-950 px-3 py-2 font-semibold text-white">Enviar correo al cliente</button>
          </>}
          {(!currentVisit.test || currentVisit.test.state === 'failed') && <button name="mode" value="test" formNoValidate className="block font-semibold text-blue-900 underline">
            Enviar prueba a transformaciondigital@davofrio.com
          </button>}
        </form>
      </details>}
    </article>}
    {!technician && notice.stage === 2 && !notice.startedAt && <NoticeForm id={notice.id} step="move" title={pendingVisit ? 'Agendar otra visita' : 'Reprogramar visita'}>
      <input type="hidden" name="previousAppointment" value={notice.appointment} />
      <input type="hidden" name="previousTechnician" value={notice.technician} />
      <input type="hidden" name="previousMinutes" value={notice.plannedMinutes ?? ''} />
      <Field name="technician" label="Técnico" list="technician-options" defaultValue={notice.technician} required />
      <Field name="appointment" label="Fecha y hora local de la visita" type="datetime-local" defaultValue={notice.appointment} required />
      <VisitDuration value={notice.plannedMinutes} />
    </NoticeForm>}
    {notice.stage === 2 && !pendingVisit && !notice.startedAt && <form action={saveNotice} className={panel + ' space-y-3'}>
      <input type="hidden" name="id" value={notice.id} />
      <input type="hidden" name="step" value="start" />
      <input type="hidden" name="visitRevision" value={notice.visitRevision || ''} />
      <h2 className="text-lg font-bold">Inicio de intervención</h2>
      <button className={primary}>Iniciar intervención</button>
    </form>}
    {!!notice.incompleteVisits?.length && <article className={panel + ' space-y-3'}>
      <h3 className="font-bold">Resultados de visitas anteriores</h3>
      <ol className="space-y-3">
        {notice.incompleteVisits.map((visit, index) => <li key={index} className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{visit.reason} · {visitDate(visit.appointment)}</p>
          <p>{visit.technician} · registrado el {formatWorkTime(visit.recordedAt)}</p>
          <p className="whitespace-pre-wrap break-words">{visit.work}</p>
          <p className="whitespace-pre-wrap break-words"><strong>Próxima acción</strong> · {visit.nextAction}</p>
        </li>)}
      </ol>
    </article>}
    {notice.stage === 2 && !pendingVisit && <NoticeForm id={notice.id} step="2" anchor="cerrar-parte" title="Cerrar el parte">
      <input type="hidden" name="visitRevision" value={notice.visitRevision || ''} />
      <Notes name="report" label="Trabajo realizado" maxLength={4000} required />
      <ServiceWorksheetFields origin={notice.origin} />
      <ServiceWorkMinutes startedAt={notice.startedAt} initial={elapsedWorkMinutes(notice.startedAt)} />
      <ServiceUsedParts reference={notice.part} stockLocation={notice.stockLocation} />
      <Notes name="usedParts" label="Notas sobre las piezas (opcional)" maxLength={2000} />
      <ServiceRefrigerantFields today={madridDate()} refrigerant={equipment?.refrigerant} chargeGrams={equipment?.chargeGrams} />
      <ReportEvidence />
    </NoticeForm>}
    {notice.stage === 2 && !pendingVisit && <details className={panel}>
      <summary className="cursor-pointer font-semibold text-blue-900">La visita quedó incompleta</summary>
      <NoticeForm id={notice.id} step="result" title="Registrar visita incompleta">
      <input type="hidden" name="visitRevision" value={notice.visitRevision || ''} />
      <Selection name="reason" label="Motivo" options={['Selecciona un motivo', ...incompleteVisitReasons]} />
      <Notes name="work" label="Qué ocurrió o qué trabajo quedó hecho" maxLength={4000} required />
      <Notes name="nextAction" label="Próxima acción" maxLength={1000} required />
      </NoticeForm>
    </details>}
  </div>;
}

export default async function ServiceNotices({ noticeId, create, error, equipmentId, search, historyPage, rescheduled, technician, conflictId, deliveryResult, billingResult }: {
  noticeId?: string; create: boolean; error?: string; equipmentId?: string; search?: string; historyPage?: string; rescheduled?: boolean; technician?: string; conflictId?: string; deliveryResult?: string; billingResult?: string;
}) {
  const candidate = noticeId ? await getNotice(noticeId) : null;
  const notice = candidate && (!technician || (candidate.stage >= 2 && noticeBelongsToTechnician(candidate, technician))) ? candidate : null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [effective, equipment] = await Promise.all([
    !technician && notice?.equipmentId ? getEffectiveContract(notice.equipmentId, notice.preventiveDate || today, workTypeForOrigin(notice.origin)) : null,
    notice?.equipmentId ? getEquipment(notice.equipmentId) : null,
  ]);
  const notices = !create && !noticeId ? await listNotices() : [];
  const pending = !technician && !create && !noticeId ? await listPendingVisits() : [];
  const canLink = Boolean(!technician && notice && (notice.stage === 0 || !notice.equipmentId));
  const selected = equipmentId && (create || canLink) ? await getEquipment(equipmentId) : null;
  const page = /^\d{1,6}$/.test(historyPage || '') ? Number(historyPage) : 0;
  const message = error ? errors[error] : equipmentId && !selected ? errors.equipo : undefined;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Avisos</h2>
      {create || noticeId
        ? <Link className="font-semibold text-blue-900 underline" href={technician ? base + '?vista=ordenes' : base}>{technician ? 'Volver a mis órdenes' : 'Volver a avisos'}</Link>
        : <Link className={primary} href={base + '?nuevo=1'}>Nuevo aviso</Link>}
    </div>
    {!!pending.length && <section className={panel + ' space-y-3'}>
      <h3 className="font-bold">Pendientes de otra visita</h3>
      <ul className="divide-y text-sm">
        {pending.map(item => {
          const visit = item.incompleteVisits?.at(-1);
          return <li className="py-2" key={item.id}>
            <Link href={base + '?aviso=' + item.id} className="font-semibold text-blue-900 underline">{item.customer}</Link>
            {visit && <p className="break-words">{visit.reason} · {visit.nextAction}</p>}
          </li>;
        })}
      </ul>
    </section>}
    {rescheduled && notice && <p role="status" className="rounded-lg bg-green-100 p-3 text-green-950">Visita reprogramada.</p>}
    {message && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-amber-950">
      {message}
      {!technician && error === 'solapamiento' && conflictId && /^[a-f0-9-]{36}$/i.test(conflictId) && <>
        {' '}<Link className="font-semibold underline" href={base + '?aviso=' + conflictId}>Ver la visita que ocupa el horario</Link>
      </>}
    </p>}
    {(create || canLink) && <EquipmentSearch search={search} noticeId={create ? undefined : notice?.id} />}
    {notice && selected && !create && <NoticeForm id={notice.id} step="link" title="Vincular equipo">
      <input type="hidden" name="equipmentId" value={selected.id} />
      <EquipmentSummary equipment={selected} />
    </NoticeForm>}
    {create ? <NoticeForm id={randomUUID()} step="create" title="Registrar aviso">
      <p className="text-sm text-slate-600">Tras guardar el aviso, abre «Revisar cobertura y precio» para registrar el contrato o la garantía.</p>
      {selected && <>
        <input type="hidden" name="equipmentId" value={selected.id} />
        <EquipmentSummary equipment={selected} />
        <Link className="text-sm text-blue-900 underline" href={base + '?nuevo=1'}>Quitar selección</Link>
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
      {!technician && <EquipmentHistory notice={notice} page={page} effective={effective} equipment={equipment} />}
      <NoticeDetails billingResult={billingResult} deliveryResult={deliveryResult} notice={notice} effective={effective} technician={technician} equipment={equipment} />
    </> : (
      <div className={panel}>
        {notices.length ? <ul className="divide-y divide-slate-200">
          {notices.map(item => <li key={item.id}>
            <Link className="flex flex-wrap justify-between gap-2 py-3 hover:text-blue-700" href={base + '?aviso=' + item.id}>
              <span className="font-semibold">{item.customer} {item.equipment && '· ' + item.equipment}</span>
              <span className="text-sm">{item.origin === 'Preventivo' && 'Preventivo · '}{item.stage === 2 && !item.appointment ? 'Pendiente de otra visita' : stages[item.stage]}</span>
            </Link>
          </li>)}
        </ul> : noticeId ? <p>Aviso no encontrado.</p> : <div className="space-y-1">
          <p className="font-semibold">Todavía no hay avisos registrados.</p>
          <p className="text-sm text-slate-600">Crea un aviso para revisar su contrato o garantía y calcular el precio antes de agendar.</p>
        </div>}
      </div>
    )}
  </section>;
}
