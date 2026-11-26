'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess, noticeBelongsToTechnician } from './service-access';
import { issueServiceCertificate } from './service-certificate-store';
import { getNotice } from './service-store';

export async function generateServiceCertificate(form: FormData) {
  const access = await getServiceAccess();
  if (!access) redirect('/servicio-tecnico/login');
  const id = form.get('notice');
  const notice = typeof id === 'string' ? await getNotice(id) : null;
  if (!notice || notice.stage !== 3 || !notice.refrigerantWork?.technicianCredential
    || (access.role === 'technician' && !noticeBelongsToTechnician(notice, access.account.technicianId))) {
    redirect('/servicio-tecnico');
  }
  const detail = '/servicio-tecnico?vista=certificado&aviso=' + notice.id;
  try {
    await issueServiceCertificate(notice.id);
  } catch (error) {
    console.error('No se pudo numerar el certificado del aviso ' + notice.id, error);
  }
  revalidatePath('/servicio-tecnico');
  redirect(detail);
}
