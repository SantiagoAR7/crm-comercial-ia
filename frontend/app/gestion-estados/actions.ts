'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieName, serviceCookieName, duration, sign } from './session';

export async function login(form: FormData) {
  const path = '/gestion-estados';
  const expires = String(Date.now() + duration * 1000);
  let version = '';
  try {
    const response = await fetch((process.env.WORKFLOW_INTERNAL_API_URL || 'http://crm-api:4000') + '/api/account-recovery/workflow-login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.get('username'),password:form.get('password')}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (response.ok) version = (await response.json()).version || '';
  } catch {}
  const signature = version ? sign(expires + ':' + version) : null;
  if (!version || !signature) redirect(path + '/login?error=1');
  (await cookies()).set(cookieName, `${expires}.${version}.${signature}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path, maxAge: duration,
  });
  redirect(path);
}

export async function logoutService() {
  (await cookies()).set(serviceCookieName, '', { path: '/servicio-tecnico', maxAge: 0 });
  redirect('/servicio-tecnico/login');
}

export async function logout() {
  (await cookies()).set(cookieName, '', { path: '/gestion-estados', maxAge: 0 });
  redirect('/gestion-estados/login');
}
