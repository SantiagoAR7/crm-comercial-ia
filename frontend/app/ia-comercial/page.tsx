'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Building2, Lightbulb, Loader2, Phone, RefreshCw } from 'lucide-react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
type Recommendation = { id:string; title:string; reason:string; estimatedContacts:number; type:string; filters:Record<string,string>; priority:string };
type Analysis = { generatedAt:string; seasonalType:string; callable:number; highPriority:number; recommendations:Recommendation[]; topBrands:{value:string;count:number}[]; topProvinces:{value:string;count:number}[] };

export default function CommercialAiPage() {
  const [data,setData]=useState<Analysis|null>(null); const [loading,setLoading]=useState(true); const [message,setMessage]=useState('');
  const load=useCallback(async()=>{setLoading(true);setMessage('');try{const r=await fetch(`${apiUrl}/api/commercial-ai/recommendations`,{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||b.detail);setData(b.data);}catch(e){setMessage(e instanceof Error?e.message:'Error desconocido.');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  async function createDraft(item:Recommendation){setMessage(`Creando «${item.title}»...`);try{const r=await fetch(`${apiUrl}/api/commercial-ai/recommendations/${item.id}/create-draft`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:item.title,type:item.type,filters:item.filters,notes:`Recomendación IA: ${item.reason} Requiere revisión humana antes de llamar.`})});const b=await r.json();if(!r.ok)throw new Error(b.error||b.detail);window.location.href=`/campanas/${b.data.id}`;}catch(e){setMessage(e instanceof Error?e.message:'No se pudo crear el borrador.');}}
  return <div className="p-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Análisis del histórico</p><h2 className="mt-1 text-3xl font-bold text-slate-950">IA Comercial</h2><p className="mt-2 text-sm text-slate-500">Recomendaciones explicables. Ninguna llamada se realiza sin aprobación humana.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={17}/>Actualizar análisis</button></div>
    {message&&<div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}
    {loading&&<div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={18}/>Analizando instalaciones...</div>}
    {data&&<><section className="mb-6 grid gap-4 md:grid-cols-3"><Metric icon={<Phone/>} label="Contactables" value={data.callable}/><Metric icon={<Lightbulb/>} label="Prioridad alta" value={data.highPriority}/><Metric icon={<Building2/>} label="Temporada sugerida" text={data.seasonalType}/></section>
    <section className="grid gap-4 xl:grid-cols-3">{data.recommendations.map(item=><article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-violet-50 p-2.5 text-violet-700"><Bot size={20}/></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{item.priority}</span></div><h3 className="mt-4 font-bold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p><p className="mt-4 text-sm"><strong>{item.estimatedContacts.toLocaleString('es-ES')}</strong> candidatos estimados</p><button onClick={()=>createDraft(item)} className="mt-5 w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Crear borrador para revisión</button></article>)}</section>
    <p className="mt-5 text-xs text-slate-400">Análisis actualizado: {new Date(data.generatedAt).toLocaleString('es-ES')} · Los resultados son sugerencias basadas en los datos disponibles.</p></>}
  </div>;
}
function Metric({icon,label,value,text}:{icon:React.ReactNode;label:string;value?:number;text?:string}){return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-slate-500">{icon}</span><p className="mt-3 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{text||Number(value).toLocaleString('es-ES')}</p></article>}
