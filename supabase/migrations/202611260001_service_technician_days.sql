begin;
create table if not exists public.service_technician_days (
  technician_id text not null,
  work_day date not null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  registered_at timestamptz not null default now(),
  primary key (technician_id, work_day)
);
alter table public.service_technician_days enable row level security;
revoke all on public.service_technician_days from anon, authenticated;
grant select, insert on public.service_technician_days to service_role;
commit;
