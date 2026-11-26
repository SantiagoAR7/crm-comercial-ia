import { createHash, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
type Credentials = { username: string; salt: string; hash: string };
type Account = Credentials & ({ role: 'admin' } | { role: 'technician'; technicianId: string });
export type Technician = { username: string; technicianId: string };

function accounts(): Account[] {
  try {
    const values: unknown = JSON.parse(process.env.SERVICE_TECHNICIAN_ACCOUNTS || '[]');
    if (!Array.isArray(values)) return [];
    return values.flatMap((item): Account[] => {
      if (!item || typeof item.username !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(item.username)
        || typeof item.salt !== 'string' || !/^[a-f0-9]{32}$/.test(item.salt)
        || typeof item.hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash)) return [];
      const credentials = { username: item.username, salt: item.salt, hash: item.hash };
      if (item.role === 'admin') return [{ ...credentials, role: 'admin' }];
      if (typeof item.technicianId !== 'string' || !/^[A-Z0-9_-]+(?: [A-Z0-9_-]+)*$/.test(item.technicianId)) return [];
      return [{ ...credentials, role: 'technician', technicianId: item.technicianId }];
    });
  } catch {
    return [];
  }
}

export function findServiceAccount(username: string) {
  return accounts().find(account => account.username.toLowerCase() === username.toLowerCase());
}

export function assignedTechnician(value: string) {
  const name = value.toLowerCase();
  return technicianOptions().find(account => account.technicianId.toLowerCase() === name || account.username.toLowerCase() === name)?.technicianId;
}

export function technicianOptions(): Technician[] {
    return accounts().flatMap(account => account.role === 'technician'
    ? [{ username: account.username, technicianId: account.technicianId }] : []);
}

export function accountVersion(account: Account) {
  return createHash('sha256').update(JSON.stringify(account)).digest('hex');
}

const failures = new Map<string, { until: number; count: number }>();

export async function authenticateServiceAccount(account: Account, password: string) {
  if (password.length > 256) return false;
  const key = account.username.toLowerCase();
  const now = Date.now();
  const stored = failures.get(key);
  if (stored && stored.until > now && stored.count >= 8) return false;
  const attempt = stored && stored.until > now ? stored : { until: now + 10 * 60 * 1000, count: 0 };
  attempt.count++;
  failures.set(key, attempt);
  const actual = await scrypt(password, Buffer.from(account.salt, 'hex'), 32) as Buffer;
  if (!timingSafeEqual(actual, Buffer.from(account.hash, 'hex'))) return false;
  failures.delete(key);
  return true;
}
