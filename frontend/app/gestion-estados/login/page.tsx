import RecoveryLinks from '../../../components/recovery-links';
import Link from 'next/link';
import { login } from '../actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
    <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <Link href="/" className="text-sm font-semibold text-blue-800">← Portal corporativo</Link>
      <h1 className="my-6 text-2xl font-bold text-slate-950">Gestión de estados y automatizaciones</h1>
      <form action={login} className="grid gap-4 text-slate-900">
        <label>Usuario<input name="username" autoComplete="username" required className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label>Contraseña<input name="password" autoComplete="current-password" type="password" required className="mt-1 block w-full rounded-lg border p-2" /></label>
        {error && <p role="alert" className="text-red-700">Usuario o contraseña incorrectos.</p>}
        <RecoveryLinks profile="workflow"/>
        <button className="rounded-xl bg-blue-900 p-3 font-bold text-white">Entrar al módulo</button>
      </form>
    </section>
  </main>;
}
