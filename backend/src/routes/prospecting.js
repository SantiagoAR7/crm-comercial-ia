import { Router } from 'express';
import { supabase } from '../services/supabase.js';

export const prospectingRouter = Router();

const allowedProspectStatuses = new Set(['NUEVO', 'INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'DESCARTADO', 'CONVERTIDO']);
const allowedMessageStatuses = new Set(['BORRADOR', 'APROBADO', 'DESCARTADO', 'ENVIADO', 'RESPONDIDO']);
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiProspectingModel = process.env.OPENAI_PROSPECTING_MODEL || 'gpt-4.1-mini';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWebsite(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase();
}

function websiteKey(value) {
  const cleanWebsite = normalizeWebsite(value);
  if (!cleanWebsite) return '';
  try {
    return new URL(cleanWebsite).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return cleanWebsite.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

function prospectIdentityKeys(row) {
  const keys = [];
  const email = normalizeComparable(row.email);
  if (email) keys.push(`email:${email}`);

  const website = websiteKey(row.website);
  if (website) keys.push(`website:${website}`);

  const company = normalizeComparable(row.company_name || row.companyName);
  if (company) keys.push(`company:${company}`);

  return keys;
}

function scoreProspect(prospect) {
  let score = 40;
  if (prospect.website) score += 15;
  if (prospect.email) score += 15;
  if (prospect.contact_role) score += 10;
  if (prospect.sector) score += 8;
  if (prospect.company_size) score += 6;
  if (prospect.linkedin_url) score += 6;
  return Math.min(100, score);
}

function priorityFromScore(score) {
  if (score >= 75) return 'ALTA';
  if (score >= 55) return 'MEDIA';
  return 'BAJA';
}

function buildResearch(prospect, list) {
  const company = prospect.company_name;
  const role = prospect.contact_role || 'responsable comercial/operativo';
  const sector = prospect.sector || list?.icp?.sector || 'su sector';
  const offer = list?.icp?.offer || 'una conversación breve para evaluar oportunidades de mejora';
  const pain = list?.icp?.pain || 'mejorar eficiencia comercial y detectar oportunidades con menos trabajo manual';

  return {
    company_summary: `${company} parece encajar con una prospección B2B orientada a ${sector}. La información cargada permite preparar una apertura personalizada sin iniciar todavía contacto automático.`,
    pain_hypothesis: `Como ${role}, probablemente le interese ${pain}.`,
    buying_signal: prospect.website
      ? `Tiene presencia web identificada (${prospect.website}), suficiente para priorizar investigación manual o enriquecimiento posterior.`
      : 'Falta web corporativa; conviene enriquecer antes de contactar.',
    personalization_angle: `Abrir con una hipótesis concreta sobre ${sector} y evitar un mensaje genérico de venta directa.`,
    objections: [
      'Ya tenemos proveedor o proceso interno.',
      'No es una prioridad ahora.',
      'Envia informacion por correo.',
    ],
    recommended_offer: offer,
    confidence: prospect.website || prospect.email ? 'MEDIA' : 'BAJA',
  };
}

function buildMessages(prospect, research) {
  const contact = prospect.contact_name || 'equipo';
  const company = prospect.company_name;
  const angle = research.personalization_angle;
  const offer = research.recommended_offer;

  return [
    {
      channel: 'EMAIL',
      step: 1,
      subject: `${company} | idea rapida`,
      body: `Hola ${contact},\n\nVi ${company} y pense que podria tener sentido una conversacion corta. ${angle}\n\nEstamos ayudando a equipos B2B a priorizar prospectos, personalizar contactos y reducir tareas manuales sin perder revision humana.\n\n¿Te encajaria revisar en 15 minutos si ${offer} tiene sentido para vosotros?\n\nUn saludo,`,
    },
    {
      channel: 'LINKEDIN',
      step: 1,
      subject: null,
      body: `Hola ${contact}, vi ${company} y queria conectar. Estoy revisando formas de ayudar a equipos B2B a detectar oportunidades y preparar mensajes mas personalizados sin aumentar carga manual.`,
    },
    {
      channel: 'EMAIL',
      step: 2,
      subject: `Re: ${company} | idea rapida`,
      body: `Hola ${contact},\n\nTe escribo solo para cerrar el hilo. La idea no era venderte algo a ciegas, sino validar si hay margen para mejorar prospeccion, seguimiento o cualificacion comercial en ${company}.\n\nSi no es prioridad, lo dejo aqui. Si tiene sentido, puedo enviarte una propuesta concreta en 3 puntos.\n\nGracias,`,
    },
  ];
}

function normalizeGeneratedContent(content, prospect, list) {
  const fallbackResearch = buildResearch(prospect, list);
  const research = content?.research && typeof content.research === 'object'
    ? {
      company_summary: normalizeText(content.research.company_summary) || fallbackResearch.company_summary,
      pain_hypothesis: normalizeText(content.research.pain_hypothesis) || fallbackResearch.pain_hypothesis,
      buying_signal: normalizeText(content.research.buying_signal) || fallbackResearch.buying_signal,
      personalization_angle: normalizeText(content.research.personalization_angle) || fallbackResearch.personalization_angle,
      objections: Array.isArray(content.research.objections) && content.research.objections.length
        ? content.research.objections.map((item) => normalizeText(item)).filter(Boolean).slice(0, 6)
        : fallbackResearch.objections,
      recommended_offer: normalizeText(content.research.recommended_offer) || fallbackResearch.recommended_offer,
      confidence: ['BAJA', 'MEDIA', 'ALTA'].includes(content.research.confidence)
        ? content.research.confidence
        : fallbackResearch.confidence,
    }
    : fallbackResearch;

  const fallbackMessages = buildMessages(prospect, research);
  const validMessages = Array.isArray(content?.messages)
    ? content.messages
      .map((message, index) => ({
        channel: ['EMAIL', 'LINKEDIN', 'WHATSAPP', 'LLAMADA'].includes(message?.channel)
          ? message.channel
          : index === 1 ? 'LINKEDIN' : 'EMAIL',
        step: Math.max(1, Number(message?.step || index + 1)),
        subject: normalizeText(message?.subject) || null,
        body: normalizeText(message?.body),
      }))
      .filter((message) => message.body)
      .slice(0, 5)
    : [];

  return {
    research,
    messages: validMessages.length ? validMessages : fallbackMessages,
  };
}

async function generateWithOpenAI(prospect, list) {
  if (!openaiApiKey) return null;

  const prompt = {
    list: {
      name: list?.name,
      icp: list?.icp || {},
    },
    prospect: {
      company_name: prospect.company_name,
      website: prospect.website,
      linkedin_url: prospect.linkedin_url,
      contact_name: prospect.contact_name,
      contact_role: prospect.contact_role,
      email: prospect.email,
      phone: prospect.phone,
      country: prospect.country,
      city: prospect.city,
      sector: prospect.sector,
      company_size: prospect.company_size,
      notes: prospect.notes,
    },
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiProspectingModel,
      instructions: [
        'Eres un SDR B2B senior para campañas outbound revisadas por humanos.',
        'Escribe en español natural, directo y profesional.',
        'No inventes datos específicos no presentes. Si falta información, trabaja con hipótesis prudentes.',
        'Devuelve exclusivamente JSON válido con las claves research y messages.',
        'messages debe incluir email paso 1, LinkedIn paso 1 y email follow-up paso 2.',
      ].join(' '),
      input: `Genera investigación comercial y mensajes personalizados para este prospecto:\n${JSON.stringify(prompt, null, 2)}\n\nFormato JSON esperado:\n{\n  "research": {\n    "company_summary": "...",\n    "pain_hypothesis": "...",\n    "buying_signal": "...",\n    "personalization_angle": "...",\n    "objections": ["...", "..."],\n    "recommended_offer": "...",\n    "confidence": "BAJA|MEDIA|ALTA"\n  },\n  "messages": [\n    {"channel":"EMAIL","step":1,"subject":"...","body":"..."},\n    {"channel":"LINKEDIN","step":1,"subject":null,"body":"..."},\n    {"channel":"EMAIL","step":2,"subject":"...","body":"..."}\n  ]\n}`,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
    signal: AbortSignal.timeout(45000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || `OpenAI respondio HTTP ${response.status}`);
  }

  const outputText = body.output_text ||
    body.output?.flatMap((item) => item.content || [])
      .map((part) => part.text || '')
      .join('\n')
      .trim();

  if (!outputText) throw new Error('OpenAI no devolvio texto.');
  return JSON.parse(outputText);
}

async function generateProspectingContent(prospect, list) {
  if (openaiApiKey) {
    try {
      const generated = await generateWithOpenAI(prospect, list);
      return {
        ...normalizeGeneratedContent(generated, prospect, list),
        generatedBy: `OPENAI:${openaiProspectingModel}`,
        rawSources: [{ provider: 'openai', model: openaiProspectingModel }],
      };
    } catch (error) {
      console.error('OpenAI prospecting fallback:', error instanceof Error ? error.message : error);
    }
  }

  const research = buildResearch(prospect, list);
  return {
    research,
    messages: buildMessages(prospect, research),
    generatedBy: 'MVP_RULES',
    rawSources: [],
  };
}

function normalizeProspectRow(row) {
  if (!row) return row;
  const research = Array.isArray(row.prospect_research)
    ? row.prospect_research[0] || null
    : row.prospect_research || null;
  const messages = Array.isArray(row.prospect_messages)
    ? [...row.prospect_messages].sort((a, b) => a.step - b.step || String(a.channel).localeCompare(String(b.channel)))
    : [];

  return {
    ...row,
    prospect_research: research,
    prospect_messages: messages,
  };
}

async function loadList(listId) {
  const { data, error } = await supabase
    .from('prospecting_lists')
    .select('id, name, icp, status')
    .eq('id', listId)
    .single();
  return { data, error };
}

prospectingRouter.get('/lists', async (_req, res) => {
  const { data, error } = await supabase
    .from('prospecting_lists')
    .select('id, name, description, icp, status, source, total_prospects, researched_prospects, approved_prospects, created_at, updated_at')
    .neq('status', 'ARCHIVADA')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'No se pudieron obtener las listas de prospeccion.', detail: error.message });
  }

  return res.json({ data: data || [] });
});

prospectingRouter.post('/lists', async (req, res) => {
  const { name, description = '', icp = {}, source = 'MANUAL' } = req.body ?? {};
  const cleanName = normalizeText(name);

  if (!cleanName) {
    return res.status(400).json({ error: 'El nombre de la lista es obligatorio.' });
  }

  const { data, error } = await supabase
    .from('prospecting_lists')
    .insert({
      name: cleanName,
      description: normalizeText(description) || null,
      icp: typeof icp === 'object' && icp ? icp : {},
      source: normalizeText(source) || 'MANUAL',
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'No se pudo crear la lista.', detail: error.message });
  }

  return res.status(201).json({ data });
});

