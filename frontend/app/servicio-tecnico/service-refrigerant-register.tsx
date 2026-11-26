import Link from 'next/link';
import { formatKilograms, leakResults, madridDate } from './service-refrigerant';
import { listRefrigerantWork } from './service-store';

const base = '/servicio-tecnico?vista=refrigerantes';
const link = 'font-semibold text-blue-900 underline';

export default async function ServiceRefrigerantRegister({ year, page }: { year?: string; page?: string }) {
  const current = Number(madridDate().slice(0, 4));
  const selected = /^\d{4}$/.test(year || '') && Number(year) >= 1900 && Number(year) <= current ? Number(year) : current;
  const index = /^\d{1,5}$/.test(page || '') ? Number(page) : 0;
  const records = await listRefrigerantWork(selected, index * 30);
  const href = (page: number) => base + '&anio=' + selected + (page ? '&paginaRefrigerantes=' + page : '');
  return <section className="space-y-4">
    <h2 className="text-xl font-bold">Registro de refrigerantes</h2>
    <form method="get" action="/servicio-tecnico" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="vista" value="refrigerantes" />
      <label className="text-sm font-semibold">Año de la actuación
        <input name="anio" type="number" min={1900} max={current} defaultValue={selected} required
          className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Ver actuaciones</button>
    </form>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="bg-blue-50">
          <tr>{['Fecha', 'Cliente y equipo', 'Técnico', 'Refrigerante', 'Añadido', 'Recuperado', 'Control', 'Documento'].map(label =>
            <th scope="col" key={label} className="px-3 py-3">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {records.slice(0, 30).map(record => {
            const work = record.refrigerantWork;
            return <tr key={record.id} className="align-top">
              <td className="px-3 py-3">{work.performedOn.split('-').reverse().join('/')}</td>
              <td className="px-3 py-3">
                <Link href={'/servicio-tecnico?aviso=' + record.id} className={link}>{record.customer}</Link>
                {record.equipment && <p>{record.equipment}</p>}
              </td>
              <td className="px-3 py-3">{record.technician}</td>
              <td className="px-3 py-3">{work.refrigerant}</td>
              <td className="px-3 py-3">{formatKilograms(work.addedGrams)}</td>
              <td className="px-3 py-3">{formatKilograms(work.recoveredGrams)}</td>
              <td className="px-3 py-3">{leakResults[work.leakResult]}</td>
              <td className="px-3 py-3"><Link className={link}
                href={'/servicio-tecnico?vista=' + (work.technicianCredential ? 'certificado' : 'parte') + '&aviso=' + record.id}>
                {work.technicianCredential ? 'Certificado' : 'Parte'}
              </Link></td>
            </tr>;
          })}
          {!records.length && <tr><td colSpan={8} className="px-3 py-5">
            {index ? 'No hay más actuaciones en esta página.' : 'Todavía no hay actuaciones registradas para este año.'}
          </td></tr>}
        </tbody>
      </table>
    </div>
    {(index > 0 || records.length > 30) && <nav aria-label="Páginas de actuaciones" className="flex gap-4 text-sm">
      {index > 0 && <Link className={link} href={href(index - 1)}>Página anterior</Link>}
      {records.length > 30 && <Link className={link} href={href(index + 1)}>Página siguiente</Link>}
    </nav>}
  </section>;
}
