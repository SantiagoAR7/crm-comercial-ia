import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const storeFile = process.env.LINKEDIN_IDEAS_FILE || path.join(dataDir, 'linkedin-ideas.json');
let writes = Promise.resolve();

export const linkedinAccounts = [
  {
    id: 'davofrio',
    name: 'DAVOFRIO',
    role: 'Cuenta corporativa',
    line: 'Autoridad de empresa: ingeniería, innovación, método propio, capacidad integral y visión de mercado.',
  },
  {
    id: 'adrian',
    name: 'Adrián',
    role: 'Cuenta técnica',
    line: 'Explicación técnica: datos, cálculo, método, criterio de diseño, errores habituales y decisiones de ingeniería.',
  },
  {
    id: 'juan',
    name: 'Juan',
    role: 'Cuenta humana',
    line: 'Confianza y experiencia: trato cercano, casos del día a día, tranquilidad del cliente y aprendizaje práctico.',
  },
];

export const linkedinVerticals = [
  {
    id: 'industrial_ibi_foia',
    label: 'Industrial Ibi / Foia de Castalla',
    source: 'HTML: Climatización industrial / Salas blancas / Enfriadoras + prioridad indicada por cliente.',
    premise: 'Fábricas de inyección, extrusión y transformación de plástico en Ibi, Castalla, Onil, Tibi, Villena, Alcoy y Foia de Castalla.',
    offer: 'Diagnóstico técnico de refrigeración industrial, agua refrigerada, chillers, climatización de proceso y salas blancas.',
    pains: [
      { id: 'paradas_temperatura', label: 'Paradas por temperatura', text: 'Cuando la temperatura del proceso se sale de rango, la producción lo nota antes que cualquier dashboard.' },
      { id: 'agua_refrigerada', label: 'Agua refrigerada inestable', text: 'El agua refrigerada no es un servicio auxiliar si condiciona ciclos, calidad y continuidad.' },
      { id: 'inyeccion_sobrecalienta', label: 'Inyección fuera de rango', text: 'Una máquina de inyección que trabaja caliente no solo consume más: también compromete tiempos y pieza final.' },
      { id: 'mantenimiento_reactivo', label: 'Mantenimiento reactivo', text: 'Esperar a la avería convierte la refrigeración en urgencia, no en proceso controlado.' },
      { id: 'sala_blanca', label: 'Sala blanca inestable', text: 'Una sala blanca no se resuelve bajando grados: necesita estabilidad, presión, filtración, humedad y trazabilidad.' },
      { id: 'clima_residencial_industria', label: 'Clima residencial aplicado a industria', text: 'El problema aparece cuando se intenta resolver un proceso industrial con lógica de climatización doméstica.' },
    ],
  },
  {
    id: 'aerotermia_villas',
    label: 'Aerotermia villas costa Alicante',
    source: 'HTML: Proyecto de Ingeniería Térmica 495 € / Instalación llave en mano B2C villas.',
    premise: 'Propietarios de villas/chalets en costa Alicante con inversión alta y miedo a presupuestos sin justificación.',
    offer: 'Proyecto de Ingeniería Térmica con cálculo de cargas, simulación y tres presupuestos cerrados.',
    pains: [
      { id: 'presupuesto_ojo', label: 'Presupuesto a ojo', text: 'Pedir cuatro presupuestos y recibir cuatro números distintos no es comparar: es moverse sin datos.' },
      { id: 'factura_gasoil', label: 'Factura gas/gasoil', text: 'Meses pagando 150-250 € sin saber si la alternativa está bien dimensionada.' },
      { id: 'confort_irregular', label: 'Confort irregular', text: 'Salón cómodo, dormitorios fríos o calientes, y una instalación que no entiende cómo se vive la casa.' },
      { id: 'obra_invasiva', label: 'Miedo a la obra', text: 'El cliente no solo teme el precio; teme que la solución le destroce la casa.' },
    ],
  },
  {
    id: 'arquitectos',
    label: 'Arquitectos e interioristas',
    source: 'HTML: Aerotermia para arquitectos e interioristas B2B consultivo.',
    premise: 'Estudios que trabajan villas/chalets premium y necesitan respaldo técnico térmico.',
    offer: 'Co-diseño arquitecto-ingeniero, planos de clima integrados y postventa que protege la reputación del estudio.',
    pains: [
      { id: 'plano_generico', label: 'Plano de clima genérico', text: 'Un plano de clima genérico puede empañar un proyecto arquitectónico excelente.' },
      { id: 'consumos_cliente', label: 'No poder responder consumos', text: 'Cuando el cliente pregunta por consumos, una estimación no protege al estudio.' },
      { id: 'ruido_rejillas', label: 'Ruido, corrientes y rejillas', text: 'El clima mal integrado se ve, se oye y se siente cuando ya es tarde.' },
      { id: 'postventa_reputacion', label: 'La postventa afecta al arquitecto', text: 'Si la instalación falla, muchas veces la reseña mala se la lleva el proyecto completo.' },
    ],
  },
  {
    id: 'mantenimiento',
    label: 'Mantenimiento preventivo',
    source: 'HTML: Mantenimiento Preventivo - suscripción anual.',
    premise: 'Clientes con equipos instalados que recuerdan el mantenimiento cuando ya hay avería.',
    offer: 'Plan preventivo con visitas programadas, prioridad y trazabilidad de equipos.',
    pains: [
      { id: 'solo_averia', label: 'Solo acordarse cuando se rompe', text: 'El mantenimiento que llega después de la avería ya no es mantenimiento: es urgencia.' },
      { id: 'verano_saturado', label: 'Llamar en verano es tarde', text: 'En temporada alta no gana quien grita más, gana quien llegó preparado.' },
      { id: 'instalador_no_contesta', label: 'Instalador desaparecido', text: 'Una instalación sin seguimiento acaba dependiendo de quien coja el teléfono.' },
    ],
  },
];

