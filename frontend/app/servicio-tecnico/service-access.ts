import { cookies } from 'next/headers';
import { equals, serviceCookieName, sign } from '../gestion-estados/session';
import { findServiceAccount, accountVersion, type Technician } from './technician-accounts';

export async function getServiceAccess(): Promise<{ role: 'admin' } | { role: 'technician'; account: Technician } | null> {
  const token = (await cookies()).get(serviceCookieName)?.value;
  if (!token) return null;
  const [tag, username, expires, signature, extra] = token.split('.');
  if (tag !== 'member') return null;
  if (extra || !username || !/^\d+$/.test(expires || '') || Number(expires) <= Date.now() || !signature) return null;
  const account = findServiceAccount(username);
  if (!account) return null;
  const expected = sign(`member:${account.username}:${expires}:${accountVersion(account)}`, 'service');
  if (!expected || !equals(signature, expected)) return null;
  if (account.role === 'admin') return { role: 'admin' };
  return { role: 'technician', account: { username: account.username, technicianId: account.technicianId } };
}

export function noticeBelongsToTechnician(notice: { technicianId?: string; technician: string }, technicianId: string) {
  return (notice.technicianId || notice.technician) === technicianId;
}
