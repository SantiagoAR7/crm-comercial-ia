import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, BriefcaseBusiness, FileCheck2, Network, Search } from 'lucide-react';

const modules = [
  {
    href: '/crm',
    title: 'CRM principal',
    description: 'Contactos, instalaciones, campañas, oportunidades y seguimiento comercial.',
    icon: BriefcaseBusiness,
    accent: 'from-blue-700 to-blue-950',
    badge: 'Gestión comercial',
  },
  {
    href: '/redes',
    title: 'Redes sociales',
    description: 'Control de automatizaciones, contenidos, publicaciones y errores de las cuentas.',
    icon: Network,
    accent: 'from-sky-500 to-blue-700',
    badge: 'Automatización',
  },
  {
    href: '/prospeccion',
    title: 'Prospección',
    description: 'Búsqueda, enriquecimiento y seguimiento de nuevos contactos y empresas.',
    icon: Search,
    accent: 'from-cyan-500 to-teal-700',
    badge: 'Desarrollo comercial',
  },
  {
    href: '/bi',
    title: 'Business Intelligence',
    description: 'Indicadores, análisis y visión ejecutiva de la actividad de Davofrío.',
    icon: BarChart3,
    accent: 'from-indigo-500 to-violet-800',
    badge: 'Analítica',
  },
  {
    href: '/facturas',
    title: 'Facturas y tickets',
    description: 'Revisión y aprobación de documentos enviados por los técnicos.',
    icon: FileCheck2,
    accent: 'from-emerald-500 to-emerald-800',
    badge: 'Administración',
  },
];

export default function ModulesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef3f9] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-red-100/80 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#061a35_0%,#082b5b_52%,#0b4481_100%)] px-6 py-8 text-white shadow-2xl shadow-blue-950/20 sm:px-10 sm:py-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-xl shadow-slate-950/20">
                <Image src="/icon.png" alt="Davofrío" width={68} height={68} priority />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Portal corporativo</p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">DAVOFRÍO</h1>
                <p className="mt-1 text-sm text-blue-100 sm:text-base">Selecciona el módulo al que quieres acceder</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm text-blue-50 backdrop-blur">
              <p className="font-bold text-white">Un único punto de entrada</p>
              <p className="mt-1 max-w-sm leading-6 text-blue-100">Cada área mantiene su acceso y sus permisos independientes.</p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Módulos disponibles">
          {modules.map(({ href, title, description, icon: Icon, accent, badge }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-3xl border border-white bg-white p-6 shadow-lg shadow-slate-300/45 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}>
                  <Icon size={27} />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">{badge}</span>
              </div>
              <h2 className="mt-6 text-xl font-extrabold text-slate-950">{title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#082b5b]">
                Entrar al módulo
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </section>

        <footer className="mt-8 text-center text-xs text-slate-500">
          Portal interno de Davofrío · Los datos de cada módulo están protegidos por su propia sesión.
        </footer>
      </div>
    </main>
  );
}
