import { query } from './service-store';

export type ServiceCertificate = { notice_id: string; number: number; issued_at: string };

export function certificateNumber(certificate: ServiceCertificate) {
  return 'SAT-' + String(certificate.number).padStart(6, '0');
}

export async function getServiceCertificate(noticeId: string) {
  const [row] = await query<ServiceCertificate>('service_certificates', {
    select: 'notice_id,number,issued_at', notice_id: 'eq.' + noticeId,
  });
  return row ?? null;
}

export async function issueServiceCertificate(noticeId: string) {
  const current = await getServiceCertificate(noticeId);
  if (current) return current;
  const [created] = await query<ServiceCertificate>('service_certificates', { on_conflict: 'notice_id' }, {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ notice_id: noticeId }),
  });
  return created ?? await getServiceCertificate(noticeId);
}
