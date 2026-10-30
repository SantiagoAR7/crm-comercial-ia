import { createClient } from '@supabase/supabase-js';

const DEMO_LIST_NAME = 'DEMO cliente - Industrial Foia de Castalla';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecret) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const now = Date.now();
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const daysFromNow = (days) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

function industrialResearch(prospect) {
  return {
    company_summary: `${prospect.company_name} encaja con la vertical industrial: procesos de plastico, control de temperatura, agua refrigerada, climatizacion de planta o sala blanca.`,
    pain_hypothesis: 'La hipotesis comercial es que una parada por temperatura inestable, chiller saturado o mantenimiento reactivo puede impactar directamente produccion y calidad.',
    buying_signal: prospect.website
      ? `Tiene web identificada (${prospect.website}) y se puede abrir una conversacion tecnica con una hipotesis concreta.`
      : 'Falta web validada; antes de contactar conviene enriquecer o revisar manualmente.',
    personalization_angle: 'Abrir con continuidad operativa, estabilidad de temperatura y mantenimiento preventivo, no con una venta generica de climatizacion.',
    objections: [
      'Ya trabajamos con otra empresa de mantenimiento.',
      'Ahora no podemos parar produccion.',
      'Solo revisamos proveedores cuando hay averia.',
      'Envianos informacion tecnica primero.',
    ],
    recommended_offer: 'Diagnostico tecnico breve de refrigeracion industrial, agua refrigerada y climatizacion de proceso para detectar riesgos antes de una parada.',
    confidence: prospect.email ? 'ALTA' : 'MEDIA',
    raw_sources: [{ type: 'DEMO', label: 'Datos sembrados para presentacion cliente' }],
    generated_by: 'DEMO_SEED',
    generated_at: new Date().toISOString(),
  };
}

function messagesFor(prospect, status = 'BORRADOR') {
  const contact = prospect.contact_name || 'equipo';
  return [
    {
      prospect_id: prospect.id,
      channel: 'EMAIL',
      step: 1,
      subject: `${prospect.company_name} | refrigeracion de proceso`,
      body: `Hola ${contact},\n\nTe escribo desde Davofrio porque estamos revisando empresas industriales de la zona de Ibi/Castalla/Alcoy donde la temperatura del proceso, el agua refrigerada o la climatizacion de planta pueden afectar produccion.\n\nNo queria enviarte una propuesta generica. La idea es validar si en ${prospect.company_name} tiene sentido revisar refrigeracion industrial, mantenimiento preventivo o estabilidad de temperatura en proceso/salas blancas.\n\nTiene sentido que lo veamos en una llamada corta y, si encaja, os enviamos un diagnostico tecnico inicial?\n\nUn saludo,`,
      status,
      generated_by: 'DEMO_SEED',
    },
    {
      prospect_id: prospect.id,
      channel: 'LINKEDIN',
      step: 1,
      subject: null,
      body: `Hola ${contact}, vi ${prospect.company_name} y queria conectar. En Davofrio estamos trabajando refrigeracion industrial y climatizacion de proceso en la Foia de Castalla, especialmente donde el agua refrigerada o la temperatura estable impactan produccion.`,
      status: status === 'ENVIADO' || status === 'RESPONDIDO' ? 'APROBADO' : status,
      generated_by: 'DEMO_SEED',
    },
    {
      prospect_id: prospect.id,
      channel: 'EMAIL',
      step: 2,
      subject: `Re: ${prospect.company_name} | refrigeracion de proceso`,
      body: `Hola ${contact},\n\nTe escribo solo para cerrar el hilo. No era una venta a ciegas: queriamos validar si en ${prospect.company_name} hay algun punto critico de refrigeracion, agua refrigerada, mantenimiento o climatizacion de proceso que merezca revision.\n\nSi ya lo teneis cubierto, lo dejo aqui. Si tiene sentido, puedo enviarte una propuesta concreta de revision tecnica en 3 puntos.\n\nGracias,`,
      status: 'BORRADOR',
      generated_by: 'DEMO_SEED',
    },
  ];
}

