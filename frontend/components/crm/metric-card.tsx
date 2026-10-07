import { ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-semibold">{label}</span>
        {icon}
      </div>
      <strong className="mt-3 block text-2xl text-slate-950">{value}</strong>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </article>
  );
}
