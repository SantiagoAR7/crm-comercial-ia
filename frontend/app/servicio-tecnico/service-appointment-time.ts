export const defaultVisitMinutes = 60;
export const maxVisitMinutes = 480;

export function shiftAppointment(appointment: string, minutes: number) {
  return new Date(Date.parse(appointment + ':00Z') + minutes * 60000).toISOString().slice(0, 16);
}

export function minutesForVisit(value?: number | string | null) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 && minutes <= maxVisitMinutes ? minutes : defaultVisitMinutes;
}

export function visitEnd(appointment: string, minutes?: number | string | null) {
  return shiftAppointment(appointment, minutesForVisit(minutes));
}

export function visitOverlaps(start: string, end: string, otherStart: string, otherMinutes?: number | string | null) {
  return otherStart < end && start < visitEnd(otherStart, otherMinutes);
}

export function weekStart(day: string) {
  const weekday = new Date(day + 'T00:00:00Z').getUTCDay();
  return shiftAppointment(day + 'T00:00', -((weekday + 6) % 7) * 1440).slice(0, 10);
}

export function datePlus(day: string, days: number) {
  return shiftAppointment(day + 'T00:00', days * 1440).slice(0, 10);
}