async function throwIf(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function main() {
  const { data: existingLists, error: listLookupError } = await supabase
    .from('prospecting_lists')
    .select('id, name')
    .eq('name', DEMO_LIST_NAME);
  await throwIf(listLookupError, 'lookup existing demo list');

  if (existingLists?.length) {
    const ids = existingLists.map((item) => item.id);
    const { error: deleteError } = await supabase
      .from('prospecting_lists')
      .delete()
      .in('id', ids);
    await throwIf(deleteError, 'delete previous demo list');
  }

  const { data: list, error: createListError } = await supabase
    .from('prospecting_lists')
    .insert({
      name: DEMO_LIST_NAME,
      description: 'Demo controlada para presentar el flujo de prospeccion industrial Davofrio. Correos de muestra con dominio .invalid: no enviar contacto real desde esta lista.',
      status: 'LISTA',
      source: 'DEMO',
      icp: {
        vertical: 'industrial_foia_castalla',
        sector: 'Plastics Manufacturing; Plastics and Rubber Product Manufacturing',
        location: 'Ibi, Castalla, Onil, Tibi, Villena, Alcoy y Foia de Castalla',
        targetRole: 'Gerencia, operaciones, produccion, mantenimiento, compras tecnicas',
        companySize: 'PYMES industriales y fabricantes locales, especialmente 11-50, 50-200 y 200+ empleados',
        pain: 'Reducir paradas, estabilizar agua refrigerada, anticipar averias, mantener salas blancas y controlar temperatura de proceso.',
        offer: 'Diagnostico tecnico breve de refrigeracion industrial y climatizacion de proceso.',
        exclusions: 'Aerotermia residencial, consultoria generica, comercios no industriales y empresas sin proceso productivo.',
        searchNotes: 'DEMO: lista sembrada manualmente para presentacion. No consume Prospeo ni envia correos.',
      },
    })
    .select()
    .single();
  await throwIf(createListError, 'create demo list');

  const prospectsInput = [
    {
      company_name: 'Termoformas del Mediterraneo',
      website: 'https://termoformas-demo.example.invalid',
      contact_name: 'Laura Ferrer',
      contact_role: 'Responsable de Produccion',
      email: 'laura.ferrer@termoformas-demo.example.invalid',
      phone: '+34 600 000 101',
      city: 'Ibi',
      sector: 'Inyeccion y termoformado de plasticos',
      company_size: '50-200 empleados',
      status: 'MENSAJE_GENERADO',
      fit_score: 88,
      priority: 'ALTA',
      tags: ['demo', 'industrial', 'inyeccion-plasticos'],
      notes: 'Demo: buen encaje por proceso continuo y necesidad de temperatura estable.',
    },
    {
      company_name: 'Castalla Plastic Components',
      website: 'https://castalla-components.example.invalid',
      contact_name: 'Miguel Soler',
      contact_role: 'Director de Operaciones',
      email: 'miguel.soler@castalla-components.example.invalid',
      phone: '+34 600 000 102',
      city: 'Castalla',
      sector: 'Componentes plasticos para industria',
      company_size: '200+ empleados',
      status: 'APROBADO',
      fit_score: 92,
      priority: 'ALTA',
      tags: ['demo', 'industrial', 'agua-refrigerada'],
      notes: 'Demo: mensaje aprobado para ensenar revision humana previa al envio.',
    },
    {
      company_name: 'Ibi Injection Systems',
      website: 'https://ibi-injection.example.invalid',
      contact_name: 'Ana Vidal',
      contact_role: 'Gerente',
      email: 'ana.vidal@ibi-injection.example.invalid',
      phone: '+34 600 000 103',
      city: 'Ibi',
      sector: 'Inyeccion de plasticos',
      company_size: '11-50 empleados',
      status: 'APROBADO',
      fit_score: 86,
      priority: 'ALTA',
      tags: ['demo', 'industrial', 'respondio'],
      notes: 'Demo: simula respuesta interesada tras email enviado.',
    },
    {
      company_name: 'Alcoy Packaging Solutions',
      website: 'https://alcoy-packaging.example.invalid',
      contact_name: 'Jorge Mira',
      contact_role: 'Responsable de Mantenimiento',
      email: 'jorge.mira@alcoy-packaging.example.invalid',
      phone: '+34 600 000 104',
      city: 'Alcoy',
      sector: 'Packaging plastico y extrusion',
      company_size: '50-200 empleados',
      status: 'APROBADO',
      fit_score: 81,
      priority: 'ALTA',
      tags: ['demo', 'industrial', 'mas-tarde'],
      notes: 'Demo: respuesta de mas tarde con seguimiento pendiente.',
    },
    {
      company_name: 'Onil Moldes Tecnicos',
      website: 'https://onil-moldes.example.invalid',
      contact_name: 'Pablo Navarro',
      contact_role: 'Compras Tecnicas',
      email: 'pablo.navarro@onil-moldes.example.invalid',
      phone: '+34 600 000 105',
      city: 'Onil',
      sector: 'Moldes y transformacion de plasticos',
      company_size: '11-50 empleados',
      status: 'DESCARTADO',
      fit_score: 61,
      priority: 'MEDIA',
      tags: ['demo', 'descartado'],
      notes: 'Demo: descartado por no interes.',
    },
    {
      company_name: 'Tibi Cleanroom Plastics',
      website: 'https://tibi-cleanroom.example.invalid',
      contact_name: '',
      contact_role: 'Operaciones / Calidad',
      email: null,
      phone: '',
      city: 'Tibi',
      sector: 'Plasticos tecnicos y sala blanca',
      company_size: '50-200 empleados',
      status: 'NUEVO',
      fit_score: 67,
      priority: 'MEDIA',
      tags: ['demo', 'falta-email', 'sala-blanca'],
      notes: 'Demo: buen encaje tecnico, pendiente de enriquecimiento porque falta email.',
    },
  ];

  const { data: prospects, error: prospectsError } = await supabase
    .from('prospects')
    .insert(prospectsInput.map((prospect) => ({
      ...prospect,
      list_id: list.id,
      country: 'Espana',
      source: 'DEMO',
    })))
    .select();
  await throwIf(prospectsError, 'insert demo prospects');

  const byName = new Map(prospects.map((prospect) => [prospect.company_name, prospect]));

  const researchRows = prospects
    .filter((prospect) => prospect.status !== 'NUEVO')
    .map((prospect) => ({ prospect_id: prospect.id, ...industrialResearch(prospect) }));
  const { error: researchError } = await supabase.from('prospect_research').insert(researchRows);
  await throwIf(researchError, 'insert demo research');

  const messageRows = [
    ...messagesFor(byName.get('Termoformas del Mediterraneo'), 'BORRADOR'),
    ...messagesFor(byName.get('Castalla Plastic Components'), 'APROBADO'),
    ...messagesFor(byName.get('Ibi Injection Systems'), 'RESPONDIDO'),
    ...messagesFor(byName.get('Alcoy Packaging Solutions'), 'RESPONDIDO'),
    ...messagesFor(byName.get('Onil Moldes Tecnicos'), 'RESPONDIDO'),
  ].filter(Boolean);
  const { data: messages, error: messagesError } = await supabase
    .from('prospect_messages')
    .insert(messageRows)
    .select();
  await throwIf(messagesError, 'insert demo messages');

  const firstMessageByProspect = new Map();
  for (const message of messages || []) {
    if (message.channel === 'EMAIL' && message.step === 1) firstMessageByProspect.set(message.prospect_id, message);
  }

  const ibi = byName.get('Ibi Injection Systems');
  const alcoy = byName.get('Alcoy Packaging Solutions');
  const onil = byName.get('Onil Moldes Tecnicos');
  const castalla = byName.get('Castalla Plastic Components');

  const activities = [
    ...prospects
      .filter((prospect) => prospect.status !== 'NUEVO')
      .map((prospect) => ({
        prospect_id: prospect.id,
        type: 'INVESTIGACION',
        description: 'Investigacion y mensajes preparados para revision humana.',
        metadata: { fitScore: prospect.fit_score, priority: prospect.priority, demo: true },
        created_at: daysAgo(4),
      })),
    {
      prospect_id: castalla.id,
      type: 'APROBACION',
      description: 'Mensaje inicial aprobado para demo.',
      metadata: { demo: true, channel: 'EMAIL' },
      created_at: daysAgo(3),
    },
    {
      prospect_id: ibi.id,
      type: 'MENSAJE',
      description: 'Contacto registrado por EMAIL: CONTACTADO.',
      metadata: {
        demo: true,
        channel: 'EMAIL',
        emailDirection: 'outbound',
        contactEmail: ibi.email,
        contactName: ibi.contact_name,
        subject: firstMessageByProspect.get(ibi.id)?.subject || '',
        body: firstMessageByProspect.get(ibi.id)?.body || '',
        outreachStatus: 'CONTACTADO',
        messageId: firstMessageByProspect.get(ibi.id)?.id || null,
      },
      created_at: daysAgo(2),
    },
    {
      prospect_id: ibi.id,
      type: 'NOTA',
      description: 'Respuesta registrada: REUNION.',
      metadata: {
        demo: true,
        emailDirection: 'inbound',
        from: ibi.email,
        subject: `Re: ${ibi.company_name} | refrigeracion de proceso`,
        responseText: 'Gracias, tiene sentido revisarlo. La semana que viene podemos verlo con mantenimiento y produccion.',
        outreachStatus: 'REUNION',
        nextFollowUpAt: daysFromNow(2),
      },
      created_at: daysAgo(1),
    },
    {
      prospect_id: alcoy.id,
      type: 'MENSAJE',
      description: 'Contacto registrado por EMAIL: CONTACTADO.',
      metadata: {
        demo: true,
        channel: 'EMAIL',
        emailDirection: 'outbound',
        contactEmail: alcoy.email,
        contactName: alcoy.contact_name,
        subject: firstMessageByProspect.get(alcoy.id)?.subject || '',
        body: firstMessageByProspect.get(alcoy.id)?.body || '',
        outreachStatus: 'CONTACTADO',
        messageId: firstMessageByProspect.get(alcoy.id)?.id || null,
      },
      created_at: daysAgo(5),
    },
    {
      prospect_id: alcoy.id,
      type: 'NOTA',
      description: 'Respuesta registrada: MAS_TARDE.',
      metadata: {
        demo: true,
        emailDirection: 'inbound',
        from: alcoy.email,
        subject: `Re: ${alcoy.company_name} | refrigeracion de proceso`,
        responseText: 'Ahora estamos cerrando produccion. Retomemos en dos semanas y vemos una visita tecnica.',
        outreachStatus: 'MAS_TARDE',
        nextFollowUpAt: daysAgo(1),
      },
      created_at: daysAgo(3),
    },
    {
      prospect_id: onil.id,
      type: 'NOTA',
      description: 'Respuesta registrada: NO_INTERESADO.',
      metadata: {
        demo: true,
        emailDirection: 'inbound',
        from: onil.email,
        subject: `Re: ${onil.company_name} | refrigeracion de proceso`,
        responseText: 'Gracias, pero tenemos contrato cerrado y no queremos recibir mas informacion por ahora.',
        outreachStatus: 'NO_INTERESADO',
      },
      created_at: daysAgo(2),
    },
  ];
  const { error: activitiesError } = await supabase.from('prospect_activities').insert(activities);
  await throwIf(activitiesError, 'insert demo activities');

  const { error: refreshError } = await supabase.rpc('refresh_prospecting_list_counters', { p_list_id: list.id });
  await throwIf(refreshError, 'refresh counters');

  console.log(JSON.stringify({
    ok: true,
    listId: list.id,
    listName: list.name,
    prospects: prospects.length,
    messages: messages.length,
    activities: activities.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
