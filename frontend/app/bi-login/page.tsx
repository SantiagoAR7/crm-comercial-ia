'use client';

import { FormEvent, useState } from 'react';
import { BarChart3, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function BiLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/bi/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo iniciar sesión BI.');
      window.location.replace('/bi');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión BI.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-950 text-white lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex min-h-[42vh] flex-col justify-between bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.28),transparent_32%),linear-gradient(135deg,#061529,#0f233f_58%,#121826)] p-8 sm:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">BI</div>
          <div>
            <p className="text-lg font-extrabold tracking-wide">CLIENTE</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Business Intelligence</p>
          </div>
        </div>

        <div className="max-w-2xl py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
            <BarChart3 size={14} />
            Acceso BI
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-normal sm:text-5xl">Panel directivo separado del CRM operativo</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Métricas, seguimiento y lectura ejecutiva en la misma dirección, con credenciales propias y sin exponer el sistema original.
          </p>
        </div>

        <p className="text-xs text-slate-400">Sesión independiente de campañas y automatizaciones.</p>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-5 text-slate-950">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-950/10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-slate-700">
            <LockKeyhole size={13} />
            Credencial BI
          </div>
          <h2 className="mt-4 text-3xl font-bold">Entrar al BI</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Usa el usuario específico del panel BI. El usuario del CRM no abre esta interfaz.</p>

          <label className="mt-7 block text-sm font-semibold text-slate-700">
            Usuario
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          {message && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</div>}

          <button disabled={loading} className="mt-6 w-full rounded-lg bg-slate-950 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Comprobando...' : 'Entrar'}
          </button>
          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck size={14} />Acceso aislado y protegido</p>
        </form>
      </section>
    </div>
  );
}
