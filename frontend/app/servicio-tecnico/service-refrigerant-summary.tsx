import { formatKilograms, leakResults, type RefrigerantWork } from './service-refrigerant';

export default function ServiceRefrigerantSummary({ work }: { work: RefrigerantWork }) {
  return <section className="space-y-2">
    <h2 className="font-bold">Registro de refrigerante</h2>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt>Fecha de la actuación</dt><dd>{work.performedOn.split('-').reverse().join('/')}</dd>
      <dt>Refrigerante</dt><dd>{work.refrigerant}</dd>
      <dt>Carga nominal del equipo</dt><dd>{formatKilograms(work.chargeGrams)}</dd>
      <dt>Cantidad añadida</dt><dd>{formatKilograms(work.addedGrams)}</dd>
      <dt>Cantidad recuperada</dt><dd>{formatKilograms(work.recoveredGrams)}</dd>
      <dt>Control de fugas</dt><dd>{leakResults[work.leakResult]}</dd>
      <dt>Acreditación del técnico</dt><dd>{work.technicianCredential || '—'}</dd>
      {work.followUp && <><dt>Actuación o seguimiento</dt><dd className="whitespace-pre-wrap break-words">{work.followUp}</dd></>}
    </dl>
  </section>;
}
