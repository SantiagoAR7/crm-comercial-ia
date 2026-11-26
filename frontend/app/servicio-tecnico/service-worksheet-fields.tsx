'use client';

import { useState } from 'react';
import { checkResults, getWorksheetTemplate } from './service-worksheet';

export default function ServiceWorksheetFields({ origin }: { origin: string }) {
  const template = getWorksheetTemplate(origin);
  const [results, setResults] = useState<Record<string, string>>({});
  const needsNotes = Object.values(results).includes('issue');
  const control = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
  return <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 text-sm font-semibold">{template.title}</legend>
    <input type="hidden" name="worksheet" value="1" />
    {template.checks.map(([id, label]) => <label key={id} className="block text-sm font-semibold">{label}
      <select name={'check-' + id} required value={results[id] || ''}
        onChange={event => setResults({ ...results, [id]: event.target.value })} className={control}>
        <option value="">Seleccionar resultado</option>
        {Object.entries(checkResults).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
      </select>
    </label>)}
    <label className="block text-sm font-semibold">Observaciones de las comprobaciones
      <textarea name="worksheetNotes" rows={3} maxLength={1200} required={needsNotes} className={control} />
    </label>
  </fieldset>;
}
