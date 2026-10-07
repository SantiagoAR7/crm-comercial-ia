'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bot, Building2, LayoutDashboard, Megaphone, Settings, Target, LogOut, X } from 'lucide-react';

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/instalaciones', label: 'Instalaciones', icon: Building2 },
  { href: '/campanas', label: 'Campañas', icon: Megaphone },
  { href: '/ia-comercial', label: 'IA Comercial', icon: Bot },
  { href: '/oportunidades', label: 'Oportunidades', icon: Target },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

type SidebarProps = { mobile?: boolean; email?: string; onClose?: () => void };

export function Sidebar({ mobile = false, email = '', onClose }: SidebarProps) {
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);

  async function logout() {
    setClosing(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.replace('/login');
    }
  }

  return (
    <aside className={`${mobile ? 'fixed inset-y-0 left-0 z-50 flex' : 'fixed inset-y-0 left-0 hidden lg:flex'} w-72 flex-col border-r border-blue-900/20 bg-[#082b5b] px-4 py-5 text-white shadow-xl`}>
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-black text-[#082b5b] shadow-sm">CRM</div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-wide">CLIENTE</p>
          <p className="text-xs font-medium text-blue-200">CRM comercial</p>
        </div>
        {mobile && <button onClick={onClose} aria-label="Cerrar menú" className="ml-auto rounded-lg p-2 text-blue-100 hover:bg-white/10"><X size={20} /></button>}
      </div>

      <div className="my-6 h-px bg-white/10" />
      <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">Gestión</p>
      <nav className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={label} href={href} onClick={onClose} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-white text-[#082b5b] shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} />{label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="truncate text-xs font-medium text-blue-200">{email || 'Sesión segura'}</p>
        <button onClick={logout} disabled={closing} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
          <LogOut size={17} /> {closing ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  );
}
