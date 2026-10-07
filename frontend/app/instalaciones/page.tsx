'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { MetricCard } from '../../components/crm/metric-card';
import { ScoreBadge } from '../../components/crm/score-badge';
import { SectionCard } from '../../components/crm/section-card';
import { StatusBadge } from '../../components/crm/status-badge';

type Installation = {
  id: string;
  id_activo: string | null;
  id_cliente: string | null;
  customer_name: string | null;
  contact_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  population: string | null;
  province: string | null;
  brand: string | null;
  model: string | null;
  equipment_type: string | null;
  serial_number: string | null;
  installation_date: string | null;
  installation_status: string;
  last_service_date: string | null;
  last_intervention_date: string | null;
  warranty_until: string | null;
  excluded_from_campaigns: boolean;
  exclusion_reason: string | null;
  crm_tags: string[];
  crm_notes?: string | null;
  renewal_score: number | null;
  active: boolean;
  updated_at: string;
};

type Filters = {
  search: string;
  brand: string;
  province: string;
  equipmentType: string;
  status: string;
  excluded: string;
};

type FilterOptions = {
  brands: string[];
  provinces: string[];
  equipmentTypes: string[];
  statuses: string[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

const initialFilters: Filters = {
  search: '',
  brand: '',
  province: '',
  equipmentType: '',
  status: '',
  excluded: '',
};

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selected, setSelected] = useState<Installation | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [options, setOptions] = useState<FilterOptions>({
    brands: [],
    provinces: [],
    equipmentTypes: [],
    statuses: [],
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    excluded: 0,
    withoutPhone: 0,
    highRenewal: 0,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    params.set('page', String(pagination.page));
    params.set('pageSize', String(pagination.pageSize));

    return params.toString();
  }, [filters, pagination.page, pagination.pageSize]);

  const loadInstallations = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/installations?${queryString}`, {
        cache: 'no-store',
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.detail || 'No se pudieron cargar las instalaciones.');
      }

      setInstallations(body.data || []);
      setPagination((current) => ({
        ...current,
        ...body.pagination,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadOptions = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/installations/filters`, {
        cache: 'no-store',
      });
      const body = await response.json();

      if (response.ok) {
        setOptions(body.data);
      }
    } catch {
      // El listado puede seguir funcionando aunque los filtros no carguen.
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/installations/summary`, { cache: 'no-store' });
      const body = await response.json();
      if (body?.data) setSummary(body.data);
    } catch {
      // Las métricas no deben bloquear el listado.
    }
  }, []);

  useEffect(() => {
    loadInstallations();
  }, [loadInstallations]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function openInstallation(id: string) {
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/installations/${id}`, {
        cache: 'no-store',
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'No se pudo abrir la instalación.');
      }

      setSelected(body.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Núcleo CRM</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950">Instalaciones</h2>
          <p className="mt-2 text-sm text-slate-500">
            Equipos, clientes asociados y trazabilidad comercial.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadInstallations}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Actualizar vista
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Instalaciones"
          value={summary.total.toLocaleString('es-ES')}
          description="Total sincronizado"
          icon={<Building2 size={18} />}
        />
        <MetricCard
          label="Activas"
          value={summary.active.toLocaleString('es-ES')}
          description="Disponibles en CRM"
          icon={<ShieldCheck size={18} />}
        />
        <MetricCard
          label="Excluidas"
          value={summary.excluded.toLocaleString('es-ES')}
          description="Fuera de campañas"
          icon={<Ban size={18} />}
        />
        <MetricCard
          label="Sin teléfono"
          value={summary.withoutPhone.toLocaleString('es-ES')}
          description="Requieren revisión"
          icon={<Phone size={18} />}
        />
        <MetricCard
          label="Renovación alta"
          value={summary.highRenewal.toLocaleString('es-ES')}
          description="Índice ≥ 75%"
          icon={<RefreshCw size={18} />}
        />
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-slate-500" />
          <h3 className="font-bold text-slate-900">Filtros</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-3 text-slate-400"
            />
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Cliente, activo, teléfono, marca..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-700"
            />
          </label>

          <FilterSelect
            value={filters.brand}
            onChange={(value) => updateFilter('brand', value)}
            placeholder="Todas las marcas"
            options={options.brands}
          />

          <FilterSelect
            value={filters.province}
            onChange={(value) => updateFilter('province', value)}
            placeholder="Todas las provincias"
            options={options.provinces}
          />

          <FilterSelect
            value={filters.equipmentType}
            onChange={(value) => updateFilter('equipmentType', value)}
            placeholder="Todos los equipos"
            options={options.equipmentTypes}
          />

          <FilterSelect
            value={filters.status}
            onChange={(value) => updateFilter('status', value)}
            placeholder="Todos los estados"
            options={options.statuses}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => updateFilter('excluded', filters.excluded === 'true' ? '' : 'true')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filters.excluded === 'true'
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Excluidas de campañas
          </button>

          <button
            onClick={() => {
              setFilters(initialFilters);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-950">
              {pagination.total.toLocaleString('es-ES')} instalaciones
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Ordenadas por índice de renovación y cliente.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            Página {pagination.page} de {pagination.totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Instalación</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Equipo</th>
                <th className="px-5 py-3">Ubicación</th>
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Renovación</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {installations.map((installation) => (
                <tr
                  key={installation.id}
                  onClick={() => openInstallation(installation.id)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2">
                        <Building2 size={18} className="text-slate-600" />
                      </div>
                      <div>
                        <strong className="block text-slate-950">
                          {installation.id_activo || 'Sin ID activo'}
                        </strong>
                        <span className="text-xs text-slate-500">
                          Cliente {installation.id_cliente || '—'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <strong className="block text-slate-900">
                      {installation.customer_name || 'Sin cliente'}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {installation.contact_name || 'Sin contacto'}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    <strong className="block font-semibold text-slate-900">
                      {[installation.brand, installation.model].filter(Boolean).join(' · ') || '—'}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {installation.equipment_type || 'Tipo no informado'}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    {[installation.population, installation.province]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    <span className="block">{installation.normalized_phone || '—'}</span>
                    <span className="block max-w-[220px] truncate text-xs text-slate-500">
                      {installation.normalized_email || '—'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={installation.installation_status} excluded={installation.excluded_from_campaigns} />
                  </td>

                  <td className="px-5 py-4">
                    <ScoreBadge value={installation.renewal_score} />
                  </td>
                </tr>
              ))}

              {!loading && installations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                    No hay instalaciones que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <button
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page: Math.max(current.page - 1, 1),
              }))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            <ChevronLeft size={17} />
            Anterior
          </button>

          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page: Math.min(current.page + 1, current.totalPages),
              }))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Siguiente
            <ChevronRight size={17} />
          </button>
        </div>
      </section>

      {selected && (
        <>
          <button
            aria-label="Cerrar ficha"
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-20 cursor-default bg-black/25"
          />

          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Instalación {selected.id_activo || 'sin identificar'}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.customer_name || 'Sin cliente'}
                </h3>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <SectionCard title="Equipo" icon={<Wrench size={18} />}>
                <DetailGrid
                  rows={[
                    ['Marca', selected.brand],
                    ['Modelo', selected.model],
                    ['Tipo', selected.equipment_type],
                    ['N.º de serie', selected.serial_number],
                    ['Fecha instalación', formatDate(selected.installation_date)],
                    ['Estado', selected.installation_status],
                  ]}
                />
              </SectionCard>

              <SectionCard title="Cliente y contacto" icon={<Building2 size={18} />}>
                <div className="space-y-3 text-sm">
                  <InfoLine icon={<Building2 size={16} />} text={selected.customer_name} />
                  <InfoLine
                    icon={<MapPin size={16} />}
                    text={[selected.population, selected.province].filter(Boolean).join(', ')}
                  />
                  <InfoLine icon={<Phone size={16} />} text={selected.normalized_phone} />
                  <InfoLine icon={<Mail size={16} />} text={selected.normalized_email} />
                </div>
              </SectionCard>

              <SectionCard title="Servicio y garantía" icon={<ShieldCheck size={18} />}>
                <DetailGrid
                  rows={[
                    ['Último mantenimiento', formatDate(selected.last_service_date)],
                    ['Última intervención', formatDate(selected.last_intervention_date)],
                    ['Garantía hasta', formatDate(selected.warranty_until)],
                    [
                      'Campañas',
                      selected.excluded_from_campaigns
                        ? `Excluida${selected.exclusion_reason ? `: ${selected.exclusion_reason}` : ''}`
                        : 'Disponible',
                    ],
                  ]}
                />
              </SectionCard>

              <SectionCard title="Potencial comercial" icon={<RefreshCw size={18} />}>
                <ScoreBadge value={selected.renewal_score} large />
                <p className="mt-3 text-sm text-slate-500">
                  El índice se calculará con antigüedad, intervenciones, averías y comportamiento comercial.
                </p>
              </SectionCard>

              {selected.excluded_from_campaigns && (
                <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <Ban size={19} className="mt-0.5 shrink-0" />
                  <div>
                    <strong className="block">Excluida de campañas</strong>
                    <span>{selected.exclusion_reason || 'Sin motivo registrado.'}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function DetailGrid({
  rows,
}: {
  rows: Array<[string, string | null | undefined]>;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {label}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function InfoLine({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3 text-slate-700">
      <span className="text-slate-400">{icon}</span>
      <span>{text || '—'}</span>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T00:00:00`));
}
