import { chargeLabels, charges, payerLabels } from './service-coverage';
import { warrantyStatus, warrantyStatusLabels, type EquipmentWarranty } from './service-warranty';

export default function ServiceWarrantySummary({ warranty, date }: { warranty: EquipmentWarranty; date: string }) {
  const format = (day: string) => day.split('-').reverse().join('/');
  const status = warrantyStatus(warranty, date);
  return <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
    <p className={status === 'active' ? 'font-semibold text-green-800' : 'font-semibold text-amber-900'}>
      {warrantyStatusLabels[status]}
    </p>
    <p>{warranty.manufacturer} · {warranty.reference}</p>
    <p>Del {format(warranty.from)} al {format(warranty.until)}</p>
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {charges.map(charge => <li key={charge}>{chargeLabels[charge]} · {payerLabels[warranty.payers[charge]]}</li>)}
    </ul>
  </div>;
}
