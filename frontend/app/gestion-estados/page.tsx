import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from './actions';
import { hasSession } from './session';
import Board from './board';

const departments = [
  { id: 'comercial', name: 'Comercial' },
  { id: 'mantenimiento', name: 'Mantenimiento' },
] as const;

export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ departamento?: string; seccion?: string }> }) {
  if (!await hasSession()) redirect('/gestion-estados/login');
  const params = await searchParams;
  const technicalService = params.seccion === 'servicio-tecnico';
  const selected = params.departamento === 'mantenimiento' ? 'mantenimiento' : 'comercial';
  return <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside className="bg-[#082b5b] p-5 text-white lg:sticky lg:top-0 lg:h-screen">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/icon.png" alt="" width={40} height={40} className="rounded-lg bg-white" />
        <span className="font-bold">DAVOFRÍO</span>
      </Link>
      <nav aria-label="Áreas del CRM" className="mt-6 space-y-2 border-t border-white/20 pt-5">
        <details open={!technicalService} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 font-semibold hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            Seguimiento
            <ChevronDown aria-hidden="true" size={16} className="group-open:rotate-180" />
          </summary>
          <div className="mt-1 space-y-1 pl-3">
            {departments.map(department => <Link key={department.id}
              href={`/gestion-estados?departamento=${department.id}`}
              aria-current={!technicalService && selected === department.id ? 'page' : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 ${!technicalService && selected === department.id ? 'bg-white/15' : ''}`}>
              {department.name}
            </Link>)}
          </div>
        </details>
        <details open={technicalService} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 font-semibold hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            Servicio técnico
            <ChevronDown aria-hidden="true" size={16} className="group-open:rotate-180" />
          </summary>
          <div className="mt-1 pl-3">
            <Link href="/gestion-estados?seccion=servicio-tecnico"
              aria-current={technicalService ? 'page' : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 ${technicalService ? 'bg-white/15' : ''}`}>
              Avisos
            </Link>
          </div>
        </details>
      </nav>
    </aside>
    <main className="min-w-0 p-5 sm:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-blue-950 p-6 text-white">
        <div><Link href="/" className="text-sm text-blue-200">← Portal corporativo</Link>
          <h1 className="mt-2 text-2xl font-bold">{technicalService ? 'Servicio técnico' : 'Gestión de estados y automatizaciones'}</h1></div>
        <form action={logout}><button className="rounded-lg border border-white/30 px-4 py-2">Cerrar sesión</button></form>
      </header>
      {technicalService ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Avisos</h2>
          <p className="mt-2 text-sm text-slate-600">El módulo de avisos está en preparación.</p>
        </section>
      ) : <Board key={selected} department={selected} label={selected === 'comercial' ? departments[0].name : departments[1].name} />}
    </div>
    </main>
  </div>;
}
