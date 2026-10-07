import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { readSettings } from '../services/settings-store.js';

export const campaignsRouter = Router();

const allowedTypes = new Set(['INVIERNO', 'VERANO', 'SIBER']);
const retellCampaignAgentId = process.env.RETELL_CAMPAIGN_AGENT_ID;
const retellFromNumber = process.env.RETELL_FROM_NUMBER || '+34865621672';
const allowedOutcomes = new Set([
  'INTERESADO',
  'NO_INTERESADO',
  'NO_LLAMAR',
  'VOLVER_A_LLAMAR',
  'SIN_RESPUESTA',
  'BUZON_DE_VOZ',
  'FALLIDA',
]);

const allowedTransitions = {
  BORRADOR: ['FILTROS', 'CANCELADA'],
  FILTROS: ['PREVISUALIZACION', 'BORRADOR', 'CANCELADA'],
  PREVISUALIZACION: ['REVISION', 'FILTROS', 'CANCELADA'],
  REVISION: ['APROBADA', 'FILTROS', 'CANCELADA'],
  APROBADA: ['ENVIADA_N8N', 'REVISION', 'CANCELADA'],
  ENVIADA_N8N: ['LLAMANDO', 'CANCELADA'],
  LLAMANDO: ['FINALIZADA', 'CANCELADA'],
  FINALIZADA: [],
  CANCELADA: [],
};

function applyCandidateFilters(query, filters = {}) {
  const { brand, province, equipmentType, communication } = filters;

  query = query
    .eq('active', true)
    .eq('excluded_from_campaigns', false);

  if (brand) query = query.eq('brand', brand);
  if (province) query = query.eq('province', province);
  if (equipmentType) query = query.eq('equipment_type', equipmentType);

  if (communication === 'phone') {
    query = query.not('normalized_phone', 'is', null).neq('normalized_phone', '');
  }

  if (communication === 'email') {
    query = query.not('normalized_email', 'is', null).neq('normalized_email', '');
  }

  if (communication === 'both') {
    query = query
      .not('normalized_phone', 'is', null)
      .neq('normalized_phone', '')
      .not('normalized_email', 'is', null)
      .neq('normalized_email', '');
  }

  return query;
}


async function fetchAllCandidateRows({
  filters = {},
  select,
  orderByRenewalScore = false,
  pageSize = 1000,
}) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('installations')
      .select(select)
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' });

    query = applyCandidateFilters(query, filters);

    if (orderByRenewalScore) {
      query = query.order('renewal_score', {
        ascending: false,
        nullsFirst: false,
      });
    }

    query = query
      .order('customer_name', { ascending: true })
      .range(from, from + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: rows, error: null };
}


async function fetchAllCampaignContactsForRun(campaignId, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('campaign_contacts')
      .select(`
        id,
        contact_id,
        id_activo,
        id_cliente,
        customer_name,
        contact_name,
        normalized_phone,
        normalized_email,
        population,
        province,
        brand,
        model,
        review_status,
        excluded
      `)
      .eq('campaign_id', campaignId)
      .eq('excluded', false)
      .eq('review_status', 'APROBADO')
      .order('customer_name', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: rows, error: null };
}

campaignsRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      type,
      start_date,
      end_date,
      retell_agent_id:vapi_agent_id,
      active,
      status,
      candidate_count,
      filters,
      notes,
      created_at,
      updated_at,
      campaign_contacts(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener las campañas.',
      detail: error.message,
    });
  }

  const campaigns = (data || []).map((campaign) => ({
    ...campaign,
    contacts_count: campaign.campaign_contacts?.[0]?.count ?? 0,
    campaign_contacts: undefined,
  }));

  return res.json({ data: campaigns });
});

campaignsRouter.get('/filters', async (_req, res) => {
  const { data, error } = await supabase
    .from('installations')
    .select('brand, province, equipment_type')
    .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
    .eq('active', true)
    .eq('excluded_from_campaigns', false)
    .limit(10000);

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener los filtros.',
      detail: error.message,
    });
  }

  const unique = (field) =>
    [...new Set((data || []).map((row) => row[field]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'es'));

  return res.json({
    data: {
      brands: unique('brand'),
      provinces: unique('province'),
      equipmentTypes: unique('equipment_type'),
    },
  });
});

