create index service_notices_equipment_recent_idx
  on public.service_notices ((record ->> 'equipmentId'), created_at desc, id desc)
  where record ->> 'equipmentId' is not null;
