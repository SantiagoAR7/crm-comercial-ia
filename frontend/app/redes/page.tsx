'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileImage, Film, Loader2, RefreshCw, Search, Share2 } from 'lucide-react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
type Publication = { id:string; sourceExecutionId:string|null; workflowName:string|null; category:string; content:string; mediaType:string; platform:string; status:string; publishedAt:string; errorMessage:string|null; externalUrl:string|null };
type ResponseData = { data:Publication[]; summary:{total:number;today:number;published:number;errors:number}; filters:{categories:string[];platforms:string[]} };

export default function SocialPublicationsPage() {
  const [payload, setPayload] = useState<ResponseData>({data:[],summary:{total:0,today:0,published:0,errors:0},filters:{categories:[],platforms:[]}});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      const response = await fetch(`${apiUrl}/api/social-publications?${params}`, { cache: 'no-store' });
      const body = await response.json();
      if (response.status === 401) { window.location.replace('/redes/login'); return; }
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar el historial.');
      setPayload(body);
    } catch (value) { setError(value instanceof Error ? value.message : 'No se pudo cargar el historial.'); }
    finally { setLoading(false); }
  }, [search, category, status]);

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  const hasFilters = useMemo(() => Boolean(search || category || status), [search, category, status]);

  return <div className="space-y-7 p-5 sm:p-8">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-slate-500">Control de automatizaciones</p><h1 className="mt-1 text-3xl font-extrabold text-slate-950">Redes sociales</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Registro de cada ejecución y publicación. Se guarda el contenido y el tipo de recurso, nunca el archivo de imagen o vídeo.</p></div>
      <div className="flex flex-wrap items-center gap-3"><a href="/" className="text-sm font-semibold text-slate-500">Volver al CRM</a><button onClick={async()=>{await fetch('/api/social/auth/logout',{method:'POST'});window.location.replace('/redes/login');}} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Cerrar sesión</button><button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={17} className={loading?'animate-spin':''}/>Actualizar registro</button></div>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Registros totales" value={payload.summary.total} icon={<Share2 size={20}/>} tone="blue"/>
      <Metric label="Ejecuciones hoy" value={payload.summary.today} icon={<RefreshCw size={20}/>} tone="violet"/>
      <Metric label="Publicaciones correctas" value={payload.summary.published} icon={<CheckCircle2 size={20}/>} tone="emerald"/>
      <Metric label="Errores detectados" value={payload.summary.errors} icon={<AlertTriangle size={20}/>} tone="rose"/>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_240px_200px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por contenido, área o flujo…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></label>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todas las áreas</option>{payload.filters.categories.map(item=><option key={item} value={item.toLowerCase()}>{item}</option>)}</select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todos los estados</option><option value="publicado">Publicado</option><option value="error">Error</option><option value="pendiente">Pendiente</option><option value="omitido">Omitido</option></select>
      </div>
    </section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" size={20}/>Cargando ejecuciones…</div> : payload.data.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Share2 size={34} className="mb-3 text-slate-300"/><p className="font-bold text-slate-700">{hasFilters?'No hay resultados para estos filtros':'Todavía no hay publicaciones registradas'}</p><p className="mt-1 max-w-lg text-sm text-slate-500">Aún no se han recibido registros de n8n.</p></div> : <div className="divide-y divide-slate-100">{payload.data.map(item=><PublicationRow key={item.id} item={item}/>)}</div>}
    </section>
  </div>;
}

function Metric({label,value,icon,tone}:{label:string;value:number;icon:React.ReactNode;tone:'blue'|'violet'|'emerald'|'rose'}) { const styles={blue:'bg-blue-50 text-blue-700',violet:'bg-violet-50 text-violet-700',emerald:'bg-emerald-50 text-emerald-700',rose:'bg-rose-50 text-rose-700'}; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${styles[tone]}`}>{icon}</div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold text-slate-950">{value}</p></div> }
function PublicationRow({item}:{item:Publication}) { const date=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(item.publishedAt)); const MediaIcon=item.mediaType==='video'?Film:FileImage; return <article className="grid gap-4 p-5 hover:bg-slate-50/70 lg:grid-cols-[190px_170px_1fr_150px] lg:items-start"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{date}</p><p className="mt-2 text-sm font-bold text-slate-800">{item.category}</p><p className="mt-1 text-xs text-slate-500">{item.platform}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status==='publicado'?'bg-emerald-50 text-emerald-700':item.status==='error'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'}`}>{item.status}</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"><MediaIcon size={13}/>{item.mediaType}</span></div><div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content || 'Sin texto disponible.'}</p>{item.errorMessage&&<p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{item.errorMessage}</p>}<p className="mt-2 text-xs text-slate-400">{item.workflowName || 'Flujo no identificado'}{item.sourceExecutionId?` · Ejecución ${item.sourceExecutionId}`:''}</p></div><div className="lg:text-right">{item.externalUrl&&<a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-700 hover:underline">Ver publicación</a>}</div></article> }
