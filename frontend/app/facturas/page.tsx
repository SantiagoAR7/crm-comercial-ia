'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, X, RefreshCw, Receipt, Menu, Users, UserRound, CreditCard, LogOut } from 'lucide-react';

const technicians = Array.from({length:17},(_,i)=>`TECNICO ${String(i+1).padStart(2,'0')}`);
const categories = ['Aparcamientos','Combustible','Revisión','Supermercados','Varios'];
type Fields = {cif_nif:string;technician:string;establishment:string;ticket_date:string;amount:string;currency:string;category:string;payment_method:string;document_type:string};
type Ticket = {is_test:boolean;id:string;technician:string|null;bot_alias:string;status:string;received_at:string;reviewed_at:string|null;reviewed_by:string|null;rejection_reason:string|null;version:number;proposed_data:Partial<Fields>;reviewed_data:Partial<Fields>};
type Detail = {data:Ticket;imageUrl:string;history:{id:number;actor:string;new_status:string;created_at:string;reason:string|null}[];tasks:{id:string;destination:string;status:string;last_error:string|null}[]};
const empty:Fields = {cif_nif:'',technician:'',establishment:'',ticket_date:'',amount:'',currency:'EUR',category:'',payment_method:'',document_type:'TICKET'};
async function request(path:string, options?:RequestInit) {
  const response = await fetch(`/api/tickets${path}`,{...options,cache:'no-store',credentials:'same-origin'});
  const body = await response.json();
  if(response.status===401){window.location.replace('/facturas/login');throw new Error('Inicia sesión en Facturas y tickets.');}
  if(!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}
const date = (value:string) => new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50';

export default function FacturasPage() {
  const [username,setUsername]=useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  function selectTechnician(value:string){setTech(value);setPage(0);setMenuOpen(false);}
  useEffect(()=>{fetch('/api/tickets/auth/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(b=>setUsername(b?.data?.username||''));},[]);
  async function logout(){await fetch('/api/tickets/auth/logout',{method:'POST',credentials:'same-origin'});window.location.replace('/facturas/login');}
  const [month,setMonth]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date()));
  const [tech,setTech]=useState(''),[status,setStatus]=useState('PENDIENTE');
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[rows,setRows]=useState<Ticket[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null),[form,setForm]=useState<Fields>(empty),[reason,setReason]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [detailError,setDetailError]=useState('');
  const generation=useRef(0), selection=useRef(0);
  const load=useCallback(async()=>{
    const current=++generation.current; setLoading(true);setError('');
    try {const result=await request(`?${new URLSearchParams({month,status,technician:tech==='Pagos Tarjeta'?'':tech,bot_alias:tech==='Pagos Tarjeta'?'Pagos Tarjeta':'',page:String(page)})}`);if(current===generation.current){setRows(result.data);setTotal(result.total);}}
    catch(e){if(current===generation.current){setRows([]);setError(e instanceof Error?e.message:'No se pudo cargar.');}}
    finally{if(current===generation.current)setLoading(false);}
  },[tech,status,page,month]);
  useEffect(()=>{load();},[load]);
  async function open(id:string){
    const current=++selection.current;setBusy(true);setDetailError('');setError('');
    try{const result:Detail=await request(`/${id}`);if(current!==selection.current)return;setDetail(result);setForm({...empty,...result.data.proposed_data,...result.data.reviewed_data,technician:result.data.technician||''});setReason('');}
    catch(e){setError(e instanceof Error?e.message:'No se pudo abrir.');}
    finally{if(current===selection.current)setBusy(false);}
  }
  async function decide(next:string){
    if(!detail)return;setBusy(true);setDetailError('');setNotice('');
    try{await request(`/${detail.data.id}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next,version:detail.data.version,reason,data:form})});setDetail(null);setNotice(next==='APROBADA'?'Factura aprobada. Las tareas de notificación y archivo están pendientes de procesar.':'Factura rechazada. La notificación está pendiente de procesar.');await load();}
    catch(e){setDetailError(e instanceof Error?e.message:'No se pudo guardar.');}
    finally{setBusy(false);}
  }
  const field=(key:keyof Fields,label:string,options?:string[]) => <label className="space-y-1 text-xs font-semibold text-slate-600">{label}{options?<select disabled={busy||detail?.data.status!=='PENDIENTE'} className={control} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Seleccionar…</option>{options.map(x=><option key={x}>{x}</option>)}</select>:<input disabled={busy||detail?.data.status!=='PENDIENTE'} className={control} type={key==='ticket_date'?'date':'text'} inputMode={key==='amount'?'decimal':undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>;
  return <main className="min-h-screen bg-slate-50 lg:pl-72">
    {menuOpen&&<button aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"/>}
    <aside aria-label="Menú de facturas" className={`${menuOpen?'flex':'hidden'} fixed inset-y-0 left-0 z-50 w-72 flex-col bg-[#0b2d5d] px-3.5 pb-4 pt-5 text-white lg:flex`}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/15 px-1 pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5"><Image src="/icon.png" alt="Davofrío" width={42} height={42} priority /></div>
        <div><p className="text-lg font-extrabold tracking-wide">DAVOFRÍO</p><p className="text-xs font-semibold text-blue-200">Facturas y tickets</p></div>
        <button aria-label="Cerrar menú lateral" onClick={()=>setMenuOpen(false)} className="ml-auto rounded-lg p-1 lg:hidden"><X size={18}/></button>
      </div>
      <p className="shrink-0 px-2 pb-2 pt-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue-300">Documentos por técnico</p>
      <nav aria-label="Técnicos y pagos" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {['',...technicians,'Pagos Tarjeta'].map(value=>{const Icon=value==='Pagos Tarjeta'?CreditCard:value?UserRound:Users;return <button key={value||'all'} aria-pressed={tech===value} onClick={()=>selectTechnician(value)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[13px] font-bold transition ${tech===value?'bg-white text-[#0b2d5d] shadow-sm':'text-blue-100 hover:bg-white/10 hover:text-white'}`}><Icon size={17} className="shrink-0"/>{value||'Todos los documentos'}</button>;})}
      </nav>
      <div className="mt-3 shrink-0 border-t border-white/15 pt-3"><p className="truncate px-2 pb-2 text-xs text-blue-200">{username}</p><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold hover:bg-white/10"><LogOut size={17}/>Salir</button></div>
    </aside>
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-[#0b2d5d] px-5 py-3 text-white lg:hidden"><div className="flex items-center gap-2"><div className="rounded-lg bg-white p-1"><Image src="/icon.png" alt="Davofrío" width={30} height={30}/></div><span className="text-sm font-bold">Facturas y tickets</span></div><button aria-label="Abrir menú de técnicos" onClick={()=>setMenuOpen(true)} className="rounded-lg border border-white/20 p-2"><Menu size={20}/></button></div>
    <div className="mx-auto max-w-[1600px] space-y-6 p-5 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-500">Revisión de documentos de los técnicos</p><h1 className="text-3xl font-extrabold text-slate-950">{tech||'Facturas y tickets'}</h1><p className="mt-2 text-sm text-slate-500">Revisa la imagen y los datos antes de aprobar. Los documentos rechazados conservan su evidencia.</p></div><button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"><RefreshCw size={16}/>Actualizar</button></header>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"><label className="space-y-1 text-sm font-semibold text-slate-700"><span className="block">Historial mensual</span><input aria-label="Mes del historial" type="month" min="2020-01" max="2100-12" value={month==='TODOS'?'':month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setPage(0);}}} className="rounded-lg border px-3 py-2"/></label><button onClick={()=>{setMonth('TODOS');setPage(0);}} aria-pressed={month==='TODOS'} className="rounded-lg border px-3 py-2 text-sm font-semibold">Todos los meses</button><p className="text-xs text-slate-500">Fotos y decisiones conservadas por técnico. Se muestran 50 documentos por página.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Estado">{[['PENDIENTE','Pendientes'],['APROBADA','Aprobadas'],['RECHAZADA','Rechazadas'],['TODAS','Todas']].map(([value,label])=><button key={value} aria-pressed={status===value} onClick={()=>{setStatus(value);setPage(0);}} className={`rounded-full px-4 py-2 text-sm font-semibold ${status===value?'bg-blue-100 text-blue-900':'bg-white text-slate-600'}`}>{label}</button>)}</div>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <section aria-label="Documentos" className="overflow-x-auto rounded-2xl border bg-white shadow-sm">{loading?<p className="p-12 text-center text-slate-500">Cargando documentos…</p>:error?<p className="p-8 text-center text-slate-500">No se pueden mostrar los documentos hasta resolver el error.</p>:rows.length===0?<div className="p-12 text-center text-slate-500"><Receipt className="mx-auto mb-3"/><p>No hay documentos en esta vista.</p></div>:<table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Técnico / bot','Recibido','Establecimiento','Importe','Estado',''].map((x,i)=><th key={i} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{rows.map(r=>{const v=r.status==='APROBADA'?r.reviewed_data:r.proposed_data;return <tr key={r.id} className="border-t"><td className="px-4 py-4"><p className="font-semibold">{r.is_test&&<span className="mr-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">PRUEBA</span>}{r.technician||'Sin asignar'}</p><p className="text-xs text-slate-500">{r.bot_alias}</p></td><td className="px-4 py-4">{date(r.received_at)}</td><td className="px-4 py-4">{v.establishment||'Por revisar'}</td><td className="px-4 py-4">{v.amount??'—'} {v.currency||''}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{r.status}</span></td><td className="px-4 py-4"><button disabled={busy} onClick={()=>open(r.id)} className="font-bold text-blue-800">Revisar</button></td></tr>;})}</tbody></table>}</section>
    {!error&&<div className="flex items-center justify-between text-sm text-slate-500"><span>{total} documentos · página {page+1}</span><div className="flex gap-4"><button disabled={page===0||loading} onClick={()=>setPage(page-1)}>Anterior</button><button disabled={(page+1)*50>=total||loading} onClick={()=>setPage(page+1)}>Siguiente</button></div></div>}
    {detail&&<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-8"><section role="dialog" aria-modal="true" aria-labelledby="ticket-title" className="mx-auto max-w-6xl rounded-2xl bg-white p-5 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 id="ticket-title" className="text-xl font-bold">{detail.data.is_test?'PRUEBA · ':''}Revisión · {detail.data.technician||detail.data.bot_alias}</h2><button autoFocus aria-label="Cerrar revisión" disabled={busy} onClick={()=>setDetail(null)} className="rounded-lg border p-2"><X size={18}/></button></div><div>{detail.data.is_test&&<p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">PRUEBA: copia de una ejecución anterior. La notificación se simula y la aprobación se exporta a un Excel de pruebas, separado del real.</p>}</div><div className="grid gap-6 lg:grid-cols-2"><div><a href={detail.imageUrl} target="_blank" rel="noreferrer" className="mb-2 block text-sm font-semibold text-blue-800">Ampliar imagen original</a><img src={detail.imageUrl} alt="Documento original enviado por Telegram" className="max-h-[70vh] w-full rounded-xl bg-slate-50 object-contain" onError={()=>setDetailError('La vista previa ha caducado o no pudo cargarse. Cierra y vuelve a abrir el documento.')}/></div><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{field('technician','Técnico / origen',detail.data.bot_alias==='Pagos Tarjeta'?[...technicians,'Pagos Tarjeta']:technicians)}{field('document_type','Tipo',['TICKET','FACTURA'])}{field('establishment','Establecimiento')}{field('cif_nif','CIF / NIF')}{field('ticket_date','Fecha real del ticket')}{field('amount','Importe (punto decimal)')}{field('currency','Moneda')}{field('category','Clasificación',categories)}{field('payment_method','Método de pago',['Pago con tarjeta','Pago en efectivo'])}</div>
      {detail.data.status==='PENDIENTE'?<><label className="block space-y-1 text-xs font-semibold text-slate-600">Motivo obligatorio si rechazas<textarea value={reason} maxLength={2000} disabled={busy} onChange={e=>setReason(e.target.value)} className={control} rows={3}/></label><div className="flex gap-3"><button onClick={()=>decide('APROBADA')} disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Check size={16}/>Aprobar</button><button onClick={()=>decide('RECHAZADA')} disabled={busy||!reason.trim()} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-800 disabled:opacity-50">Rechazar</button></div></>:<p className="rounded-xl bg-slate-50 p-3 text-sm">{detail.data.status} por {detail.data.reviewed_by}{detail.data.reviewed_at?` · ${date(detail.data.reviewed_at)}`:''}{detail.data.rejection_reason&&<span className="mt-2 block">Motivo: {detail.data.rejection_reason}</span>}</p>}
      {detailError&&<p role="alert" className="text-sm text-rose-700">{detailError}</p>}
      <div className="border-t pt-4"><h3 className="font-bold">Historial</h3>{detail.history.length?detail.history.map(h=><p key={h.id} className="mt-2 text-xs text-slate-600">{date(h.created_at)} · {h.actor} · {h.new_status}{h.reason?` · ${h.reason}`:''}</p>):<p className="mt-2 text-xs text-slate-500">Pendiente de revisión.</p>}</div>
      <div><h3 className="font-bold">Notificación y archivo</h3>{detail.tasks.map(t=><p key={t.id} className="mt-2 text-xs text-slate-600">{t.destination==='TELEGRAM'?'Respuesta al técnico':'OneDrive y Tickets Técnicos'} · {t.status}{t.last_error?` · ${t.last_error}`:''}</p>)}{!detail.tasks.length&&<p className="mt-2 text-xs text-slate-500">Se crearán las tareas al guardar la decisión.</p>}</div></div></div></section></div>}
  </div></main>;
}
