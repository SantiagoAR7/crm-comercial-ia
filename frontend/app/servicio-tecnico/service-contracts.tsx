import ServiceContractScheduleFields from './service-contract-schedule-fields';
import { contractType, contractTypes, coversWork, rateInput } from './service-contract-rules';
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { generateServicePreventives, saveServiceContract } from './service-contract-actions';
import { chargeLabels, charges } from './service-coverage';
import { getContract, listContracts } from './service-contract-store';
import { equipmentLabel, getEquipment, searchEquipment } from './service-store';

const base = '/servicio-tecnico?vista=contratos';
const panel = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5';
const control = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2';
const primary = 'rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white';
const link = 'font-semibold text-blue-900 underline';
const errors: Record<string, string> = {
  datos: 'Revisa la referencia, los equipos, las fechas, la periodicidad y las horas de respuesta.',
  tarifa: 'Introduce los importes de referencia en euros con un máximo de dos decimales.',
  sinPreventivos: 'Este contrato es correctivo y no genera revisiones preventivas.',
  equipos: 'Selecciona equipos que estén disponibles y figuren bajo el mismo cliente.',
  estado: 'El contrato cambió. Revisa los datos antes de volver a guardar o generar.',
  horizonte: 'Selecciona una fecha entre hoy y los próximos doce meses.',
};

function Field({ name, children, value, type = 'text', required = false, min, max }: {
  name: string; children: string; value?: string | number; type?: string; required?: boolean; min?: string; max?: string;
}) {
  return <label className="block text-sm font-semibold">{children}
    <input name={name} type={type} className={control} defaultValue={value} required={required} min={min} max={max}
      maxLength={type === 'text' ? 120 : undefined} />
  </label>;
}

