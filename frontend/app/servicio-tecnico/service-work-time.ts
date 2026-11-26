export const maxWorkedMinutes = 9999;

export function elapsedWorkMinutes(startedAt: string | undefined, end = Date.now()) {
  if (!startedAt) return null;
  const elapsed = end - Date.parse(startedAt);
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.max(1, Math.round(elapsed / 60000)) : null;
}

export function formatWorkTime(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short',
  });
}
