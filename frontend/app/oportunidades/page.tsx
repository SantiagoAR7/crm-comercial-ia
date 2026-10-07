'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Phone, RefreshCw, Target } from 'lucide-react';

type Opportunity = {
  id: string;
  outcome: string;
  interest_level: string | null;
  summary: string | null;
  next_action: string | null;
  callback_at: string | null;
  created_at: string;
  campaign_call_queue: {
    customer_name: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  campaigns: { name: string; type: string } | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/dashboard/opportunities`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron cargar las oportunidades.');
      setItems(body.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Seguimiento comercial</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950">Oportunidades</h2>
          <p className="mt-2 text-sm text-slate-500">Clientes que han mostrado interés durante una campaña.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <RefreshCw size={17} /> Actualizar
        </button>
      </div>

      {message && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>}
      {loading && <p className="text-sm text-slate-500">Cargando oportunidades...</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const contact = item.campaign_call_queue;
          return (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><Target size={20} /></span>
                  <div>
                    <h3 className="font-bold text-slate-950">{contact?.contact_name || contact?.customer_name || 'Cliente'}</h3>
                    <p className="text-xs font-semibold text-slate-500">{item.campaigns?.name || 'Campaña'} · {item.campaigns?.type || ''}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">INTERESADO</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                {contact?.phone && <span className="inline-flex items-center gap-1.5"><Phone size={15} />{contact.phone}</span>}
                {contact?.email && <span className="inline-flex items-center gap-1.5"><Mail size={15} />{contact.email}</span>}
              </div>
              {item.summary && <p className="mt-4 text-sm leading-6 text-slate-700">{item.summary}</p>}
              {item.next_action && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><strong>Siguiente acción:</strong> {item.next_action}</p>}
              <p className="mt-4 text-xs text-slate-400">{new Date(item.created_at).toLocaleString('es-ES')}</p>
            </article>
          );
        })}
      </div>

      {!loading && !items.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Todavía no hay oportunidades registradas.</div>
      )}
    </div>
  );
}
