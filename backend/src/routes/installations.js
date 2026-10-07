import { Router } from 'express';
import { supabase } from '../services/supabase.js';

export const installationsRouter = Router();

installationsRouter.post('/sync', async (_req, res) => {
  const webhookUrl = process.env.N8N_INSTALLATIONS_SYNC_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(503).json({
      error: 'La sincronización con Expertis no está configurada.',
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'cliente-crm', requestedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(180000),
    });
    const responseText = await response.text();
    let result = null;

    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = responseText || null;
    }

    if (!response.ok) {
      return res.status(502).json({
        error: 'Expertis no pudo completar la sincronización.',
        detail: result,
      });
    }

    return res.json({
      data: result,
      message: 'Instalaciones sincronizadas correctamente.',
    });
  } catch (error) {
    return res.status(502).json({
      error: 'No se pudo conectar con el servicio de sincronización.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

installationsRouter.get('/summary', async (_req, res) => {
  const [
    totalResult,
    activeResult,
    excludedResult,
    withoutPhoneResult,
    highRenewalResult,
  ] = await Promise.all([
    supabase.from('installations').select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' }),
    supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .eq('installation_status', 'ACTIVA'),
    supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .eq('excluded_from_campaigns', true),
    supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .or('normalized_phone.is.null,normalized_phone.eq.'),
    supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .gte('renewal_score', 75),
  ]);

  const error =
    totalResult.error ||
    activeResult.error ||
    excludedResult.error ||
    withoutPhoneResult.error ||
    highRenewalResult.error;

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron calcular las métricas.',
      detail: error.message,
    });
  }

  return res.json({
    data: {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      excluded: excludedResult.count || 0,
      withoutPhone: withoutPhoneResult.count || 0,
      highRenewal: highRenewalResult.count || 0,
    },
  });
});

installationsRouter.get('/filters', async (_req, res) => {
  const { data, error } = await supabase
    .from('installations')
    .select('brand, province, equipment_type, installation_status')
    .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
    .limit(10000);

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron cargar los filtros de instalaciones.',
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
      statuses: unique('installation_status'),
    },
  });
});

installationsRouter.get('/', async (req, res) => {
  const {
    search = '',
    brand = '',
    province = '',
    equipmentType = '',
    status = '',
    excluded = '',
    page = '1',
    pageSize = '50',
  } = req.query;

  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('installations')
    .select(`
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
      serial_number,
      installation_date,
      installation_status,
      last_service_date,
      last_intervention_date,
      warranty_until,
      excluded_from_campaigns,
      exclusion_reason,
      crm_tags,
      crm_notes,
      renewal_score,
      active,
      updated_at
    `, { count: 'exact' })
    .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
    .order('renewal_score', { ascending: false, nullsFirst: false })
    .order('customer_name', { ascending: true })
    .range(from, to);

  if (search) {
    const term = String(search).trim().replace(/[%(),]/g, '');
    if (term) {
      query = query.or(
        [
          `id_activo.ilike.%${term}%`,
          `id_cliente.ilike.%${term}%`,
          `customer_name.ilike.%${term}%`,
          `contact_name.ilike.%${term}%`,
          `normalized_phone.ilike.%${term}%`,
          `normalized_email.ilike.%${term}%`,
          `brand.ilike.%${term}%`,
          `model.ilike.%${term}%`,
          `serial_number.ilike.%${term}%`,
        ].join(','),
      );
    }
  }

  if (brand) query = query.eq('brand', brand);
  if (province) query = query.eq('province', province);
  if (equipmentType) query = query.eq('equipment_type', equipmentType);
  if (status) query = query.eq('installation_status', status);
  if (excluded === 'true') query = query.eq('excluded_from_campaigns', true);
  if (excluded === 'false') query = query.eq('excluded_from_campaigns', false);

  const { data, count, error } = await query;

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener las instalaciones.',
      detail: error.message,
    });
  }

  return res.json({
    data: data || [],
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: count || 0,
      totalPages: Math.max(Math.ceil((count || 0) / safePageSize), 1),
    },
  });
});

installationsRouter.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({
      error: 'No se encontró la instalación.',
      detail: error.message,
    });
  }

  return res.json({ data });
});
