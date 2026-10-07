import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiGet<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: { cookie: cookieStore.toString() },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Error HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
