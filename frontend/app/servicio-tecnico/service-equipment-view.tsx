import ServiceWarrantyFields from './service-warranty-fields';
import ServiceWarrantySummary from './service-warranty-summary';
import { madridDate } from './service-refrigerant';
import { contractType, contractTypes } from './service-contract-rules';
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { saveServiceEquipment } from './service-equipment-actions';
import { listEquipmentContracts } from './service-contract-store';
import { formatKilograms } from './service-refrigerant';
import { equipmentLabel, getEquipmentDetails, listEquipmentNotices, searchEquipment, stages } from './service-store';

const base = '/servicio-tecnico?vista=equipos';
const panel = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5';
const control = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2';
const primary = 'rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white';
const link = 'font-semibold text-blue-900 underline';

function Field({ name, label, value, required, limit = 120 }: { name: string; label: string; value?: string | null; required?: boolean; limit?: number }) {
  return <label className="block text-sm font-semibold">{label}
    <input name={name} defaultValue={value || ''} required={required} maxLength={limit} className={control} />
  </label>;
}

export default async function ServiceEquipmentView({ params }: { params: Record<string, string | undefined> }) {
  const id = params.equipo;
  const creating = params.nuevoEquipo === '1' && !id;
  const { equipment, revision } = id ? await getEquipmentDetails(id) : { equipment: null, revision: '' };
  const editing = creating || Boolean(equipment);
  const index = /^\d{1,5}$/.test(params.paginaFicha || '') ? Number(params.paginaFicha) : 0;
  const [notices, contracts, results] = await Promise.all([
    equipment ? listEquipmentNotices(equipment.id, '', index * 10) : [],
    equipment ? listEquipmentContracts(equipment.id) : [],
    !editing && !id && params.buscar ? searchEquipment(params.buscar) : [],
  ]);
  const message = params.errorEquipo === 'garantia' ? 'Revisa el fabricante, la referencia, el periodo y los conceptos de garantía.'
    : params.errorEquipo === 'datos' ? 'Completa el cliente, la marca, el modelo y la serie. Si indicas una carga, introduce también el refrigerante.'
    : params.errorEquipo === 'estado' ? 'La ficha cambió mientras la editabas. Revisa los datos actuales.' : '';
  const detail = base + '&equipo=' + (equipment?.id || '');
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{creating ? 'Nuevo equipo' : equipment ? equipmentLabel(equipment) : 'Equipos'}</h2>
      {editing || id ? <Link href={base} className={link}>Volver a equipos</Link>
        : <Link href={base + '&nuevoEquipo=1'} className={primary}>Nuevo equipo</Link>}
    </header>
    {message && <p role="alert" className="rounded-lg bg-amber-100 p-3">{message}</p>}
    {params.guardadoEquipo === '1' && <p role="status" className="rounded-lg bg-green-100 p-3">Ficha guardada.</p>}
    {editing ? <>
      <form action={saveServiceEquipment} className={panel}>
        <input type="hidden" name="id" value={equipment?.id || randomUUID()} />
        <input type="hidden" name="revision" value={revision} />
        <input type="hidden" name="existing" value={equipment ? 'yes' : 'no'} />
        <h3 className="font-bold">Datos del equipo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {equipment?.customer_name ? <p className="text-sm"><strong>Cliente</strong><br />{equipment.customer_name}</p>
            : <Field name="customer" label="Cliente" required />}
          <Field name="phone" label="Teléfono de contacto" value={equipment?.normalized_phone} limit={40} />
          <Field name="location" label="Ubicación o dirección de la instalación" value={equipment?.location} limit={250} />
          <Field name="brand" label="Marca" value={equipment?.brand} required />
          <Field name="model" label="Modelo" value={equipment?.model} required />
          <Field name="serial" label="Número de serie" value={equipment?.serial_number} required />
          <Field name="refrigerant" label="Refrigerante" value={equipment?.refrigerant} limit={40} />
          <label className="block text-sm font-semibold">Carga nominal (kg)
            <input name="charge" inputMode="decimal" maxLength={9} pattern="[0-9]{1,5}([.,][0-9]{1,3})?"
              defaultValue={equipment?.chargeGrams == null ? '' : String(equipment.chargeGrams / 1000).replace('.', ',')} className={control} />
          </label>
        </div>
        {equipment?.warranty && <ServiceWarrantySummary warranty={equipment.warranty} date={madridDate()} />}
        <ServiceWarrantyFields warranty={equipment?.warranty} />
        <div className="flex flex-wrap items-center gap-3">
          <button className={primary}>Guardar ficha</button>
          {equipment && <Link href={'/servicio-tecnico?nuevo=1&equipo=' + equipment.id} className={link}>Crear aviso para este equipo</Link>}
        </div>
      </form>
      {equipment && <>
        <section className={panel}>
          <h3 className="font-bold">Contratos del equipo</h3>
          {contracts.length ? <ul className="space-y-2 text-sm">{contracts.map(contract => <li key={contract.id}>
            <Link className={link} href={'/servicio-tecnico?vista=contratos&contrato=' + contract.id}>{contract.record.reference}</Link>
            {' · '}{contractTypes[contractType(contract.record.kind)]}{' · '}{contract.record.start}{contract.record.end ? ' a ' + contract.record.end : ' · sin fecha fin'}
          </li>)}</ul> : <p className="text-sm">El equipo no tiene contratos registrados.</p>}
        </section>
        <section className={panel}>
          <h3 className="font-bold">Historial de avisos y partes</h3>
          {notices.length ? <ul className="space-y-2 text-sm">{notices.slice(0, 10).map(notice => <li key={notice.id}>
            <Link className={link} href={'/servicio-tecnico?aviso=' + notice.id}>{notice.issue}</Link>
            {' · '}{stages[notice.stage]}
            {notice.report && <p>{notice.report}</p>}
          </li>)}</ul> : <p className="text-sm">No hay avisos en esta página.</p>}
          <nav aria-label="Páginas del historial" className="flex gap-4 text-sm">
            {index > 0 && <Link href={detail + '&paginaFicha=' + (index - 1)} className={link}>Anteriores</Link>}
            {notices.length > 10 && <Link href={detail + '&paginaFicha=' + (index + 1)} className={link}>Siguientes</Link>}
          </nav>
        </section>
      </>}
    </> : id ? <p className={panel}>Equipo no encontrado.</p> : <>
      <form method="get" action="/servicio-tecnico" className={panel}>
        <input type="hidden" name="vista" value="equipos" />
        <Field name="buscar" label="Buscar por cliente o número de serie" value={params.buscar} required limit={100} />
        <button className={primary}>Buscar equipos</button>
      </form>
      {params.buscar && <section className={panel}>
        {results.length ? <ul className="divide-y divide-slate-200 text-sm">{results.map(item => <li key={item.id} className="py-3">
          <Link className={link} href={base + '&equipo=' + item.id}>{item.customer_name} · {equipmentLabel(item)}</Link>
          <p>{item.serial_number || 'Sin número de serie'}{item.location && ' · ' + item.location}</p>
          {item.refrigerant && <p>{item.refrigerant} · {formatKilograms(item.chargeGrams ?? null)}</p>}
        </li>)}</ul> : <p>No se encontraron equipos.</p>}
      </section>}
    </>}
  </section>;
}
