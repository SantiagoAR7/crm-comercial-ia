import Link from 'next/link';
import { datePlus, minutesForVisit, visitEnd, weekStart } from './service-appointment-time';
import { validCoverageDate } from './service-coverage';
import { listScheduledVisits, stages, type ScheduledVisit } from './service-store';

const base = '/servicio-tecnico';
const control = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
const link = 'font-semibold text-blue-900 underline';

function Visit({ visit, orders = false }: { visit: ScheduledVisit; orders?: boolean }) {
  const end = visitEnd(visit.appointment, visit.plannedMinutes);
  const time = visit.appointment.slice(11, 16) + '–' + end.slice(11, 16)
    + (end.slice(0, 10) !== visit.appointment.slice(0, 10) ? ' (+1 día)' : '');
  return <div className="space-y-1 text-sm">
    <time dateTime={visit.appointment} className="block font-semibold tabular-nums">{time}</time>
    <Link className={link} href={base + '?aviso=' + visit.id + (orders ? '#cerrar-parte' : '')}>
      {visit.customer}{visit.equipment && ' · ' + visit.equipment}
    </Link>
    <p className="text-xs text-slate-600">
      {visit.origin === 'Preventivo' ? 'Preventivo' : 'Correctivo'} · {minutesForVisit(visit.plannedMinutes)} min
      {visit.plannedMinutes == null && ' estimados'} · {stages[visit.stage]}
    </p>
  </div>;
}

const headings = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function ServiceSchedule({ date, technician, technicianId, page, orders = false, period }: {
  date?: string; technician?: string; technicianId?: string; page?: string; orders?: boolean; period?: string;
}) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const day = !orders && date && validCoverageDate(date) && date.slice(0, 4) >= '1900' && date.slice(0, 4) <= '9998' ? date : today;
  const weekly = !orders && period === 'semana';
  const first = weekly ? weekStart(day) : day;
  const last = weekly ? datePlus(first, 6) : day;
  const days = weekly ? Array.from({ length: 7 }, (_, index) => datePlus(first, index)) : [day];
  const name = technicianId ? '' : technician?.slice(0, 250).trim() || '';
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const visits = await listScheduledVisits(first, name, index * 40, orders, technicianId, last);
  const groups = new Map<string, ScheduledVisit[]>();
  for (const visit of visits.slice(0, 40)) {
    const group = groups.get(visit.technician);
    if (group) group.push(visit);
    else groups.set(visit.technician, [visit]);
  }
  const href = (date: string, page = 0, week = weekly, filter = name) => base + '?' + new URLSearchParams({
    vista: orders ? 'ordenes' : 'agenda', fecha: date, ...(week ? { periodo: 'semana' } : {}),
    ...(filter ? { tecnico: filter } : {}), ...(page ? { paginaAgenda: String(page) } : {}),
  });

  return <section className="space-y-5">
    <h2 className="text-xl font-bold">{technicianId ? 'Mis órdenes de hoy' : orders ? 'Órdenes de hoy' : weekly ? 'Agenda semanal por técnico' : 'Agenda de visitas'}</h2>
    {orders && !technicianId && <p className="text-sm text-slate-600">Visitas pendientes de hoy. Filtra por el nombre asignado al técnico.</p>}
    {!technicianId && <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <form method="get" action="/servicio-tecnico" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vista" value={orders ? 'ordenes' : 'agenda'} />
        {weekly && <input type="hidden" name="periodo" value="semana" />}
        {!orders && <label className="text-sm font-semibold">Fecha
          <input className={control} name="fecha" type="date" defaultValue={day} required />
        </label>}
        <label className="text-sm font-semibold">Técnico
          <input className={control} name="tecnico" placeholder="Nombre exacto" maxLength={250} defaultValue={name} />
        </label>
        <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Ver visitas</button>
        {name && <Link href={href(day, 0, weekly, '')} className={link}>Ver todos los técnicos</Link>}
      </form>
      {!orders && <>
        <nav aria-label="Vista de agenda" className="flex gap-3 text-sm">
          <Link href={href(day, 0, false)} aria-current={!weekly ? 'page' : undefined} className={link}>Día</Link>
          <Link href={href(day, 0, true)} aria-current={weekly ? 'page' : undefined} className={link}>Semana</Link>
        </nav>
        <nav aria-label="Navegación por fecha" className="flex flex-wrap gap-4 text-sm">
          <Link className={link} href={href(datePlus(first, weekly ? -7 : -1))}>{weekly ? 'Semana anterior' : 'Día anterior'}</Link>
          <Link className={link} href={href(today)}>{weekly ? 'Esta semana' : 'Hoy'}</Link>
          <Link className={link} href={href(datePlus(first, weekly ? 7 : 1))}>{weekly ? 'Semana siguiente' : 'Día siguiente'}</Link>
        </nav>
      </>}
    </div>}
    {weekly ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[64rem] table-fixed text-left">
        <thead className="bg-blue-50">
          <tr>
            <th scope="col" className="w-32 px-3 py-3 text-sm">Técnico</th>
            {days.map(day => <th key={day} scope="col" className="px-3 py-3 text-sm capitalize">
              {headings.format(new Date(day + 'T00:00:00Z'))}
            </th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {[...groups].map(([technician, records]) => <tr key={technician} className="align-top">
            <th scope="row" className="break-words px-3 py-3 text-sm">{technician || 'Sin técnico'}</th>
            {days.map(day => <td key={day} className="space-y-2 border-l border-slate-100 px-2 py-2 align-top">
              {records.filter(visit => visit.appointment.startsWith(day)).map(visit => <div key={visit.id} className="break-words rounded-lg bg-slate-50 p-2">
                <Visit visit={visit} />
              </div>)}
            </td>)}
          </tr>)}
          {groups.size === 0 && <tr><td colSpan={8} className="p-5 text-sm">No hay visitas para esta semana y filtro.</td></tr>}
        </tbody>
      </table>
    </div> : <>
      {groups.size === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5">
        {index ? 'No hay más visitas en esta página.' : orders ? 'No hay órdenes pendientes para hoy con este filtro.' : 'No hay visitas para esta fecha y filtro.'}
      </p>}
      {[...groups].map(([technician, records]) => <section key={technician} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{technician || 'Técnico sin indicar'}</h3>
        <ul className="divide-y divide-slate-200">
          {records.map(visit => <li key={visit.id} className="py-3"><Visit visit={visit} orders={orders} /></li>)}
        </ul>
      </section>)}
    </>}
    {(index > 0 || visits.length > 40) && <nav aria-label="Páginas de visitas" className="flex gap-4 text-sm">
      {index > 0 && <Link className={link} href={href(day, index - 1)}>Página anterior</Link>}
      {visits.length > 40 && <Link className={link} href={href(day, index + 1)}>Página siguiente</Link>}
    </nav>}
  </section>;
}
