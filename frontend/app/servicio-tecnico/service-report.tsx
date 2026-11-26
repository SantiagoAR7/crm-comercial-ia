import { generateServiceCertificate } from './service-certificate-actions';
import { certificateNumber, getServiceCertificate } from './service-certificate-store';
import ServiceWorksheetSummary from './service-worksheet-summary';
import { formatWorkTime } from './service-work-time';
import ServiceRefrigerantSummary from './service-refrigerant-summary';
import Link from 'next/link';
import ServicePartsList from './service-parts-list';
import ServicePrintButton from './service-print-button';
import { downloadUrl } from './service-document';
import { noticeBelongsToTechnician } from './service-access';
import { getNotice } from './service-store';

const base = '/servicio-tecnico';

export default async function ServiceReport({ id, technician, certificate = false }: { id?: string; technician?: string; certificate?: boolean }) {
  const notice = id ? await getNotice(id) : null;
  if (!notice || notice.stage !== 3 || (technician && !noticeBelongsToTechnician(notice, technician))) {
    return <p>El parte estará disponible al cerrar la intervención. <Link href={technician ? base + '?vista=ordenes' : base} className="underline">Volver</Link></p>;
  }
  const work = notice.refrigerantWork;
  const kind = certificate ? 'certificado' : 'parte';
  if (certificate && !work?.technicianCredential) {
    return <p>El certificado requiere un registro de refrigerante con la referencia de acreditación del técnico. <Link href={base + '?aviso=' + notice.id} className="underline">Volver al aviso</Link></p>;
  }
  const certificateRecord = certificate ? await getServiceCertificate(notice.id) : null;
  if (certificate && !certificateRecord) {
    return <main className="mx-auto max-w-xl space-y-4 p-6">
      <Link href={base + '?aviso=' + notice.id} className="font-semibold text-blue-900 underline">Volver al aviso</Link>
      <h1 className="text-2xl font-bold">Certificado pendiente de numerar</h1>
      <form action={generateServiceCertificate}>
        <input type="hidden" name="notice" value={notice.id} />
        <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Numerar certificado</button>
      </form>
    </main>;
  }
  return <div className="min-h-screen bg-slate-100 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={base + '?aviso=' + notice.id} className="font-semibold text-blue-900 underline">Volver al aviso</Link>
        {!certificate && work?.technicianCredential && <Link href={base + '?vista=certificado&aviso=' + notice.id} className="font-semibold text-blue-900 underline">
          Ver certificado de intervención
        </Link>}
        <a href={downloadUrl(notice.id, kind)} className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Descargar PDF</a>
        {!technician && <Link href={base + '?vista=entrega&tipo=' + kind + '&aviso=' + notice.id}
          className="font-semibold text-blue-900 underline">Preparar correo</Link>}
        <ServicePrintButton />
      </div>
      <article className="space-y-6 rounded-xl bg-white p-5 text-slate-950 sm:p-8 print:p-0">
        <header className="border-b pb-4">
          <p className="font-semibold text-blue-950">Davofrío</p>
          <h1 className="text-2xl font-bold">{certificate ? 'Certificado de intervención' : 'Parte de trabajo'}</h1>
          {certificateRecord && <p className="font-semibold">{certificateNumber(certificateRecord)} · {formatWorkTime(certificateRecord.issued_at)}</p>}
          <p className="text-xs text-slate-600">{notice.id}</p>
        </header>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Cliente</dt><dd>{notice.customer}</dd>
          <dt>Equipo</dt><dd>{notice.equipment || '—'}</dd>
          <dt>Número de serie</dt><dd>{notice.serial || '—'}</dd>
          <dt>Técnico</dt><dd>{notice.technician}</dd>
          <dt>Visita</dt><dd>{notice.appointment.replace('T', ' ')}</dd>
          {notice.startedAt && <><dt>Inicio</dt><dd>{formatWorkTime(notice.startedAt)}</dd></>}
          {notice.finishedAt && <><dt>Cierre</dt><dd>{formatWorkTime(notice.finishedAt)}</dd></>}
          <dt>Minutos trabajados</dt><dd>{notice.minutes}</dd>
        </dl>
        <section><h2 className="font-bold">Trabajo realizado</h2><p className="whitespace-pre-wrap break-words">{notice.report}</p></section>
        {notice.worksheet && <ServiceWorksheetSummary worksheet={notice.worksheet} />}
        {work && <ServiceRefrigerantSummary work={work} />}
        {!certificate && <section><h2 className="font-bold">Piezas utilizadas</h2><ServicePartsList parts={notice.consumedParts} notes={notice.usedParts} /></section>}
        {!certificate && Boolean(notice.reportPhotos?.length) && <section>
          <h2 className="font-bold">Fotos del trabajo</h2>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {notice.reportPhotos?.map((photo, index) =>
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={photo} alt={`Foto ${index + 1} del trabajo`} className="max-h-60 w-full break-inside-avoid object-contain" />)}
          </div>
        </section>}
        {notice.reportSignature && <section className="break-inside-avoid">
          <h2 className="font-bold">Firma del cliente</h2>
          <p>{notice.reportSigner}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={notice.reportSignature} alt="Firma manuscrita del cliente" className="max-h-28 max-w-full" />
        </section>}
      </article>
    </div>
  </div>;
}
