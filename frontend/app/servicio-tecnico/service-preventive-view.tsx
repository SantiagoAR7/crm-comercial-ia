import Link from 'next/link';
import { madridToday } from './service-preventives';
import { listPreventiveNotices, stages } from './service-store';

const base = '/servicio-tecnico?vista=preventivos';
const link = 'font-semibold text-blue-900 underline';

export default async function ServicePreventiveView({ filter, page }: { filter?: string; page?: string }) {
  const overdue = filter !== 'proximas';
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const visits = await listPreventiveNotices(madridToday(), overdue, index * 30);
  const href = (offset: number) => base + (overdue ? '' : '&filtro=proximas') + (offset ? '&paginaPreventivos=' + offset : '');
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Revisiones preventivas</h2>
      <Link className={link} href="/servicio-tecnico?vista=contratos">Ver contratos</Link>
    </header>
    <nav aria-label="Estado de las revisiones" className="flex gap-3">
      {[{ label: 'Vencidas', active: overdue, href: base }, { label: 'Próximas', active: !overdue, href: base + '&filtro=proximas' }].map(item =>
        <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${item.active ? 'bg-blue-950 text-white' : 'bg-white text-blue-900'}`}>
          {item.label}
        </Link>)}
    </nav>
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold">{overdue ? 'Revisiones vencidas sin cerrar' : 'Próximas revisiones sin cerrar'}</h3>
      {visits.length ? <ul className="divide-y divide-slate-200">
        {visits.slice(0, 30).map(visit => <li key={visit.id} className="space-y-1 py-3 text-sm">
          <Link className={link} href={'/servicio-tecnico?aviso=' + visit.id}>
            {visit.customer}{visit.equipment && ' · ' + visit.equipment}
          </Link>
          <p>Prevista el {visit.preventiveDate.split('-').reverse().join('/')} · {stages[visit.stage]}</p>
          <p>{visit.appointment ? `${visit.technician} · ${visit.appointment.replace('T', ' ')}` : 'Pendiente de asignar'}</p>
        </li>)}
      </ul> : <p className="text-sm">{index ? 'No hay más revisiones en esta página.' : 'No hay revisiones en este grupo.'}</p>}
      {(index > 0 || visits.length > 30) && <nav aria-label="Páginas de revisiones" className="flex gap-4 text-sm">
        {index > 0 && <Link className={link} href={href(index - 1)}>Página anterior</Link>}
        {visits.length > 30 && <Link className={link} href={href(index + 1)}>Página siguiente</Link>}
      </nav>}
    </section>
  </section>;
}