prospectingRouter.patch('/lists/:id', async (req, res) => {
  const { status, name, description, icp } = req.body ?? {};
  const updates = {};

  if (typeof name === 'string') {
    const cleanName = normalizeText(name);
    if (!cleanName) return res.status(400).json({ error: 'El nombre de la lista es obligatorio.' });
    updates.name = cleanName;
  }
  if (typeof description === 'string' || description === null) {
    updates.description = normalizeText(description) || null;
  }
  if (icp && typeof icp === 'object') updates.icp = icp;
  if (status) {
    const allowedListStatuses = new Set(['BORRADOR', 'INVESTIGANDO', 'REVISION', 'LISTA', 'ARCHIVADA']);
    if (!allowedListStatuses.has(status)) {
      return res.status(400).json({ error: 'El estado de la lista no es valido.' });
    }
    updates.status = status;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No hay cambios para guardar.' });
  }

  const { data, error } = await supabase
    .from('prospecting_lists')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'No se pudo actualizar la lista.', detail: error.message });
  }

  return res.json({ data });
});

prospectingRouter.delete('/lists/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('prospecting_lists')
    .update({ status: 'ARCHIVADA' })
    .eq('id', req.params.id)
    .select('id, status')
    .single();

  if (error) {
    return res.status(500).json({ error: 'No se pudo archivar la lista.', detail: error.message });
  }

  return res.json({ data });
});

