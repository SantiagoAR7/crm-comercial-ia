'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileImage,
  Film,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sparkles,
  XCircle,
} from 'lucide-react';

type Publication = {
  id: string;
  category: string;
  accountName: string;
  title: string;
  content: string;
  mediaType: string;
  platform: string;
  publishedAt: string;
  externalUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
};

type PublicationsPayload = {
  data: Publication[];
  summary: { total: number; today: number; images: number; videos: number };
  sync?: { lastSyncAt: string | null };
};

type LinkedinAccount = { id: string; name: string; role: string; line: string };
type LinkedinPain = { id: string; label: string; text: string };
type LinkedinVertical = { id: string; label: string; source: string; premise: string; offer: string; pains: LinkedinPain[] };
type LinkedinOption = { id: string; label: string; guidance?: string };
type Frequency = Record<string, { postsPerWeek: number; preferredDays: string[] }>;

type LinkedinContext = {
  accounts: LinkedinAccount[];
  verticals: LinkedinVertical[];
  angles: LinkedinOption[];
  drivers: LinkedinOption[];
  formats: LinkedinOption[];
  settings: { frequency: Frequency };
};

type LinkedinIdea = {
  id: string;
  accountId: string;
  accountName: string;
  verticalId: string;
  verticalLabel: string;
  painId: string;
  painLabel: string;
  angleId: string;
  angleLabel: string;
  driverId: string;
  driverLabel: string;
  formatId: string;
  formatLabel: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'programada' | 'publicada';
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

type IdeasPayload = {
  data: LinkedinIdea[];
  summary: { total: number; pending: number; approved: number; rejected: number; scheduled: number };
};

const emptyPublications: PublicationsPayload = { data: [], summary: { total: 0, today: 0, images: 0, videos: 0 } };
const emptyIdeas: IdeasPayload = { data: [], summary: { total: 0, pending: 0, approved: 0, rejected: 0, scheduled: 0 } };
const publicationCategories = ['Alicante y Turismo', 'Psicología Sanitaria', 'El Mundo del Autismo', 'Jessica'];
const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];

const date = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
}).format(new Date(value));

const shortDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeZone: 'Europe/Madrid',
}).format(new Date(value));

