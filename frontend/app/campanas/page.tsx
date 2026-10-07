'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Megaphone,
  PhoneCall,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type CampaignType = 'INVIERNO' | 'VERANO' | 'SIBER';

type Campaign = {
  id: string;
  name: string;
  type: CampaignType;
  start_date: string;
  end_date: string;
  retell_agent_id: string;
  active: boolean;
  status: string;
  candidate_count: number;
  contacts_count: number;
  notes: string | null;
  created_at: string;
};

type CampaignForm = {
  name: string;
  type: CampaignType;
  startDate: string;
  endDate: string;
  notes: string;
};

type TestCallForm = {
  customerName: string;
  phone: string;
  type: CampaignType;
  email: string;
};

const initialForm: CampaignForm = {
  name: '',
  type: 'INVIERNO',
  startDate: '',
  endDate: '',
  notes: '',
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(initialForm);
  const [message, setMessage] = useState('');
  const [showTestCall, setShowTestCall] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testCall, setTestCall] = useState<TestCallForm>({
    customerName: '',
    phone: '',
    type: 'INVIERNO',
    email: '',
  });

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/campaigns`, {
        cache: 'no-store',
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudieron cargar las campañas.');
      }

      setCampaigns(body.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudo crear la campaña.');
      }

      setForm(initialForm);
      setShowForm(false);
      await loadCampaigns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    const confirmed = window.confirm(
      `¿Eliminar la campaña «${campaign.name}» y todos sus registros asociados? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(campaign.id);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/campaigns/${campaign.id}`, {
        method: 'DELETE',
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudo eliminar la campaña.');
      }

      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setMessage(`Campaña «${campaign.name}» eliminada correctamente.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setDeletingId(null);
    }
  }

  async function sendTestCall(event: FormEvent) {
    event.preventDefault();
    setSendingTest(true);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/campaigns/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCall),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo iniciar la prueba.');

      setMessage(`Llamada ${testCall.type} iniciada a ${body.data.phone}. ID: ${body.data.callId}`);
      setShowTestCall(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Gestión comercial</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950">Campañas</h2>
          <p className="mt-2 text-sm text-slate-500">
            Diseña, revisa, aprueba y ejecuta campañas con trazabilidad completa.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTestCall(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            <PhoneCall size={17} />
            Llamada de prueba
          </button>
          <button
            onClick={loadCampaigns}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Nueva campaña
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      {showTestCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={sendTestCall} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Llamada de prueba</h3>
                <p className="mt-1 text-sm text-slate-500">Comprueba una campaña sin crear una cola completa.</p>
              </div>
              <button type="button" onClick={() => setShowTestCall(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="text-sm font-semibold text-slate-700">
                Nombre completo
                <input required value={testCall.customerName} onChange={(event) => setTestCall({ ...testCall, customerName: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Teléfono internacional
                <input required value={testCall.phone} onChange={(event) => setTestCall({ ...testCall, phone: event.target.value })} placeholder="+34600000000" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Campaña
                <select value={testCall.type} onChange={(event) => setTestCall({ ...testCall, type: event.target.value as CampaignType })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal">
                  <option value="SIBER">SIBER</option>
                  <option value="INVIERNO">Invierno</option>
                  <option value="VERANO">Verano</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Correo registrado (opcional)
                <input type="email" value={testCall.email} onChange={(event) => setTestCall({ ...testCall, email: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
            </div>

            <button disabled={sendingTest} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {sendingTest ? 'Iniciando llamada…' : 'Llamar ahora'}
            </button>
          </form>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <article
            key={campaign.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2.5">
                  <Megaphone size={20} className="text-slate-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">{campaign.name}</h3>
                  <p className="mt-1 text-xs font-bold tracking-wide text-slate-500">
                    {campaign.type}
                  </p>
                </div>
              </div>

              <CampaignStatus status={campaign.status} />
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarDays size={16} />
                <span>
                  {formatDate(campaign.start_date)} — {formatDate(campaign.end_date)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <span className="block text-xs text-slate-500">Candidatos</span>
                  <strong className="mt-1 block text-lg text-slate-900">
                    {campaign.candidate_count || 0}
                  </strong>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Generados</span>
                  <strong className="mt-1 block text-lg text-slate-900">
                    {campaign.contacts_count || 0}
                  </strong>
                </div>
              </div>

              {campaign.notes && (
                <p className="line-clamp-2 text-xs text-slate-500">
                  {campaign.notes}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <Link
                href={`/campanas/${campaign.id}`}
                className="block flex-1 rounded-lg bg-slate-950 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
              >
                Abrir campaña
              </Link>
              <button
                type="button"
                aria-label={`Eliminar ${campaign.name}`}
                title="Eliminar campaña"
                disabled={deletingId === campaign.id || campaign.status === 'LLAMANDO'}
                onClick={() => deleteCampaign(campaign)}
                className="rounded-lg border border-red-200 px-3 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}

        {!loading && campaigns.length === 0 && (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center lg:col-span-2 xl:col-span-3">
            <Megaphone className="mx-auto text-slate-400" />
            <h3 className="mt-4 font-bold text-slate-900">Todavía no hay campañas</h3>
            <p className="mt-2 text-sm text-slate-500">
              Crea la primera campaña para empezar.
            </p>
          </article>
        )}
      </section>

      {showForm && (
        <>
          <button
            aria-label="Cerrar"
            onClick={() => setShowForm(false)}
            className="fixed inset-0 z-20 cursor-default bg-black/25"
          />

          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">BORRADOR</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-950">
                  Nueva campaña
                </h3>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createCampaign} className="mt-8 space-y-5">
              <Field label="Nombre">
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Invierno 2026"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-700"
                />
              </Field>

              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value as CampaignType })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="INVIERNO">Invierno</option>
                  <option value="VERANO">Verano</option>
                  <option value="SIBER">Siber</option>
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fecha de inicio">
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm({ ...form, startDate: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </Field>

                <Field label="Fecha de fin">
                  <input
                    required
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm({ ...form, endDate: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                El agente unificado de Retell se asignará automáticamente según el tipo de campaña.
              </div>

              <Field label="Notas">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Objetivo, segmento y observaciones internas..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </Field>

              <button
                disabled={saving}
                className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear borrador'}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CampaignStatus({ status }: { status: string }) {
  const classes =
    status === 'FINALIZADA'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'CANCELADA'
        ? 'bg-rose-100 text-rose-700'
        : status === 'LLAMANDO' || status === 'ENVIADA_N8N'
          ? 'bg-blue-100 text-blue-700'
          : status === 'APROBADA'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>
      {status || 'BORRADOR'}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T00:00:00`));
}
