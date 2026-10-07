'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Filter,
  Mail,
  Phone,
  RefreshCw,
  Users,
} from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  active: boolean;
  status: string;
  candidate_count: number;
  contacts_count: number;
  filters: Record<string, string>;
  notes: string | null;
};

type Candidate = {
  id: string;
  customer_name: string | null;
  contact_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  population: string | null;
  province: string | null;
  brand: string | null;
  model: string | null;
  equipment_type: string | null;
};

type CampaignRun = {
  id: string;
  status: string;
  total_contacts: number;
  queued_contacts: number;
  processing_contacts: number;
  completed_contacts: number;
  failed_contacts: number;
  skipped_contacts: number;
  batch_size: number;
  max_concurrency: number;
  max_attempts: number;
  n8n_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string;
};

type CampaignContact = {
  id: string;
  customer_name: string | null;
  contact_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  province: string | null;
  brand: string | null;
  model: string | null;
  excluded: boolean;
  exclusion_reason: string | null;
  review_status: string;
};

type CallResult = {
  id: string;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  interest_level: string | null;
  next_action: string | null;
  callback_at: string | null;
  call_status: string | null;
  transcript: string | null;
  recording_url: string | null;
  created_at: string;
  campaign_call_queue: {
    customer_name: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type Filters = {
  brand: string;
  province: string;
  equipmentType: string;
  communication: string;
};

type FilterOptions = {
  brands: string[];
  provinces: string[];
  equipmentTypes: string[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

const initialFilters: Filters = {
  brand: '',
  province: '',
  equipmentType: '',
  communication: '',
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [options, setOptions] = useState<FilterOptions>({
    brands: [],
    provinces: [],
    equipmentTypes: [],
  });
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [preview, setPreview] = useState<Candidate[]>([]);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [results, setResults] = useState<CallResult[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    previewed: 0,
    withPhone: 0,
    withEmail: 0,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [message, setMessage] = useState('');

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const [campaignResponse, filtersResponse, contactsResponse, runsResponse, resultsResponse] =
        await Promise.all([
          fetch(`${apiUrl}/api/campaigns/${campaignId}`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/campaigns/filters`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/campaigns/${campaignId}/contacts`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/campaigns/${campaignId}/runs`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/campaigns/${campaignId}/results`, { cache: 'no-store' }),
        ]);

      const campaignBody = await campaignResponse.json();
      const filtersBody = await filtersResponse.json();
      const contactsBody = await contactsResponse.json();
      const runsBody = await runsResponse.json();
      const resultsBody = await resultsResponse.json();

      if (!campaignResponse.ok) {
        throw new Error(campaignBody.error || 'No se pudo cargar la campaña.');
      }

      setCampaign(campaignBody.data);

      if (filtersResponse.ok) setOptions(filtersBody.data);
      if (contactsResponse.ok) setContacts(contactsBody.data || []);
      if (runsResponse.ok) setRuns(runsBody.data || []);
      if (resultsResponse.ok) setResults(resultsBody.data || []);

      const savedFilters = campaignBody.data.filters || {};
      setFilters({
        brand: savedFilters.brand || '',
        province: savedFilters.province || '',
        equipmentType: savedFilters.equipmentType || '',
        communication: savedFilters.communication || '',
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!campaign || !['ENVIADA_N8N', 'LLAMANDO'].includes(campaign.status)) return;
    const interval = window.setInterval(loadBaseData, 5000);
    return () => window.clearInterval(interval);
  }, [campaign, loadBaseData]);

  async function previewCandidates(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(
        `${apiUrl}/api/campaigns/${campaignId}/candidates/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filters),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudo calcular la selección.');
      }

      setPreview(body.data || []);
      setSummary(body.summary);
      await loadBaseData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }

  async function generateCandidates() {
    if (summary.total === 0 && campaign?.candidate_count === 0) {
      setMessage('Calcula primero la selección de candidatos.');
      return;
    }

    setGenerating(true);
    setMessage('');

    try {
      const response = await fetch(
        `${apiUrl}/api/campaigns/${campaignId}/candidates/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filters),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudieron generar los candidatos.');
      }

      setMessage(`${body.inserted} instalaciones incorporadas a la campaña.`);
      setPreview([]);
      await loadBaseData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setGenerating(false);
    }
  }

  async function changeStatus(status: string) {
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'No se pudo cambiar el estado.');
      }

      await loadBaseData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  async function startCalls() {
    setMessage('Preparando la cola e iniciando las llamadas...');

    try {
      const response = await fetch(
        `${apiUrl}/api/campaigns/${campaignId}/send-to-n8n`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudo enviar la campaña a n8n.');
      }

      setMessage(
        `${body.queuedContacts} llamadas en cola. La campaña ya está en ejecución.`,
      );
      await loadBaseData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  async function bulkReview(reviewStatus: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO') {
    const label = reviewStatus === 'APROBADO' ? 'aprobar' : reviewStatus === 'EXCLUIDO' ? 'excluir' : 'dejar pendientes';
    if (!window.confirm(`¿Confirmas que deseas ${label} todos los candidatos de esta campaña?`)) return;
    setBulkReviewing(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/campaigns/${campaignId}/contacts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo completar la revisión masiva.');
      setMessage(`${body.updated} candidatos actualizados.`);
      await loadBaseData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBulkReviewing(false);
    }
  }

  async function reviewCandidate(
    contact: CampaignContact,
    reviewStatus: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO',
  ) {
    const excluded = reviewStatus === 'EXCLUIDO';

    try {
      const response = await fetch(
        `${apiUrl}/api/campaigns/${campaignId}/contacts/${contact.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            excluded,
            reviewStatus,
            exclusionReason: excluded ? 'Exclusión manual durante la revisión' : null,
          }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'No se pudo actualizar el candidato.');
      }

      setContacts((current) =>
        current.map((item) =>
          item.id === contact.id
            ? {
                ...item,
                excluded,
                review_status: reviewStatus,
              }
            : item,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  if (loading && !campaign) {
    return <div className="p-8 text-sm text-slate-500">Cargando campaña...</div>;
  }

  const reviewApproved = contacts.filter(
    (contact) => !contact.excluded && contact.review_status === 'APROBADO',
  ).length;
  const reviewPending = contacts.filter(
    (contact) => !contact.excluded && contact.review_status !== 'APROBADO',
  ).length;
  const reviewExcluded = contacts.filter((contact) => contact.excluded).length;

  return (
    <div className="p-8">
      <Link
        href="/campanas"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft size={17} />
        Volver a campañas
      </Link>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-950">
              {campaign?.name || 'Campaña'}
            </h2>
            <CampaignStatus status={campaign?.status || 'BORRADOR'} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {campaign?.notes || 'Configura el segmento y completa el ciclo de aprobación.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {campaign?.status === 'REVISION' && (
            <button
              onClick={() => changeStatus('APROBADA')}
              disabled={reviewPending > 0 || reviewApproved === 0}
              title={reviewPending > 0 ? `Quedan ${reviewPending} candidatos pendientes de revisión` : undefined}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reviewPending > 0 ? `Revisar ${reviewPending} pendientes` : 'Aprobar campaña'}
            </button>
          )}

          {campaign?.status === 'APROBADA' && (
            <button
              onClick={startCalls}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Iniciar llamadas
            </button>
          )}

          <button
            onClick={loadBaseData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        </div>
      </div>

      <Lifecycle current={campaign?.status || 'BORRADOR'} />

      {message && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Candidatos" value={campaign?.candidate_count || summary.total} icon={<Users size={18} />} />
        <Metric label="Con teléfono" value={contacts.length ? contacts.filter((item) => Boolean(item.normalized_phone)).length : summary.withPhone} icon={<Phone size={18} />} />
        <Metric label="Con email" value={contacts.length ? contacts.filter((item) => Boolean(item.normalized_email)).length : summary.withEmail} icon={<Mail size={18} />} />
        <Metric label="Generados" value={campaign?.contacts_count || 0} icon={<CheckCircle2 size={18} />} />
      </div>

      {runs.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-950">Ejecuciones</h3>
            <p className="mt-1 text-xs text-slate-500">
              Estado operativo de la cola y las llamadas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Creada</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">En cola</th>
                  <th className="px-5 py-3">Llamando</th>
                  <th className="px-5 py-3">Completadas</th>
                  <th className="px-5 py-3">Errores</th>
                  <th className="px-5 py-3">Seguimiento</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3 text-slate-700">
                      {new Intl.DateTimeFormat('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(run.created_at))}
                    </td>
                    <td className="px-5 py-3">
                      <CampaignStatus status={run.status} />
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {run.total_contacts}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {run.queued_contacts}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {run.processing_contacts}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {run.completed_contacts}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {run.failed_contacts}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {run.last_error || (run.n8n_execution_id ? 'Ejecución conectada' : 'Preparando')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-950">Resultados de llamadas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Interesados, no interesados, solicitudes de no volver a llamar y seguimientos.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Teléfono</th>
                  <th className="px-5 py-3">Resultado</th>
                  <th className="px-5 py-3">Duración</th>
                  <th className="px-5 py-3">Resumen / siguiente acción</th>
                  <th className="px-5 py-3">Grabación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result) => (
                  <tr key={result.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {result.campaign_call_queue?.contact_name || result.campaign_call_queue?.customer_name || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {result.campaign_call_queue?.phone || '—'}
                    </td>
                    <td className="px-5 py-3"><CampaignStatus status={result.outcome || 'SIN_RESULTADO'} /></td>
                    <td className="px-5 py-3 text-slate-700">
                      {result.duration_seconds == null ? '—' : `${result.duration_seconds} s`}
                    </td>
                    <td className="max-w-lg px-5 py-3 text-slate-700">
                      {result.summary || result.next_action || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {result.recording_url ? (
                        <a href={result.recording_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline">Escuchar</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {contacts.length === 0 ? (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={previewCandidates}
            className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-2">
              <Filter size={19} />
              <h3 className="font-bold text-slate-950">Filtros de instalaciones</h3>
            </div>

            <div className="space-y-4">
              <SelectField
                label="Marca"
                value={filters.brand}
                onChange={(value) => setFilters({ ...filters, brand: value })}
                options={options.brands}
              />

              <SelectField
                label="Provincia"
                value={filters.province}
                onChange={(value) => setFilters({ ...filters, province: value })}
                options={options.provinces}
              />

              <SelectField
                label="Tipo de equipo"
                value={filters.equipmentType}
                onChange={(value) => setFilters({ ...filters, equipmentType: value })}
                options={options.equipmentTypes}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Datos de contacto
                </span>
                <select
                  value={filters.communication}
                  onChange={(event) =>
                    setFilters({ ...filters, communication: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Cualquier contacto</option>
                  <option value="phone">Con teléfono</option>
                  <option value="email">Con email</option>
                  <option value="both">Con teléfono y email</option>
                </select>
              </label>
            </div>

            <button className="mt-6 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Calcular selección
            </button>

            <button
              type="button"
              onClick={generateCandidates}
              disabled={generating || (summary.total === 0 && campaign?.candidate_count === 0)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {generating ? 'Generando...' : 'Generar candidatos'}
            </button>
          </form>

          <CandidateTable rows={preview} />
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-bold text-slate-950">Revisión de candidatos</h3>
              <p className="mt-1 text-xs text-slate-500">
                {reviewApproved} aprobados · {reviewPending} pendientes · {reviewExcluded} excluidos
              </p>
            </div>
            {campaign?.status === 'REVISION' && (
              <div className="flex flex-wrap gap-2">
                <button disabled={bulkReviewing} onClick={() => bulkReview('APROBADO')} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Aprobar todos</button>
                <button disabled={bulkReviewing} onClick={() => bulkReview('PENDIENTE')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Restablecer revisión</button>
                <button disabled={bulkReviewing} onClick={() => bulkReview('EXCLUIDO')} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Excluir todos</button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Contacto</th>
                  <th className="px-5 py-3">Equipo</th>
                  <th className="px-5 py-3">Provincia</th>
                  <th className="px-5 py-3">Teléfono</th>
                  <th className="px-5 py-3">Revisión</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <tr key={contact.id} className={contact.excluded ? 'bg-rose-50/50' : ''}>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {contact.customer_name || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {contact.contact_name || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {[contact.brand, contact.model].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {contact.province || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {contact.normalized_phone || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <CampaignStatus status={contact.review_status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {campaign?.status !== 'REVISION' ? (
                          <span className="text-xs text-slate-400">Revisión cerrada</span>
                        ) : contact.excluded ? (
                          <button
                            onClick={() => reviewCandidate(contact, 'PENDIENTE')}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Reincorporar para revisar
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => reviewCandidate(contact, 'APROBADO')}
                              disabled={contact.review_status === 'APROBADO'}
                              className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Aprobar llamada
                            </button>
                            <button
                              onClick={() => reviewCandidate(contact, 'EXCLUIDO')}
                              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              No llamar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Lifecycle({ current }: { current: string }) {
  const steps = [
    'BORRADOR',
    'PREVISUALIZACION',
    'REVISION',
    'APROBADA',
    'ENVIADA_N8N',
    'LLAMANDO',
    'FINALIZADA',
  ];

  const currentIndex = steps.indexOf(current);

  return (
    <section className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-[850px] items-center">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  index <= currentIndex
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {index + 1}
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                {step.replace('_', ' ')}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-px flex-1 ${
                  index < currentIndex ? 'bg-slate-950' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CandidateTable({ rows }: { rows: Candidate[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="font-bold text-slate-950">Vista previa</h3>
        <p className="mt-1 text-xs text-slate-500">
          Se muestran hasta 200 instalaciones.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Contacto</th>
              <th className="px-5 py-3">Marca / modelo</th>
              <th className="px-5 py-3">Equipo</th>
              <th className="px-5 py-3">Provincia</th>
              <th className="px-5 py-3">Teléfono</th>
              <th className="px-5 py-3">Email</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((contact) => (
              <tr key={contact.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-semibold text-slate-900">
                  {contact.customer_name || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {contact.contact_name || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {[contact.brand, contact.model].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {contact.equipment_type || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {contact.province || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {contact.normalized_phone || '—'}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {contact.normalized_email || '—'}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center text-slate-500">
                  Aplica los filtros para calcular candidatos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-semibold">{label}</span>
        {icon}
      </div>
      <strong className="mt-3 block text-2xl text-slate-950">{value}</strong>
    </article>
  );
}

function CampaignStatus({ status }: { status: string }) {
  const classes =
    status === 'FINALIZADA' || status === 'APROBADO'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'CANCELADA' || status === 'EXCLUIDO'
        ? 'bg-rose-100 text-rose-700'
        : status === 'LLAMANDO' || status === 'ENVIADA_N8N'
          ? 'bg-blue-100 text-blue-700'
          : status === 'APROBADA'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>
      {status || 'PENDIENTE'}
    </span>
  );
}