campaignsRouter.post('/test-call', async (req, res) => {
  const { type, phone, customerName, email = '', province = '' } = req.body ?? {};
  const apiKey = process.env.RETELL_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'Las llamadas de prueba no están configuradas en el servidor.',
    });
  }

  if (!allowedTypes.has(type)) {
    return res.status(400).json({ error: 'El tipo de campaña no es válido.' });
  }

  let normalizedPhone = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (normalizedPhone.startsWith('00')) normalizedPhone = `+${normalizedPhone.slice(2)}`;
  if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 9) {
    normalizedPhone = `+34${normalizedPhone}`;
  }

  if (!/^\+\d{9,15}$/.test(normalizedPhone) || !String(customerName || '').trim()) {
    return res.status(400).json({
      error: 'Indica un nombre y un teléfono internacional válidos.',
    });
  }

  const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from_number: retellFromNumber,
      to_number: normalizedPhone,
      override_agent_id: retellCampaignAgentId,
      override_agent_version: 'latest_published',
      metadata: { source: 'cliente-crm', test: true, campaignType: type },
      retell_llm_dynamic_variables: {
        campaign_type: type,
        campaign_name: `Prueba ${type}`,
        campaign_label: `Prueba de campaña ${type}`,
        customer_name: String(customerName).trim(),
        contact_name: String(customerName).trim(),
        product: 'equipo registrado',
        email: String(email || '').trim(),
        province: String(province || '').trim(),
        queue_id: `crm-test-${type.toLowerCase()}-${Date.now()}`,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return res.status(502).json({
      error: 'Retell no pudo iniciar la llamada de prueba.',
      detail: body.message || body.error || `HTTP ${response.status}`,
    });
  }

  return res.status(201).json({
    data: {
      callId: body.call_id,
      status: body.call_status,
      type,
      phone: normalizedPhone,
      customerName: String(customerName).trim(),
    },
  });
});

campaignsRouter.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      type,
      start_date,
      end_date,
      retell_agent_id:vapi_agent_id,
      active,
      status,
      candidate_count,
      filters,
      notes,
      generated_at,
      approved_at,
      sent_to_n8n_at,
      started_at,
      completed_at,
      created_at,
      updated_at,
      campaign_contacts(count)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({
      error: 'No se encontró la campaña.',
      detail: error.message,
    });
  }

  return res.json({
    data: {
      ...data,
      contacts_count: data.campaign_contacts?.[0]?.count ?? 0,
      campaign_contacts: undefined,
    },
  });
});

campaignsRouter.delete('/:id', async (req, res) => {
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('id', req.params.id)
    .single();

  if (campaignError) {
    return res.status(404).json({ error: 'No se encontró la campaña.' });
  }

  if (campaign.status === 'LLAMANDO') {
    return res.status(409).json({
      error: 'No se puede eliminar una campaña mientras está realizando llamadas.',
    });
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: 'No se pudo eliminar la campaña.',
      detail: error.message,
    });
  }

  return res.json({
    deleted: true,
    campaign: { id: campaign.id, name: campaign.name },
  });
});

campaignsRouter.post('/', async (req, res) => {
  const {
    name,
    type,
    startDate,
    endDate,
    notes = '',
  } = req.body ?? {};

  if (!name || !type || !startDate || !endDate) {
    return res.status(400).json({
      error: 'Nombre, tipo y fechas son obligatorios.',
    });
  }

  if (!allowedTypes.has(type)) {
    return res.status(400).json({
      error: 'El tipo de campaña no es válido.',
    });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({
      error: 'La fecha final no puede ser anterior a la inicial.',
    });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name: String(name).trim(),
      type,
      start_date: startDate,
      end_date: endDate,
      vapi_agent_id: retellCampaignAgentId,
      active: true,
      status: 'BORRADOR',
      notes: String(notes || '').trim() || null,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'No se pudo crear la campaña.',
      detail: error.message,
    });
  }

  return res.status(201).json({ data });
});