export const linkedinAngles = [
  { id: 'dolor', label: 'Dolor por síntoma', guidance: 'Poner el dedo en el problema actual con una escena concreta.' },
  { id: 'ganancia', label: 'Ganancia aspiracional', guidance: 'Mostrar el estado deseable: estabilidad, tranquilidad, control o reputación.' },
  { id: 'mecanismo', label: 'Mecanismo único', guidance: 'Explicar por qué el método Davofrío funciona distinto.' },
  { id: 'enemigo', label: 'Enemigo común', guidance: 'Contraponer ingeniería contra improvisación, presupuestos a ojo o clima doméstico aplicado a industria.' },
  { id: 'friccion', label: 'Fricción cero', guidance: 'Hacer fácil lo que parece complejo: diagnóstico, coordinación, proceso documentado.' },
  { id: 'cierre', label: 'Genérico / cierre', guidance: 'Storytelling de método y llamada a una conversación sin presión.' },
];

export const linkedinDrivers = [
  { id: 'perfecto', label: 'Sé perfecto', guidance: 'Rigor, datos, ingeniería, documentación.' },
  { id: 'fuerte', label: 'Sé fuerte', guidance: 'Control, independencia, criterio propio.' },
  { id: 'prisa', label: 'Date prisa', guidance: 'Ventana temporal, urgencia real, coste de esperar.' },
  { id: 'complace', label: 'Complace a los demás', guidance: 'Reputación, comunidad, estándar visible.' },
  { id: 'esfuerzate', label: 'Esfuérzate', guidance: 'Mérito, recompensa, hacer bien lo que importa.' },
];

export const linkedinFormats = [
  { id: 'post_corto', label: 'Post corto' },
  { id: 'post_largo', label: 'Post largo' },
  { id: 'carrusel', label: 'Carrusel' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'caso_tecnico', label: 'Caso técnico' },
];

const defaultSettings = {
  frequency: {
    davofrio: { postsPerWeek: 3, preferredDays: ['lunes', 'miércoles', 'viernes'] },
    adrian: { postsPerWeek: 2, preferredDays: ['martes', 'jueves'] },
    juan: { postsPerWeek: 1, preferredDays: ['viernes'] },
  },
};

