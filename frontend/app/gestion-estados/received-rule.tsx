'use client';

import { useEffect, useState } from 'react';
import { receivedTemplate as template } from './commercial-email';

type EmailRule = {
  enabled: boolean;
  timing: 'immediate' | 'next-morning';
  templateId: typeof template.id;
};

const defaultRule: EmailRule = { enabled: false, timing: 'immediate', templateId: template.id };

export default function ReceivedRule({ close, storageKey }: { close: () => void; storageKey: string }) {
  const [rule, setRule] = useState(defaultRule);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved?.templateId === template.id && typeof saved.enabled === 'boolean' &&
          ['immediate', 'next-morning'].includes(saved.timing)) setRule(saved);
    } catch {
      // Keep the proposal defaults if a saved rule cannot be loaded.
    }
  }, [storageKey]);

  return <form className="grid min-w-0 gap-4 text-sm" onSubmit={event => {
    event.preventDefault();
    try {
      localStorage.setItem(storageKey, JSON.stringify(rule));
      close();
    } catch {
      setError(true);
    }
  }}>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={rule.enabled} onChange={event => setRule({ ...rule, enabled: event.target.checked })} />
      Activar en la demo
    </label>
    <label className="grid gap-1">Momento del envío
      <select className="w-full min-w-0 rounded-lg border border-slate-300 p-2" value={rule.timing}
        onChange={event => setRule({ ...rule, timing: event.target.value === 'next-morning' ? 'next-morning' : 'immediate' })}>
        <option value="immediate">Al entrar en el estado</option>
        <option value="next-morning">Al día siguiente a las 08:00 (España peninsular)</option>
      </select>
    </label>
    <p>Plantilla: {template.subject}</p>
    <button type="button" className="w-fit text-blue-900 underline" aria-expanded={preview}
      onClick={() => setPreview(!preview)}>{preview ? 'Ocultar correo' : 'Ver correo HTML'}</button>
    {preview && <iframe src="/email-plantillas/solicitud-recibida.html" title={template.subject}
      sandbox="" className="h-[65vh] w-full rounded-xl border border-slate-200" />}
    <p className="text-slate-600">La configuración se guarda en este navegador. Demo sin envío.</p>
    {error && <p role="alert" className="text-red-700">No se pudo guardar la regla en este navegador.</p>}
    <div className="flex gap-3">
      <button type="submit" className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Guardar</button>
      <button type="button" onClick={close} className="rounded-lg px-4 py-2">Cancelar</button>
    </div>
  </form>;
}
