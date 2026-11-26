'use client';

import { useState } from 'react';
import { chargeLabels, charges, payerLabels, type Charge, type Payer } from './service-coverage';
import type { EquipmentWarranty } from './service-warranty';
import type { ContractTerms } from './service-contract-store';
import { rateInput } from './service-contract-rules';
import { coverages } from './service-options';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';

function Amount({ charge, rate }: { charge: Charge; rate?: number }) {
  return <label className="block space-y-1 text-sm">
    <span>Importe para el cliente (€)</span>
    <input name={charge} className={input} defaultValue={rateInput(rate)} inputMode="decimal" maxLength={10} />
  </label>;
}

function CoveredCharge({ charge, provider, initial, rate }: { charge: Charge; provider: 'contract' | 'manufacturer'; initial: Payer; rate?: number }) {
  const [payer, setPayer] = useState<Payer>(initial);
  return <div className="space-y-2">
    <label className="block space-y-1 text-sm font-semibold">
      <span>{chargeLabels[charge]}</span>
      <select name={'payer-' + charge} value={payer} onChange={event => setPayer(event.target.value as Payer)} className={input}>
        {(['pending', 'customer', provider] as const).map(value =>
          <option key={value} value={value}>{payerLabels[value]}</option>)}
      </select>
    </label>
    {payer === 'customer' && <Amount charge={charge} rate={rate} />}
  </div>;
}

export default function CoverageFields({ contract, warranty }: { contract?: ContractTerms; warranty?: EquipmentWarranty }) {
  const [coverage, setCoverage] = useState(contract && !warranty ? 'Contrato' : warranty && !contract ? 'Garantía de fabricante' : '');
  return <>
    <label className="block space-y-1 text-sm font-semibold">
      <span>Cobertura</span>
      <select name="coverage" value={coverage} onChange={event => setCoverage(event.target.value)} required className={input}>
        <option value="">Selecciona la cobertura verificada</option>
        {coverages.slice(1).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    {contract && warranty && <p className="text-sm text-slate-600">Hay contrato y garantía vigentes. Elige qué cobertura se aplica a este aviso.</p>}
    {coverage === 'Contrato' && <>
      <label className="block space-y-1 text-sm font-semibold">
        Referencia del contrato
        <input name="reference" defaultValue={contract?.reference} maxLength={250} required className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold">Vigente desde
          <input name="coverageFrom" type="date" defaultValue={contract?.start} required className={input} />
        </label>
        <label className="block space-y-1 text-sm font-semibold">Vigente hasta
          <input name="coverageUntil" type="date" defaultValue={contract?.end} className={input} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {charges.map(charge => <CoveredCharge key={charge} charge={charge} provider="contract" rate={contract?.rates?.[charge]} initial={contract?.payers[charge] || (charge === 'material' ? 'customer' : 'contract')} />)}
      </div>
    </>}
    {coverage === 'Fuera de cobertura' && <label className="block space-y-1 text-sm font-semibold">
      Motivo de exclusión
      <input name="reference" maxLength={250} required className={input} />
    </label>}
    {coverage === 'Fuera de cobertura' && <div className="grid gap-3 sm:grid-cols-3">
      {charges.map(charge => <fieldset key={charge} className="space-y-1">
        <legend className="text-sm font-semibold">{chargeLabels[charge]}</legend>
        <Amount charge={charge} />
      </fieldset>)}
    </div>}
    {coverage === 'Garantía de fabricante' && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold">Fabricante
          <input name="manufacturer" defaultValue={warranty?.manufacturer} maxLength={250} required className={input} />
        </label>
        <label className="block space-y-1 text-sm font-semibold">Referencia de autorización
          <input name="reference" maxLength={250} required className={input} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {charges.map(charge => <CoveredCharge key={charge} charge={charge} provider="manufacturer" initial={warranty?.payers[charge] || "pending"} />)}
      </div>
    </>}
    {coverage && <p className="text-sm text-slate-600">Deja en blanco un importe pendiente. El total se confirma cuando se conocen todos los conceptos a cargo del cliente.</p>}
  </>;
}
