'use client';

import { useEffect, useState } from 'react';
import { elapsedWorkMinutes, maxWorkedMinutes } from './service-work-time';

export default function ServiceWorkMinutes({ startedAt, initial }: { startedAt?: string; initial: number | null }) {
  const automatic = Boolean(startedAt && initial && initial <= maxWorkedMinutes);
  const [value, setValue] = useState(automatic ? String(initial) : '');
  const [manual, setManual] = useState(!automatic);

  useEffect(() => {
    if (manual || !startedAt) return;
    const update = () => {
      const elapsed = elapsedWorkMinutes(startedAt);
      if (elapsed !== null && elapsed <= maxWorkedMinutes) setValue(String(elapsed));
    };
    update();
    const interval = window.setInterval(update, 15000);
    return () => window.clearInterval(interval);
  }, [manual, startedAt]);

  return <div className="space-y-1">
    <input type="hidden" name="minutesMode" value={manual ? 'manual' : 'elapsed'} />
    <label className="block space-y-1 text-sm font-semibold">Minutos trabajados
      <input name="minutes" type="number" min={1} max={maxWorkedMinutes} value={value} required
        onChange={event => { setManual(true); setValue(event.target.value); }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
    </label>
    {automatic && <p className="text-sm text-slate-600">
      {manual ? 'Se guardarán los minutos que indiques.' : 'Se calcularán desde el inicio hasta el cierre. Puedes corregirlos si hubo pausas.'}
    </p>}
  </div>;
}