prospectingRouter.get('/lists/:id/prospects', async (req, res) => {
  const { data, error } = await supabase
    .from('prospects')
    .select(`
      id,
      list_id,
      company_name,
      website,
      linkedin_url,
      contact_name,
      contact_role,
      email,
      phone,
      country,
      city,
      sector,
      company_size,
      source,
      status,
      fit_score,
      priority,
      tags,
      notes,
      created_at,
      updated_at,
      prospect_research(company_summary, pain_hypothesis, buying_signal, personalization_angle, recommended_offer, confidence, generated_at),
      prospect_messages(id, channel, step, subject, body, status, created_at)
    `)
    .eq('list_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    return res.status(500).json({ error: 'No se pudieron obtener los prospectos.', detail: error.message });
  }

  return res.json({ data: (data || []).map(normalizeProspectRow) });
});

prospectingRouter.post('/lists/:id/prospects', async (req, res) => {
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const inputRows = Array.isArray(req.body?.prospects) ? req.body.prospects : [];
  const rows = inputRows
    .map((item) => {
      const companyName = normalizeText(item.companyName || item.company_name);
      if (!companyName) return null;
      return {
        list_id: list.id,
        company_name: companyName,
        website: normalizeWebsite(item.website),
        linkedin_url: normalizeText(item.linkedinUrl || item.linkedin_url) || null,
        contact_name: normalizeText(item.contactName || item.contact_name) || null,
        contact_role: normalizeText(item.contactRole || item.contact_role) || null,
        email: normalizeText(item.email).toLowerCase() || null,
        phone: normalizeText(item.phone) || null,
        country: normalizeText(item.country) || null,
        city: normalizeText(item.city) || null,
        sector: normalizeText(item.sector) || null,
        company_size: normalizeText(item.companySize || item.company_size) || null,
        source: normalizeText(item.source) || 'MANUAL',
        notes: normalizeText(item.notes) || null,
      };
    })
    .filter(Boolean)
    .slice(0, 500);

  if (!rows.length) {
    return res.status(400).json({ error: 'Incluye al menos un prospecto con empresa.' });
  }

  const uniqueRows = [];
  const incomingKeys = new Set();
  const skipped = [];

  for (const row of rows) {
    const keys = prospectIdentityKeys(row);
    if (keys.some((key) => incomingKeys.has(key))) {
      skipped.push({ companyName: row.company_name, reason: 'Duplicado en el archivo' });
      continue;
    }
    keys.forEach((key) => incomingKeys.add(key));
    uniqueRows.push(row);
  }

  const { data: existingProspects, error: existingError } = await supabase
    .from('prospects')
    .select('company_name, website, email')
    .eq('list_id', list.id);

  if (existingError) {
    return res.status(500).json({ error: 'No se pudieron validar duplicados.', detail: existingError.message });
  }

  const existingKeys = new Set((existingProspects || []).flatMap(prospectIdentityKeys));
  const insertRows = uniqueRows.filter((row) => {
    const exists = prospectIdentityKeys(row).some((key) => existingKeys.has(key));
    if (exists) skipped.push({ companyName: row.company_name, reason: 'Ya existe en esta lista' });
    return !exists;
  });

  if (!insertRows.length) {
    return res.status(200).json({ data: [], inserted: 0, skipped: skipped.length, skippedRows: skipped });
  }

  const { data, error } = await supabase
    .from('prospects')
    .insert(insertRows)
    .select();

  if (error) {
    return res.status(500).json({ error: 'No se pudieron guardar los prospectos.', detail: error.message });
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: list.id });
  return res.status(201).json({
    data,
    inserted: data?.length || insertRows.length,
    skipped: skipped.length,
    skippedRows: skipped,
  });
});

