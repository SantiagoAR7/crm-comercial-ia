const templates = {
  preventivo: {
    title: 'Revisión preventiva',
    checks: [
      ['general', 'Estado general del equipo'],
      ['plan', 'Puntos de revisión del plan'],
      ['function', 'Prueba de funcionamiento'],
    ],
  },
  correctivo: {
    title: 'Reparación correctiva',
    checks: [
      ['diagnosis', 'Diagnóstico de la incidencia'],
      ['repair', 'Reparación o ajuste aplicado'],
      ['function', 'Prueba después de la intervención'],
    ],
  },
} as const;

export const checkResults = {
  ok: 'Comprobado',
  issue: 'Con incidencia',
  na: 'No aplica',
} as const;

export type Worksheet = {
  title: string;
  checks: { label: string; result: keyof typeof checkResults }[];
  notes: string;
};

export function getWorksheetTemplate(origin: string) {
  return origin === 'Preventivo' ? templates.preventivo : templates.correctivo;
}

export function readWorksheet(form: FormData, origin: string) {
  const template = getWorksheetTemplate(origin);
  const checks: Worksheet['checks'] = [];
  for (const [id, label] of template.checks) {
    const result = form.get('check-' + id);
    if (result !== 'ok' && result !== 'issue' && result !== 'na') return null;
    checks.push({ label, result });
  }
  const raw = form.get('worksheetNotes');
  if (typeof raw !== 'string' || raw.length > 1200) return null;
  const notes = raw.trim();
  if (checks.some(check => check.result === 'issue') && !notes) return null;
  return { title: template.title, checks, notes };
}