async function readState() {
  try {
    const parsed = JSON.parse(await fs.readFile(storeFile, 'utf8'));
    return {
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : defaultSettings,
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { ideas: [], settings: defaultSettings };
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  const temporary = `${storeFile}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(temporary, storeFile);
}

function findById(items, id, fallbackIndex = 0) {
  return items.find((item) => item.id === id) || items[fallbackIndex % items.length];
}

function cleanStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['pendiente', 'aprobada', 'rechazada', 'programada', 'publicada'].includes(status)) return status;
  return 'pendiente';
}

function summarizeIdea(idea) {
  return {
    id: idea.id,
    accountId: idea.accountId,
    accountName: idea.accountName,
    verticalId: idea.verticalId,
    verticalLabel: idea.verticalLabel,
    painId: idea.painId,
    painLabel: idea.painLabel,
    angleId: idea.angleId,
    angleLabel: idea.angleLabel,
    driverId: idea.driverId,
    driverLabel: idea.driverLabel,
    formatId: idea.formatId,
    formatLabel: idea.formatLabel,
    title: idea.title,
    hook: idea.hook,
    body: idea.body,
    cta: idea.cta,
    status: idea.status,
    scheduledFor: idea.scheduledFor || null,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
  };
}

export async function listLinkedinIdeas(filters = {}) {
  const state = await readState();
  let ideas = state.ideas;
  if (filters.status) ideas = ideas.filter((idea) => idea.status === filters.status);
  if (filters.accountId) ideas = ideas.filter((idea) => idea.accountId === filters.accountId);
  if (filters.verticalId) ideas = ideas.filter((idea) => idea.verticalId === filters.verticalId);
  return ideas
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .map(summarizeIdea);
}

export async function linkedinIdeasContext() {
  const state = await readState();
  return {
    accounts: linkedinAccounts,
    verticals: linkedinVerticals,
    angles: linkedinAngles,
    drivers: linkedinDrivers,
    formats: linkedinFormats,
    settings: state.settings,
  };
}

export function generateLinkedinIdeas(input = {}) {
  const count = Math.min(12, Math.max(1, Number(input.count || 6)));
  const now = new Date().toISOString();
  const selectedAccount = findById(linkedinAccounts, input.accountId, 0);
  const selectedVertical = findById(linkedinVerticals, input.verticalId, 0);
  const selectedAngle = input.angleId ? findById(linkedinAngles, input.angleId, 0) : null;
  const selectedDriver = input.driverId ? findById(linkedinDrivers, input.driverId, 0) : null;
  const selectedFormat = input.formatId ? findById(linkedinFormats, input.formatId, 0) : null;
  const selectedPain = input.painId
    ? selectedVertical.pains.find((pain) => pain.id === input.painId) || selectedVertical.pains[0]
    : null;

  return Array.from({ length: count }, (_, index) => {
    const account = selectedAccount;
    const vertical = selectedVertical;
    const pain = selectedPain || vertical.pains[index % vertical.pains.length];
    const angle = selectedAngle || linkedinAngles[index % linkedinAngles.length];
    const driver = selectedDriver || linkedinDrivers[(index + 1) % linkedinDrivers.length];
    const format = selectedFormat || linkedinFormats[(index + 2) % linkedinFormats.length];
    const title = buildTitle({ account, vertical, pain, angle, format });
    const body = buildBody({ account, vertical, pain, angle, driver, format });

    return {
      id: crypto.randomUUID(),
      accountId: account.id,
      accountName: account.name,
      accountRole: account.role,
      verticalId: vertical.id,
      verticalLabel: vertical.label,
      painId: pain.id,
      painLabel: pain.label,
      angleId: angle.id,
      angleLabel: angle.label,
      driverId: driver.id,
      driverLabel: driver.label,
      formatId: format.id,
      formatLabel: format.label,
      title,
      hook: firstLine(body),
      body,
      cta: callToAction(account, vertical),
      status: 'pendiente',
      scheduledFor: null,
      source: 'Davofrio LI.html',
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function saveGeneratedLinkedinIdeas(input) {
  const result = writes.then(async () => {
    const state = await readState();
    const generated = generateLinkedinIdeas(input);
    const next = { ...state, ideas: [...generated, ...state.ideas].slice(0, 500) };
    await writeState(next);
    return generated.map(summarizeIdea);
  });
  writes = result.catch(() => undefined);
  return result;
}

export function updateLinkedinIdea(id, updates = {}) {
  const result = writes.then(async () => {
    const state = await readState();
    const index = state.ideas.findIndex((idea) => idea.id === id);
    if (index < 0) return null;
    const current = state.ideas[index];
    const updated = {
      ...current,
      status: updates.status ? cleanStatus(updates.status) : current.status,
      scheduledFor: Object.hasOwn(updates, 'scheduledFor') ? normalizeDate(updates.scheduledFor) : current.scheduledFor,
      title: typeof updates.title === 'string' ? updates.title.trim() || current.title : current.title,
      body: typeof updates.body === 'string' ? updates.body.trim() || current.body : current.body,
      cta: typeof updates.cta === 'string' ? updates.cta.trim() || current.cta : current.cta,
      updatedAt: new Date().toISOString(),
    };
    const ideas = state.ideas.slice();
    ideas[index] = updated;
    await writeState({ ...state, ideas });
    return summarizeIdea(updated);
  });
  writes = result.catch(() => undefined);
  return result;
}

export function updateLinkedinSettings(settings = {}) {
  const result = writes.then(async () => {
    const state = await readState();
    const frequency = { ...state.settings.frequency };
    for (const account of linkedinAccounts) {
      const next = settings.frequency?.[account.id];
      if (!next) continue;
      frequency[account.id] = {
        postsPerWeek: Math.min(7, Math.max(0, Number(next.postsPerWeek ?? frequency[account.id]?.postsPerWeek ?? 0))),
        preferredDays: Array.isArray(next.preferredDays)
          ? next.preferredDays.map((item) => String(item).trim()).filter(Boolean).slice(0, 7)
          : frequency[account.id]?.preferredDays || [],
      };
    }
    const nextState = { ...state, settings: { ...state.settings, frequency } };
    await writeState(nextState);
    return nextState.settings;
  });
  writes = result.catch(() => undefined);
  return result;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function firstLine(value) {
  return String(value || '').split('\n').find(Boolean) || '';
}

function buildTitle({ account, vertical, pain, angle, format }) {
  if (format.id === 'carrusel') return `${vertical.label}: ${pain.label} en 5 puntos`;
  if (format.id === 'checklist') return `Checklist: ${pain.label}`;
  if (format.id === 'caso_tecnico') return `Caso técnico: ${pain.label}`;
  return `${pain.label} · ${angle.label} · ${account.name}`;
}

function buildBody({ account, vertical, pain, angle, driver, format }) {
  const intro = accountIntro(account, vertical, pain);
  const angleLine = angleToLine(angle, vertical, pain);
  const driverLine = `Enfoque: ${driver.guidance}`;

  if (format.id === 'carrusel') {
    return [
      `${pain.label}: lo que conviene mirar antes de decidir.`,
      '',
      `1. ${pain.text}`,
      `2. No empezar por la máquina: empezar por el proceso.`,
      `3. Medir estabilidad, demanda real y condiciones de uso.`,
      `4. Comparar soluciones con criterio técnico, no solo precio.`,
      `5. Cerrar con un diagnóstico claro antes de invertir.`,
      '',
      `${angleLine}`,
      `${callToAction(account, vertical)}`,
    ].join('\n');
  }

  if (format.id === 'checklist') {
    return [
      `Checklist rápido para ${vertical.label}:`,
      '',
      `- ¿El problema está medido o solo descrito?`,
      `- ¿La solución parte de ${pain.label.toLowerCase()}?`,
      `- ¿Hay cálculo, documentación y responsable técnico?`,
      `- ¿Se ha revisado mantenimiento, consumo y continuidad?`,
      `- ¿El presupuesto explica por qué, no solo cuánto?`,
      '',
      `${angleLine}`,
      `${callToAction(account, vertical)}`,
    ].join('\n');
  }

  if (format.id === 'caso_tecnico') {
    return [
      `Caso típico en ${vertical.label}:`,
      '',
      `${pain.text}`,
      '',
      `La solución no empieza preguntando “qué equipo ponemos”. Empieza entendiendo uso real, condiciones de trabajo, demanda y riesgo si el sistema falla.`,
      '',
      `${angleLine}`,
      '',
      `${driverLine}`,
      '',
      `${callToAction(account, vertical)}`,
    ].join('\n');
  }

  const extra = format.id === 'post_largo'
    ? `\n\nLa diferencia entre una instalación correcta y una improvisada suele estar antes de la obra: en la visita, las preguntas, los cálculos y la documentación. Ahí es donde el cliente deja de comparar números sueltos y empieza a comparar criterio.`
    : '';

  return [
    intro,
    '',
    pain.text,
    '',
    angleLine,
    extra,
    '',
    callToAction(account, vertical),
  ].join('\n');
}

function accountIntro(account, vertical, pain) {
  if (account.id === 'adrian') {
    return `Cuando hablamos de ${vertical.label}, ${pain.label.toLowerCase()} no se puede tratar como un detalle comercial. Es una decisión técnica.`;
  }
  if (account.id === 'juan') {
    return `Hay clientes que no necesitan que les prometan más. Necesitan que alguien les explique bien qué pasa con ${pain.label.toLowerCase()}.`;
  }
  return `En ${vertical.label}, ${pain.label.toLowerCase()} es una señal de que conviene mirar la instalación con criterio técnico.`;
}

function angleToLine(angle, vertical, pain) {
  if (angle.id === 'dolor') return `El síntoma es claro: ${pain.text}`;
  if (angle.id === 'ganancia') return `La ganancia no es “poner clima”: es conseguir estabilidad, control y menos decisiones a ciegas.`;
  if (angle.id === 'mecanismo') return `El mecanismo Davofrío: ingeniería primero, instalación después, mantenimiento con el mismo criterio.`;
  if (angle.id === 'enemigo') return `El enemigo no es otro proveedor: es decidir ${vertical.label.toLowerCase()} con estimaciones, prisa y poca documentación.`;
  if (angle.id === 'friccion') return `Para reducir fricción, el primer paso debe ser un diagnóstico claro, entendible y accionable.`;
  return `La pregunta útil no es “cuánto cuesta”, sino qué riesgo se evita y qué criterio sostiene la solución.`;
}

function callToAction(account, vertical) {
  if (account.id === 'adrian') return 'Si quieres, lo explicamos con datos antes de hablar de equipos.';
  if (account.id === 'juan') return 'Una conversación bien hecha suele ahorrar muchos malentendidos después.';
  return `Davofrío puede revisar el caso y plantear un diagnóstico inicial para ${vertical.label}.`;
}
