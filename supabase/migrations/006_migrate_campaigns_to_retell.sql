-- 006 - Migra el motor de campañas de Vapi a Retell sin perder históricos.

alter table public.campaigns
  add column if not exists retell_agent_id text;

-- El identificador real se configura mediante RETELL_CAMPAIGN_AGENT_ID
-- y no se almacena en el repositorio.

alter table public.campaign_call_queue
  add column if not exists retell_call_id text;

alter table public.campaign_call_results
  add column if not exists retell_call_id text;

create index if not exists idx_campaign_call_queue_retell_call_id
  on public.campaign_call_queue(retell_call_id);

create index if not exists idx_campaign_call_results_retell_call_id
  on public.campaign_call_results(retell_call_id);

comment on column public.campaigns.retell_agent_id is
  'Agente unificado de Retell utilizado para VERANO, INVIERNO y SIBER.';
