'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess } from '../service-access';
import { madridDate } from '../service-refrigerant';
import { registerTechnicianDay } from '../service-technician-day';

export async function registerToday(form: FormData) {
  const access = await getServiceAccess();
  if (!access) redirect('/servicio-tecnico/login');
  if (access.role !== 'technician') redirect('/servicio-tecnico?vista=tecnicos');
  const value = form.get('displayName');
  const name = typeof value === 'string' && value.length <= 120 ? value.trim().replace(/\s+/gu, ' ') : '';
  if (name.length < 2 || !/\p{L}/u.test(name) || /\p{C}/u.test(name)) {
    redirect('/servicio-tecnico/jornada?error=nombre');
  }
  try {
    await registerTechnicianDay(access.account.technicianId, madridDate(), name);
  } catch {
    redirect('/servicio-tecnico/jornada?error=registro');
  }
  revalidatePath('/servicio-tecnico');
  redirect('/servicio-tecnico?vista=ordenes');
}
