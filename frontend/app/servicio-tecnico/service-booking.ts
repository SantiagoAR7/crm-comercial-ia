import { maxVisitMinutes, shiftAppointment, visitEnd, visitOverlaps } from './service-appointment-time';
import { listOpenVisitsAround } from './service-store';
import { assignedTechnician } from './technician-accounts';

const runtime = globalThis as typeof globalThis & { serviceBookingQueue?: Map<string, Promise<void>> };
const queues = runtime.serviceBookingQueue ??= new Map();

function technicianKey(name: string) {
  return (assignedTechnician(name) || name).trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function bookVisit(id: string, technician: string, appointment: string, duration: number, save: () => Promise<boolean>) {
  const key = technicianKey(technician);
  const previous = queues.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => current);
  queues.set(key, tail);
  try {
    await previous;
    const end = visitEnd(appointment, duration);
    const earliest = shiftAppointment(appointment, -maxVisitMinutes);
    let offset = 0;
    for (;;) {
      const visits = await listOpenVisitsAround(id, earliest, end, offset);
      const busy = visits.find(visit => technicianKey(visit.technicianId || visit.technician) === key
        && visitOverlaps(appointment, end, visit.appointment, visit.plannedMinutes));
      if (busy) return { saved: false, conflict: busy.id };
      if (visits.length < 100) break;
      offset += visits.length;
    }
    return { saved: await save() };
  } finally {
    release();
    if (queues.get(key) === tail) queues.delete(key);
  }
}