campaignsRouter.post('/from-warranty-selection', async (req, res) => {
  const { installationIds, name, type, startDate, endDate } = req.body ?? {};
  const selectedIds = [...new Set(Array.isArray(installationIds) ? installationIds.filter(Boolean) : [])];

  if (!selectedIds.length || !name || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'La selección, el nombre, el tipo y las fechas son obligatorios.' });
  }
  if (selectedIds.length > 500) return res.status(400).json({ error: 'La selección no puede superar 500 usuarios.' });
  if (!allowedTypes.has(type)) return res.status(400).json({ error: 'El tipo de campaña no es válido.' });
  if (new Date(endDate) < new Date(startDate)) return res.status(400).json({ error: 'La fecha final no puede ser anterior a la inicial.' });

  const { data: contacts, error: contactsError } = await supabase
    .from('installations')
    .select('id,id_activo,id_cliente,customer_name,contact_name,normalized_phone,normalized_email,population,province,brand,model,source_snapshot')
    .in('id', selectedIds)
    .contains('source_snapshot', { warranty_status: 'EN_GARANTIA' })
    .eq('active', true);

  if (contactsError) return res.status(500).json({ error: 'No se pudo validar la selección.', detail: contactsError.message });
  if (!contacts?.length || contacts.length !== selectedIds.length) {
    return res.status(400).json({ error: 'La selección contiene usuarios no válidos o que no están en garantía.' });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name: String(name).trim(), type, start_date: startDate, end_date: endDate,
      vapi_agent_id: retellCampaignAgentId, active: true, status: 'REVISION',
      candidate_count: contacts.length,
      filters: { source: 'GARANTIA_SELECCION_MANUAL', installationIds: selectedIds },
      notes: 'Usuarios en garantía añadidos únicamente mediante selección manual.',
    })
    .select()
    .single();

  if (campaignError) return res.status(500).json({ error: 'No se pudo crear la campaña.', detail: campaignError.message });

  const now = new Date().toISOString();
  const rows = contacts.map((contact) => ({
    campaign_id: campaign.id, contact_id: contact.id, id_activo: contact.id_activo,
    id_cliente: contact.id_cliente, customer_name: contact.customer_name,
    contact_name: contact.contact_name, normalized_phone: contact.normalized_phone,
    normalized_email: contact.normalized_email, population: contact.population,
    province: contact.province, brand: contact.brand, model: contact.model,
    selected: true, excluded: false, status: 'SELECCIONADO', review_status: 'PENDIENTE',
    approved_at: null, source_snapshot: contact.source_snapshot, updated_at: now,
  }));

  const { error: insertError } = await supabase.from('campaign_contacts').insert(rows);
  if (insertError) {
    await supabase.from('campaigns').delete().eq('id', campaign.id);
    return res.status(500).json({ error: 'No se pudieron añadir los usuarios seleccionados.', detail: insertError.message });
  }

  return res.status(201).json({ data: campaign, selected: rows.length });
});


