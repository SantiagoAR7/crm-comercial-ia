import Link from 'next/link';
import { documentLabel, downloadUrl, type ServiceDocument } from './service-document';
import { sendServiceDocument } from './service-delivery-actions';
import { listServiceDeliveries, type DeliveryState } from './service-delivery-store';
import { getNotice } from './service-store';

export default async function ServiceDelivery({ id, kind, result, inline = false }: { id?: string; kind?: string; result?: string; inline?: boolean }) {
  const notice = id ? await getNotice(id) : null;
  const document: ServiceDocument = kind === 'certificado' ? 'certificado' : 'parte';
  if (!notice || notice.stage !== 3 || (document === 'certificado' && !notice.refrigerantWork?.technicianCredential)) {
    return <p>El documento no está disponible. <Link href="/servicio-tecnico" className="underline">Volver a avisos</Link></p>;
  }
  const history = await listServiceDeliveries(notice.id);
  const status: Record<DeliveryState, string> = {
    sending: 'En proceso', accepted: 'Aceptado por Microsoft', failed: 'Rechazado', unknown: 'Sin confirmación',
  };
  const messages: Record<string, string> = {
    accepted: 'Microsoft aceptó el correo para envío.',
    failed: 'El correo se rechazó. Revisa el destino antes de reintentar.',
    unknown: 'El resultado quedó sin confirmar. Revisa el buzón antes de intentar otro envío.',
    duplicado: 'Ese documento ya tiene un envío aceptado o pendiente para este destinatario.',
    datos: 'Completa el asunto y el mensaje y confirma el destinatario para enviar.',
    pdf: 'No se pudo preparar el PDF adjunto.',
    numero: 'Abre el certificado y numéralo antes de enviarlo.',
    config: 'Falta configurar el correo de Servicio técnico.',
  };
  const title = documentLabel(document);
  const subject = 'Davofrío | ' + title;
  const message = `Hola,\n\nTe adjuntamos el ${title.toLowerCase()} de la intervención realizada por Davofrío${notice.equipment ? ' en el equipo ' + notice.equipment : ''}.\n\nSi necesitas aclarar algún detalle, responde a este correo.\n\nSaludos,\nServicio técnico de Davofrío`;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{inline ? 'Entrega del parte por correo' : 'Borrador de entrega'}</h2>
      {!inline && <Link href={'/servicio-tecnico?vista=' + document + '&aviso=' + notice.id} className="font-semibold text-blue-900 underline">Volver al documento</Link>}
    </div>
    {result && messages[result] && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm">{messages[result]}</p>}
    <form action={sendServiceDocument} className="max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {inline && <input type="hidden" name="inline" value="1" />}
      <input type="hidden" name="notice" value={notice.id} />
      <input type="hidden" name="kind" value={document} />
      <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="font-semibold">Cliente</dt><dd>{notice.customer}</dd>
        <dt className="font-semibold">Remitente</dt><dd>transformaciondigital@davofrio.com</dd>
        <dt className="font-semibold">Adjunto</dt>
        <dd><a href={downloadUrl(notice.id, document)} className="font-semibold text-blue-900 underline">Descargar {title.toLowerCase()} en PDF</a></dd>
      </dl>
      <label className="block text-sm font-semibold">Correo del destinatario
        <input name="recipient" type="email" maxLength={254} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
      </label>
      <label className="block text-sm font-semibold">Asunto
        <input name="subject" defaultValue={subject} required maxLength={150} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
      </label>
      <label className="block text-sm font-semibold">Mensaje
        <textarea name="message" defaultValue={message} required maxLength={4000} rows={8} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirmRecipient" value="yes" /> Confirmo el destinatario y autorizo enviar el adjunto
      </label>
      <div className="flex flex-wrap gap-3">
        <button name="mode" value="send" className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white">Enviar al destinatario</button>
        <button name="mode" value="test" formNoValidate className="rounded-lg border border-blue-950 px-4 py-2 font-semibold text-blue-950">Enviar prueba al buzón de Davofrío</button>
      </div>
      <p className="text-sm text-slate-600">Las pruebas siempre van a transformaciondigital@davofrio.com.</p>
    </form>
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold">Historial de correo del aviso</h3>
      {history.length ? <ul className="divide-y divide-slate-200 text-sm">
        {history.map(entry => <li key={entry.id} className="space-y-1 py-2">
          <p className="font-semibold">{documentLabel(entry.kind)} · {entry.recipient}{entry.is_test && ' · Prueba'}</p>
          <p>{status[entry.state]} · {new Date(entry.completed_at || entry.attempted_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
          {entry.previous.map(attempt => <p key={attempt.attempted_at} className="text-slate-600">
            {status[attempt.state]} · {new Date(attempt.completed_at || attempt.attempted_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
          </p>)}
        </li>)}
      </ul> : <p className="text-sm">Todavía no hay envíos registrados.</p>}
    </section>
  </section>;
}
