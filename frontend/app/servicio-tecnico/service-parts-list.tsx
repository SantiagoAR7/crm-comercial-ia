import type { UsedPart } from './service-parts';

const quantity = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });

export default function ServicePartsList({ parts, notes }: { parts?: UsedPart[]; notes?: string }) {
  return <div className="space-y-2">
    {Boolean(parts?.length) && <ul className="list-disc space-y-1 pl-4">
      {parts?.map((part, index) => <li key={index} className="break-words">
        {part.reference} · {quantity.format(part.units)} · {part.location}
      </li>)}
    </ul>}
    {notes && <p className="whitespace-pre-wrap break-words">{notes}</p>}
    {!parts?.length && !notes && <p>—</p>}
  </div>;
}
