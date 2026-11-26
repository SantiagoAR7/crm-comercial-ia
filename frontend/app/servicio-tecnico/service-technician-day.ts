import { query } from './service-store';

export async function technicianDayName(technicianId: string, workDay: string) {
  const [row] = await query<{ display_name: string }>('service_technician_days', {
    select: 'display_name', technician_id: 'eq.' + technicianId, work_day: 'eq.' + workDay, limit: '1',
  });
  return row?.display_name;
}

export async function registerTechnicianDay(technicianId: string, workDay: string, displayName: string) {
  await query('service_technician_days', { on_conflict: 'technician_id,work_day' }, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ technician_id: technicianId, work_day: workDay, display_name: displayName }),
  });
}
