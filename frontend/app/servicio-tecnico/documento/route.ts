import { getServiceCertificate } from '../service-certificate-store';
import { getServiceAccess, noticeBelongsToTechnician } from '../service-access';
import { renderServicePdf } from '../service-pdf';
import { getNotice } from '../service-store';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const access = await getServiceAccess();
  if (!access) return Response.json({ error: 'Inicia sesión en Servicio técnico.' }, { status: 401, headers: privateHeaders });
  const params = new URL(request.url).searchParams;
  const id = params.get('aviso');
  const kind = params.get('tipo');
  if (!id || (kind !== 'parte' && kind !== 'certificado' && kind !== 'presupuesto')) {
    return Response.json({ error: 'Documento no válido.' }, { status: 400, headers: privateHeaders });
  }

  const notice = await getNotice(id);
  const version = Number(params.get('version'));
  const quote = kind === 'presupuesto';
  const available = quote
    ? access.role === 'admin' && Number.isSafeInteger(version) && version > 0 && notice?.quotes?.[version - 1]
    : notice?.stage === 3;
  if (!notice || !available || (access.role === 'technician' && !noticeBelongsToTechnician(notice, access.account.technicianId))
    || (kind === 'certificado' && !notice.refrigerantWork?.technicianCredential)) {
    return Response.json({ error: 'Documento no disponible.' }, { status: 404, headers: privateHeaders });
  }

  try {
    const certificate = kind === 'certificado' ? await getServiceCertificate(notice.id) : null;
    if (kind === 'certificado' && !certificate) {
      return Response.json({ error: 'El certificado todavía está pendiente de numerar.' }, { status: 409, headers: privateHeaders });
    }
    const bytes = await renderServicePdf(notice, kind, certificate, version);
    return new Response(new Uint8Array(bytes), { headers: {
      ...privateHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${kind}-davofrio-${notice.id}${quote ? "-v" + version : ""}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ error: 'No se pudo preparar el PDF.' }, { status: 500, headers: privateHeaders });
  }
}
