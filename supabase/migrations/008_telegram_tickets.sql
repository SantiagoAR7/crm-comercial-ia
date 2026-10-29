-- Run only in the dedicated tickets project. Application access is server-only.
begin;
create table public.ticket_submissions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null, chat_id text not null, message_id text not null,
  bot_alias text not null, technician text,
  file_id text not null, file_unique_id text not null,
  storage_path text not null unique, sha256 text not null, mime_type text not null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE','APROBADA','RECHAZADA')),
  proposed_data jsonb not null default '{}', reviewed_data jsonb not null default '{}', ocr_error text,
  received_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by text,
  rejection_reason text, version integer not null default 0,
  previous_submission_id uuid references public.ticket_submissions(id),
  unique(bot_id,chat_id,message_id),
  check (status <> 'RECHAZADA' or length(trim(rejection_reason)) > 0),
  check (status = 'PENDIENTE' or (reviewed_at is not null and reviewed_by is not null))
);
create index on public.ticket_submissions (status, received_at desc);
create index on public.ticket_submissions (technician, received_at desc);
create index on public.ticket_submissions (file_unique_id);
create index on public.ticket_submissions (sha256);
create table public.ticket_audit (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.ticket_submissions(id),
  actor text not null, previous_status text not null, new_status text not null,
  reason text, reviewed_data jsonb not null, created_at timestamptz not null default now()
);
create table public.ticket_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.ticket_submissions(id),
  destination text not null check (destination in ('TELEGRAM','ARCHIVE_EXPORT')),
  version integer not null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE','EN_PROCESO','COMPLETADA','ERROR','INCIERTA')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_token uuid, lease_until timestamptz, result jsonb, last_error text,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(submission_id,destination,version)
);
create index on public.ticket_outbox(status, next_attempt_at);
alter table public.ticket_submissions enable row level security;
alter table public.ticket_audit enable row level security;
alter table public.ticket_outbox enable row level security;
revoke all on public.ticket_submissions, public.ticket_audit, public.ticket_outbox from public, anon, authenticated;
grant select, insert on public.ticket_submissions to service_role;
grant select on public.ticket_audit, public.ticket_outbox to service_role;
-- Mutations are constrained to RPCs; the browser has no table privileges or policies.
create function public.review_ticket(p_id uuid, p_version integer, p_status text, p_actor text, p_reason text, p_data jsonb)
returns public.ticket_submissions language plpgsql security definer set search_path = '' as $$
declare r public.ticket_submissions;
begin
  if p_status not in ('APROBADA','RECHAZADA') or length(trim(coalesce(p_actor,''))) = 0 then raise exception 'Invalid decision'; end if;
  if p_status = 'RECHAZADA' and (length(trim(coalesce(p_reason,''))) = 0 or length(p_reason) > 2000) then raise exception 'Rejection reason required'; end if;
  select * into r from public.ticket_submissions where id = p_id for update;
  if not found or r.status <> 'PENDIENTE' or r.version <> p_version then raise exception 'Ticket already reviewed or version changed'; end if;
  if p_status = 'APROBADA' then
    if coalesce(p_data->>'technician','') !~ '^TECNICO (0[1-9]|1[0-7])$'
      or coalesce(p_data->>'category','') not in ('Aparcamientos','Combustible','Revisión','Supermercados','Varios')
      or coalesce(p_data->>'payment_method','') not in ('Pago con tarjeta','Pago en efectivo')
      or coalesce(p_data->>'document_type','') not in ('TICKET','FACTURA')
      or coalesce(p_data->>'amount','') !~ '^\d{1,9}(\.\d{1,2})?$'
      or coalesce(p_data->>'ticket_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or length(trim(coalesce(p_data->>'establishment',''))) = 0
      or coalesce(p_data->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'Invalid reviewed data'; end if;
    if (p_data->>'amount')::numeric <= 0 then raise exception 'Invalid amount'; end if;
    perform (p_data->>'ticket_date')::date;
  end if;
  update public.ticket_submissions set status = p_status, reviewed_at = now(), reviewed_by = p_actor,
    rejection_reason = case when p_status = 'RECHAZADA' then trim(p_reason) else null end,
    reviewed_data = case when p_status = 'APROBADA' then p_data else '{}'::jsonb end,
    technician = case when p_status = 'APROBADA' then p_data->>'technician' else technician end,
    version = version + 1 where id = p_id returning * into r;
  insert into public.ticket_audit(submission_id,actor,previous_status,new_status,reason,reviewed_data)
    values(p_id,p_actor,'PENDIENTE',p_status,r.rejection_reason,r.reviewed_data);
  insert into public.ticket_outbox(submission_id,destination,version) values(p_id,'TELEGRAM',r.version);
  if p_status = 'APROBADA' then
    insert into public.ticket_outbox(submission_id,destination,version) values(p_id,'ARCHIVE_EXPORT',r.version);
  end if;
  return r;
end $$;
revoke all on function public.review_ticket(uuid,integer,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.review_ticket(uuid,integer,text,text,text,jsonb) to service_role;

-- Leases prevent parallel workers from processing the same task.
create function public.claim_ticket_task() returns setof public.ticket_outbox
language plpgsql security definer set search_path = '' as $$
begin
  -- A Telegram timeout is uncertain: never automatically send it twice.
  update public.ticket_outbox set status = 'INCIERTA', last_error = 'Lease expired; reconcile delivery before retry', lease_token = null
    where destination = 'TELEGRAM' and status = 'EN_PROCESO' and lease_until < now();
  return query
  with candidate as (
    select id from public.ticket_outbox where
      (status in ('PENDIENTE','ERROR') and next_attempt_at <= now() and attempts < 8)
      or (destination = 'ARCHIVE_EXPORT' and status = 'EN_PROCESO' and lease_until < now() and attempts < 8)
    order by created_at for update skip locked limit 1
  )
  update public.ticket_outbox o set status = 'EN_PROCESO', attempts = attempts + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '10 minutes'
    from candidate c where o.id = c.id returning o.*;
end $$;
create function public.finish_ticket_task(p_id uuid,p_lease uuid,p_status text,p_result jsonb,p_error text)
returns public.ticket_outbox language plpgsql security definer set search_path = '' as $$
declare r public.ticket_outbox;
begin
  if p_status not in ('COMPLETADA','ERROR','INCIERTA') then raise exception 'Invalid task status'; end if;
  update public.ticket_outbox set status = p_status, result = p_result, last_error = left(p_error,2000),
    completed_at = case when p_status = 'COMPLETADA' then now() else null end,
    next_attempt_at = now() + interval '5 minutes' * greatest(attempts,1), lease_token = null, lease_until = null
    where id = p_id and lease_token = p_lease and status = 'EN_PROCESO' and lease_until >= now() returning * into r;
  if not found then raise exception 'Expired or invalid lease'; end if;
  return r;
end $$;
revoke all on function public.claim_ticket_task() from public,anon,authenticated;
revoke all on function public.finish_ticket_task(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_ticket_task(), public.finish_ticket_task(uuid,uuid,text,jsonb,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('ticket-evidence','ticket-evidence',false,8388608,array['image/jpeg','image/png']);
commit;
