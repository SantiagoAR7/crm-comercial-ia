'use client';
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { GripVertical, Mail, Settings2, X } from 'lucide-react';
import { commercialSchedule } from './commercial-email';
import ReceivedRule from './received-rule';

const stages = [
  ['received', 'Solicitud recibida', 'Confirmación inmediata'],
  ['unanswered', 'Sin respuesta', '2 correos de seguimiento'],
  ['quote-sent', 'Presupuesto enviado', '6 correos de seguimiento'],
  ['quote-accepted', 'Presupuesto aceptado', 'Confirmación de aceptación'],
  ['visit', 'Pendiente de agendar visita (auditoría)', 'Aviso de visita pendiente'],
  ['report', 'Pendiente de realizar informe de auditoría', 'Recordatorio cada 3 días'],
  ['audit', 'Auditoría realizada – Pendiente de presentar a cliente', 'Aviso de presentación'],
  ['presented', 'Proyecto presentado', '6 correos de seguimiento'],
  ['accepted', 'Proyecto aceptado', 'Confirmación del proyecto'],
  ['paid', 'Proyecto pagado', 'Confirmación de pago'],
  ['installed', 'Instalación completada', '2 correos de postventa'],
  ['quote-pending', 'Pendiente de enviar presupuesto', 'Tarea interna (propuesta)'],
  ['rejected', 'Presupuesto rechazado', 'Cancelar seguimientos (propuesta)'],
] as const;
type Stage = typeof stages[number];
type Rules = Partial<Record<Stage[0], string>>;

const followUpStages = ['unanswered', 'quote-sent', 'report', 'presented', 'installed'] as const;

function EmailList({ emails }: { emails: (typeof commercialSchedule)[string] }) {
  return emails.length ? <ul className="divide-y divide-slate-200">
              {emails.map(email => <li key={email.reference} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">{email.title}</p>
                <p className="mt-1 text-sm text-slate-600">{email.timing}</p>
                <a href={`/email-plantillas/${email.reference === 'email-000' ? 'solicitud-recibida' : email.reference}.html`}
                  target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-900 underline">
                  Ver correo HTML
                </a>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold text-blue-900">Ver diseño del PDF</summary>
                  <img loading="lazy" src={`/email-propuesta/${email.reference}.png`} alt={email.title}
                    className="mt-3 block h-auto w-full rounded-lg" />
                  <a href={`/email-propuesta/${email.reference}.html`} target="_blank" rel="noreferrer"
                    className="mt-2 inline-block font-semibold text-blue-900 underline">Abrir referencia en otra pestaña</a>
                </details>
              </li>)}
            </ul> : <p className="text-sm text-slate-600">Sin correo en la propuesta.</p>;
}