prospectingRouter.post('/prospects/:id/generate-ai', async (req, res) => {
  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('*, prospecting_lists(id, name, icp)')
    .eq('id', req.params.id)
    .single();

  if (prospectError) {
    return res.status(404).json({ error: 'No se encontro el prospecto.' });
  }

  const fitScore = scoreProspect(prospect);
  const priority = priorityFromScore(fitScore);
  const { research, messages, generatedBy, rawSources } =
    await generateProspectingContent(prospect, prospect.prospecting_lists);

  const { data: savedResearch, error: researchError } = await supabase
    .from('prospect_research')
    .upsert({
      prospect_id: prospect.id,
      ...research,
      raw_sources: rawSources,
      generated_by: generatedBy,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'prospect_id' })
    .select()
    .single();

  if (researchError) {
    return res.status(500).json({ error: 'No se pudo guardar la investigacion IA.', detail: researchError.message });
  }

  await supabase
    .from('prospect_messages')
    .delete()
    .eq('prospect_id', prospect.id)
    .eq('status', 'BORRADOR');

  const { data: savedMessages, error: messagesError } = await supabase
    .from('prospect_messages')
    .insert(messages.map((message) => ({
      prospect_id: prospect.id,
      ...message,
      generated_by: generatedBy,
    })))
    .select();

  if (messagesError) {
    return res.status(500).json({ error: 'Se guardo la investigacion, pero no los mensajes.', detail: messagesError.message });
  }

  const { data: updatedProspect, error: updateError } = await supabase
    .from('prospects')
    .update({
      fit_score: fitScore,
      priority,
      status: 'MENSAJE_GENERADO',
    })
    .eq('id', prospect.id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ error: 'Se genero el contenido, pero no se actualizo el prospecto.', detail: updateError.message });
  }

  await Promise.all([
    supabase.from('prospect_activities').insert({
      prospect_id: prospect.id,
      type: 'INVESTIGACION',
      description: 'Investigacion y mensajes generados para revision humana.',
      metadata: { fitScore, priority },
    }),
    supabase.rpc('refresh_prospecting_list_counters', { p_list_id: prospect.list_id }),
  ]);

  return res.json({
    data: {
      prospect: updatedProspect,
      research: savedResearch,
      messages: savedMessages || [],
    },
  });
});

