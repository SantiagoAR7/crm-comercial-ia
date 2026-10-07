'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (pathname === '/login') return;
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => setEmail(body?.data?.email || ''))
      .catch(() => undefined);
  }, [pathname]);

  if (pathname === '/login' || pathname === '/bi-login' || pathname.startsWith('/bi')) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar email={email} />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#082b5b] text-[10px] font-black text-white">CRM</div>
          <div><p className="text-sm font-extrabold text-[#082b5b]">CLIENTE</p><p className="text-[11px] text-slate-500">CRM comercial</p></div>
        </div>
        <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="rounded-lg border border-slate-200 p-2 text-slate-700"><Menu size={21} /></button>
      </header>
      {menuOpen && (
        <>
          <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" />
          <Sidebar mobile email={email} onClose={() => setMenuOpen(false)} />
        </>
      )}
      <main className="min-h-screen lg:pl-72">{children}</main>
    </>
  );
}
