-- 007 - Prospeccion IA
-- Crea el modulo SDR para prospectos B2B externos al CRM actual.

create extension if not exists pgcrypto;

create table if not exists public.prospecting_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icp jsonb not null default '{}'::jsonb,
  status text not null default 'BORRADOR'
    check (status in ('BORRADOR', 'INVESTIGANDO', 'REVISION', 'LISTA', 'ARCHIVADA')),
  source text not null default 'MANUAL',
  total_prospects integer not null default 0,
  researched_prospects integer not null default 0,
  approved_prospects integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.prospecting_lists(id) on delete cascade,
  company_name text not null,
  website text,
  linkedin_url text,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  country text,
  city text,
  sector text,
  company_size text,
  source text not null default 'MANUAL',
  status text not null default 'NUEVO'
    check (status in ('NUEVO', 'INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'DESCARTADO', 'CONVERTIDO')),
  fit_score integer check (fit_score is null or (fit_score >= 0 and fit_score <= 100)),
  priority text check (priority is null or priority in ('BAJA', 'MEDIA', 'ALTA')),
  tags text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_research (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique references public.prospects(id) on delete cascade,
  company_summary text,
  pain_hypothesis text,
  buying_signal text,
  personalization_angle text,
  objections jsonb not null default '[]'::jsonb,
  recommended_offer text,
  confidence text not null default 'MEDIA'
    check (confidence in ('BAJA', 'MEDIA', 'ALTA')),
  raw_sources jsonb not null default '[]'::jsonb,
  generated_by text not null default 'MVP_RULES',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null check (channel in ('EMAIL', 'LINKEDIN', 'WHATSAPP', 'LLAMADA')),
  step integer not null default 1,
  subject text,
  body text not null,
  status text not null default 'BORRADOR'
    check (status in ('BORRADOR', 'APROBADO', 'DESCARTADO', 'ENVIADO', 'RESPONDIDO')),
  generated_by text not null default 'MVP_RULES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  type text not null check (type in ('NOTA', 'INVESTIGACION', 'MENSAJE', 'APROBACION', 'DESCARTE', 'CONVERSION')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospects_list_id
  on public.prospects(list_id);

create index if not exists idx_prospects_status
  on public.prospects(status);

create index if not exists idx_prospect_messages_prospect_id
  on public.prospect_messages(prospect_id);

create index if not exists idx_prospect_activities_prospect_id
  on public.prospect_activities(prospect_id);

create or replace function public.refresh_prospecting_list_counters(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prospecting_lists l
  set
    total_prospects = c.total_prospects,
    researched_prospects = c.researched_prospects,
    approved_prospects = c.approved_prospects
  from (
    select
      list_id,
      count(*)::integer as total_prospects,
      count(*) filter (
        where status in ('INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'CONVERTIDO')
      )::integer as researched_prospects,
      count(*) filter (
        where status in ('APROBADO', 'CONVERTIDO')
      )::integer as approved_prospects
    from public.prospects
    where list_id = p_list_id
    group by list_id
  ) c
  where l.id = c.list_id;

  update public.prospecting_lists
  set total_prospects = 0, researched_prospects = 0, approved_prospects = 0
  where id = p_list_id
    and not exists (select 1 from public.prospects where list_id = p_list_id);
end;
$$;

create or replace function public.sync_prospecting_list_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_prospecting_list_counters(
    coalesce(new.list_id, old.list_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_prospecting_list_counters
  on public.prospects;

create trigger trg_sync_prospecting_list_counters
after insert or update of status or delete
on public.prospects
for each row
execute function public.sync_prospecting_list_counters();

drop trigger if exists trg_prospecting_lists_updated_at
  on public.prospecting_lists;

create trigger trg_prospecting_lists_updated_at
before update on public.prospecting_lists
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prospects_updated_at
  on public.prospects;

create trigger trg_prospects_updated_at
before update on public.prospects
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prospect_research_updated_at
  on public.prospect_research;

create trigger trg_prospect_research_updated_at
before update on public.prospect_research
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prospect_messages_updated_at
  on public.prospect_messages;

create trigger trg_prospect_messages_updated_at
before update on public.prospect_messages
for each row
execute function public.set_updated_at();

alter table public.prospecting_lists enable row level security;
alter table public.prospects enable row level security;
alter table public.prospect_research enable row level security;
alter table public.prospect_messages enable row level security;
alter table public.prospect_activities enable row level security;

grant all on table public.prospecting_lists to service_role;
grant all on table public.prospects to service_role;
grant all on table public.prospect_research to service_role;
grant all on table public.prospect_messages to service_role;
grant all on table public.prospect_activities to service_role;