export default function SocialPublicationsPage() {
  const [activeTab, setActiveTab] = useState<'ideas' | 'publicadas' | 'aprobadas' | 'configuracion'>('ideas');
  const [publications, setPublications] = useState<PublicationsPayload>(emptyPublications);
  const [ideasPayload, setIdeasPayload] = useState<IdeasPayload>(emptyIdeas);
  const [context, setContext] = useState<LinkedinContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [mediaType, setMediaType] = useState('');

  const [ideaStatus, setIdeaStatus] = useState('');
  const [accountId, setAccountId] = useState('davofrio');
  const [verticalId, setVerticalId] = useState('industrial_ibi_foia');
  const [painId, setPainId] = useState('');
  const [angleId, setAngleId] = useState('dolor');
  const [driverId, setDriverId] = useState('');
  const [formatId, setFormatId] = useState('post_corto');
  const [count, setCount] = useState(6);
  const [frequency, setFrequency] = useState<Frequency>({});

  const selectedVertical = useMemo(
    () => context?.verticals.find((vertical) => vertical.id === verticalId) || context?.verticals[0],
    [context, verticalId],
  );

  const loadPublications = useCallback(async () => {
    try {
      const query = new URLSearchParams({ search, category, platform, mediaType, limit: '500' });
      const response = await fetch(`/api/social-publications?${query}`, { cache: 'no-store' });
      if (response.status === 401) {
        window.location.replace('/redes/login');
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error('No se pudieron actualizar las publicaciones.');
      setPublications(body);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar las publicaciones.');
    } finally {
      setLoading(false);
    }
  }, [search, category, platform, mediaType]);

  const loadIdeas = useCallback(async () => {
    try {
      const contextResponse = await fetch('/api/social-publications/linkedin/context', { cache: 'no-store' });
      if (contextResponse.status === 401) {
        window.location.replace('/redes/login');
        return;
      }
      const contextBody = await contextResponse.json();
      if (!contextResponse.ok) throw new Error('No se pudo cargar la estrategia LinkedIn.');
      setContext(contextBody.data);
      setFrequency(contextBody.data.settings?.frequency || {});

      const query = new URLSearchParams({ status: ideaStatus, accountId: '', verticalId: '' });
      const ideasResponse = await fetch(`/api/social-publications/linkedin/ideas?${query}`, { cache: 'no-store' });
      const ideasBody = await ideasResponse.json();
      if (!ideasResponse.ok) throw new Error('No se pudieron cargar las ideas LinkedIn.');
      setIdeasPayload(ideasBody);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ideas LinkedIn.');
    } finally {
      setIdeasLoading(false);
    }
  }, [ideaStatus]);

  useEffect(() => {
    const timeout = setTimeout(loadPublications, 250);
    const timer = setInterval(loadPublications, 15000);
    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [loadPublications]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (!selectedVertical?.pains.some((pain) => pain.id === painId)) {
      setPainId(selectedVertical?.pains[0]?.id || '');
    }
  }, [selectedVertical, painId]);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/social-publications/sync', { method: 'POST' });
      if (response.status === 401) {
        window.location.replace('/redes/login');
        return;
      }
      if (!response.ok) throw new Error('No se pudieron actualizar las publicaciones.');
      await Promise.all([loadPublications(), loadIdeas()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar las publicaciones.');
    } finally {
      setRefreshing(false);
    }
  }

  async function generateIdeas() {
    setGenerating(true);
    setMessage('');
    try {
      const response = await fetch('/api/social-publications/linkedin/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, verticalId, painId, angleId, driverId, formatId, count }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudieron generar ideas.');
      setMessage(`${body.generated || 0} ideas generadas para revisión. No se publica nada sin aprobación.`);
      setActiveTab('ideas');
      await loadIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron generar ideas.');
    } finally {
      setGenerating(false);
    }
  }

  async function updateIdea(id: string, updates: Partial<LinkedinIdea>) {
    const response = await fetch(`/api/social-publications/linkedin/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'No se pudo actualizar la idea.');
      return;
    }
    await loadIdeas();
  }

  async function copyIdea(idea: LinkedinIdea) {
    await navigator.clipboard.writeText(`${idea.title}\n\n${idea.body}\n\n${idea.cta}`);
    setMessage('Idea copiada. Sigue pendiente de aprobación/publicación manual.');
  }

  async function saveSettings() {
    const response = await fetch('/api/social-publications/linkedin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'No se pudo guardar la configuración.');
      return;
    }
    setFrequency(body.data.frequency || {});
    setMessage('Frecuencia guardada. Esto no publica automáticamente todavía.');
  }

  const approvedIdeas = ideasPayload.data.filter((idea) => ['aprobada', 'programada'].includes(idea.status));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-[#113765] p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-black text-[#113765]">DF</div>
            <div>
              <p className="text-lg font-extrabold">DAVOFRÍO</p>
              <p className="text-xs text-blue-100">Redes sociales</p>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            <SideButton active={activeTab === 'ideas'} icon={<Lightbulb size={18} />} label="Ideas LinkedIn" onClick={() => setActiveTab('ideas')} />
            <SideButton active={activeTab === 'publicadas'} icon={<Share2 size={18} />} label="Publicadas" onClick={() => setActiveTab('publicadas')} />
            <SideButton active={activeTab === 'aprobadas'} icon={<CheckCircle2 size={18} />} label="Aprobadas" onClick={() => setActiveTab('aprobadas')} />
            <SideButton active={activeTab === 'configuracion'} icon={<Settings size={18} />} label="Configuración" onClick={() => setActiveTab('configuracion')} />
          </nav>
          <div className="mt-8 rounded-xl border border-blue-300/30 bg-blue-950/20 p-4 text-sm text-blue-50">
            <p className="font-bold">Regla de seguridad</p>
            <p className="mt-2 text-blue-100">Las ideas se generan para revisión. Aprobar no publica; solo deja el contenido listo.</p>
          </div>
        </aside>

        <main className="space-y-6 p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">DAVOFRÍO · LinkedIn y publicaciones</p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Centro de redes sociales</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Genera ideas desde la estrategia del HTML, aprueba o rechaza propuestas y revisa publicaciones ya confirmadas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/" className="text-sm font-semibold text-slate-500">Volver al CRM</a>
              <button onClick={async () => { await fetch('/api/social/auth/logout', { method: 'POST' }); window.location.replace('/redes/login'); }} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">Cerrar sesión</button>
              <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          </header>

          {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
          {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{message}</p>}

          {activeTab === 'ideas' && (
            <IdeasView
              context={context}
              ideasPayload={ideasPayload}
              ideasLoading={ideasLoading}
              accountId={accountId}
              setAccountId={setAccountId}
              verticalId={verticalId}
              setVerticalId={setVerticalId}
              selectedVertical={selectedVertical}
              painId={painId}
              setPainId={setPainId}
              angleId={angleId}
              setAngleId={setAngleId}
              driverId={driverId}
              setDriverId={setDriverId}
              formatId={formatId}
              setFormatId={setFormatId}
              count={count}
              setCount={setCount}
              ideaStatus={ideaStatus}
              setIdeaStatus={setIdeaStatus}
              generating={generating}
              generateIdeas={generateIdeas}
              updateIdea={updateIdea}
              copyIdea={copyIdea}
            />
          )}

          {activeTab === 'publicadas' && (
            <PublishedView
              payload={publications}
              loading={loading}
              search={search}
              setSearch={setSearch}
              category={category}
              setCategory={setCategory}
              platform={platform}
              setPlatform={setPlatform}
              mediaType={mediaType}
              setMediaType={setMediaType}
            />
          )}

          {activeTab === 'aprobadas' && (
            <section className="space-y-4">
              <MetricGrid ideasPayload={ideasPayload} publications={publications} />
              <Panel title="Ideas aprobadas y programadas" subtitle="Contenido listo para revisión final. Todavía no se publica automáticamente.">
                <IdeaList ideas={approvedIdeas} loading={ideasLoading} updateIdea={updateIdea} copyIdea={copyIdea} />
              </Panel>
            </section>
          )}

          {activeTab === 'configuracion' && context && (
            <SettingsView context={context} frequency={frequency} setFrequency={setFrequency} saveSettings={saveSettings} />
          )}
        </main>
      </div>
    </div>
  );
}

function IdeasView({
  context,
  ideasPayload,
  ideasLoading,
  accountId,
  setAccountId,
  verticalId,
  setVerticalId,
  selectedVertical,
  painId,
  setPainId,
  angleId,
  setAngleId,
  driverId,
  setDriverId,
  formatId,
  setFormatId,
  count,
  setCount,
  ideaStatus,
  setIdeaStatus,
  generating,
  generateIdeas,
  updateIdea,
  copyIdea,
}: {
  context: LinkedinContext | null;
  ideasPayload: IdeasPayload;
  ideasLoading: boolean;
  accountId: string;
  setAccountId: (value: string) => void;
  verticalId: string;
  setVerticalId: (value: string) => void;
  selectedVertical?: LinkedinVertical;
  painId: string;
  setPainId: (value: string) => void;
  angleId: string;
  setAngleId: (value: string) => void;
  driverId: string;
  setDriverId: (value: string) => void;
  formatId: string;
  setFormatId: (value: string) => void;
  count: number;
  setCount: (value: number) => void;
  ideaStatus: string;
  setIdeaStatus: (value: string) => void;
  generating: boolean;
  generateIdeas: () => void;
  updateIdea: (id: string, updates: Partial<LinkedinIdea>) => Promise<void>;
  copyIdea: (idea: LinkedinIdea) => Promise<void>;
}) {
  return (
    <section className="space-y-6">
      <MetricGrid ideasPayload={ideasPayload} />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title="Generador estratégico" subtitle="Basado en el HTML: dolores, ángulos, drivers y verticales.">
          {!context ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin" /> Cargando estrategia…</div>
          ) : (
            <div className="space-y-4">
              <Select label="Cuenta donde se publicaría" value={accountId} onChange={setAccountId} options={context.accounts.map((account) => ({ value: account.id, label: `${account.name} · ${account.role}` }))} />
              <Select label="Vertical" value={verticalId} onChange={setVerticalId} options={context.verticals.map((vertical) => ({ value: vertical.id, label: vertical.label }))} />
              <Select label="Dolor" value={painId} onChange={setPainId} options={(selectedVertical?.pains || []).map((pain) => ({ value: pain.id, label: pain.label }))} />
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                <p className="font-bold">{selectedVertical?.premise}</p>
                <p className="mt-1 text-blue-800">{selectedVertical?.pains.find((pain) => pain.id === painId)?.text}</p>
              </div>
              <Select label="Ángulo" value={angleId} onChange={setAngleId} options={context.angles.map((angle) => ({ value: angle.id, label: angle.label }))} />
              <Select label="Driver psicológico" value={driverId} onChange={setDriverId} options={[{ value: '', label: 'Rotar drivers' }, ...context.drivers.map((driver) => ({ value: driver.id, label: driver.label }))]} />
              <Select label="Formato" value={formatId} onChange={setFormatId} options={context.formats.map((format) => ({ value: format.id, label: format.label }))} />
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Cantidad</span>
                <input type="number" min={1} max={12} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <button onClick={generateIdeas} disabled={generating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generar ideas para revisar
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Bandeja de ideas" subtitle="Aprueba, rechaza, copia o programa. Nada se publica desde aquí.">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ['', 'Todas'],
              ['pendiente', 'Pendientes'],
              ['aprobada', 'Aprobadas'],
              ['programada', 'Programadas'],
              ['rechazada', 'Rechazadas'],
            ].map(([value, label]) => (
              <button
                key={value || 'all'}
                onClick={() => setIdeaStatus(value)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${ideaStatus === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <IdeaList ideas={ideasPayload.data} loading={ideasLoading} updateIdea={updateIdea} copyIdea={copyIdea} />
        </Panel>
      </div>
    </section>
  );
}

function PublishedView({
  payload,
  loading,
  search,
  setSearch,
  category,
  setCategory,
  platform,
  setPlatform,
  mediaType,
  setMediaType,
}: {
  payload: PublicationsPayload;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  platform: string;
  setPlatform: (value: string) => void;
  mediaType: string;
  setMediaType: (value: string) => void;
}) {
  return (
    <section className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Publicaciones" value={payload.summary.total} icon={<Share2 size={20} />} />
        <Metric label="Publicadas hoy" value={payload.summary.today} icon={<CheckCircle2 size={20} />} />
        <Metric label="Imágenes publicadas" value={payload.summary.images} icon={<FileImage size={20} />} />
        <Metric label="Vídeos publicados" value={payload.summary.videos} icon={<Film size={20} />} />
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_240px_180px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input aria-label="Buscar publicaciones" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar publicación…" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm" />
          </label>
          <select aria-label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">
            <option value="">Todas las categorías</option>
            {publicationCategories.map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}
          </select>
          <select aria-label="Plataforma" value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">
            <option value="">Todas las plataformas</option>
            {['Facebook', 'Instagram', 'TikTok', 'YouTube'].map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}
          </select>
          <select aria-label="Tipo de contenido" value={mediaType} onChange={(event) => setMediaType(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">
            <option value="">Imágenes y vídeos</option>
            <option value="imagen">Solo imágenes</option>
            <option value="video">Solo vídeos</option>
          </select>
        </div>
      </section>
      <section className="space-y-4">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3"><Loader2 className="animate-spin" />Cargando publicaciones…</div>
        ) : !payload.data.length ? (
          <div className="rounded-2xl border bg-white p-16 text-center"><Share2 className="mx-auto mb-3 text-slate-300" size={34} /><p className="font-bold text-slate-700">Todavía no hay publicaciones para estos filtros</p></div>
        ) : payload.data.map((item) => <PublicationRow key={item.id} item={item} />)}
      </section>
      {payload.sync?.lastSyncAt && <p className="text-xs text-slate-400">Última actualización: {date(payload.sync.lastSyncAt)}</p>}
    </section>
  );
}

function SettingsView({ context, frequency, setFrequency, saveSettings }: { context: LinkedinContext; frequency: Frequency; setFrequency: (value: Frequency) => void; saveSettings: () => void }) {
  return (
    <Panel title="Configuración de frecuencia" subtitle="Define el ritmo deseado por cuenta. Esto solo sirve para planificación; no publica automáticamente.">
      <div className="grid gap-4 lg:grid-cols-3">
        {context.accounts.map((account) => {
          const config = frequency[account.id] || { postsPerWeek: 0, preferredDays: [] };
          return (
            <div key={account.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-950">{account.name}</p>
              <p className="mt-1 text-sm text-slate-500">{account.line}</p>
              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Posts por semana</span>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={config.postsPerWeek}
                  onChange={(event) => setFrequency({ ...frequency, [account.id]: { ...config, postsPerWeek: Number(event.target.value) } })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {days.map((day) => {
                  const active = config.preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        const preferredDays = active ? config.preferredDays.filter((item) => item !== day) : [...config.preferredDays, day];
                        setFrequency({ ...frequency, [account.id]: { ...config, preferredDays } });
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${active ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 text-slate-600'}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={saveSettings} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">
        <Settings size={17} />
        Guardar frecuencia
      </button>
    </Panel>
  );
}

function MetricGrid({ ideasPayload, publications }: { ideasPayload: IdeasPayload; publications?: PublicationsPayload }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Ideas pendientes" value={ideasPayload.summary.pending} icon={<Lightbulb size={20} />} />
      <Metric label="Aprobadas" value={ideasPayload.summary.approved} icon={<CheckCircle2 size={20} />} />
      <Metric label="Programadas" value={ideasPayload.summary.scheduled} icon={<CalendarDays size={20} />} />
      <Metric label={publications ? 'Publicadas' : 'Rechazadas'} value={publications ? publications.summary.total : ideasPayload.summary.rejected} icon={publications ? <Share2 size={20} /> : <XCircle size={20} />} />
    </section>
  );
}

function IdeaList({ ideas, loading, updateIdea, copyIdea }: { ideas: LinkedinIdea[]; loading: boolean; updateIdea: (id: string, updates: Partial<LinkedinIdea>) => Promise<void>; copyIdea: (idea: LinkedinIdea) => Promise<void> }) {
  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin" /> Cargando ideas…</div>;
  if (!ideas.length) return <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500"><Lightbulb className="mx-auto mb-3 text-slate-300" size={32} /><p className="font-bold text-slate-700">No hay ideas en esta bandeja</p><p className="mt-1 text-sm">Genera propuestas desde el panel estratégico.</p></div>;
  return (
    <div className="space-y-3">
      {ideas.map((idea) => (
        <article key={idea.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>{idea.accountName}</Badge>
                <Badge>{idea.verticalLabel}</Badge>
                <Badge>{idea.painLabel}</Badge>
                <Badge>{idea.angleLabel}</Badge>
                <Badge>{idea.formatLabel}</Badge>
                <Status status={idea.status} />
              </div>
              <h3 className="mt-3 text-lg font-extrabold text-slate-950">{idea.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copyIdea(idea)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Copy size={14} /> Copiar</button>
              <button onClick={() => updateIdea(idea.id, { status: 'aprobada' })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Aprobar</button>
              <button onClick={() => updateIdea(idea.id, { status: 'rechazada' })} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><XCircle size={14} /> Rechazar</button>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{idea.body}</p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">{idea.cta}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <CalendarDays size={15} />
              <input
                type="datetime-local"
                value={idea.scheduledFor ? idea.scheduledFor.slice(0, 16) : ''}
                onChange={(event) => updateIdea(idea.id, { scheduledFor: event.target.value, status: event.target.value ? 'programada' : idea.status })}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
              />
            </label>
            {idea.scheduledFor && <span className="text-xs text-slate-500">Programada para {shortDate(idea.scheduledFor)}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function SideButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold ${active ? 'bg-white text-[#113765]' : 'text-blue-50 hover:bg-white/10'}`}>
      {icon}
      {label}
    </button>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
        {options.map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">{children}</span>;
}

function Status({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pendiente: 'bg-blue-100 text-blue-800',
    aprobada: 'bg-emerald-100 text-emerald-800',
    rechazada: 'bg-rose-100 text-rose-800',
    programada: 'bg-amber-100 text-amber-800',
    publicada: 'bg-slate-900 text-white',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}

function PublicationRow({ item }: { item: Publication }) {
  const [failed, setFailed] = useState(false);
  const video = item.mediaType === 'video' ? item.videoUrl : null;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{item.category}</span>
          <span className="text-sm text-slate-500">· {item.platform}</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Publicado</span>
        </div>
        <time className="text-xs text-slate-500">{date(item.publishedAt)}</time>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[260px_1fr]">
        <div>
          <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {!failed && video ? (
              <video controls preload="metadata" poster={item.imageUrl || undefined} src={video} onError={() => setFailed(true)} className="max-h-80 w-full" />
            ) : !failed && item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title || 'Publicación'} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-80 w-full object-contain" />
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                {item.mediaType === 'video' ? <Film className="mx-auto mb-2" size={28} /> : <FileImage className="mx-auto mb-2" size={28} />}
                <p>Vista previa no disponible. Puedes abrir la publicación original.</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-600">{item.accountName}</p>
        </div>
        <div className="min-w-0">
          {item.title && <h2 className="mb-3 text-lg font-bold text-slate-900">{item.title}</h2>}
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.content}</p>
          {item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700">Ver en {item.platform}<ExternalLink size={13} /></a>}
        </div>
      </div>
    </article>
  );
}
