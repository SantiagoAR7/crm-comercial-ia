import { madridDate } from './service-refrigerant';
import { technicianDayName } from './service-technician-day';
import Link from 'next/link';
import { listTechnicianActivity, stages } from './service-store';
import { technicianOptions } from './technician-accounts';

const base = '/servicio-tecnico?vista=tecnicos';
const link = 'font-semibold text-blue-900 underline';

export default async function ServiceTechnicians({ selected, page }: { selected?: string; page?: string }) {
  const options = technicianOptions();
  const technician = options.find(item => item.technicianId === selected) || options[0];
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const name = technician ? await technicianDayName(technician.technicianId, madridDate()) : undefined;
  const visits = technician ? await listTechnicianActivity(technician.technicianId, index * 40) : [];
  const href = (page: number) => base + '&' + new URLSearchParams({
    tecnico: technician.technicianId, ...(page ? { paginaTecnico: String(page) } : {}),
  });
  return <section className="space-y-5">
    <h2 className="text-xl font-bold">Actividad por técnico</h2>
    {technician ? <>
      <form method="get" action="/servicio-tecnico" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="vista" value="tecnicos" />
        <label className="text-sm font-semibold">Técnico
          <select name="tecnico" defaultValue={technician.technicianId} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2">
            {options.map(item => <option key={item.username} value={item.technicianId}>{item.technicianId}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Ver actividad</button>
      </form>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{technician.technicianId}{name && ' - ' + name}</h3>
        {!name && <p className="text-sm text-slate-600">Sin nombre registrado hoy</p>}
        {visits.length ? <ul className="divide-y divide-slate-200">
          {visits.slice(0, 40).map(visit => <li key={visit.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Link className={link} href={'/servicio-tecnico?aviso=' + visit.id}>
                {visit.customer}{visit.equipment && ' · ' + visit.equipment}
              </Link>
              <p>{visit.appointment.replace('T', ' ')} · {stages[visit.stage]}</p>
            </div>
            {visit.stage === 3 && <Link className={link} href={'/servicio-tecnico?vista=parte&aviso=' + visit.id}>Ver parte</Link>}
          </li>)}
        </ul> : <p className="text-sm">Este técnico todavía no tiene visitas ni partes registrados.</p>}
        {(index > 0 || visits.length > 40) && <nav aria-label="Páginas de actividad" className="flex gap-4 text-sm">
          {index > 0 && <Link className={link} href={href(index - 1)}>Página anterior</Link>}
          {visits.length > 40 && <Link className={link} href={href(index + 1)}>Página siguiente</Link>}
        </nav>}
      </section>
    </> : <p>Todavía no hay técnicos vinculados.</p>}
  </section>;
}
