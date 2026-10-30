import { Router } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { supabase } from '../services/supabase.js';
import { cleanReplyBody, emailStatus, pollProspectingInbox, sendProspectingEmail } from '../services/prospecting-email.js';
import {
  linkedinIdeasContext,
  listLinkedinIdeas,
  saveGeneratedLinkedinIdeas,
  updateLinkedinIdea,
  updateLinkedinSettings,
} from '../services/linkedin-ideas-store.js';

export const prospectingRouter = Router();

const allowedProspectStatuses = new Set(['NUEVO', 'INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'DESCARTADO', 'CONVERTIDO']);
const allowedMessageStatuses = new Set(['BORRADOR', 'APROBADO', 'DESCARTADO', 'ENVIADO', 'RESPONDIDO']);
const allowedContactChannels = new Set(['EMAIL', 'LINKEDIN', 'WHATSAPP', 'LLAMADA']);
const allowedOutreachStatuses = new Set(['CONTACTADO', 'INTERESADO', 'NO_INTERESADO', 'MAS_TARDE', 'OBJECION', 'PIDIO_INFO', 'REUNION', 'NO_CONTACTAR']);
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiProspectingModel = process.env.OPENAI_PROSPECTING_MODEL || 'gpt-4.1-mini';
const prospeoApiKey = process.env.PROSPEO_API_KEY;
const prospeoDailySearchLimit = Math.max(0, Number(process.env.PROSPEO_DAILY_SEARCH_LIMIT || 50));
const prospeoDailyEnrichLimit = Math.max(0, Number(process.env.PROSPEO_DAILY_ENRICH_LIMIT || 0));
const prospectingDailyEmailLimit = Math.max(0, Number(process.env.PROSPECTING_EMAIL_DAILY_SEND_LIMIT || 50));
const prospectingFollowupDelayDays = Math.max(1, Number(process.env.PROSPECTING_FOLLOWUP_DELAY_DAYS || 3));
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const prospeoUsagePath = path.join(dataDir, 'prospeo-usage.json');
const plasticProspectingIndustries = ['Plastics Manufacturing', 'Plastics and Rubber Product Manufacturing'];
const plasticProspectingLocations = [
  'Ibi, Spain',
  'Alcoy, Spain',
  'Castalla, Spain',
  'Onil, Spain',
  'Tibi, Spain',
  'Cocentaina, Spain',
  'Muro del Alcoy, Spain',
  'Bañeres, Spain',
];
const plasticProspectingKeywords = [
  'inyección de plásticos',
  'transformación de plásticos',
  'moldes',
  'termoplásticos',
  'inyectados plásticos',
  'plastic injection molding',
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function todayStartIso() {
  const day = todayKey();
  return `${day}T00:00:00.000Z`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitTerms(value, limit = 20) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean).slice(0, limit);
  }
  return normalizeText(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
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

function isUsableEmail(value) {
  const email = normalizeText(value).toLowerCase();
  return Boolean(email && !email.includes('*') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function isUsablePhone(value) {
  const phone = normalizeText(value);
  const digits = phone.replace(/\D/g, '');
  return Boolean(phone && !phone.includes('*') && digits.length >= 7);
}

function readNoteValue(notes, key) {
  const prefix = `${key}:`;
  return normalizeText(notes)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim() || '';
}

function isPlasticProspectingList(list) {
  const haystack = [
    list?.name,
    list?.description,
    list?.icp?.vertical,
    list?.icp?.sector,
    list?.icp?.searchNotes,
  ].map(normalizeText).join(' ').toLowerCase();
  return /industrial_foia_castalla|pl[aá]stic|plastic|inyecci[oó]n|extrusi[oó]n/.test(haystack);
}

function isIndustrialCoolingProspectingList(list) {
  const haystack = [
    list?.name,
    list?.description,
    list?.icp?.vertical,
    list?.icp?.sector,
    list?.icp?.pain,
    list?.icp?.offer,
    list?.icp?.searchNotes,
  ].map(normalizeText).join(' ').toLowerCase();
  return /industrial_foia_castalla|refrigeraci[oó]n industrial|agua refrigerada|chiller|sala blanca|pl[aá]stic|plastic|inyecci[oó]n|extrusi[oó]n/.test(haystack);
}

function lockPlasticProspeoFilters(payload) {
  const filters = payload.filters || {};
  filters.company_industry = { include: plasticProspectingIndustries };
  filters.company_location_search = { include: plasticProspectingLocations };
  filters.company_keywords = {
    include: plasticProspectingKeywords,
    include_all: false,
    search_everywhere: true,
  };
  filters.max_person_per_company = Math.min(2, Math.max(1, Number(filters.max_person_per_company || 2)));
  payload.filters = filters;
  return payload;
}

function validateProspeoSearchPayload(payload, list) {
  const filters = payload.filters || {};
  const industries = Array.isArray(filters.company_industry?.include) ? filters.company_industry.include : [];
  const locations = Array.isArray(filters.company_location_search?.include) ? filters.company_location_search.include : [];

  if (!industries.length) {
    return 'La busqueda debe llevar industria obligatoria para evitar resultados demasiado amplios.';
  }

  if (isPlasticProspectingList(list)) {
    const validIndustry = industries.some((industry) => plasticProspectingIndustries.includes(industry));
    if (!validIndustry) {
      return `Para esta campaña usa industria exacta: ${plasticProspectingIndustries.join(', ')}.`;
    }
    if (locations.some((location) => /greater alicante|alicante area|comunidad valenciana/i.test(location))) {
      return 'La ubicacion esta demasiado amplia. Usa ciudades exactas: Ibi, Alcoy, Castalla, Onil, Tibi, Cocentaina, Muro del Alcoy y Bañeres.';
    }
  }

  return '';
}

function prepareProspeoSearchPayload(list, body = {}) {
  const payload = buildProspeoSearchPayload({
    ...body,
    sector: body?.filters ? body?.sector : body?.sector || list.icp?.sector,
    country: body?.filters ? body?.country : body?.country || list.icp?.country,
    targetRole: body?.filters ? body?.targetRole : body?.targetRole || list.icp?.targetRole,
  });

  if (isPlasticProspectingList(list)) {
    lockPlasticProspeoFilters(payload);
  }

  return payload;
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

async function readProspeoUsage() {
  const day = todayKey();
  try {
    const raw = await fs.readFile(prospeoUsagePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.date === day) {
      return {
        date: day,
        search: Number(parsed.search || 0),
        enrich: Number(parsed.enrich || 0),
      };
    }
  } catch {
    // Missing or invalid usage file starts a fresh day.
  }

  return { date: day, search: 0, enrich: 0 };
}

async function writeProspeoUsage(usage) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(prospeoUsagePath, JSON.stringify(usage, null, 2));
}

async function prospeoUsageSummary() {
  const usage = await readProspeoUsage();
  return {
    configured: Boolean(prospeoApiKey),
    date: usage.date,
    searchUsed: usage.search,
    searchLimit: prospeoDailySearchLimit,
    searchRemaining: Math.max(0, prospeoDailySearchLimit - usage.search),
    enrichUsed: usage.enrich,
    enrichLimit: prospeoDailyEnrichLimit,
    enrichRemaining: Math.max(0, prospeoDailyEnrichLimit - usage.enrich),
  };
}

async function reserveProspeoUsage(kind, count = 1) {
  const usage = await readProspeoUsage();
  const field = kind === 'enrich' ? 'enrich' : 'search';
  const limit = field === 'enrich' ? prospeoDailyEnrichLimit : prospeoDailySearchLimit;
  const nextValue = Number(usage[field] || 0) + count;

  if (nextValue > limit) {
    const label = field === 'enrich' ? 'enriquecimientos' : 'busquedas';
    throw new Error(`Limite diario de Prospeo alcanzado para ${label}: ${usage[field]}/${limit}.`);
  }

  const nextUsage = { ...usage, [field]: nextValue };
  await writeProspeoUsage(nextUsage);
  return nextUsage;
}

async function checkProspeoUsageAvailable(kind, count = 1) {
  const usage = await readProspeoUsage();
  const field = kind === 'enrich' ? 'enrich' : 'search';
  const limit = field === 'enrich' ? prospeoDailyEnrichLimit : prospeoDailySearchLimit;
  const nextValue = Number(usage[field] || 0) + count;

  if (nextValue > limit) {
    const label = field === 'enrich' ? 'enriquecimientos' : 'busquedas';
    throw new Error(`Limite diario de Prospeo alcanzado para ${label}: ${usage[field]}/${limit}.`);
  }

  return usage;
}

function buildProspeoSearchPayload(input = {}) {
  const filters = input.filters && typeof input.filters === 'object' ? input.filters : {};
  const jobTitles = splitTerms(input.jobTitles || input.job_titles || input.targetRole || input.target_role, 20);
  const locations = splitTerms(input.locations || input.location || input.country, 20);
  const industries = splitTerms(input.industries || input.industry || input.sector, 20);
  const companyKeywords = splitTerms(input.companyKeywords || input.company_keywords, 20);
  const companyNames = splitTerms(input.companyNames || input.company_names, 20);

  if (jobTitles.length && !filters.person_job_title) {
    filters.person_job_title = {
      include: jobTitles,
      match_mode: 'CONTAINS',
    };
  }

  if (locations.length && !filters.company_location_search) {
    filters.company_location_search = { include: locations };
  }

  if (industries.length && !filters.company_industry) {
    filters.company_industry = { include: industries };
  }

  if (companyKeywords.length && !filters.company_keywords) {
    filters.company_keywords = {
      include: companyKeywords,
      include_all: false,
      search_everywhere: true,
    };
  }

  if (companyNames.length && !filters.company) {
    filters.company = { names: { include: companyNames } };
  }

  if (!filters.person_contact_details && input.onlyVerifiedEmail !== false) {
    filters.person_contact_details = {
      email: ['VERIFIED'],
      operator: 'OR',
      hide_people_with_details_already_revealed: false,
    };
  }

  if (!filters.max_person_per_company) {
    filters.max_person_per_company = Math.min(5, Math.max(1, Number(input.maxPerCompany || input.max_per_company || 2)));
  }

  return {
    filters,
    page: Math.max(1, Number(input.page || 1)),
  };
}

async function callProspeo(endpoint, payload) {
  if (!prospeoApiKey) {
    throw new Error('PROSPEO_API_KEY no esta configurada.');
  }

  const response = await fetch(`https://api.prospeo.io/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-KEY': prospeoApiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.filter_error || body.message || body.error_code || body.error || `Prospeo respondio HTTP ${response.status}`);
  }

  return body;
}

function extractProspeoItems(body) {
  const candidates = [
    body?.data,
    body?.data?.people,
    body?.data?.persons,
    body?.people,
    body?.persons,
    body?.results,
    body?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizeProspeoProspect(item, list) {
  const person = item?.person || item;
  const company = item?.company || person?.company || {};
  const companyName = normalizeText(company.name || company.company_name || person.company_name || person.current_company);
  if (!companyName) return null;

  const location = person.location || company.location || {};
  const city = normalizeText(location.city || company.city || person.city) || null;
  const country = normalizeText(location.country || company.country || person.country) || null;
  const fullName = normalizeText(person.full_name || [person.first_name, person.last_name].filter(Boolean).join(' '));
  const emailValue = person.email?.email || person.email?.value || person.email || null;
  const cleanEmail = normalizeText(typeof emailValue === 'string' ? emailValue : '').toLowerCase();
  const mobileValue = person.mobile?.mobile || person.mobile?.value || person.mobile || null;
  const companyWebsite = company.website || company.domain || person.company_website;
  const companySize = company.headcount_range || company.employee_count_range || company.size || null;
  const sector = company.industry || company.main_industry || list?.icp?.sector || null;
  const prospeoPersonId = person.person_id || person.id || item.person_id;
  const prospeoCompanyId = company.company_id || company.id || item.company_id;

  return {
    list_id: list.id,
    company_name: companyName,
    website: normalizeWebsite(companyWebsite),
    linkedin_url: normalizeText(person.linkedin_url || company.linkedin_url) || null,
    contact_name: fullName || null,
    contact_role: normalizeText(person.job_title || person.title || person.headline) || null,
    email: isUsableEmail(cleanEmail) ? cleanEmail : null,
    phone: isUsablePhone(mobileValue) ? normalizeText(mobileValue) : null,
    country,
    city,
    sector: normalizeText(sector) || null,
    company_size: normalizeText(companySize) || null,
    source: 'PROSPEO',
    tags: ['prospeo'],
    notes: [
      prospeoPersonId ? `prospeo_person_id:${prospeoPersonId}` : '',
      prospeoCompanyId ? `prospeo_company_id:${prospeoCompanyId}` : '',
    ].filter(Boolean).join('\n') || null,
  };
}

function buildProspeoEnrichPayload(prospect, options = {}) {
  const personId = readNoteValue(prospect.notes, 'prospeo_person_id');
  const data = {};
  if (personId) data.person_id = personId;
  if (prospect.contact_name) data.full_name = prospect.contact_name;
  if (prospect.linkedin_url) data.linkedin_url = prospect.linkedin_url;
  if (prospect.company_name) data.company_name = prospect.company_name;
  if (prospect.website) data.company_website = websiteKey(prospect.website);

  return {
    only_verified_email: options.onlyVerifiedEmail !== false,
    enrich_mobile: options.enrichMobile === true || options.onlyVerifiedMobile === true,
    only_verified_mobile: options.onlyVerifiedMobile === true,
    data,
  };
}

function normalizeProspeoEnrichment(body, prospect) {
  const person = body?.person || {};
  const company = body?.company || {};
  const location = person.location || company.location || {};
  const emailValue = person.email?.email || '';
  const mobileValue = person.mobile?.mobile || person.mobile?.mobile_international || person.mobile?.mobile_national || '';
  const cleanEmail = isUsableEmail(emailValue) ? normalizeText(emailValue).toLowerCase() : '';
  const cleanPhone = isUsablePhone(mobileValue) ? normalizeText(mobileValue) : '';
  const nextNotes = [
    normalizeText(prospect.notes),
    body?.free_enrichment === true ? 'prospeo_enrichment:free' : 'prospeo_enrichment:charged',
    person.email?.status ? `prospeo_email_status:${person.email.status}` : '',
    person.mobile?.status ? `prospeo_mobile_status:${person.mobile.status}` : '',
  ].filter(Boolean).join('\n');

  const updates = {
    contact_name: normalizeText(person.full_name) || prospect.contact_name || null,
    contact_role: normalizeText(person.current_job_title || person.headline) || prospect.contact_role || null,
    linkedin_url: normalizeText(person.linkedin_url) || prospect.linkedin_url || null,
    website: normalizeWebsite(company.website || company.domain) || prospect.website || null,
    country: normalizeText(location.country || company.location?.country) || prospect.country || null,
    city: normalizeText(location.city || company.location?.city) || prospect.city || null,
    sector: normalizeText(company.industry) || prospect.sector || null,
    company_size: normalizeText(company.employee_range || company.headcount_range || company.employee_count_range) || prospect.company_size || null,
    notes: nextNotes,
  };

  if (cleanEmail) updates.email = cleanEmail;
  if (cleanPhone) updates.phone = cleanPhone;
  return { updates, email: cleanEmail, phone: cleanPhone };
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
  if (isIndustrialCoolingProspectingList(list)) {
    return buildIndustrialCoolingResearch(prospect, list);
  }

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

function buildIndustrialCoolingResearch(prospect, list) {
  const company = prospect.company_name;
  const role = prospect.contact_role || 'gerencia, mantenimiento u operaciones';
  const sector = prospect.sector || list?.icp?.sector || 'industria con proceso productivo';
  const offer = list?.icp?.offer || 'un diagnóstico técnico de refrigeración y climatización de proceso';
  const pain = list?.icp?.pain || 'evitar paradas de producción, estabilizar agua refrigerada y pasar de mantenimiento reactivo a preventivo';

  return {
    company_summary: `${company} encaja con una campaña industrial para ${sector}. La prioridad es validar si su proceso depende de temperatura estable, agua refrigerada, chillers, climatización de planta o condiciones de sala blanca.`,
    pain_hypothesis: `Como ${role}, probablemente le interese ${pain}.`,
    buying_signal: prospect.website
      ? `Tiene presencia web identificada (${prospect.website}), suficiente para revisar señales de proceso industrial antes de contactar.`
      : 'Falta web corporativa; conviene enriquecer o revisar manualmente antes de contactar.',
    personalization_angle: 'Abrir con una hipótesis técnica sobre continuidad de producción, control de temperatura y mantenimiento de refrigeración industrial. Evitar mensajes de aerotermia residencial o venta genérica.',
    objections: [
      'Ya tenemos empresa de mantenimiento.',
      'Ahora no podemos parar producción.',
      'Solo revisamos proveedores cuando hay avería.',
      'Envia información técnica por correo.',
    ],
    recommended_offer: offer,
    confidence: prospect.website || prospect.email ? 'MEDIA' : 'BAJA',
  };
}

function buildMessages(prospect, research) {
  const isIndustrial = /refrigeraci[oó]n|agua refrigerada|producci[oó]n|chiller|sala blanca|industrial/i.test([
    research.company_summary,
    research.pain_hypothesis,
    research.recommended_offer,
  ].join(' '));
  if (isIndustrial) {
    return buildIndustrialCoolingMessages(prospect, research);
  }

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

function buildIndustrialCoolingMessages(prospect, research) {
  const contact = prospect.contact_name || 'equipo';
  const company = prospect.company_name;
  const offer = research.recommended_offer;

  return [
    {
      channel: 'EMAIL',
      step: 1,
      subject: `${company} | refrigeración de proceso`,
      body: `Hola ${contact},\n\nTe escribo desde Davofrío porque estamos revisando empresas industriales de la zona de Ibi/Castalla/Alcoy donde la temperatura del proceso, el agua refrigerada o la climatización de planta pueden afectar producción.\n\nNo quería enviarte una propuesta genérica. La idea es validar si en ${company} tiene sentido revisar refrigeración industrial, mantenimiento preventivo o estabilidad de temperatura en proceso/salas blancas.\n\n¿Tiene sentido que lo veamos en una llamada corta y, si encaja, os enviamos un diagnóstico técnico inicial?\n\nUn saludo,`,
    },
    {
      channel: 'LINKEDIN',
      step: 1,
      subject: null,
      body: `Hola ${contact}, vi ${company} y quería conectar. En Davofrío estamos trabajando la parte de refrigeración industrial y climatización de proceso en la zona de Foia de Castalla, especialmente donde el agua refrigerada o la temperatura estable impactan producción.`,
    },
    {
      channel: 'EMAIL',
      step: 2,
      subject: `Re: ${company} | refrigeración de proceso`,
      body: `Hola ${contact},\n\nTe escribo solo para cerrar el hilo. No era una venta a ciegas: queríamos validar si en ${company} hay algún punto crítico de refrigeración, agua refrigerada, mantenimiento o climatización de proceso que merezca revisión.\n\nSi ya lo tenéis cubierto, lo dejo aquí. Si tiene sentido, puedo enviarte una propuesta concreta de revisión técnica en 3 puntos.\n\nGracias,`,
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
        'Si la lista es industrial Foia de Castalla, plásticos, inyección, extrusión, agua refrigerada, chillers o salas blancas, centra el mensaje en refrigeración industrial, climatización de proceso, continuidad de producción y mantenimiento preventivo. No uses aerotermia residencial ni prospección comercial genérica.',
        'Si la lista es aerotermia/LinkedIn, úsala como autoridad y contenido técnico, no como búsqueda industrial.',
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
  const activities = Array.isArray(row.prospect_activities)
    ? [...row.prospect_activities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  return {
    ...row,
    prospect_research: research,
    prospect_messages: messages,
    prospect_activities: activities,
  };
}

function normalizeDateTime(value) {
  const cleanValue = normalizeText(value);
  if (!cleanValue) return null;
  const date = new Date(cleanValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function prospectStatusForOutcome(status, currentStatus) {
  if (status === 'NO_INTERESADO' || status === 'NO_CONTACTAR') return 'DESCARTADO';
  if (status === 'INTERESADO' || status === 'PIDIO_INFO' || status === 'REUNION') return 'APROBADO';
  if (currentStatus === 'NUEVO' || currentStatus === 'INVESTIGADO' || currentStatus === 'MENSAJE_GENERADO') return 'APROBADO';
  return currentStatus;
}

function activityOutcome(activity) {
  const metadata = activity?.metadata || {};
  if (typeof metadata.outreachStatus === 'string' && metadata.outreachStatus) return metadata.outreachStatus;
  if (metadata.emailDirection === 'inbound') return 'RESPONDIDO';
  return '';
}

function activityBody(activity) {
  const metadata = activity?.metadata || {};
  const body = normalizeText(metadata.responseText || metadata.body || metadata.notes || '');
  if (metadata.emailDirection === 'inbound') return cleanReplyBody(body);
  return body;
}

function emptySequenceSummary() {
  return {
    delayDays: prospectingFollowupDelayDays,
    metrics: {
      missingEmail: 0,
      pendingFirstEmail: 0,
      waitingReply: 0,
      readyFollowUp: 0,
      responded: 0,
      stopped: 0,
    },
    actions: [],
  };
}

function buildSequenceSummary({ prospects = [], messages = [], activities = [] }) {
  const sequence = emptySequenceSummary();
  const now = Date.now();
  const dueMs = prospectingFollowupDelayDays * 24 * 60 * 60 * 1000;
  const messagesByProspect = new Map();
  const activitiesByProspect = new Map();

  for (const message of messages || []) {
    if (message.channel !== 'EMAIL') continue;
    const items = messagesByProspect.get(message.prospect_id) || [];
    items.push(message);
    messagesByProspect.set(message.prospect_id, items);
  }
  for (const activity of activities || []) {
    const items = activitiesByProspect.get(activity.prospect_id) || [];
    items.push(activity);
    activitiesByProspect.set(activity.prospect_id, items);
  }

  for (const prospect of prospects || []) {
    const emailMessages = (messagesByProspect.get(prospect.id) || [])
      .sort((a, b) => Number(a.step || 0) - Number(b.step || 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const prospectActivities = activitiesByProspect.get(prospect.id) || [];
    const latestOutcome = prospectActivities
      .map(activityOutcome)
      .find(Boolean);
    const outboundActivities = prospectActivities
      .filter((activity) => activity.metadata?.emailDirection === 'outbound')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const inboundActivities = prospectActivities
      .filter((activity) => activity.metadata?.emailDirection === 'inbound' || activity.metadata?.responseText)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const baseAction = {
      prospectId: prospect.id,
      companyName: prospect.company_name,
      contactName: prospect.contact_name || '',
      contactEmail: prospect.email || '',
      prospectStatus: prospect.status,
      outcome: latestOutcome,
    };

    if (!prospect.email) {
      sequence.metrics.missingEmail += 1;
      sequence.actions.push({
        ...baseAction,
        type: 'MISSING_EMAIL',
        label: 'Falta email',
        detail: 'Completa o enriquece el email antes de contactar.',
      });
      continue;
    }

    if (prospect.status === 'DESCARTADO' || ['NO_CONTACTAR', 'NO_INTERESADO'].includes(latestOutcome)) {
      sequence.metrics.stopped += 1;
      sequence.actions.push({
        ...baseAction,
        type: 'STOPPED',
        label: latestOutcome || 'Descartado',
        detail: 'Secuencia detenida para evitar nuevo contacto.',
      });
      continue;
    }

    if (inboundActivities.length) {
      sequence.metrics.responded += 1;
      sequence.actions.push({
        ...baseAction,
        type: 'RESPONDED',
        label: 'Respondió',
        detail: cleanReplyBody(activityBody(inboundActivities[0])).slice(0, 180),
        lastActivityAt: inboundActivities[0].created_at,
      });
      continue;
    }

    const sentEmailMessages = emailMessages.filter((message) => ['ENVIADO', 'RESPONDIDO'].includes(message.status));
    const nextUnsent = emailMessages.find((message) => !['ENVIADO', 'RESPONDIDO', 'DESCARTADO'].includes(message.status));

    if (!sentEmailMessages.length) {
      sequence.metrics.pendingFirstEmail += 1;
      sequence.actions.push({
        ...baseAction,
        type: 'PENDING_FIRST_EMAIL',
        label: nextUnsent ? 'Enviar paso 1' : 'Generar mensaje',
        detail: nextUnsent ? 'Primer email listo para revisión y envío.' : 'Genera o crea un email inicial antes de contactar.',
        nextMessageId: nextUnsent?.id || null,
        nextMessageSubject: nextUnsent?.subject || '',
      });
      continue;
    }

    const lastSentAt = outboundActivities[0]?.created_at || sentEmailMessages[sentEmailMessages.length - 1]?.created_at;
    const lastSentTimestamp = new Date(lastSentAt).getTime();
    const isDue = Number.isFinite(lastSentTimestamp) && now - lastSentTimestamp >= dueMs;

    if (isDue && nextUnsent) {
      sequence.metrics.readyFollowUp += 1;
      sequence.actions.push({
        ...baseAction,
        type: 'READY_FOLLOW_UP',
        label: `Enviar follow-up ${nextUnsent.step}`,
        detail: `Sin respuesta desde ${formatDateOnly(lastSentAt)}.`,
        lastSentAt,
        nextMessageId: nextUnsent.id,
        nextMessageSubject: nextUnsent.subject || '',
      });
      continue;
    }

    sequence.metrics.waitingReply += 1;
    sequence.actions.push({
      ...baseAction,
      type: 'WAITING_REPLY',
      label: 'Esperando respuesta',
      detail: lastSentAt ? `Último email: ${formatDateOnly(lastSentAt)}.` : 'Email enviado.',
      lastSentAt,
      nextMessageId: nextUnsent?.id || null,
      nextMessageSubject: nextUnsent?.subject || '',
    });
  }

  sequence.actions = sequence.actions.slice(0, 75);
  return sequence;
}

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'fecha no disponible';
  return date.toISOString().slice(0, 10);
}

async function prospectingEmailUsageSummary() {
  const { count, error } = await supabase
    .from('prospect_activities')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'MENSAJE')
    .contains('metadata', { emailDirection: 'outbound' })
    .gte('created_at', todayStartIso());

  if (error) throw error;
  const sentToday = count || 0;
  return {
    date: todayKey(),
    sentToday,
    dailyLimit: prospectingDailyEmailLimit,
    remainingToday: Math.max(0, prospectingDailyEmailLimit - sentToday),
  };
}

async function latestProspectOutcome(prospectId) {
  const { data, error } = await supabase
    .from('prospect_activities')
    .select('metadata, created_at')
    .eq('prospect_id', prospectId)
    .not('metadata->>outreachStatus', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return normalizeText(data?.[0]?.metadata?.outreachStatus).toUpperCase();
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

prospectingRouter.get('/prospeo/usage', async (_req, res) => {
  return res.json({ data: await prospeoUsageSummary() });
});

prospectingRouter.get('/email/status', async (_req, res) => {
  try {
    return res.json({ data: { ...emailStatus(), usage: await prospectingEmailUsageSummary() } });
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo obtener el estado de email.',
      detail: error instanceof Error ? error.message : 'Error desconocido.',
    });
  }
});

prospectingRouter.get('/linkedin/context', async (_req, res, next) => {
  try {
    return res.json({ data: await linkedinIdeasContext() });
  } catch (error) { return next(error); }
});

prospectingRouter.get('/linkedin/ideas', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const accountId = String(req.query.accountId || '').trim();
    const verticalId = String(req.query.verticalId || '').trim();
    const data = await listLinkedinIdeas({ status, accountId, verticalId });
    return res.json({
      data,
      summary: {
        total: data.length,
        pending: data.filter((item) => item.status === 'pendiente').length,
        approved: data.filter((item) => item.status === 'aprobada').length,
        rejected: data.filter((item) => item.status === 'rechazada').length,
        scheduled: data.filter((item) => item.status === 'programada').length,
      },
    });
  } catch (error) { return next(error); }
});

prospectingRouter.post('/linkedin/ideas/generate', async (req, res, next) => {
  try {
    const data = await saveGeneratedLinkedinIdeas(req.body || {});
    return res.status(201).json({ data, generated: data.length });
  } catch (error) { return next(error); }
});

prospectingRouter.patch('/linkedin/ideas/:id', async (req, res, next) => {
  try {
    const data = await updateLinkedinIdea(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ error: 'Idea de LinkedIn no encontrada.' });
    return res.json({ data });
  } catch (error) { return next(error); }
});

prospectingRouter.patch('/linkedin/settings', async (req, res, next) => {
  try {
    return res.json({ data: await updateLinkedinSettings(req.body || {}) });
  } catch (error) { return next(error); }
});

prospectingRouter.post('/lists/:id/prospeo/search-preview', async (req, res) => {
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const payload = prepareProspeoSearchPayload(list, req.body || {});
  const validationError = validateProspeoSearchPayload(payload, list);

  return res.json({
    data: {
      valid: !validationError,
      error: validationError || null,
      payload,
      usage: await prospeoUsageSummary(),
    },
  });
});

prospectingRouter.post('/email/poll-now', async (_req, res) => {
  try {
    const data = await pollProspectingInbox();
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo revisar la bandeja de respuestas.',
      detail: error instanceof Error ? error.message : 'Error desconocido.',
    });
  }
});

prospectingRouter.get('/lists/:id/summary', async (req, res) => {
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const { data: prospects, error: prospectsError } = await supabase
    .from('prospects')
    .select('id, company_name, contact_name, email, status, priority, created_at')
    .eq('list_id', list.id);

  if (prospectsError) {
    return res.status(500).json({ error: 'No se pudieron calcular las metricas.', detail: prospectsError.message });
  }

  const prospectIds = (prospects || []).map((prospect) => prospect.id);
  const metrics = {
    totalProspects: prospects?.length || 0,
    researched: prospects?.filter((prospect) => ['INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'CONVERTIDO'].includes(prospect.status)).length || 0,
    approved: prospects?.filter((prospect) => ['APROBADO', 'CONVERTIDO'].includes(prospect.status)).length || 0,
    discarded: prospects?.filter((prospect) => prospect.status === 'DESCARTADO').length || 0,
    sentEmails: 0,
    replies: 0,
    interested: 0,
    later: 0,
    notInterested: 0,
    meetings: 0,
    pendingFollowUps: 0,
  };

  if (!prospectIds.length) {
    return res.json({ data: { metrics, inbox: [], followUps: [], sequence: emptySequenceSummary(), list } });
  }

  const [{ data: messages, error: messagesError }, { data: activities, error: activitiesError }] = await Promise.all([
    supabase
      .from('prospect_messages')
      .select('id, prospect_id, channel, step, subject, status, created_at')
      .in('prospect_id', prospectIds),
    supabase
      .from('prospect_activities')
      .select('id, prospect_id, type, description, metadata, created_at, prospects(id, company_name, contact_name, email, status)')
      .in('prospect_id', prospectIds)
      .order('created_at', { ascending: false })
      .limit(120),
  ]);

  if (messagesError) {
    return res.status(500).json({ error: 'No se pudieron cargar los mensajes.', detail: messagesError.message });
  }
  if (activitiesError) {
    return res.status(500).json({ error: 'No se pudieron cargar las respuestas.', detail: activitiesError.message });
  }

  metrics.sentEmails = (messages || []).filter((message) => (
    message.channel === 'EMAIL' && ['ENVIADO', 'RESPONDIDO'].includes(message.status)
  )).length;

  const latestFollowUpByProspect = new Map();
  const now = Date.now();
  const inbox = [];
  const followUpMap = new Map();

  for (const activity of activities || []) {
    const metadata = activity.metadata || {};
    const outcome = activityOutcome(activity);
    const nextFollowUpAt = typeof metadata.nextFollowUpAt === 'string' ? metadata.nextFollowUpAt : '';
    if (nextFollowUpAt) {
      const timestamp = new Date(nextFollowUpAt).getTime();
      if (Number.isFinite(timestamp)) {
        const current = latestFollowUpByProspect.get(activity.prospect_id);
        if (!current || timestamp > current) latestFollowUpByProspect.set(activity.prospect_id, timestamp);
        const existing = followUpMap.get(activity.prospect_id);
        if (!existing || timestamp < existing.timestamp) {
          followUpMap.set(activity.prospect_id, {
            id: activity.id,
            prospectId: activity.prospect_id,
            companyName: activity.prospects?.company_name || '',
            contactName: activity.prospects?.contact_name || '',
            contactEmail: activity.prospects?.email || metadata.contactEmail || metadata.from || '',
            outcome,
            nextFollowUpAt,
            timestamp,
            overdue: timestamp <= now,
            note: metadata.notes || '',
          });
        }
      }
    }

    if (metadata.emailDirection === 'inbound' || metadata.responseText) {
      metrics.replies += 1;
      if (outcome === 'INTERESADO' || outcome === 'PIDIO_INFO') metrics.interested += 1;
      if (outcome === 'MAS_TARDE') metrics.later += 1;
      if (outcome === 'NO_INTERESADO' || outcome === 'NO_CONTACTAR') metrics.notInterested += 1;
      if (outcome === 'REUNION') metrics.meetings += 1;

      inbox.push({
        id: activity.id,
        prospectId: activity.prospect_id,
        companyName: activity.prospects?.company_name || '',
        contactName: activity.prospects?.contact_name || '',
        contactEmail: metadata.from || activity.prospects?.email || '',
        prospectStatus: activity.prospects?.status || '',
        subject: metadata.subject || '',
        body: activityBody(activity),
        outcome,
        nextFollowUpAt,
        createdAt: activity.created_at,
      });
    }
  }

  metrics.pendingFollowUps = Array.from(latestFollowUpByProspect.values())
    .filter((timestamp) => timestamp <= now)
    .length;

  const followUps = Array.from(followUpMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 25);

  return res.json({
    data: {
      metrics,
      inbox: inbox.slice(0, 50),
      followUps,
      sequence: buildSequenceSummary({ prospects, messages, activities }),
      list,
    },
  });
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

prospectingRouter.post('/lists/:id/prospeo/search', async (req, res) => {
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const confirmSpend = req.body?.confirmSpend === true;
  if (!confirmSpend) {
    return res.status(400).json({
      error: 'Confirma el uso de Prospeo antes de ejecutar la busqueda.',
      detail: 'Cada busqueda con resultados puede consumir 1 credito y cuenta para el limite diario.',
      usage: await prospeoUsageSummary(),
    });
  }

  const maxResults = Math.min(25, Math.max(1, Number(req.body?.maxResults || 10)));
  const enrichEmails = req.body?.enrichEmails === true;
  if (enrichEmails && prospeoDailyEnrichLimit <= 0) {
    return res.status(400).json({
      error: 'El enriquecimiento de emails esta desactivado.',
      detail: 'Configura PROSPEO_DAILY_ENRICH_LIMIT para permitirlo. Por ahora solo se importan perfiles sin revelar emails.',
      usage: await prospeoUsageSummary(),
    });
  }

  const payload = prepareProspeoSearchPayload(list, req.body || {});

  if (!Object.keys(payload.filters || {}).length) {
    return res.status(400).json({ error: 'Define al menos un filtro para buscar en Prospeo.' });
  }

  const validationError = validateProspeoSearchPayload(payload, list);
  if (validationError) {
    return res.status(400).json({
      error: validationError,
      filters: payload.filters,
      usage: await prospeoUsageSummary(),
    });
  }

  try {
    await checkProspeoUsageAvailable('search', 1);
  } catch (error) {
    return res.status(429).json({
      error: error instanceof Error ? error.message : 'Limite diario de Prospeo alcanzado.',
      usage: await prospeoUsageSummary(),
    });
  }

  let prospeoBody;
  try {
    prospeoBody = await callProspeo('search-person', payload);
  } catch (error) {
    return res.status(502).json({
      error: 'No se pudo consultar Prospeo.',
      detail: error instanceof Error ? error.message : 'Error desconocido.',
      usage: await prospeoUsageSummary(),
    });
  }

  const items = extractProspeoItems(prospeoBody).slice(0, maxResults);
  if (items.length && prospeoBody?.free !== true) {
    try {
      await reserveProspeoUsage('search', 1);
    } catch (error) {
      return res.status(429).json({
        error: error instanceof Error ? error.message : 'Limite diario de Prospeo alcanzado.',
        usage: await prospeoUsageSummary(),
      });
    }
  }

  const normalizedRows = items
    .map((item) => normalizeProspeoProspect(item, list))
    .filter(Boolean);

  if (!normalizedRows.length) {
    return res.json({
      data: [],
      inserted: 0,
      skipped: 0,
      found: items.length,
      usage: await prospeoUsageSummary(),
      free: prospeoBody?.free === true,
      filters: payload.filters,
    });
  }

  const { data: existingProspects, error: existingError } = await supabase
    .from('prospects')
    .select('company_name, website, email')
    .eq('list_id', list.id);

  if (existingError) {
    return res.status(500).json({ error: 'No se pudieron validar duplicados.', detail: existingError.message });
  }

  const existingKeys = new Set((existingProspects || []).flatMap(prospectIdentityKeys));
  const incomingKeys = new Set();
  const skippedRows = [];
  const insertRows = [];

  for (const row of normalizedRows) {
    const keys = prospectIdentityKeys(row);
    const duplicated = keys.some((key) => incomingKeys.has(key) || existingKeys.has(key));
    if (duplicated) {
      skippedRows.push({ companyName: row.company_name, reason: 'Duplicado por empresa, web o email' });
      continue;
    }
    keys.forEach((key) => incomingKeys.add(key));
    insertRows.push(row);
  }

  if (!insertRows.length) {
    return res.json({
      data: [],
      inserted: 0,
      skipped: skippedRows.length,
      skippedRows,
      found: items.length,
      usage: await prospeoUsageSummary(),
      free: prospeoBody?.free === true,
      filters: payload.filters,
    });
  }

  const { data, error } = await supabase
    .from('prospects')
    .insert(insertRows)
    .select();

  if (error) {
    return res.status(500).json({ error: 'No se pudieron guardar los prospectos de Prospeo.', detail: error.message });
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: list.id });

  return res.status(201).json({
    data,
    inserted: data?.length || insertRows.length,
    skipped: skippedRows.length,
    skippedRows,
    found: items.length,
    usage: await prospeoUsageSummary(),
    free: prospeoBody?.free === true,
    filters: payload.filters,
  });
});

prospectingRouter.post('/lists/:id/prospeo/enrich', async (req, res) => {
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  const confirmSpend = req.body?.confirmSpend === true;
  if (!confirmSpend) {
    return res.status(400).json({
      error: 'Confirma el uso de enriquecimiento de Prospeo antes de continuar.',
      detail: 'El enriquecimiento puede consumir creditos si Prospeo encuentra email o movil real.',
      usage: await prospeoUsageSummary(),
    });
  }

  const enrichMobile = req.body?.enrichMobile === true;
  const onlyVerifiedMobile = req.body?.onlyVerifiedMobile === true;
  const limit = Math.min(25, Math.max(1, Number(req.body?.limit || 10)));
  const maxChargePerHit = enrichMobile || onlyVerifiedMobile ? 10 : 1;

  try {
    await checkProspeoUsageAvailable('enrich', maxChargePerHit);
  } catch (error) {
    return res.status(429).json({
      error: error instanceof Error ? error.message : 'Limite diario de enriquecimiento de Prospeo alcanzado.',
      usage: await prospeoUsageSummary(),
    });
  }

  const { data: prospects, error: prospectsError } = await supabase
    .from('prospects')
    .select('id, list_id, company_name, website, linkedin_url, contact_name, contact_role, email, phone, country, city, sector, company_size, source, status, notes')
    .eq('list_id', list.id)
    .eq('source', 'PROSPEO')
    .order('created_at', { ascending: true })
    .limit(250);

  if (prospectsError) {
    return res.status(500).json({ error: 'No se pudieron cargar prospectos para enriquecer.', detail: prospectsError.message });
  }

  const candidates = (prospects || [])
    .filter((prospect) => readNoteValue(prospect.notes, 'prospeo_person_id'))
    .filter((prospect) => !isUsableEmail(prospect.email) || ((enrichMobile || onlyVerifiedMobile) && !isUsablePhone(prospect.phone)))
    .slice(0, limit);

  const results = [];
  let enriched = 0;
  let charged = 0;
  let emailsFound = 0;
  let phonesFound = 0;

  for (const prospect of candidates) {
    try {
      await checkProspeoUsageAvailable('enrich', maxChargePerHit);
    } catch (error) {
      results.push({
        prospectId: prospect.id,
        companyName: prospect.company_name,
        status: 'LIMIT_REACHED',
        detail: error instanceof Error ? error.message : 'Limite alcanzado.',
      });
      break;
    }

    const payload = buildProspeoEnrichPayload(prospect, {
      enrichMobile,
      onlyVerifiedEmail: req.body?.onlyVerifiedEmail !== false,
      onlyVerifiedMobile,
    });

    let prospeoBody;
    let enrichError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        prospeoBody = await callProspeo('enrich-person', payload);
        enrichError = null;
        break;
      } catch (error) {
        enrichError = error;
        const detail = error instanceof Error ? error.message : '';
        if (!/rate limit/i.test(detail) || attempt === 2) break;
        await sleep(2500);
      }
    }

    if (!prospeoBody) {
      results.push({
        prospectId: prospect.id,
        companyName: prospect.company_name,
        status: /rate limit/i.test(enrichError instanceof Error ? enrichError.message : '') ? 'RATE_LIMITED' : 'NO_MATCH',
        detail: enrichError instanceof Error ? enrichError.message : 'Sin coincidencia.',
      });
      continue;
    }

    const { updates, email, phone } = normalizeProspeoEnrichment(prospeoBody, prospect);
    const charge = prospeoBody?.free_enrichment === true
      ? 0
      : phone && (enrichMobile || onlyVerifiedMobile) ? 10 : email ? 1 : 0;

    if (charge > 0) {
      try {
        await reserveProspeoUsage('enrich', charge);
        charged += charge;
      } catch (error) {
        results.push({
          prospectId: prospect.id,
          companyName: prospect.company_name,
          status: 'LIMIT_REACHED',
          detail: error instanceof Error ? error.message : 'Limite alcanzado.',
        });
        break;
      }
    }

    const { data: updatedProspect, error: updateError } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', prospect.id)
      .select()
      .single();

    if (updateError) {
      results.push({
        prospectId: prospect.id,
        companyName: prospect.company_name,
        status: 'UPDATE_ERROR',
        detail: updateError.message,
      });
      continue;
    }

    await supabase.from('prospect_activities').insert({
      prospect_id: prospect.id,
      type: 'INVESTIGACION',
      description: email || phone ? 'Contacto enriquecido con Prospeo.' : 'Prospeo no devolvio contacto revelado.',
      metadata: {
        provider: 'PROSPEO',
        action: 'enrich-person',
        freeEnrichment: prospeoBody?.free_enrichment === true,
        charged,
        emailFound: Boolean(email),
        phoneFound: Boolean(phone),
        emailStatus: prospeoBody?.person?.email?.status || null,
        mobileStatus: prospeoBody?.person?.mobile?.status || null,
      },
    });

    if (email) emailsFound += 1;
    if (phone) phonesFound += 1;
    enriched += 1;
    results.push({
      prospectId: prospect.id,
      companyName: updatedProspect.company_name,
      status: email || phone ? 'ENRICHED' : 'NO_CONTACT_REVEALED',
      email: updatedProspect.email,
      phone: updatedProspect.phone,
      free: prospeoBody?.free_enrichment === true,
    });
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: list.id });

  return res.json({
    enriched,
    attempted: candidates.length,
    charged,
    emailsFound,
    phonesFound,
    usage: await prospeoUsageSummary(),
    results,
  });
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
  const hardDelete = req.query?.hard === 'true';
  const confirmed = req.query?.confirm === 'ELIMINAR';

  if (hardDelete) {
    if (!confirmed) {
      return res.status(400).json({ error: 'Confirma la eliminacion definitiva con confirm=ELIMINAR.' });
    }

    const { data, error } = await supabase
      .from('prospecting_lists')
      .delete()
      .eq('id', req.params.id)
      .select('id, name')
      .single();

    if (error) {
      return res.status(500).json({ error: 'No se pudo eliminar la lista.', detail: error.message });
    }

    return res.json({ data, deleted: true });
  }

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
      prospect_messages(id, channel, step, subject, body, status, created_at),
      prospect_activities(id, type, description, metadata, created_at)
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
  const { limit = 25, scope = 'pending' } = req.body ?? {};
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 25));
  const generationScope = ['pending', 'missing', 'all'].includes(scope) ? scope : 'pending';
  const { data: list, error: listError } = await loadList(req.params.id);
  if (listError) return res.status(404).json({ error: 'No se encontro la lista.' });

  let prospectsQuery = supabase
    .from('prospects')
    .select('*, prospect_research(id)')
    .eq('list_id', list.id)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (generationScope === 'pending') {
    prospectsQuery = prospectsQuery.in('status', ['NUEVO', 'INVESTIGADO']);
  } else if (generationScope === 'missing') {
    prospectsQuery = prospectsQuery.neq('status', 'DESCARTADO');
  }

  const { data: prospectRows, error: prospectsError } = await prospectsQuery;

  if (prospectsError) {
    return res.status(500).json({ error: 'No se pudieron cargar los prospectos pendientes.', detail: prospectsError.message });
  }

  const prospects = generationScope === 'missing'
    ? (prospectRows || []).filter((prospect) => {
      const research = Array.isArray(prospect.prospect_research)
        ? prospect.prospect_research
        : prospect.prospect_research ? [prospect.prospect_research] : [];
      return !research.length;
    })
    : prospectRows || [];

  let generated = 0;
  const errors = [];

  for (const prospect of prospects) {
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
        status: ['APROBADO', 'CONVERTIDO', 'DESCARTADO'].includes(prospect.status) ? prospect.status : 'MENSAJE_GENERADO',
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
    attempted: prospectRows?.length || 0,
    skipped: Math.max(0, (prospectRows?.length || 0) - prospects.length),
    scope: generationScope,
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

prospectingRouter.post('/messages/:id/send-email', async (req, res) => {
  const { subject, body, to } = req.body ?? {};
  const cleanSubject = normalizeText(subject);
  const cleanBody = normalizeText(body);
  const cleanTo = normalizeText(to).toLowerCase();

  const { data: message, error: messageError } = await supabase
    .from('prospect_messages')
    .select('id, prospect_id, channel, step, subject, body, status')
    .eq('id', req.params.id)
    .single();

  if (messageError) {
    return res.status(404).json({ error: 'No se encontro el mensaje.' });
  }
  if (message.channel !== 'EMAIL') {
    return res.status(400).json({ error: 'Solo los mensajes de canal EMAIL se pueden enviar por correo.' });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, list_id, company_name, contact_name, email, status')
    .eq('id', message.prospect_id)
    .single();

  if (prospectError) {
    return res.status(404).json({ error: 'No se encontro el prospecto del mensaje.' });
  }
  if (prospect.status === 'DESCARTADO') {
    return res.status(409).json({ error: 'Este prospecto esta descartado. No se envia email para evitar contactos no deseados.' });
  }

  const targetEmail = cleanTo || prospect.email;
  if (!isUsableEmail(targetEmail)) {
    return res.status(400).json({ error: 'Agrega un email real y verificado antes de enviar. Prospeo puede devolver emails enmascarados que no son enviables.' });
  }

  let emailUsage;
  try {
    emailUsage = await prospectingEmailUsageSummary();
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar el limite diario de emails.', detail: error instanceof Error ? error.message : 'Error desconocido.' });
  }
  if (emailUsage.remainingToday <= 0) {
    return res.status(429).json({
      error: `Limite diario de emails de prospeccion alcanzado: ${emailUsage.sentToday}/${emailUsage.dailyLimit}.`,
      usage: emailUsage,
    });
  }

  try {
    const latestOutcome = await latestProspectOutcome(prospect.id);
    if (latestOutcome === 'NO_CONTACTAR' || latestOutcome === 'NO_INTERESADO') {
      return res.status(409).json({ error: `Este prospecto esta marcado como ${latestOutcome.replace(/_/g, ' ')}. No se envia email.` });
    }
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar el historial del prospecto.', detail: error instanceof Error ? error.message : 'Error desconocido.' });
  }

  try {
    const sent = await sendProspectingEmail({
      prospect,
      message,
      subject: cleanSubject || message.subject,
      body: cleanBody || message.body,
      to: targetEmail,
    });

    const { data: updatedMessage, error: updateMessageError } = await supabase
      .from('prospect_messages')
      .update({
        subject: sent.subject,
        body: sent.body,
        status: 'ENVIADO',
      })
      .eq('id', message.id)
      .select('id, prospect_id, channel, step, subject, body, status, updated_at')
      .single();

    if (updateMessageError) {
      return res.status(500).json({ error: 'El email se envio, pero no se pudo actualizar el mensaje.', detail: updateMessageError.message });
    }

    const nextStatus = prospectStatusForOutcome('CONTACTADO', prospect.status);
    const { data: updatedProspect, error: updateProspectError } = await supabase
      .from('prospects')
      .update({
        status: nextStatus,
        email: sent.to,
      })
      .eq('id', prospect.id)
      .select()
      .single();

    if (updateProspectError) {
      return res.status(500).json({ error: 'El email se envio, pero no se pudo actualizar el prospecto.', detail: updateProspectError.message });
    }

    const { data: activity, error: activityError } = await supabase
      .from('prospect_activities')
      .insert({
        prospect_id: prospect.id,
        type: 'MENSAJE',
        description: `Email enviado a ${sent.to}.`,
        metadata: {
          emailDirection: 'outbound',
          channel: 'EMAIL',
          contactEmail: sent.to,
          contactName: prospect.contact_name || null,
          subject: sent.subject,
          body: sent.body,
          outreachStatus: 'CONTACTADO',
          messageId: message.id,
          smtpMessageId: sent.messageId,
          trackingToken: sent.trackingToken,
          from: sent.from,
        },
      })
      .select()
      .single();

    if (activityError) {
      return res.status(500).json({ error: 'El email se envio, pero no se pudo guardar el historial.', detail: activityError.message });
    }

    await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: updatedProspect.list_id });
    return res.json({ data: { prospect: updatedProspect, message: updatedMessage, activity } });
  } catch (error) {
    return res.status(502).json({
      error: 'No se pudo enviar el email.',
      detail: error instanceof Error ? error.message : 'Error desconocido.',
    });
  }
});

prospectingRouter.post('/prospects/:id/outreach', async (req, res) => {
  const {
    channel = 'EMAIL',
    contactEmail = '',
    contactName = '',
    subject = '',
    body = '',
    outreachStatus = 'CONTACTADO',
    nextFollowUpAt = '',
    notes = '',
  } = req.body ?? {};

  const cleanChannel = normalizeText(channel).toUpperCase();
  const cleanStatus = normalizeText(outreachStatus).toUpperCase();
  const cleanBody = normalizeText(body);
  const cleanSubject = normalizeText(subject);
  const cleanContactEmail = normalizeText(contactEmail).toLowerCase();
  const cleanContactName = normalizeText(contactName);
  const cleanNotes = normalizeText(notes);
  const normalizedNextFollowUpAt = normalizeDateTime(nextFollowUpAt);

  if (!allowedContactChannels.has(cleanChannel)) {
    return res.status(400).json({ error: 'El canal de contacto no es valido.' });
  }
  if (!allowedOutreachStatuses.has(cleanStatus)) {
    return res.status(400).json({ error: 'El estado de seguimiento no es valido.' });
  }
  if (!cleanContactEmail && cleanChannel === 'EMAIL') {
    return res.status(400).json({ error: 'El email de contacto es obligatorio para canal EMAIL.' });
  }
  if (cleanContactEmail && !isUsableEmail(cleanContactEmail)) {
    return res.status(400).json({ error: 'El email de contacto no es valido o esta enmascarado.' });
  }
  if (!cleanBody && !cleanNotes) {
    return res.status(400).json({ error: 'Incluye el mensaje enviado o una nota de seguimiento.' });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, list_id, status, contact_name, email')
    .eq('id', req.params.id)
    .single();

  if (prospectError) {
    return res.status(404).json({ error: 'No se encontro el prospecto.' });
  }

  let savedMessage = null;
  if (cleanBody) {
    const { data: message, error: messageError } = await supabase
      .from('prospect_messages')
      .insert({
        prospect_id: prospect.id,
        channel: cleanChannel,
        step: 1,
        subject: cleanSubject || null,
        body: cleanBody,
        status: 'ENVIADO',
        generated_by: 'MANUAL_TRACKING',
      })
      .select('id, prospect_id, channel, step, subject, body, status, created_at')
      .single();

    if (messageError) {
      return res.status(500).json({ error: 'No se pudo guardar el mensaje enviado.', detail: messageError.message });
    }
    savedMessage = message;
  }

  const nextStatus = prospectStatusForOutcome(cleanStatus, prospect.status);
  const updates = {};
  if (nextStatus !== prospect.status) updates.status = nextStatus;
  if (cleanContactEmail && cleanContactEmail !== prospect.email) updates.email = cleanContactEmail;
  if (cleanContactName && cleanContactName !== prospect.contact_name) updates.contact_name = cleanContactName;

  let updatedProspect = prospect;
  if (Object.keys(updates).length) {
    const { data, error } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', prospect.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Se guardo el mensaje, pero no se pudo actualizar el prospecto.', detail: error.message });
    }
    updatedProspect = data;
  }

  const { data: activity, error: activityError } = await supabase
    .from('prospect_activities')
    .insert({
      prospect_id: prospect.id,
      type: 'MENSAJE',
      description: `Contacto registrado por ${cleanChannel}: ${cleanStatus}.`,
      metadata: {
        channel: cleanChannel,
        contactEmail: cleanContactEmail || null,
        contactName: cleanContactName || null,
        subject: cleanSubject || null,
        body: cleanBody || null,
        outreachStatus: cleanStatus,
        nextFollowUpAt: normalizedNextFollowUpAt,
        notes: cleanNotes || null,
        messageId: savedMessage?.id || null,
      },
    })
    .select()
    .single();

  if (activityError) {
    return res.status(500).json({ error: 'No se pudo guardar la actividad de seguimiento.', detail: activityError.message });
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: updatedProspect.list_id });
  return res.status(201).json({ data: { prospect: updatedProspect, message: savedMessage, activity } });
});

prospectingRouter.post('/prospects/:id/response', async (req, res) => {
  const {
    responseText = '',
    classification = 'INTERESADO',
    nextFollowUpAt = '',
    notes = '',
  } = req.body ?? {};

  const cleanResponseText = normalizeText(responseText);
  const cleanClassification = normalizeText(classification).toUpperCase();
  const cleanNotes = normalizeText(notes);
  const normalizedNextFollowUpAt = normalizeDateTime(nextFollowUpAt);

  if (!allowedOutreachStatuses.has(cleanClassification)) {
    return res.status(400).json({ error: 'La clasificacion de respuesta no es valida.' });
  }
  if (!cleanResponseText && !cleanNotes) {
    return res.status(400).json({ error: 'Incluye la respuesta del prospecto o una nota.' });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, list_id, status')
    .eq('id', req.params.id)
    .single();

  if (prospectError) {
    return res.status(404).json({ error: 'No se encontro el prospecto.' });
  }

  const nextStatus = prospectStatusForOutcome(cleanClassification, prospect.status);
  const { data: updatedProspect, error: updateError } = await supabase
    .from('prospects')
    .update({ status: nextStatus })
    .eq('id', prospect.id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ error: 'No se pudo actualizar el prospecto.', detail: updateError.message });
  }

  await supabase
    .from('prospect_messages')
    .update({ status: 'RESPONDIDO' })
    .eq('prospect_id', prospect.id)
    .eq('status', 'ENVIADO');

  const { data: activity, error: activityError } = await supabase
    .from('prospect_activities')
    .insert({
      prospect_id: prospect.id,
      type: 'NOTA',
      description: `Respuesta registrada: ${cleanClassification}.`,
      metadata: {
        responseText: cleanResponseText || null,
        outreachStatus: cleanClassification,
        nextFollowUpAt: normalizedNextFollowUpAt,
        notes: cleanNotes || null,
      },
    })
    .select()
    .single();

  if (activityError) {
    return res.status(500).json({ error: 'No se pudo guardar la respuesta.', detail: activityError.message });
  }

  await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: updatedProspect.list_id });
  return res.status(201).json({ data: { prospect: updatedProspect, activity } });
});

prospectingRouter.patch('/activities/:id/outcome', async (req, res) => {
  const {
    classification = 'INTERESADO',
    nextFollowUpAt = '',
    notes = '',
  } = req.body ?? {};

  const cleanClassification = normalizeText(classification).toUpperCase();
  const cleanNotes = normalizeText(notes);
  const normalizedNextFollowUpAt = normalizeDateTime(nextFollowUpAt);

  if (!allowedOutreachStatuses.has(cleanClassification)) {
    return res.status(400).json({ error: 'La clasificacion de respuesta no es valida.' });
  }

  const { data: activity, error: activityError } = await supabase
    .from('prospect_activities')
    .select('id, prospect_id, metadata')
    .eq('id', req.params.id)
    .single();

  if (activityError) {
    return res.status(404).json({ error: 'No se encontro la actividad.' });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, list_id, status')
    .eq('id', activity.prospect_id)
    .single();

  if (prospectError) {
    return res.status(404).json({ error: 'No se encontro el prospecto de la actividad.' });
  }

  const nextStatus = prospectStatusForOutcome(cleanClassification, prospect.status);
  const nextMetadata = {
    ...(activity.metadata || {}),
    outreachStatus: cleanClassification,
    nextFollowUpAt: normalizedNextFollowUpAt,
    notes: cleanNotes || activity.metadata?.notes || null,
    classifiedAt: new Date().toISOString(),
  };

  const [{ data: updatedActivity, error: updateActivityError }, { data: updatedProspect, error: updateProspectError }] = await Promise.all([
    supabase
      .from('prospect_activities')
      .update({ metadata: nextMetadata })
      .eq('id', activity.id)
      .select()
      .single(),
    supabase
      .from('prospects')
      .update({ status: nextStatus })
      .eq('id', prospect.id)
      .select()
      .single(),
  ]);

  if (updateActivityError) {
    return res.status(500).json({ error: 'No se pudo actualizar la respuesta.', detail: updateActivityError.message });
  }
  if (updateProspectError) {
    return res.status(500).json({ error: 'No se pudo actualizar el prospecto.', detail: updateProspectError.message });
  }

  await Promise.all([
    supabase
      .from('prospect_messages')
      .update({ status: 'RESPONDIDO' })
      .eq('prospect_id', prospect.id)
      .eq('status', 'ENVIADO'),
    supabase.rpc('refresh_prospecting_list_counters', { p_list_id: prospect.list_id }),
  ]);

  return res.json({ data: { prospect: updatedProspect, activity: updatedActivity } });
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
