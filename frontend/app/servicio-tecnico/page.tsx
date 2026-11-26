import { madridDate } from './service-refrigerant';
import { technicianDayName } from './service-technician-day';
import { ServiceBillingQueue } from './service-billing-view';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutService } from '../gestion-estados/actions';
import { getServiceAccess } from './service-access';
import ServiceNotices from './service-notices';
import ServiceEquipmentView from './service-equipment-view';
import ServiceReport from './service-report';
import PendingServiceDeliveries from './service-delivery-pending';
import ServiceDelivery from './service-delivery';
import ServiceRefrigerantRegister from './service-refrigerant-register';
import ServiceSchedule from './service-schedule';
import ServiceContracts from './service-contracts';
import ServiceTechnicians from './service-technicians';
import ServicePreventiveView from './service-preventive-view';

const navigation = [
  { view: 'avisos', label: 'Avisos', href: '/servicio-tecnico' },
  { view: 'facturacion', label: 'Por facturar', href: '/servicio-tecnico?vista=facturacion' },
  { view: 'partes-pendientes', label: 'Partes pendientes', href: '/servicio-tecnico?vista=partes-pendientes' },
  { view: 'equipos', label: 'Equipos', href: '/servicio-tecnico?vista=equipos' },
  { view: 'agenda', label: 'Agenda', href: '/servicio-tecnico?vista=agenda' },
  { view: 'ordenes', label: 'Órdenes de hoy', href: '/servicio-tecnico?vista=ordenes' },
  { view: 'tecnicos', label: 'Técnicos', href: '/servicio-tecnico?vista=tecnicos' },
  { view: 'preventivos', label: 'Preventivos', href: '/servicio-tecnico?vista=preventivos' },
  { view: 'refrigerantes', label: 'Refrigerantes', href: '/servicio-tecnico?vista=refrigerantes' },
  { view: 'contratos', label: 'Contratos de mantenimiento', href: '/servicio-tecnico?vista=contratos' },
] as const;

type Params = Record<string, string | undefined>;

export default async function TechnicalServicePage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await getServiceAccess();
  if (!access) redirect('/servicio-tecnico/login');
  const technician = access.role === 'technician' ? access.account.technicianId : undefined;
  const dayName = technician ? await technicianDayName(technician, madridDate()) : undefined;
  if (technician && !dayName) redirect('/servicio-tecnico/jornada');
  const params = await searchParams;
  if (params.vista === 'parte' || params.vista === 'certificado') {
    return <ServiceReport id={params.aviso} technician={technician} certificate={params.vista === 'certificado'} />;
  }
  const active = technician ? 'ordenes' : navigation.find(item => item.view === params.vista)?.view || 'avisos';
  const links = technician ? navigation.filter(item => item.view === 'ordenes') : navigation;
  return <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside className="bg-[#082b5b] p-5 text-white lg:sticky lg:top-0 lg:h-screen">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/icon.png" alt="" width={40} height={40} className="rounded-lg bg-white" />
        <span className="font-bold">DAVOFRÍO</span>
      </Link>
      <nav aria-label="Servicio técnico" className="mt-6 flex flex-wrap gap-1 border-t border-white/20 pt-4 lg:block lg:space-y-1">
        {links.map(item => <Link key={item.view} href={item.href} aria-current={item.view === active ? 'page' : undefined}
          className={`block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 ${item.view === active ? 'bg-white/15' : ''}`}>
          {item.label}
        </Link>)}
      </nav>
    </aside>
    <main className="min-w-0 p-5 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-blue-950 p-6 text-white">
          <div><Link href="/" className="text-sm text-blue-200">← Portal corporativo</Link>
            <h1 className="mt-2 text-2xl font-bold">Servicio técnico</h1>{technician && <p>{technician} · {dayName}</p>}</div>
          <form action={logoutService}><button className="rounded-lg border border-white/30 px-4 py-2">Cerrar sesión</button></form>
        </header>
        {access.role === 'admin' && params.vista === 'entrega' ? <ServiceDelivery id={params.aviso} kind={params.tipo} result={params.resultado} />
          : technician && params.aviso ? <ServiceNotices noticeId={params.aviso} create={false} error={params.error} technician={technician} />
          : active === 'facturacion' ? <ServiceBillingQueue page={params.paginaFacturacion} />
          : active === 'partes-pendientes' ? <PendingServiceDeliveries page={params.paginaPartes} />
          : active === 'equipos' ? <ServiceEquipmentView params={params} />
          : active === 'contratos' ? <ServiceContracts params={params} />
          : active === 'tecnicos' ? <ServiceTechnicians selected={params.tecnico} page={params.paginaTecnico} />
          : active === 'preventivos' ? <ServicePreventiveView filter={params.filtro} page={params.paginaPreventivos} />
          : active === 'refrigerantes' ? <ServiceRefrigerantRegister year={params.anio} page={params.paginaRefrigerantes} />
          : active === 'agenda' || active === 'ordenes' ? <ServiceSchedule orders={active === 'ordenes'} date={params.fecha} technician={params.tecnico} technicianId={technician} page={params.paginaAgenda} period={params.periodo} />
          : <ServiceNotices noticeId={params.aviso} create={params.nuevo === '1'} error={params.error} equipmentId={params.equipo}
              search={params.buscarEquipo} historyPage={params.paginaEquipo} rescheduled={params.reprogramada === '1'} conflictId={params.conflicto} deliveryResult={params.resultado} billingResult={params.facturacion} />}
      </div>
    </main>
  </div>;
}
