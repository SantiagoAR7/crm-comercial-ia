'use client';

import { useState } from 'react';
import { chargeLabels, charges, payerLabels } from './service-coverage';
import type { EquipmentWarranty } from './service-warranty';

const field = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2';

export default function ServiceWarrantyFields({ warranty }: { warranty?: EquipmentWarranty }) {
  const [expanded, setExpanded] = useState(Boolean(warranty));
  return <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 font-semibold">Garantía de fabricante</legend>
    <input type="hidden" name="warrantyForm" value="1" />
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name="hasWarranty" value="yes" checked={expanded} onChange={event => setExpanded(event.target.checked)} />
      El equipo tiene una garantía registrada
    </label>
    {expanded && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Fabricante
          <input name="warrantyManufacturer" defaultValue={warranty?.manufacturer} required maxLength={120} className={field} />
        </label>
        <label className="text-sm font-semibold">Referencia de garantía
          <input name="warrantyReference" defaultValue={warranty?.reference} required maxLength={120} className={field} />
        </label>
        <label className="text-sm font-semibold">Vigente desde
          <input name="warrantyFrom" type="date" defaultValue={warranty?.from} required className={field} />
        </label>
        <label className="text-sm font-semibold">Vigente hasta
          <input name="warrantyUntil" type="date" defaultValue={warranty?.until} required className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {charges.map(charge => <label key={charge} className="text-sm font-semibold">{chargeLabels[charge]}
          <select name={'warranty-payer-' + charge} defaultValue={warranty?.payers[charge] || 'pending'} className={field}>
            {(['pending', 'manufacturer', 'customer'] as const).map(payer =>
              <option key={payer} value={payer}>{payerLabels[payer]}</option>)}
          </select>
        </label>)}
      </div>
      <p className="text-sm text-slate-600">La autorización para una intervención se registra en el aviso.</p>
    </>}
  </fieldset>;
}
