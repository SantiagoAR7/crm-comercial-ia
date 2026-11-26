import Link from 'next/link';
import { query } from './service-store';

const base = '/servicio-tecnico?vista=partes-pendientes';
const size = 30;

export default async function PendingServiceDeliveries({ page }: { page?: string }) {
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const rows = await query<{ id: string; customer: string; finishedAt?: string }>('service_notices', {
    stage: 'eq.3', select: 'id,customer:record->>customer,finishedAt:record->>finishedAt',
    order: 'created_at.desc,id.desc', offset: String(index * size), limit: String(size + 1),
  });
  const notices = rows.slice(0, size);
  const delivered = new Set(notices.length ? (await query<{ notice_id: string }>('service_deliveries', {
    select: 'notice_id', notice_id: 'in.(' + notices.map(notice => notice.id).join(',') + ')',
    kind: 'eq.parte', is_test: 'eq.false', state: 'eq.accepted',
  })).map(entry => entry.notice_id) : []);
  const pending = notices.filter(notice => !delivered.has(notice.id));
  return <section className="space-y-4 rounded-xl bg-white p-5">
    <h2 className="text-xl font-bold">Partes pendientes de entrega</h2>
    <p className="text-sm text-slate-600">Partes cerrados sin un envío al cliente aceptado por Microsoft. Los correos de prueba no cuentan como entrega.</p>
    {pending.length ? <ul className="divide-y">
      {pending.map(notice => <li key={notice.id} className="py-3">
        <Link className="font-semibold text-blue-900 underline" href={'/servicio-tecnico?aviso=' + notice.id}>{notice.customer}</Link>
        {notice.finishedAt && <p className="text-sm">{new Date(notice.finishedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>}
      </li>)}
    </ul> : <p>No hay partes pendientes en esta página.</p>}
    <nav aria-label="Páginas de partes cerrados" className="flex gap-4 text-sm font-semibold text-blue-900">
      {index > 0 && <Link href={base + '&paginaPartes=' + (index - 1)}>Anterior</Link>}
      {rows.length > size && <Link href={base + '&paginaPartes=' + (index + 1)}>Siguiente</Link>}
    </nav>
  </section>;
}
