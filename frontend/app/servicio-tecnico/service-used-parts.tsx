'use client';

import { useRef, useState } from 'react';
import { maxUsedParts } from './service-parts';

const field = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

export default function ServiceUsedParts({ reference, stockLocation }: { reference: string; stockLocation?: string }) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<number[]>([]);
  return <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 text-sm font-semibold">Consumo de repuestos</legend>
    {(reference || stockLocation) && <p className="text-sm text-slate-700">
      Previsto en el aviso: {[reference, stockLocation].filter(Boolean).join(' · ')}
    </p>}
    {rows.map(id => <div key={id} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]">
      <label className="text-sm font-semibold">Referencia
        <input name="usedPartReference" className={field} required maxLength={120} defaultValue={id === 1 ? reference : ''} />
      </label>
      <label className="text-sm font-semibold">Cantidad
        <input name="usedPartUnits" className={field} required inputMode="decimal" maxLength={10} />
      </label>
      <label className="text-sm font-semibold">Almacén o furgoneta
        <input name="usedPartLocation" className={field} required maxLength={120} defaultValue={id === 1 ? stockLocation : ''} />
      </label>
      <button type="button" className="w-fit text-sm font-semibold text-blue-900 underline"
        onClick={() => setRows(rows.filter(row => row !== id))}>Quitar repuesto</button>
    </div>)}
    {rows.length < maxUsedParts && <button type="button" className="text-sm font-semibold text-blue-900 underline"
      onClick={() => { const id = nextId.current++; setRows([...rows, id]); }}>Añadir repuesto utilizado</button>}
  </fieldset>;
}
