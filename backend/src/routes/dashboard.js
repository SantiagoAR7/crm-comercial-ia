import { Router } from 'express';
import { supabase } from '../services/supabase.js';

export const dashboardRouter = Router();

dashboardRouter.get('/opportunities', async (_req, res) => {
  const { data, error } = await supabase
    .from('campaign_call_results')
    .select(`
      id,
      campaign_id,
      retell_call_id:vapi_call_id,
      outcome,
      interest_level,
      summary,
      next_action,
      callback_at,
      created_at,
      campaign_call_queue(customer_name, contact_name, phone, email),
      campaigns(name, type)
    `)
    .eq('opportunity_required', true)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener las oportunidades.',
      detail: error.message,
    });
  }

  return res.json({ data: data || [] });
});

dashboardRouter.get('/', async (_req, res) => {
  const { data: reviewCampaigns, error: reviewCampaignsError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 'REVISION');

  if (reviewCampaignsError) {
    return res.status(500).json({ error: 'No se pudieron identificar las campañas en revisión.', detail: reviewCampaignsError.message });
  }

  const reviewCampaignIds = (reviewCampaigns || []).map((campaign) => campaign.id);
  const pendingQuery = supabase
    .from('campaign_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'PENDIENTE')
    .eq('excluded', false);

  const [
    installationsResult,
    campaignsResult,
    pendingResult,
    callsResult,
    leadsResult,
    recentCampaignsResult,
  ] = await Promise.all([
    supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .eq('active', true),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }),
    reviewCampaignIds.length ? pendingQuery.in('campaign_id', reviewCampaignIds) : Promise.resolve({ count: 0, error: null }),
    supabase.from('campaign_call_results').select('id', { count: 'exact', head: true }),
    supabase.from('campaign_call_results').select('id', { count: 'exact', head: true }).eq('opportunity_required', true),
    supabase.from('campaigns').select('id,name,type,status,candidate_count,start_date,end_date').order('created_at', { ascending: false }).limit(5),
  ]);

  const firstError = [
    installationsResult,
    campaignsResult,
    pendingResult,
    callsResult,
    leadsResult,
    recentCampaignsResult,
  ].find((result) => result.error)?.error;

  if (firstError) {
    return res.status(500).json({
      error: 'No se pudieron calcular las métricas.',
      detail: firstError.message,
    });
  }

  return res.json({
    contacts: installationsResult.count ?? 0,
    campaigns: campaignsResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    calls: callsResult.count ?? 0,
    leads: leadsResult.count ?? 0,
    recentCampaigns: recentCampaignsResult.data || [],
  });
});
