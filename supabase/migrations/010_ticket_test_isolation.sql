begin;
alter table public.ticket_submissions add column is_test boolean not null default false;
update public.ticket_submissions set is_test=true where file_id like 'codex-test-%';
commit;
