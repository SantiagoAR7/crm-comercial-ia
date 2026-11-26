'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { duration, serviceCookieName, sign } from '../gestion-estados/session';
import { authenticateServiceAccount, findServiceAccount, accountVersion } from './technician-accounts';

export async function loginTechnicalModule(form: FormData) {
  const username = form.get('username');
  const password = form.get('password');
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 120 || password.length > 256) {
    redirect('/servicio-tecnico/login?error=1');
  }
  const account = findServiceAccount(username.trim());
  if (!account || !await authenticateServiceAccount(account, password)) redirect('/servicio-tecnico/login?error=1');
  const expires = String(Date.now() + duration * 1000);
  const signature = sign(`member:${account.username}:${expires}:${accountVersion(account)}`, 'service');
  if (!signature) redirect('/servicio-tecnico/login?error=1');
  (await cookies()).set(serviceCookieName, `member.${account.username}.${expires}.${signature}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/servicio-tecnico', maxAge: duration,
  });
  redirect(account.role === 'admin' ? '/servicio-tecnico?vista=tecnicos' : '/servicio-tecnico?vista=ordenes');
}
