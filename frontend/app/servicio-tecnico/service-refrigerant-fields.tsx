'use client';

import { useState } from 'react';
import { leakResults } from './service-refrigerant';

const control = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

const amounts = [
  { name: 'refrigerantCharge', label: 'Carga nominal del equipo (kg)' },
  { name: 'refrigerantAdded', label: 'Cantidad añadida (kg)' },
  { name: 'refrigerantRecovered', label: 'Cantidad recuperada (kg)' },
];

export default function ServiceRefrigerantFields({ today, refrigerant, chargeGrams }: { today: string; refrigerant?: string; chargeGrams?: number | null }) {
  const [enabled, setEnabled] = useState(false);
  const [leakResult, setLeakResult] = useState('not_checked');
  return <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 text-sm font-semibold">Refrigerantes y control de fugas</legend>
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name="recordRefrigerant" value="yes" checked={enabled}
        onChange={event => setEnabled(event.target.checked)} /> Registrar actuación de refrigerante
    </label>
    {enabled && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Fecha de la actuación
          <input type="date" name="refrigerantDate" className={control} defaultValue={today} min="1900-01-01" max={today} required />
        </label>
        <label className="text-sm font-semibold">Tipo de refrigerante
          <input name="refrigerantType" defaultValue={refrigerant} className={control} maxLength={40} placeholder="Ej. R-32" required />
        </label>
        {amounts.map(field => <label key={field.name} className="text-sm font-semibold">{field.label}
          <input name={field.name} defaultValue={field.name === 'refrigerantCharge' && chargeGrams != null ? String(chargeGrams / 1000).replace('.', ',') : undefined} className={control} maxLength={9} inputMode="decimal"
            pattern="[0-9]{1,5}([.,][0-9]{1,3})?" />
        </label>)}
        <label className="text-sm font-semibold">Resultado del control de fugas
          <select name="refrigerantLeakResult" value={leakResult} onChange={event => setLeakResult(event.target.value)} className={control}>
            {Object.entries(leakResults).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold">Actuación correctiva o seguimiento
        <textarea name="refrigerantFollowUp" className={control} rows={3} maxLength={1200}
          required={leakResult === 'leak_found'} />
      </label>
      <label className="block text-sm font-semibold">Referencia de acreditación del técnico
        <input name="refrigerantCredential" className={control} maxLength={100} />
      </label>
      <p className="text-sm text-slate-600">Si indicas la acreditación, podrás abrir el certificado de intervención desde el parte cerrado.</p>
    </>}
  </fieldset>;
}