campaignsRouter.post('/:id/send-to-n8n', async (req, res) => {
  const webhookUrl = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return res.status(500).json({
      error: 'Falta configurar N8N_CAMPAIGN_WEBHOOK_URL en backend/.env.',
    });
  }

  const operationalSettings = await readSettings();

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      type,
      status,
      start_date,
      end_date,
      retell_agent_id:vapi_agent_id,
      filters,
      notes
    `)
    .eq('id', req.params.id)
    .single();

  if (campaignError) {
    return res.status(404).json({
      error: 'No se encontró la campaña.',
      detail: campaignError.message,
    });
  }

  if (campaign.status !== 'APROBADA') {
    return res.status(400).json({
      error: 'Solo se pueden enviar campañas aprobadas.',
      currentStatus: campaign.status,
    });
  }

  const { data: contacts, error: contactsError } =
    await fetchAllCampaignContactsForRun(req.params.id);

  if (contactsError) {
    return res.status(500).json({
      error: 'No se pudieron cargar los candidatos aprobados.',
      detail: contactsError.message,
    });
  }

  const callableContacts = (contacts || []).filter(
    (contact) => Boolean(contact.normalized_phone),
  );

  if (!callableContacts.length) {
    return res.status(400).json({
      error: 'La campaña no tiene candidatos con teléfono disponible.',
    });
  }

  const { data: existingRun, error: existingRunError } = await supabase
    .from('campaign_runs')
    .select('id, status, total_contacts, created_at')
    .eq('campaign_id', req.params.id)
    .in('status', [
      'PENDIENTE',
      'ENCOLANDO',
      'EN_COLA',
      'EJECUTANDO',
      'PAUSADA',
    ])
    .maybeSingle();

  if (existingRunError) {
    return res.status(500).json({
      error: 'No se pudo comprobar si la campaña ya tiene una ejecución activa.',
      detail: existingRunError.message,
    });
  }

  if (existingRun) {
    return res.status(409).json({
      error: 'La campaña ya tiene una ejecución activa.',
      run: existingRun,
    });
  }

  const now = new Date().toISOString();

  const { data: run, error: runError } = await supabase
    .from('campaign_runs')
    .insert({
      campaign_id: campaign.id,
      status: 'ENCOLANDO',
      total_contacts: callableContacts.length,
      batch_size: Math.min(100, Math.max(1, Number(operationalSettings.batchSize || 10))),
      max_concurrency: Math.min(10, Math.max(1, Number(operationalSettings.maxConcurrency || 3))),
      max_attempts: Math.min(5, Math.max(1, Number(operationalSettings.maxAttempts || 3))),
      metadata: {
        source: 'cliente-crm',
        campaignType: campaign.type,
        retellAgentId: campaign.retell_agent_id || retellCampaignAgentId,
        callingStart: operationalSettings.callingStart || '09:00',
        callingEnd: operationalSettings.callingEnd || '19:00',
        timezone: 'Europe/Madrid',
      },
    })
    .select()
    .single();

  if (runError) {
    return res.status(500).json({
      error: 'No se pudo crear la ejecución de campaña.',
      detail: runError.message,
    });
  }

  const queueRows = callableContacts.map((contact, index) => ({
    run_id: run.id,
    campaign_id: campaign.id,
    campaign_contact_id: contact.id,
    installation_id: contact.contact_id,
    id_activo: contact.id_activo,
    id_cliente: contact.id_cliente,
    customer_name: contact.customer_name,
    contact_name: contact.contact_name,
    phone: contact.normalized_phone,
    email: contact.normalized_email,
    province: contact.province,
    brand: contact.brand,
    model: contact.model,
    priority: 100 + index,
    status: 'PENDIENTE',
    attempt_count: 0,
    max_attempts: Math.min(5, Math.max(1, Number(operationalSettings.maxAttempts || 3))),
    scheduled_at: now,
    payload: {
      population: contact.population,
      campaignContactId: contact.id,
      installationId: contact.contact_id,
      retellAgentId: campaign.retell_agent_id || retellCampaignAgentId,
      campaignName: campaign.name,
      campaignType: campaign.type,
    },
  }));

  let queued = 0;
  const chunkSize = 500;

  for (let index = 0; index < queueRows.length; index += chunkSize) {
    const chunk = queueRows.slice(index, index + chunkSize);

    const { data, error } = await supabase
      .from('campaign_call_queue')
      .insert(chunk)
      .select('id');

    if (error) {
      await supabase
        .from('campaign_runs')
        .update({
          status: 'ERROR',
          last_error: error.message,
        })
        .eq('id', run.id);

      return res.status(500).json({
        error: 'No se pudo completar la cola de llamadas.',
        detail: error.message,
        runId: run.id,
        queued,
      });
    }

    queued += data?.length ?? chunk.length;
  }

  const { data: queuedRun, error: queuedRunError } = await supabase
    .from('campaign_runs')
    .update({
      status: 'EN_COLA',
      total_contacts: queued,
      queued_contacts: queued,
    })
    .eq('id', run.id)
    .select()
    .single();

  if (queuedRunError) {
    return res.status(500).json({
      error: 'La cola se creó, pero no se pudo actualizar la ejecución.',
      detail: queuedRunError.message,
      runId: run.id,
    });
  }

  const payload = {
    event: 'campaign.run.created',
    sentAt: now,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      retellAgentId: campaign.retell_agent_id || retellCampaignAgentId,
      filters: campaign.filters || {},
      notes: campaign.notes,
    },
    run: {
      id: queuedRun.id,
      status: queuedRun.status,
      totalContacts: queuedRun.total_contacts,
      batchSize: queuedRun.batch_size,
      maxConcurrency: queuedRun.max_concurrency,
      maxAttempts: queuedRun.max_attempts,
    },
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (webhookSecret) {
    headers['x-cliente-secret'] = webhookSecret;
  }

  let n8nResponse;

  try {
    n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    await supabase
      .from('campaign_runs')
      .update({
        status: 'ERROR',
        last_error: error instanceof Error ? error.message : String(error),
      })
      .eq('id', run.id);

    return res.status(502).json({
      error: 'La ejecución y la cola se crearon, pero no se pudo conectar con n8n.',
      detail: error instanceof Error ? error.message : String(error),
      runId: run.id,
    });
  }

  const responseText = await n8nResponse.text();
  let responseBody = responseText;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    // n8n puede responder texto plano.
  }

  if (!n8nResponse.ok) {
    await supabase
      .from('campaign_runs')
      .update({
        status: 'ERROR',
        last_error: `n8n respondió ${n8nResponse.status}`,
      })
      .eq('id', run.id);

    return res.status(502).json({
      error: 'n8n rechazó el inicio de la ejecución.',
      n8nStatus: n8nResponse.status,
      n8nResponse: responseBody,
      runId: run.id,
    });
  }

  const n8nExecutionId =
    responseBody && typeof responseBody === 'object'
      ? responseBody.executionId || responseBody.execution_id || null
      : null;

  const { data: finalRun, error: finalRunError } = await supabase
    .from('campaign_runs')
    .update({
      status: 'EJECUTANDO',
      started_at: now,
      n8n_execution_id: n8nExecutionId,
    })
    .eq('id', run.id)
    .select()
    .single();

  if (finalRunError) {
    return res.status(500).json({
      error: 'n8n aceptó la ejecución, pero no se pudo actualizar su estado.',
      detail: finalRunError.message,
      runId: run.id,
      n8nResponse: responseBody,
    });
  }

  const { data: updatedCampaign, error: campaignUpdateError } = await supabase
    .from('campaigns')
    .update({
      status: 'ENVIADA_N8N',
      sent_to_n8n_at: now,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (campaignUpdateError) {
    return res.status(500).json({
      error: 'La ejecución comenzó, pero no se pudo actualizar la campaña.',
      detail: campaignUpdateError.message,
      run: finalRun,
    });
  }

  return res.json({
    data: updatedCampaign,
    run: finalRun,
    queuedContacts: queued,
    n8nResponse: responseBody,
  });
});

campaignsRouter.get('/:id/runs', async (req, res) => {
  const { data, error } = await supabase
    .from('campaign_runs')
    .select(`
      id,
      status,
      total_contacts,
      queued_contacts,
      processing_contacts,
      completed_contacts,
      failed_contacts,
      skipped_contacts,
      batch_size,
      max_concurrency,
      max_attempts,
      n8n_execution_id,
      started_at,
      paused_at,
      completed_at,
      last_error,
      created_at,
      updated_at
    `)
    .eq('campaign_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener las ejecuciones.',
      detail: error.message,
    });
  }

  return res.json({ data: data || [] });
});

campaignsRouter.get('/:id/results', async (req, res) => {
  const { data, error } = await supabase
    .from('campaign_call_results')
    .select(`
      id,
      queue_id,
      run_id,
      retell_call_id:vapi_call_id,
      call_status,
      outcome,
      started_at,
      ended_at,
      duration_seconds,
      summary,
      transcript,
      recording_url,
      sentiment,
      interest_level,
      next_action,
      callback_at,
      opportunity_required,
      structured_data,
      created_at,
      campaign_call_queue(customer_name, contact_name, phone, email)
    `)
    .eq('campaign_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener los resultados de llamadas.',
      detail: error.message,
    });
  }

  return res.json({ data: data || [] });
});

campaignsRouter.post(['/webhooks/retell-result', '/webhooks/vapi-result'], async (req, res) => {
  const configuredSecret = process.env.N8N_WEBHOOK_SECRET;
  if (configuredSecret && req.get('x-cliente-secret') !== configuredSecret) {
    return res.status(401).json({ error: 'Webhook no autorizado.' });
  }

  const body = req.body ?? {};
  const queueId = body.queueId || body.queue_id;
  const retellCallId = body.retellCallId || body.retell_call_id || body.callId ||
    body.vapiCallId || body.vapi_call_id || body.call?.call_id || body.call?.id;
  const rawOutcome = String(body.outcome || body.result || 'FALLIDA')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const aliases = {
    INTERESTED: 'INTERESADO',
    NOT_INTERESTED: 'NO_INTERESADO',
    DO_NOT_CALL: 'NO_LLAMAR',
    DNC: 'NO_LLAMAR',
    CALLBACK: 'VOLVER_A_LLAMAR',
    NO_ANSWER: 'SIN_RESPUESTA',
    VOICEMAIL: 'BUZON_DE_VOZ',
    FAILED: 'FALLIDA',
  };
  const outcome = aliases[rawOutcome] || rawOutcome;

  if ((!queueId && !retellCallId) || !allowedOutcomes.has(outcome)) {
    return res.status(400).json({
      error: 'Falta identificar la llamada o el resultado no es válido.',
      allowedOutcomes: [...allowedOutcomes],
    });
  }

  let queueQuery = supabase
    .from('campaign_call_queue')
    .select('id, run_id, campaign_id, campaign_contact_id, installation_id');
  queueQuery = queueId ? queueQuery.eq('id', queueId) : queueQuery.eq('vapi_call_id', retellCallId);
  const { data: queue, error: queueError } = await queueQuery.single();

  if (queueError) {
    return res.status(404).json({
      error: 'No se encontró la llamada en la cola.',
      detail: queueError.message,
    });
  }

  const now = new Date().toISOString();
  const failed = outcome === 'FALLIDA';
  const structuredData = body.structuredData || body.structured_data || {};
  const resultRow = {
    queue_id: queue.id,
    run_id: queue.run_id,
    campaign_id: queue.campaign_id,
    campaign_contact_id: queue.campaign_contact_id,
    vapi_call_id: retellCallId || null,
    call_status: body.callStatus || body.call_status || (failed ? 'failed' : 'ended'),
    outcome,
    started_at: body.startedAt || body.started_at || null,
    ended_at: body.endedAt || body.ended_at || now,
    duration_seconds: body.durationSeconds ?? body.duration_seconds ?? null,
    summary: body.summary || null,
    transcript: body.transcript || null,
    recording_url: body.recordingUrl || body.recording_url || null,
    sentiment: body.sentiment || null,
    interest_level: body.interestLevel || body.interest_level || null,
    next_action: body.nextAction || body.next_action || null,
    callback_at: body.callbackAt || body.callback_at || null,
    opportunity_required: outcome === 'INTERESADO',
    structured_data: structuredData,
    raw_response: body,
  };

  const { data: result, error: resultError } = await supabase
    .from('campaign_call_results')
    .upsert(resultRow, { onConflict: 'queue_id' })
    .select()
    .single();

  if (resultError) {
    return res.status(500).json({
      error: 'No se pudo guardar el resultado de la llamada.',
      detail: resultError.message,
    });
  }

  const { error: queueUpdateError } = await supabase
    .from('campaign_call_queue')
    .update({
      status: failed ? 'ERROR' : 'COMPLETADA',
      completed_at: now,
      vapi_call_id: retellCallId || undefined,
      result_code: outcome,
      last_error: failed ? body.error || body.endedReason || body.ended_reason || 'Llamada fallida' : null,
    })
    .eq('id', queue.id);

  if (queueUpdateError) {
    return res.status(500).json({
      error: 'Se guardó el resultado, pero no se pudo cerrar la llamada en cola.',
      detail: queueUpdateError.message,
    });
  }

  if (outcome === 'NO_LLAMAR' && queue.installation_id) {
    await supabase
      .from('installations')
      .update({ excluded_from_campaigns: true })
      .eq('id', queue.installation_id);
  }

  await supabase.rpc('refresh_campaign_run_counters', { p_run_id: queue.run_id });

  const { count: remainingCount } = await supabase
    .from('campaign_call_queue')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', queue.run_id)
    .in('status', ['PENDIENTE', 'RESERVADA', 'LLAMANDO', 'REINTENTO']);

  if (!remainingCount) {
    const { count: failedCount } = await supabase
      .from('campaign_call_queue')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', queue.run_id)
      .eq('status', 'ERROR');
    await Promise.all([
      supabase.from('campaign_runs').update({
        status: failedCount ? 'COMPLETADA_CON_ERRORES' : 'COMPLETADA',
        completed_at: now,
      }).eq('id', queue.run_id),
      supabase.from('campaigns').update({
        status: 'FINALIZADA',
        completed_at: now,
      }).eq('id', queue.campaign_id),
    ]);
  }

  return res.json({ success: true, data: result });
});

campaignsRouter.patch('/:id/status', async (req, res) => {
  const { status } = req.body ?? {};

  const { data: current, error: currentError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', req.params.id)
    .single();

  if (currentError) {
    return res.status(404).json({
      error: 'No se encontró la campaña.',
      detail: currentError.message,
    });
  }

  const nextStatuses = allowedTransitions[current.status] || [];

  if (!nextStatuses.includes(status)) {
    return res.status(400).json({
      error: `No se puede pasar de ${current.status} a ${status}.`,
      allowed: nextStatuses,
    });
  }

  if (status === 'APROBADA') {
    const [includedResult, pendingResult] = await Promise.all([
      supabase.from('campaign_contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', req.params.id).eq('excluded', false),
      supabase.from('campaign_contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', req.params.id).eq('excluded', false).neq('review_status', 'APROBADO'),
    ]);

    if (includedResult.error || pendingResult.error) {
      return res.status(500).json({
        error: 'No se pudo comprobar la revisión humana de los candidatos.',
        detail: includedResult.error?.message || pendingResult.error?.message,
      });
    }

    if (!includedResult.count) {
      return res.status(400).json({
        error: 'La campaña no tiene candidatos aprobados para llamar.',
      });
    }

    if (pendingResult.count) {
      return res.status(400).json({
        error: 'Todos los candidatos incluidos deben validarse manualmente antes de aprobar la campaña.',
        pendingReview: pendingResult.count,
      });
    }
  }

  const updates = { status };

  if (status === 'APROBADA') updates.approved_at = new Date().toISOString();
  if (status === 'ENVIADA_N8N') updates.sent_to_n8n_at = new Date().toISOString();
  if (status === 'LLAMANDO') updates.started_at = new Date().toISOString();
  if (status === 'FINALIZADA') updates.completed_at = new Date().toISOString();
  if (status === 'CANCELADA') updates.active = false;

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'No se pudo actualizar el estado.',
      detail: error.message,
    });
  }

  return res.json({ data });
});

campaignsRouter.post('/:id/candidates/preview', async (req, res) => {
  const filters = req.body ?? {};

  const { data: allRows, error } = await fetchAllCandidateRows({
    filters,
    select: `
      id,
      id_activo,
      id_cliente,
      customer_name,
      contact_name,
      normalized_phone,
      normalized_email,
      population,
      province,
      brand,
      model,
      equipment_type,
      renewal_score
    `,
    orderByRenewalScore: true,
  });

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron calcular los candidatos.',
      detail: error.message,
    });
  }

  const rows = allRows || [];
  const previewRows = rows.slice(0, 200);

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      filters,
      candidate_count: rows.length,
      status: 'PREVISUALIZACION',
    })
    .eq('id', req.params.id);

  if (updateError) {
    return res.status(500).json({
      error: 'Se calcularon los candidatos, pero no se pudo guardar la previsualización.',
      detail: updateError.message,
    });
  }

  return res.json({
    data: previewRows,
    summary: {
      total: rows.length,
      previewed: previewRows.length,
      withPhone: rows.filter((row) => Boolean(row.normalized_phone)).length,
      withEmail: rows.filter((row) => Boolean(row.normalized_email)).length,
    },
  });
});

campaignsRouter.post('/:id/candidates/generate', async (req, res) => {
  const filters = req.body ?? {};

  const { data: contacts, error: contactsError } =
    await fetchAllCandidateRows({
      filters,
      select: `
        id,
        id_activo,
        id_cliente,
        customer_name,
        contact_name,
        normalized_phone,
        normalized_email,
        population,
        province,
        brand,
        model,
        source_snapshot
      `,
    });

  if (contactsError) {
    return res.status(500).json({
      error: 'No se pudieron consultar los candidatos.',
      detail: contactsError.message,
    });
  }

  if (!contacts?.length) {
    return res.status(400).json({
      error: 'Los filtros no devuelven ningún candidato.',
    });
  }

  const now = new Date().toISOString();

  const rows = contacts.map((contact) => ({
    campaign_id: req.params.id,
    contact_id: contact.id,
    id_activo: contact.id_activo,
    id_cliente: contact.id_cliente,
    customer_name: contact.customer_name,
    contact_name: contact.contact_name,
    normalized_phone: contact.normalized_phone,
    normalized_email: contact.normalized_email,
    population: contact.population,
    province: contact.province,
    brand: contact.brand,
    model: contact.model,
    selected: true,
    excluded: false,
    status: 'SELECCIONADO',
    review_status: 'PENDIENTE',
    approved_at: null,
    source_snapshot: contact.source_snapshot,
    updated_at: now,
  }));

  const chunkSize = 500;
  let inserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);

    const { data, error } = await supabase
      .from('campaign_contacts')
      .upsert(chunk, {
        onConflict: 'campaign_id,contact_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      return res.status(500).json({
        error: 'No se pudieron generar los candidatos.',
        detail: error.message,
        inserted,
      });
    }

    inserted += data?.length ?? chunk.length;
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      filters,
      candidate_count: rows.length,
      generated_at: now,
      status: 'REVISION',
    })
    .eq('id', req.params.id);

  if (updateError) {
    return res.status(500).json({
      error: 'Los candidatos se generaron, pero no se actualizó el estado de la campaña.',
      detail: updateError.message,
      inserted,
    });
  }

  return res.status(201).json({
    inserted,
    totalMatched: rows.length,
  });
});

campaignsRouter.get('/:id/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('campaign_contacts')
    .select('id, contact_id, customer_name, contact_name, normalized_phone, normalized_email, population, province, brand, model, selected, excluded, exclusion_reason, status, review_status, created_at')
    .eq('campaign_id', req.params.id)
    .order('customer_name', { ascending: true })
    .limit(5000);

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener los contactos de la campaña.',
      detail: error.message,
    });
  }

  return res.json({ data: data || [] });
});

campaignsRouter.patch('/:id/contacts/:campaignContactId', async (req, res) => {
  const { reviewStatus, excluded, exclusionReason } = req.body ?? {};

  const updates = {};

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', req.params.id)
    .single();

  if (campaignError) return res.status(404).json({ error: 'No se encontró la campaña.' });
  if (campaign.status !== 'REVISION') {
    return res.status(409).json({
      error: 'Los candidatos solo se pueden modificar durante la revisión.',
      currentStatus: campaign.status,
    });
  }

  const allowedReviewStatuses = new Set(['PENDIENTE', 'APROBADO', 'EXCLUIDO']);

  if (reviewStatus && !allowedReviewStatuses.has(reviewStatus)) {
    return res.status(400).json({ error: 'El estado de revisión no es válido.' });
  }

  if (reviewStatus) updates.review_status = reviewStatus;
  if (typeof excluded === 'boolean') updates.excluded = excluded;
  if (typeof exclusionReason === 'string' || exclusionReason === null) {
    updates.exclusion_reason = exclusionReason;
  }

  if (reviewStatus === 'APROBADO') {
    updates.excluded = false;
    updates.exclusion_reason = null;
    updates.approved_at = new Date().toISOString();
  }

  if (reviewStatus === 'EXCLUIDO') {
    updates.excluded = true;
    updates.approved_at = null;
  }

  if (reviewStatus === 'PENDIENTE') {
    updates.excluded = false;
    updates.approved_at = null;
  }

  const { data, error } = await supabase
    .from('campaign_contacts')
    .update(updates)
    .eq('campaign_id', req.params.id)
    .eq('id', req.params.campaignContactId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'No se pudo actualizar el candidato.',
      detail: error.message,
    });
  }

  return res.json({ data });
});

campaignsRouter.patch('/:id/contacts', async (req, res) => {
  const { reviewStatus } = req.body ?? {};
  const allowedReviewStatuses = new Set(['PENDIENTE', 'APROBADO', 'EXCLUIDO']);

  if (!allowedReviewStatuses.has(reviewStatus)) {
    return res.status(400).json({ error: 'El estado de revisión no es válido.' });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', req.params.id)
    .single();

  if (campaignError) return res.status(404).json({ error: 'No se encontró la campaña.' });
  if (campaign.status !== 'REVISION') {
    return res.status(409).json({
      error: 'La revisión masiva solo está disponible durante la revisión.',
    });
  }

  const now = new Date().toISOString();
  const updates = reviewStatus === 'APROBADO'
    ? { review_status: 'APROBADO', excluded: false, exclusion_reason: null, approved_at: now }
    : reviewStatus === 'EXCLUIDO'
      ? { review_status: 'EXCLUIDO', excluded: true, exclusion_reason: 'Exclusión masiva durante la revisión', approved_at: null }
      : { review_status: 'PENDIENTE', excluded: false, exclusion_reason: null, approved_at: null };

  const { data, error } = await supabase
    .from('campaign_contacts')
    .update(updates)
    .eq('campaign_id', req.params.id)
    .neq('review_status', reviewStatus)
    .select('id');

  if (error) {
    return res.status(500).json({
      error: 'No se pudo completar la revisión masiva.',
      detail: error.message,
    });
  }

  return res.json({ updated: data?.length || 0, reviewStatus });
});
