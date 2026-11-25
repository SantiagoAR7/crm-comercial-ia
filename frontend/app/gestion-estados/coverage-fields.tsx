'use client';

import { useState } from 'react';
import { chargeLabels, charges, payerLabels, type Charge } from './service-coverage';
import { coverages } from './service-options';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';

function Amount({ charge }: { charge: Charge }) {
  return <label className="block space-y-1 text-sm">
    <span>Importe para el cliente (€)</span>
    <input name={charge} className={input} inputMode="decimal" maxLength={10} />
  </label>;
}

function ManufacturerCharge({ charge }: { charge: Charge }) {
  const [payer, setPayer] = useState('pending');
  return <div className="space-y-2">
    <label className="block space-y-1 text-sm font-semibold">
      <span>{chargeLabels[charge]}</span>
      <select name={'payer-' + charge} value={payer} onChange={event => setPayer(event.target.value)} className={input}>
        {(['pending', 'customer', 'manufacturer'] as const).map(value =>
          <option key={value} value={value}>{payerLabels[value]}</option>)}
      </select>
    </label>
    {payer === 'customer' && <Amount charge={charge} />}
  </div>;
}

export default function CoverageFields() {
  const [coverage, setCoverage] = useState('');
  return <>
    <label className="block space-y-1 text-sm font-semibold">
      <span>Cobertura</span>
      <select name="coverage" value={coverage} onChange={event => setCoverage(event.target.value)} required className={input}>
        <option value="">Selecciona la cobertura verificada</option>
        {coverages.slice(1).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    {coverage === 'Contrato' && <div className="space-y-2">
      <p className="text-sm text-slate-700">El contrato cubre mano de obra y desplazamiento. El cliente paga el material.</p>
      <Amount charge="material" />
    </div>}
    {coverage === 'Fuera de cobertura' && <div className="grid gap-3 sm:grid-cols-3">
      {charges.map(charge => <fieldset key={charge} className="space-y-1">
        <legend className="text-sm font-semibold">{chargeLabels[charge]}</legend>
        <Amount charge={charge} />
      </fieldset>)}
    </div>}
    {coverage === 'Garantía de fabricante' && <div className="grid gap-3 sm:grid-cols-3">
      {charges.map(charge => <ManufacturerCharge charge={charge} key={charge} />)}
    </div>}
    {coverage && <p className="text-sm text-slate-600">Deja en blanco un importe pendiente. El total se confirma cuando se conocen todos los conceptos a cargo del cliente.</p>}
  </>;
}
