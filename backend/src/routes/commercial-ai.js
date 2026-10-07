import { Router } from 'express';
import { supabase } from '../services/supabase.js';

export const commercialAiRouter = Router();
const retellCampaignAgentId = process.env.RETELL_CAMPAIGN_AGENT_ID;

const month = new Date().getMonth() + 1;
const seasonalType = month >= 4 && month <= 9 ? 'VERANO' : 'INVIERNO';

commercialAiRouter.get('/recommendations', async (_req, res) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('installations')
      .select('brand,province,equipment_type,renewal_score,normalized_phone,excluded_from_campaigns')
      .contains('source_snapshot', { warranty_status: 'FUERA_DE_GARANTIA' })
      .eq('active', true)
      .eq('excluded_from_campaigns', false)
      .not('normalized_phone', 'is', null)
      .neq('normalized_phone', '')
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) return res.status(500).json({ error: 'No se pudo analizar el histórico comercial.', detail: error.message });
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const group = (field) => {
    const counts = new Map();
    for (const row of rows) {
      const rawValue = row[field];
      const value = typeof rawValue === 'string'
        ? rawValue.trim().toLocaleUpperCase('es-ES')
        : rawValue;
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count }));
  };

  const highPriority = rows.filter((row) => Number(row.renewal_score || 0) >= 70).length;
  const recommendations = [];
  const topBrand = group('brand')[0];
  const topProvince = group('province')[0];

  recommendations.push({
    id: 'seasonal',
    title: `Campaña estacional de ${seasonalType === 'VERANO' ? 'verano' : 'invierno'}`,
    reason: `${rows.length.toLocaleString('es-ES')} instalaciones activas disponen de teléfono y no están excluidas.`,
    estimatedContacts: rows.length,
    type: seasonalType,
    filters: { communication: 'phone' },
    priority: 'ALTA',
  });
  if (topBrand) recommendations.push({
    id: 'brand', title: `Seguimiento de equipos ${topBrand.value}`,
    reason: `Es la marca con mayor presencia entre los contactos disponibles (${topBrand.count}).`,
    estimatedContacts: topBrand.count, type: seasonalType,
    filters: { brand: topBrand.value, communication: 'phone' }, priority: 'MEDIA',
  });
  if (topProvince) recommendations.push({
    id: 'province', title: `Campaña local en ${topProvince.value}`,
    reason: `Permite concentrar la acción comercial en ${topProvince.count} instalaciones de la misma provincia.`,
    estimatedContacts: topProvince.count, type: seasonalType,
    filters: { province: topProvince.value, communication: 'phone' }, priority: 'MEDIA',
  });

  return res.json({
    data: { generatedAt: new Date().toISOString(), seasonalType, callable: rows.length, highPriority, topBrands: group('brand'), topProvinces: group('province'), recommendations },
  });
});

commercialAiRouter.post('/recommendations/:recommendationId/create-draft', async (req, res) => {
  const { title, type, filters, notes } = req.body || {};
  if (!title || !['VERANO', 'INVIERNO', 'SIBER'].includes(type)) return res.status(400).json({ error: 'La recomendación no contiene los datos necesarios.' });
  const { data, error } = await supabase.from('campaigns').insert({
    name: String(title).trim(), type, start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    vapi_agent_id: retellCampaignAgentId,
    active: true, status: 'BORRADOR', filters: filters || {},
    notes: String(notes || 'Borrador creado desde IA Comercial. Requiere revisión humana.'),
  }).select('id,name,status').single();
  if (error) return res.status(500).json({ error: 'No se pudo crear el borrador.', detail: error.message });
  return res.status(201).json({ data });
});
