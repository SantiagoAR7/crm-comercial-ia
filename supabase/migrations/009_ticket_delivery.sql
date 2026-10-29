begin;
alter table public.ticket_submissions add column source_received_at timestamptz;
create table public.ticket_export_allocations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.ticket_submissions(id),
  output_name text not null, workbook text not null, table_id text not null,
  row_start integer not null check(row_start>=0), row_count integer not null check(row_count>0),
  prepared_date date not null default (now() at time zone 'Europe/Madrid')::date,
  unique(submission_id,output_name)
);
alter table public.ticket_export_allocations enable row level security;
revoke all on public.ticket_export_allocations from public,anon,authenticated;
grant select on public.ticket_export_allocations to service_role;
create function public.allocate_ticket_rows(p_id uuid,p_output text,p_workbook text,p_table text,p_next integer,p_count integer)
returns public.ticket_export_allocations language plpgsql security definer set search_path='' as $$
declare r public.ticket_export_allocations; next_row integer;
begin
  if p_next < 0 or p_count not between 1 and 2 then raise exception 'Invalid allocation'; end if;
  perform pg_advisory_xact_lock(hashtext(p_workbook||':'||p_table)::bigint);
  select * into r from public.ticket_export_allocations where submission_id=p_id and output_name=p_output;
  if found then return r; end if;
  select greatest(p_next,coalesce(max(row_start+row_count),0)) into next_row
    from public.ticket_export_allocations where workbook=p_workbook and table_id=p_table;
  insert into public.ticket_export_allocations(submission_id,output_name,workbook,table_id,row_start,row_count)
    values(p_id,p_output,p_workbook,p_table,next_row,p_count) returning * into r;
  return r;
end $$;
create function public.checkpoint_ticket_task(p_id uuid,p_lease uuid,p_result jsonb)
returns public.ticket_outbox language plpgsql security definer set search_path='' as $$
declare r public.ticket_outbox;
begin
  update public.ticket_outbox set result=p_result,lease_until=now()+interval '10 minutes'
    where id=p_id and lease_token=p_lease and status='EN_PROCESO' and lease_until>=now() returning * into r;
  if not found then raise exception 'Invalid or expired lease'; end if;
  return r;
end $$;
create function public.update_ticket_extraction(p_id uuid,p_data jsonb,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.ticket_submissions set proposed_data=p_data,ocr_error=left(p_error,1000)
    where id=p_id and status='PENDIENTE';
  return found;
end $$;
create or replace function public.claim_ticket_task() returns setof public.ticket_outbox
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('tickets-claim')::bigint);
  update public.ticket_outbox set status='INCIERTA',last_error='Entrega de Telegram incierta; conciliar antes de reenviar',lease_token=null
    where destination='TELEGRAM' and status='EN_PROCESO' and lease_until<now();
  return query with candidate as (
    select o.id from public.ticket_outbox o where o.attempts<8 and (
      (o.status in ('PENDIENTE','ERROR') and o.next_attempt_at<=now()) or
      (o.destination='ARCHIVE_EXPORT' and o.status='EN_PROCESO' and o.lease_until<now())
    ) and (o.destination='TELEGRAM' or not exists(
      select 1 from public.ticket_outbox busy where busy.destination='ARCHIVE_EXPORT'
        and busy.status='EN_PROCESO' and busy.lease_until>=now()
    )) order by o.created_at for update skip locked limit 1
  ) update public.ticket_outbox o set status='EN_PROCESO',attempts=o.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes'
    from candidate c where o.id=c.id returning o.*;
end $$;
revoke all on function public.allocate_ticket_rows(uuid,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.checkpoint_ticket_task(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_ticket_extraction(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.allocate_ticket_rows(uuid,text,text,text,integer,integer),public.checkpoint_ticket_task(uuid,uuid,jsonb),public.update_ticket_extraction(uuid,jsonb,text) to service_role;
create or replace function public.review_ticket(p_id uuid, p_version integer, p_status text, p_actor text, p_reason text, p_data jsonb)
returns public.ticket_submissions language plpgsql security definer set search_path = '' as $$
declare r public.ticket_submissions;
begin
  if p_status not in ('APROBADA','RECHAZADA') or length(trim(coalesce(p_actor,''))) = 0 then raise exception 'Invalid decision'; end if;
  if p_status = 'RECHAZADA' and (length(trim(coalesce(p_reason,''))) = 0 or length(p_reason) > 2000) then raise exception 'Rejection reason required'; end if;
  select * into r from public.ticket_submissions where id = p_id for update;
  if not found or r.status <> 'PENDIENTE' or r.version <> p_version then raise exception 'Ticket already reviewed or version changed'; end if;
  if p_status = 'APROBADA' then
    if (coalesce(p_data->>'technician','') !~ '^TECNICO (0[1-9]|1[0-7])$' and not (p_data->>'technician'='Pagos Tarjeta' and r.bot_alias='Pagos Tarjeta'))
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

commit;