export default async function ServiceContracts({ params }: { params: Record<string, string | undefined> }) {
  const contract = params.contrato ? await getContract(params.contrato) : null;
  const editing = Boolean(contract || params.nuevoContrato === '1');
  const page = /^\d{1,5}$/.test(params.paginaContratos || '') ? Number(params.paginaContratos) : 0;
  const list = editing || params.contrato ? [] : await listContracts(page * 30);
  const terms = contract?.record;
  const kind = contractType(terms?.kind);
  const selectedIds = terms?.equipmentIds || [];
  const [selected, results] = editing ? await Promise.all([
    Promise.all(selectedIds.map(getEquipment)), params.buscar ? searchEquipment(params.buscar) : [],
  ]) : [[], []];
  const equipment = new Map(results.map(item => [item.id, item]));
  for (const item of selected) if (item) equipment.set(item.id, item);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const dateAhead = (days: number) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  const message = params.errorContrato ? errors[params.errorContrato] : undefined;
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Contratos de mantenimiento</h2>
      {editing || params.contrato ? <Link href={base} className={link}>Volver a contratos</Link>
        : <Link href={base + '&nuevoContrato=1'} className={primary}>Nuevo contrato</Link>}
    </header>
    {!editing && !params.contrato && <p className="text-sm text-slate-600">
      Las revisiones se generan a diario. Consulta las pendientes en <Link href="/servicio-tecnico?vista=preventivos" className={link}>Preventivos</Link>.
    </p>}
    {message && <p role="alert" className="rounded-lg bg-amber-100 p-3">{message}</p>}
    {params.guardado === '1' && contract && <p role="status">Contrato guardado.</p>}
    {contract && /^\d{1,4}$/.test(params.generados || '') && <p role="status" className="rounded-lg bg-green-100 p-3">
      Avisos preventivos creados: {Number(params.generados)} de {Number(params.previstos)} previstos.
      {' '}Los avisos que ya existían se conservaron.
      {Number(params.noDisponibles) > 0 && ` Equipos no disponibles: ${Number(params.noDisponibles)}.`}
    </p>}
    {editing ? <>
      <form method="get" action="/servicio-tecnico" className={panel}>
        <input type="hidden" name="vista" value="contratos" />
        <input type="hidden" name={contract ? 'contrato' : 'nuevoContrato'} value={contract?.id || '1'} />
        <label className="block text-sm font-semibold">Buscar equipos del cliente
          <input name="buscar" defaultValue={params.buscar || terms?.customer} placeholder="Cliente o número de serie"
            minLength={2} maxLength={100} className={control} required />
        </label>
        <button className={primary}>Buscar equipos</button>
      </form>
      <form action={saveServiceContract} className={panel}>
        <h3 className="font-bold">{contract ? 'Editar contrato' : 'Registrar contrato'}</h3>
        <input type="hidden" name="id" value={contract?.id || randomUUID()} />
        <input type="hidden" name="revision" value={contract?.revision || ''} />
        <fieldset className="space-y-2">
          <legend className="font-semibold">Equipos cubiertos{terms && ' · ' + terms.customer}</legend>
          {!equipment.size && <p className="text-sm">Busca el cliente y selecciona al menos un equipo.</p>}
          {[...equipment.values()].map(item => <label key={item.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="equipment" value={item.id} defaultChecked={selectedIds.includes(item.id)} />
            <span>{item.customer_name} · {equipmentLabel(item)} · {item.serial_number || 'Sin número de serie'}</span>
          </label>)}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="reference" value={terms?.reference} required>Referencia del contrato</Field>
          <Field name="start" type="date" value={terms?.start} required>Vigente desde</Field>
          <Field name="end" type="date" value={terms?.end}>Vigente hasta (opcional)</Field>
          <ServiceContractScheduleFields initial={kind} first={terms?.firstVisit} months={terms?.months} />
          <Field name="responseHours" type="number" min="1" max="720" value={terms?.responseHours || 48} required>Plazo de respuesta en horas</Field>
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="font-semibold">Quién paga cada concepto</legend>
          {charges.map(charge => <label key={charge} className="block text-sm font-semibold">{chargeLabels[charge]}
            <select name={'payer-' + charge} defaultValue={terms?.payers[charge] || (charge === 'material' ? 'customer' : 'contract')} className={control}>
              <option value="customer">Cliente</option><option value="contract">Contrato</option>
            </select>
          </label>)}
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="font-semibold">Importes de referencia para el cliente (euros)</legend>
          {charges.map(charge => <label key={charge} className="block text-sm font-semibold">{chargeLabels[charge]}
            <input name={'rate-' + charge} inputMode="decimal" maxLength={10} defaultValue={rateInput(terms?.rates?.[charge])}
              className={control} placeholder="Opcional" />
          </label>)}
        </fieldset>
        <button className={primary}>Guardar contrato</button>
      </form>
      {contract && coversWork(kind, 'preventivo') && <form action={generateServicePreventives} className={panel}>
        <h3 className="font-bold">Generar avisos preventivos</h3>
        <p className="text-sm">Se crean para los equipos cubiertos entre hoy y la fecha elegida, dentro de la vigencia. Después puedes asignarlos desde Avisos.</p>
        <input type="hidden" name="id" value={contract.id} />
        <input type="hidden" name="revision" value={contract.revision} />
        <Field name="through" type="date" value={dateAhead(90)} min={today} max={dateAhead(366)} required>Generar hasta</Field>
        <button className={primary}>Generar preventivos</button>
      </form>}
    </> : <div className={panel}>
      {params.contrato ? <p>Contrato no encontrado.</p> : list.length ? <ul className="divide-y divide-slate-200">
        {list.slice(0, 30).map(item => <li key={item.id} className="py-3">
          <Link href={base + '&contrato=' + item.id} className={link}>{item.record.customer} · {item.record.reference}</Link>
          <p className="text-sm">{contractTypes[contractType(item.record.kind)]} · {item.record.equipmentIds.length} equipo(s){coversWork(item.record.kind, 'preventivo') && ' · revisión cada ' + item.record.months + ' meses'}</p>
        </li>)}
      </ul> : <p>Todavía no hay contratos registrados.</p>}
      <nav aria-label="Páginas de contratos" className="flex gap-4 text-sm">
        {page > 0 && <Link href={base + '&paginaContratos=' + (page - 1)} className={link}>Página anterior</Link>}
        {list.length > 30 && <Link href={base + '&paginaContratos=' + (page + 1)} className={link}>Página siguiente</Link>}
      </nav>
    </div>}
  </section>;
}
