export function ScoreBadge({
  value,
  large = false,
}: {
  value: number | null;
  large?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-slate-400">Sin calcular</span>;
  }

  return (
    <div>
      <strong className={large ? 'text-4xl text-slate-950' : 'text-lg text-slate-950'}>
        {Math.round(value)}%
      </strong>
      <div
        className={`mt-2 overflow-hidden rounded-full bg-slate-100 ${
          large ? 'h-2.5' : 'h-1.5 w-24'
        }`}
      >
        <div
          className="h-full rounded-full bg-slate-800"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
