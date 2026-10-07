export function StatusBadge({
  status,
  excluded = false,
}: {
  status: string;
  excluded?: boolean;
}) {
  if (excluded) {
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
        EXCLUIDA
      </span>
    );
  }

  const classes =
    status === 'ACTIVA'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'INACTIVA'
        ? 'bg-amber-100 text-amber-700'
        : status === 'BAJA'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>
      {status || 'DESCONOCIDA'}
    </span>
  );
}
