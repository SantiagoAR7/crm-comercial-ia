export const receivedTemplate = {
  id: 'commercial-request-received',
  subject: 'Confirmación de solicitud',
} as const;

type Schedule = { title: string; timing: string; reference: string };

export const commercialSchedule: Record<string, Schedule[]> = {
  received: [{ title: receivedTemplate.subject, timing: 'Al instante', reference: 'email-000' }],
  unanswered: [
    { title: 'Hemos intentado contactar', timing: '1 día después', reference: 'email-001' },
    { title: 'Retomamos cuando quieras', timing: '3 días después', reference: 'email-002' },
  ],
  'quote-sent': [
    { title: '¿Has podido revisar tu propuesta?', timing: '2 días después', reference: 'email-003' },
    { title: 'La diferencia está en calcular antes', timing: '2 días más tarde', reference: 'email-004' },
    { title: '¿Avanzamos con tu proyecto?', timing: '3 días más tarde', reference: 'email-005' },
    { title: 'Tu propuesta sigue disponible', timing: 'A los 14 días', reference: 'email-006' },
    { title: '¿Seguimos adelante con tu proyecto?', timing: 'A los 30 días', reference: 'email-007' },
    { title: 'Antes de archivar tu propuesta', timing: 'A los 2 meses', reference: 'email-008' },
  ],
  'quote-accepted': [{ title: '¡Enhorabuena, tu proyecto ha sido aceptado!', timing: 'Hora de envío por confirmar', reference: 'email-009' }],
  visit: [{ title: 'En breve agendamos tu visita técnica', timing: 'Hora de envío por confirmar', reference: 'email-010' }],
  report: [{ title: 'Seguimos trabajando en tu proyecto', timing: 'Cada 3 días mientras siga en este estado', reference: 'email-011' }],
  audit: [{ title: 'Tu proyecto ya está listo para presentarte', timing: 'Hora de envío por confirmar', reference: 'email-012' }],
  presented: [
    { title: 'Tu proyecto ya tiene números reales', timing: '1 día después', reference: 'email-013' },
    { title: 'El proyecto no termina en el plano', timing: '4 días más tarde', reference: 'email-014' },
    { title: '¿Qué necesitas para tomar una decisión?', timing: '15 días más tarde', reference: 'email-015' },
    { title: '¿Sigues valorando tu proyecto?', timing: 'A los 14 días', reference: 'email-016' },
    { title: 'Tu proyecto sigue disponible', timing: 'Al mes', reference: 'email-017' },
    { title: 'Antes de archivar tu proyecto', timing: 'A los 2 meses', reference: 'email-018' },
  ],
  accepted: [{ title: 'Tu proyecto está confirmado', timing: 'Hora de envío por confirmar', reference: 'email-019' }],
  paid: [{ title: 'Pago recibido correctamente', timing: 'Hora de envío por confirmar', reference: 'email-020' }],
  installed: [
    { title: 'Tu instalación ya está lista', timing: 'Hora de envío por confirmar', reference: 'email-021' },
    { title: '¿Cómo está funcionando tu instalación?', timing: '10 días después', reference: 'email-022' },
  ],
  'quote-pending': [],
  rejected: [],
};