export default function Board({ department, label }: { department: 'comercial' | 'mantenimiento'; label: string }) {
  const prefix = `davofrio-demo:${department === 'comercial' ? 'commercial' : department}`;
  const orderKey = `${prefix}:order`;
  const rulesKey = `${prefix}:rules`;
  const [ordered, setOrdered] = useState<Stage[]>([...stages]);
  const [rules, setRules] = useState<Rules>({});
  const [editing, setEditing] = useState<Stage[0]>();
  const [panel, setPanel] = useState<'rule' | 'emails' | 'reminders'>('rule');
  const panelOpen = editing !== undefined || panel === 'reminders';
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = stages.find(stage => stage[0] === editing);
  const dragged = useRef<Stage[0] | null>(null);
  const [dropTarget, setDropTarget] = useState<Stage[0]>();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panelOpen && !element.open) element.showModal();
    if (!panelOpen && element.open) element.close();
  }, [panelOpen]);

  function closePanel() {
    setEditing(undefined);
    setPanel('rule');
  }

  function openPanel(id: Stage[0], view: 'rule' | 'emails') {
    setPanel(view);
    setEditing(id);
  }

  function targetAt(event: PointerEvent<HTMLLIElement>) {
    const id = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-stage]')?.dataset.stage;
    return ordered.findIndex(stage => stage[0] === id);
  }

  function endDrag() {
    dragged.current = null;
    setDropTarget(undefined);
  }


  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(orderKey) ?? 'null');
      if (!Array.isArray(saved) || saved.length !== stages.length || new Set(saved).size !== stages.length) return;
      const restored = saved.map(id => stages.find(stage => stage[0] === id));
      if (restored.every(stage => stage !== undefined)) setOrdered(restored);
    } catch {
      // Keep the default order if browser storage is unavailable.
    }
  }, [orderKey]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(rulesKey) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      const restored: Rules = {};
      for (const [id] of stages) {
        const value = (saved as Record<string, unknown>)[id];
        if (typeof value === 'string') restored[id] = value;
      }
      setRules(restored);
    } catch {
      // Keep the default rules if browser storage is unavailable.
    }
  }, [rulesKey]);

  function saveRule(id: Stage[0], action: string) {
    const updated = { ...rules, [id]: action.trim() };
    setRules(updated);
    setEditing(undefined);
    try { localStorage.setItem(rulesKey, JSON.stringify(updated)); } catch {}
  }

  function move(id: Stage[0], destination: number) {
    const source = ordered.findIndex(stage => stage[0] === id);
    if (source < 0 || destination < 0 || destination >= ordered.length || source === destination) return;
    const updated = [...ordered];
    updated[source] = ordered[destination];
    updated[destination] = ordered[source];
    setOrdered(updated);
    try { localStorage.setItem(orderKey, JSON.stringify(updated.map(stage => stage[0]))); } catch {}
  }

  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{label}</h2>
      <button type="button" onClick={() => setPanel('reminders')}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-950 hover:bg-blue-50">
        <Mail size={16} aria-hidden /> Recordatorios
      </button>
    </div>
    <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ordered.map(stage => <li key={stage[0]} data-stage={stage[0]}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button, form, details')) return;
          dragged.current = stage[0];
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setDropTarget(ordered[targetAt(event)]?.[0]);
        }}
        onPointerUp={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          if (dragged.current) move(dragged.current, targetAt(event));
          endDrag();
        }}
        onLostPointerCapture={endDrag}
        className={`flex min-w-0 cursor-grab select-none flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm active:cursor-grabbing ${dropTarget === stage[0] ? 'ring-2 ring-blue-500' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="rounded bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-900">
            {stages.indexOf(stage) < 11 ? stages.indexOf(stage) + 1 : '–'}
          </span>
          <h3 className="flex-1 font-semibold">{stage[1]}</h3>
          <GripVertical size={19} className="shrink-0 text-slate-500" aria-hidden />
        </div>
        <p className="my-3 break-words text-sm text-slate-600">{(rules[stage[0]] ?? stage[2]) || 'Sin acción configurada'}</p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm font-semibold text-blue-900">
          <button type="button" onClick={() => openPanel(stage[0], 'emails')}
            className="inline-flex items-center gap-1.5 hover:underline">
            <Mail size={15} aria-hidden /> Correos
          </button>
          <button type="button" onClick={() => openPanel(stage[0], 'rule')}
            className="inline-flex items-center gap-1.5 hover:underline">
            <Settings2 size={15} aria-hidden /> Editar regla
          </button>
        </div>
      </li>)}
    </ol>
    <dialog ref={dialog} aria-labelledby="stage-panel-title" onClose={closePanel}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50">
      {panel === 'reminders' ? <>
        <header className="sticky top-0 flex items-center justify-between gap-4 border-b bg-white px-5 py-4">
          <h3 id="stage-panel-title" className="text-xl font-bold">Recordatorios de {label}</h3>
          <button type="button" aria-label="Cerrar" onClick={closePanel} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
        </header>
        <div className="space-y-6 p-5">
          {followUpStages.map(id => <section key={id} className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-base font-bold text-blue-950">{stages.find(stage => stage[0] === id)?.[1]}</h4>
            <EmailList emails={id === 'installed' ? commercialSchedule[id].slice(1) : commercialSchedule[id]} />
          </section>)}
        </div>
      </> : selected && <>
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <p className="text-sm font-medium text-slate-600">{label} · {panel === 'rule' ? 'Automatización' : 'Correos de la propuesta'}</p>
            <h3 id="stage-panel-title" className="mt-1 text-xl font-bold">{selected[1]}</h3>
          </div>
          <button type="button" aria-label="Cerrar" onClick={() => setEditing(undefined)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={20} /></button>
        </header>
        <div className="min-w-0 px-5 py-5 sm:px-7">
          {panel === 'emails' ? (
            <EmailList emails={commercialSchedule[selected[0]]} />
          ) : selected[0] === 'received' ? (
            <ReceivedRule storageKey={`${prefix}:received-email`} close={() => setEditing(undefined)} />
          ) : <form key={selected[0]} className="grid gap-4" onSubmit={event => {
            event.preventDefault();
            saveRule(selected[0], String(new FormData(event.currentTarget).get('action') ?? ''));
          }}>
            <label className="text-sm font-medium">Acción simulada
              <input name="action" maxLength={200} defaultValue={rules[selected[0]] ?? selected[2]}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <div className="flex flex-wrap gap-3 text-sm">
              <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Guardar</button>
              <button type="button" onClick={() => setEditing(undefined)} className="rounded-lg px-4 py-2">Cancelar</button>
            </div>
          </form>}
          {panel === 'rule' && selected[0] !== 'received' && (
            <section className="mt-5 border-t border-slate-200 pt-4">
              <h4 className="mb-3 font-bold">Correos del estado</h4>
              <EmailList emails={commercialSchedule[selected[0]]} />
            </section>
          )}
        </div>
      </>}
    </dialog>
  </>;
}