prospectingRouter.post('/lists/:id/generate-ai', async (req, res) => {
  const { limit = 25 } = req.body ?? {};
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const { data: prospects, error: prospectsError } = await supabase
    .from('prospects')
    .select('*')
    .eq('list_id', list.id)
    .in('status', ['NUEVO', 'INVESTIGADO'])
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (prospectsError) {
    return res.status(500).json({ error: 'No se pudieron cargar los prospectos pendientes.', detail: prospectsError.message });
  }

  let generated = 0;
  const errors = [];

  for (const prospect of prospects || []) {
    const fitScore = scoreProspect(prospect);
    const priority = priorityFromScore(fitScore);
    const { research, messages, generatedBy, rawSources } =
      await generateProspectingContent(prospect, list);

    const { error: researchError } = await supabase
      .from('prospect_research')
      .upsert({
        prospect_id: prospect.id,
        ...research,
        raw_sources: rawSources,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'prospect_id' });

    if (researchError) {
      errors.push({ prospectId: prospect.id, error: researchError.message });
      continue;
    }

    await supabase
      .from('prospect_messages')
      .delete()
      .eq('prospect_id', prospect.id)
      .eq('status', 'BORRADOR');

    const { error: messagesError } = await supabase
      .from('prospect_messages')
      .insert(messages.map((message) => ({
        prospect_id: prospect.id,
        ...message,
        generated_by: generatedBy,
      })));

    if (messagesError) {
      errors.push({ prospectId: prospect.id, error: messagesError.message });
      continue;
    }

    const { error: updateError } = await supabase
      .from('prospects')
      .update({
        fit_score: fitScore,
        priority,
        status: 'MENSAJE_GENERADO',
      })
      .eq('id', prospect.id);

    if (updateError) {
      errors.push({ prospectId: prospect.id, error: updateError.message });
      continue;
    }

    await supabase.from('prospect_activities').insert({
      prospect_id: prospect.id,
      type: 'INVESTIGACION',
      description: 'Investigacion y mensajes generados en lote para revision humana.',
      metadata: { fitScore, priority },
    });

    generated += 1;
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: list.id });

  return res.json({
    generated,
    attempted: prospects?.length || 0,
    errors,
  });
});

prospectingRouter.patch('/messages/:id', async (req, res) => {
  const { subject, body, status } = req.body ?? {};
  const updates = {};

  if (typeof subject === 'string' || subject === null) updates.subject = normalizeText(subject) || null;
  if (typeof body === 'string') {
    const cleanBody = normalizeText(body);
    if (!cleanBody) return res.status(400).json({ error: 'El mensaje no puede quedar vacio.' });
    updates.body = cleanBody;
  }
  if (status) {
    if (!allowedMessageStatuses.has(status)) {
      return res.status(400).json({ error: 'El estado del mensaje no es valido.' });
    }
    updates.status = status;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No hay cambios para guardar.' });
  }

  const { data, error } = await supabase
    .from('prospect_messages')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, prospect_id, channel, step, subject, body, status, updated_at')
    .single();

  if (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el mensaje.', detail: error.message });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: data.prospect_id,
    type: 'MENSAJE',
    description: status ? `Mensaje actualizado a ${status}.` : 'Mensaje editado manualmente.',
    metadata: { messageId: data.id, status: data.status },
  });

  return res.json({ data });
});

prospectingRouter.patch('/prospects/:id/status', async (req, res) => {
  const { status } = req.body ?? {};
  if (!allowedProspectStatuses.has(status)) {
    return res.status(400).json({ error: 'El estado del prospecto no es valido.' });
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el estado.', detail: error.message });
  }

  await Promise.all([
    supabase.from('prospect_activities').insert({
      prospect_id: data.id,
      type: status === 'APROBADO' ? 'APROBACION' : status === 'DESCARTADO' ? 'DESCARTE' : 'NOTA',
      description: `Estado actualizado a ${status}.`,
      metadata: { status },
    }),
    supabase.rpc('refresh_prospecting_list_counters', { p_list_id: data.list_id }),
  ]);

  return res.json({ data });
});
