import { redirect } from 'next/navigation';
import { logoutService } from '../../gestion-estados/actions';
import { getServiceAccess } from '../service-access';
import { madridDate } from '../service-refrigerant';
import { technicianDayName } from '../service-technician-day';
import { registerToday } from './actions';

export default async function TechnicianDayPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const access = await getServiceAccess();
  if (!access) redirect('/servicio-tecnico/login');
  if (access.role !== 'technician') redirect('/servicio-tecnico?vista=tecnicos');
  const position = access.account.technicianId;
  if (await technicianDayName(position, madridDate())) redirect('/servicio-tecnico?vista=ordenes');
  const { error } = await searchParams;

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4 text-slate-950">
    <section className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <p className="font-bold text-blue-900">{position}</p>
      <h1 className="text-2xl font-bold">Hola, por favor ingresa tu nombre</h1>
      <p className="text-sm text-slate-600">Administración verá quién está usando este puesto hoy. Solo te lo pediremos una vez por jornada.</p>
      <form action={registerToday} className="space-y-4">
        <label className="block font-semibold">Nombre y apellidos
          <input name="displayName" autoComplete="name" required minLength={2} maxLength={120}
            className="mt-1 block w-full rounded-lg border p-3 font-normal" />
        </label>
        {error && <p role="alert">{error === 'nombre' ? 'Ingresa un nombre válido.' : 'No se pudo guardar el nombre. Vuelve a intentarlo.'}</p>}
        <button className="w-full rounded-lg bg-blue-950 px-4 py-3 font-semibold text-white">Continuar a mis órdenes</button>
      </form>
      <form action={logoutService}><button className="text-sm underline">Cerrar sesión</button></form>
    </section>
  </main>;
}
