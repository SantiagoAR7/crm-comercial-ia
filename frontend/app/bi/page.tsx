'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  DatabaseZap,
  LogOut,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';

type MetricFormat = 'currency' | 'number' | 'percent';
type ModuleMetric = { label: string; value: number; format: MetricFormat };
type BiModule = { id: string; label: string; status: string; detail: string; metrics: ModuleMetric[] };
type Overview = {
  generatedAt: string;
  source: string;
  year: number;
  month: number | null;
  connection?: { serverName?: string; databaseName?: string; serverDate?: string };
  cards: {
    revenue: number;
    revenueVat: number;
    revenueTotal: number;
    previousRevenue: number;
    previousRevenueVat: number;
    previousRevenueTotal: number;
    variation: number;
    invoices: number;
    customers: number;
    quotes: number;
    pipeline: number;
    pipelineVat: number;
    workOrders: number;
    technicians: number;
    stockReferences: number;
    stockAlerts: number;
  };
  modules: BiModule[];
  charts: {
    monthlyRevenue: Array<{ year: number; month: number; taxableRevenue: number; vatRevenue: number; totalRevenue: number; invoices: number; customers: number }>;
    monthlyQuotes: Array<{ year: number; month: number; quotedAmount: number; quotes: number }>;
  };
  tables: {
    topCustomers: Array<{ customerCode: string; customerName: string; taxableRevenue: number; vatAmount: number; totalRevenue: number; invoices: number }>;
    pendingReceivables: Array<{ invoiceId: string; customerName: string; dueDate: string; pendingNet: number; pendingVat: number; pendingTotal: number; overdueDays: number }>;
    technicians: Array<{ technicianCode: string; technicianName: string; workOrders: number; customers: number }>;
    recentWorkOrders: Array<{ workOrderId: string; requestDate: string; businessName: string; technicianName: string; type: string; ageDays: number }>;
    stockAlerts: Array<{ itemCode: string; description: string; warehouse: string; stock: number; reorderPoint: number; alertType: string }>;
    topParts: Array<{ itemCode: string; description: string; uses: number; quantity: number; amount: number; vatAmount: number; totalAmount: number }>;
  };
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, index) => currentYear - index);
const months = [
  { value: '', label: 'Todo el año' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const emptyOverview: Overview = {
  generatedAt: '',
  source: '',
  year: currentYear,
  month: null,
  cards: {
    revenue: 0,
    revenueVat: 0,
    revenueTotal: 0,
    previousRevenue: 0,
    previousRevenueVat: 0,
    previousRevenueTotal: 0,
    variation: 0,
    invoices: 0,
    customers: 0,
    quotes: 0,
    pipeline: 0,
    pipelineVat: 0,
    workOrders: 0,
    technicians: 0,
    stockReferences: 0,
    stockAlerts: 0,
  },
  modules: [],
  charts: { monthlyRevenue: [], monthlyQuotes: [] },
  tables: {
    topCustomers: [],
    pendingReceivables: [],
    technicians: [],
    recentWorkOrders: [],
    stockAlerts: [],
    topParts: [],
  },
};

function formatValue(value: number, format: MetricFormat = 'number') {
  if (format === 'currency') {
    return Number(value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }
  if (format === 'percent') {
    return `${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;
  }
  return Number(value || 0).toLocaleString('es-ES');
}

function formatDate(value?: string) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-ES');
}

function StatCard({ label, value, detail, icon, format = 'number', tone = 'slate' }: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  format?: MetricFormat;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <div className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{formatValue(value, format)}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function ModulePanel({ module }: { module: BiModule }) {
  const icons: Record<string, ReactNode> = {
    financiero: <CircleDollarSign size={18} />,
    comercial: <TrendingUp size={18} />,
    operaciones: <Wrench size={18} />,
    almacen: <PackageSearch size={18} />,
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icons[module.id] || <BarChart3 size={18} />}</div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{module.status}</span>
      </div>
      <h2 className="text-lg font-bold">{module.label}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{module.detail}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {module.metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg bg-slate-50 p-3">
            <p className="truncate text-xs font-semibold text-slate-500">{metric.label}</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-950">{formatValue(metric.value, metric.format)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function TrendBlock({ rows }: { rows: Overview['charts']['monthlyRevenue'] }) {
  const max = Math.max(...rows.map((row) => row.taxableRevenue), 1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Facturación mensual s/IVA</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">Sin datos.</p>}
        {rows.map((row) => (
          <div key={`${row.year}-${row.month}`} className="grid grid-cols-[3rem_1fr_7rem] items-center gap-3 text-sm">
            <span className="font-semibold text-slate-500">{row.month}/{String(row.year).slice(-2)}</span>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.max((row.taxableRevenue / max) * 100, 4)}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-700">
              {formatValue(row.taxableRevenue, 'currency')}
              <span className="block text-xs font-medium text-slate-500">IVA {formatValue(row.vatRevenue, 'currency')}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TableBlock({ title, rows, columns }: {
  title: string;
  rows: Array<Record<string, string | number | undefined>>;
  columns: Array<{ key: string; label: string; format?: MetricFormat | 'date' }>;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-5 py-3">{column.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-4 text-slate-500">Sin datos.</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index} className="text-slate-700">
                {columns.map((column) => {
                  const value = row[column.key];
                  const display = column.format === 'date'
                    ? formatDate(String(value || ''))
                    : column.format
                      ? formatValue(Number(value || 0), column.format)
                      : String(value ?? 'Sin dato');
                  return <td key={column.key} className="max-w-80 truncate px-5 py-3">{display}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BiPage() {
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const query = new URLSearchParams({ year });
      if (month) query.set('month', month);

      const [sessionResponse, overviewResponse] = await Promise.all([
        fetch('/api/bi/auth/session', { credentials: 'same-origin', cache: 'no-store' }),
        fetch(`/api/bi/overview?${query.toString()}`, { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      const sessionBody = await sessionResponse.json();
      const overviewBody = await overviewResponse.json();

      if (!sessionResponse.ok) throw new Error(sessionBody.error || 'Sesión BI no válida.');
      if (!overviewResponse.ok) throw new Error(overviewBody.detail || overviewBody.error || 'No se pudo cargar el panel BI.');

      setUsername(sessionBody?.data?.username || '');
      setOverview(overviewBody.data || emptyOverview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function logout() {
    await fetch('/api/bi/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/bi-login');
  }

  const cards = useMemo(() => [
    { label: 'Facturación s/IVA', value: overview.cards.revenue, detail: `IVA ${formatValue(overview.cards.revenueVat, 'currency')} · ${formatValue(overview.cards.variation, 'percent')} vs año anterior`, icon: <CircleDollarSign size={18} />, format: 'currency' as MetricFormat, tone: 'emerald' as const },
    { label: 'Facturas', value: overview.cards.invoices, detail: `${formatValue(overview.cards.customers)} clientes`, icon: <ReceiptText size={18} />, tone: 'sky' as const },
    { label: 'Pipeline s/IVA', value: overview.cards.pipeline, detail: `IVA ${formatValue(overview.cards.pipelineVat, 'currency')} · ${formatValue(overview.cards.quotes)} presupuestos`, icon: <TrendingUp size={18} />, format: 'currency' as MetricFormat, tone: 'amber' as const },
    { label: 'Órdenes', value: overview.cards.workOrders, detail: `${formatValue(overview.cards.technicians)} técnicos activos`, icon: <Wrench size={18} />, tone: 'slate' as const },
    { label: 'Referencias', value: overview.cards.stockReferences, detail: 'Artículos en almacén', icon: <PackageSearch size={18} />, tone: 'sky' as const },
    { label: 'Alertas stock', value: overview.cards.stockAlerts, detail: 'Sin stock o bajo mínimo', icon: <Activity size={18} />, tone: 'rose' as const },
  ], [overview]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-950">BI</div>
            <div>
              <p className="text-base font-extrabold tracking-wide">CLIENTE BI</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Expertis SQL Server</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 sm:inline-flex">{username || 'Sesión BI'}</span>
            <button onClick={loadOverview} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Vista ejecutiva</p>
            <h1 className="mt-1 text-3xl font-bold">Business Intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Panel separado del CRM de campañas con datos directos de Expertis: financiero, comercial, operaciones, instalaciones y almacén.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <CalendarDays size={16} />
              <select value={year} onChange={(event) => setYear(event.target.value)} className="bg-transparent outline-none">
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <select value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none">
              {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {message}
          </div>
        )}

        <section className="mb-5 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Fuente: <span className="font-semibold text-slate-800">{overview.source || 'sin cargar'}</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Servidor: <span className="font-semibold text-slate-800">{overview.connection?.serverName || 'sin conexión'}</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Base: <span className="font-semibold text-slate-800">{overview.connection?.databaseName || 'sin cargar'}</span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => <StatCard key={card.label} {...card} />)}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          {overview.modules.map((module) => <ModulePanel key={module.id} module={module} />)}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <TrendBlock rows={overview.charts.monthlyRevenue} />
          <TableBlock
            title="Top clientes"
            rows={overview.tables.topCustomers}
            columns={[
              { key: 'customerName', label: 'Cliente' },
              { key: 'taxableRevenue', label: 'Facturado s/IVA', format: 'currency' },
              { key: 'vatAmount', label: 'IVA', format: 'currency' },
              { key: 'invoices', label: 'Facturas', format: 'number' },
            ]}
          />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <TableBlock
            title="Cobros pendientes"
            rows={overview.tables.pendingReceivables}
            columns={[
              { key: 'customerName', label: 'Cliente' },
              { key: 'dueDate', label: 'Vence', format: 'date' },
              { key: 'pendingNet', label: 'Importe s/IVA', format: 'currency' },
              { key: 'pendingVat', label: 'IVA', format: 'currency' },
              { key: 'overdueDays', label: 'Días', format: 'number' },
            ]}
          />
          <TableBlock
            title="Técnicos"
            rows={overview.tables.technicians}
            columns={[
              { key: 'technicianName', label: 'Técnico' },
              { key: 'workOrders', label: 'Órdenes', format: 'number' },
              { key: 'customers', label: 'Clientes', format: 'number' },
            ]}
          />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <TableBlock
            title="Órdenes recientes"
            rows={overview.tables.recentWorkOrders}
            columns={[
              { key: 'businessName', label: 'Cliente' },
              { key: 'technicianName', label: 'Técnico' },
              { key: 'type', label: 'Tipo' },
              { key: 'requestDate', label: 'Fecha', format: 'date' },
            ]}
          />
          <TableBlock
            title="Alertas de almacén"
            rows={overview.tables.stockAlerts}
            columns={[
              { key: 'description', label: 'Artículo' },
              { key: 'warehouse', label: 'Almacén' },
              { key: 'stock', label: 'Stock', format: 'number' },
              { key: 'alertType', label: 'Alerta' },
            ]}
          />
        </section>

        <section className="mt-6">
          <TableBlock
            title="Repuestos con más consumo"
            rows={overview.tables.topParts}
            columns={[
              { key: 'description', label: 'Artículo' },
              { key: 'uses', label: 'Usos', format: 'number' },
              { key: 'quantity', label: 'Cantidad', format: 'number' },
              { key: 'amount', label: 'Importe s/IVA', format: 'currency' },
              { key: 'vatAmount', label: 'IVA', format: 'currency' },
            ]}
          />
        </section>
      </main>
    </div>
  );
}
