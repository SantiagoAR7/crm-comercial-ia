import { checkResults, type Worksheet } from './service-worksheet';

export default function ServiceWorksheetSummary({ worksheet }: { worksheet: Worksheet }) {
  return <section className="space-y-2">
    <h2 className="font-bold">{worksheet.title}</h2>
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {worksheet.checks.map(check => <li key={check.label}>{check.label} · {checkResults[check.result]}</li>)}
    </ul>
    {worksheet.notes && <p className="whitespace-pre-wrap break-words text-sm">{worksheet.notes}</p>}
  </section>;
}
