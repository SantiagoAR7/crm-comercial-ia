begin;

create table public.service_notices (
  id uuid primary key,
  stage smallint not null default 0 check (stage between 0 and 3),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now()
);

create index service_notices_recent_idx on public.service_notices (created_at desc, id desc);

create table public.service_notice_history (
  notice_id uuid not null references public.service_notices(id) on delete cascade,
  stage smallint not null check (stage between 0 and 3),
  changed_at timestamptz not null default now(),
  primary key (notice_id, stage)
);

alter table public.service_notices enable row level security;
alter table public.service_notice_history enable row level security;

revoke all on public.service_notices, public.service_notice_history from public, anon, authenticated;
grant select, insert, update on public.service_notices to service_role;
grant select, insert on public.service_notice_history to service_role;

create function public.record_service_notice_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.stage <> 0 then
      raise exception 'An initial notice must be in stage 0';
    end if;
  elsif new.stage <> old.stage + 1 then
    raise exception 'A notice can only advance one stage';
  end if;

  insert into public.service_notice_history (notice_id, stage) values (new.id, new.stage);
  return new;
end;
$$;

revoke all on function public.record_service_notice_stage() from public, anon, authenticated;

create trigger service_notice_stage_changed
after insert or update of stage on public.service_notices
for each row execute function public.record_service_notice_stage();

commit;
