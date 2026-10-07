'use client';

import { FormEvent, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo iniciar sesión.');
      window.location.replace('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef4fb] p-5">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-red-100/70 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-3xl border border-white bg-white/95 p-8 shadow-2xl shadow-blue-950/10 sm:p-10">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#082b5b] text-sm font-black tracking-wide text-white shadow-md">CRM</div>
          <div><p className="text-xl font-extrabold tracking-wide text-[#082b5b]">CLIENTE</p><p className="text-sm font-medium text-slate-500">CRM comercial</p></div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-blue-800"><LockKeyhole size={13} />Acceso privado</div>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">Bienvenido</h1>
        <p className="mt-2 text-sm text-slate-500">Identifícate para acceder a los datos y campañas.</p>

        <label className="mt-7 block text-sm font-semibold text-slate-700">
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
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
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        {message && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</div>}

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-[#082b5b] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#0b3975] disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Comprobando…' : 'Iniciar sesión'}
        </button>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck size={14} />Acceso protegido y datos privados</p>
      </form>
    </div>
  );
}
