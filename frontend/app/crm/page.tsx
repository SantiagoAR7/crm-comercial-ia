import Link from 'next/link';
import { apiGet } from '@/lib/api';

type DashboardData = {
  contacts: number;
  campaigns: number;
  pending: number;
  calls: number;
  leads: number;
  recentCampaigns: Array<{ id: string; name: string; type: string; status: string; candidate_count: number }>;
};

async function loadDashboard(): Promise<{ data: DashboardData | null; error: boolean }> {
  try {
    return { data: await apiGet<DashboardData>('/api/dashboard'), error: false };
  } catch {
    return { data: null, error: true };
  }
}

export default async function DashboardPage() {
  const result = await loadDashboard();
  const data = result.data || { contacts: 0, campaigns: 0, pending: 0, calls: 0, leads: 0, recentCampaigns: [] };

  const cards = [
    ['Contactos activos', data.contacts],
    ['Campañas', data.campaigns],
    ['Pendientes', data.pending],
    ['Llamadas realizadas', data.calls],
    ['Oportunidades', data.leads],
  ];

  return (
    <div className="p-5 sm:p-8">
      {result.error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          No se pudo conectar con el backend. No se muestran cifras para evitar confundir datos de prueba con datos reales.
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Resumen operativo</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950">Dashboard</h2>
        </div>
        <Link
          href="/instalaciones"
          className="rounded-xl bg-[#082b5b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b3975]"
        >
          Ver instalaciones
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {Number(value).toLocaleString('es-ES')}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-bold text-slate-950">Campañas activas</h3>
          <div className="mt-5 space-y-3">
            {data.recentCampaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campanas/${campaign.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-900">{campaign.name}</p>
                  <p className="text-sm text-slate-500">{campaign.type} · {campaign.candidate_count || 0} candidatos</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {campaign.status}
                </span>
              </Link>
            ))}
            {data.recentCampaigns.length === 0 && <p className="text-sm text-slate-500">No hay campañas registradas.</p>}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Próximo paso</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Revisar los candidatos pendientes antes de aprobar y enviar cualquier campaña a n8n.
          </p>
          <Link
            href="/campanas"
            className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Abrir campañas
          </Link>
        </article>
      </section>
    </div>
  );
}
