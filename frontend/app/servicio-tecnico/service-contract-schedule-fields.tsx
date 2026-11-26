'use client';

import { useState } from 'react';
import { contractTypes, coversWork, type ContractType } from './service-contract-rules';

const control = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2';

export default function ServiceContractScheduleFields({ initial, first, months }: { initial: ContractType; first?: string; months?: number }) {
  const [kind, setKind] = useState(initial);
  return <>
    <label className="block text-sm font-semibold">Tipo de contrato
      <select name="kind" value={kind} onChange={event => setKind(event.target.value as ContractType)} className={control}>
        {Object.entries(contractTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {coversWork(kind, 'preventivo') && <>
      <label className="block text-sm font-semibold">Primera revisión prevista
        <input name="firstVisit" type="date" required defaultValue={first} className={control} />
      </label>
      <label className="block text-sm font-semibold">Periodicidad en meses
        <input name="months" type="number" min={1} max={36} required defaultValue={months || 12} className={control} />
      </label>
    </>}
  </>;
}
