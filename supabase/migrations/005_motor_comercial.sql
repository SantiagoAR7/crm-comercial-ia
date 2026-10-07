-- 005 - Motor comercial
-- Crea ejecuciones de campaña, cola de llamadas y resultados de IA.

create extension if not exists pgcrypto;

create table if not exists public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,

  status text not null default 'PENDIENTE'
    check (status in (
      'PENDIENTE',
      'ENCOLANDO',
      'EN_COLA',
      'EJECUTANDO',
      'PAUSADA',
      'COMPLETADA',
      'COMPLETADA_CON_ERRORES',
      'CANCELADA',
      'ERROR'
    )),

  total_contacts integer not null default 0,
  queued_contacts integer not null default 0,
  processing_contacts integer not null default 0,
  completed_contacts integer not null default 0,
  failed_contacts integer not null default 0,
  skipped_contacts integer not null default 0,

  batch_size integer not null default 10,
  max_concurrency integer not null default 3,
  max_attempts integer not null default 3,

  n8n_execution_id text,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  last_error text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_runs_campaign_id
  on public.campaign_runs(campaign_id);

create index if not exists idx_campaign_runs_status
  on public.campaign_runs(status);

create table if not exists public.campaign_call_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_contact_id uuid not null references public.campaign_contacts(id) on delete cascade,
  installation_id uuid,

  id_activo text,
  id_cliente text,
  customer_name text,
  contact_name text,
  phone text,
  email text,
  province text,
  brand text,
  model text,

  priority integer not null default 100,
  status text not null default 'PENDIENTE'
    check (status in (
      'PENDIENTE',
      'RESERVADA',
      'LLAMANDO',
      'COMPLETADA',
      'REINTENTO',
      'OMITIDA',
      'ERROR',
      'CANCELADA'
    )),

  attempt_count integer not null default 0,
  max_attempts integer not null default 3,

  scheduled_at timestamptz not null default now(),
  reserved_at timestamptz,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  retell_call_id text,
  result_code text,
  last_error text,

  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (run_id, campaign_contact_id)
);

create index if not exists idx_campaign_call_queue_run_status
  on public.campaign_call_queue(run_id, status);

create index if not exists idx_campaign_call_queue_available
  on public.campaign_call_queue(status, scheduled_at, priority);

create index if not exists idx_campaign_call_queue_retell_call_id
  on public.campaign_call_queue(retell_call_id);

create table if not exists public.campaign_call_results (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null unique references public.campaign_call_queue(id) on delete cascade,
  run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_contact_id uuid not null references public.campaign_contacts(id) on delete cascade,

  retell_call_id text,
  call_status text,
  outcome text,

  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,

  summary text,
  transcript text,
  recording_url text,

  sentiment text,
  interest_level text,
  next_action text,
  callback_at timestamptz,

  opportunity_required boolean not null default false,
  opportunity_id uuid,

  structured_data jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_call_results_run_id
  on public.campaign_call_results(run_id);

create index if not exists idx_campaign_call_results_campaign_id
  on public.campaign_call_results(campaign_id);

create index if not exists idx_campaign_call_results_outcome
  on public.campaign_call_results(outcome);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_runs_updated_at
  on public.campaign_runs;

create trigger trg_campaign_runs_updated_at
before update on public.campaign_runs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_campaign_call_queue_updated_at
  on public.campaign_call_queue;

create trigger trg_campaign_call_queue_updated_at
before update on public.campaign_call_queue
for each row
execute function public.set_updated_at();

drop trigger if exists trg_campaign_call_results_updated_at
  on public.campaign_call_results;

create trigger trg_campaign_call_results_updated_at
before update on public.campaign_call_results
for each row
execute function public.set_updated_at();

create or replace function public.refresh_campaign_run_counters(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campaign_runs r
  set
    total_contacts = q.total_contacts,
    queued_contacts = q.queued_contacts,
    processing_contacts = q.processing_contacts,
    completed_contacts = q.completed_contacts,
    failed_contacts = q.failed_contacts,
    skipped_contacts = q.skipped_contacts
  from (
    select
      run_id,
      count(*)::integer as total_contacts,
      count(*) filter (
        where status in ('PENDIENTE', 'REINTENTO', 'RESERVADA')
      )::integer as queued_contacts,
      count(*) filter (
        where status = 'LLAMANDO'
      )::integer as processing_contacts,
      count(*) filter (
        where status = 'COMPLETADA'
      )::integer as completed_contacts,
      count(*) filter (
        where status = 'ERROR'
      )::integer as failed_contacts,
      count(*) filter (
        where status in ('OMITIDA', 'CANCELADA')
      )::integer as skipped_contacts
    from public.campaign_call_queue
    where run_id = p_run_id
    group by run_id
  ) q
  where r.id = q.run_id;
end;
$$;

create or replace function public.sync_campaign_run_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_campaign_run_counters(
    coalesce(new.run_id, old.run_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_campaign_run_counters
  on public.campaign_call_queue;

create trigger trg_sync_campaign_run_counters
after insert or update of status or delete
on public.campaign_call_queue
for each row
execute function public.sync_campaign_run_counters();

alter table public.campaign_runs enable row level security;
alter table public.campaign_call_queue enable row level security;
alter table public.campaign_call_results enable row level security;

grant all on table public.campaign_runs to service_role;
grant all on table public.campaign_call_queue to service_role;
grant all on table public.campaign_call_results to service_role;

grant execute on function public.refresh_campaign_run_counters(uuid)
  to service_role;

comment on table public.campaign_runs is
  'Ejecuciones operativas de campañas comerciales.';

comment on table public.campaign_call_queue is
  'Cola de instalaciones pendientes de llamada para cada ejecución.';

comment on table public.campaign_call_results is
  'Resultado, transcripción y clasificación IA de cada llamada.';
