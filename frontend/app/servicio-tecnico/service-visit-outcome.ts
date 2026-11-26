export const incompleteVisitReasons = [
  'Cliente ausente',
  'Sin acceso a la instalación',
  'Repuesto pendiente',
  'Reparación parcial',
  'Se necesita otra visita',
] as const;

export type IncompleteVisit = {
  appointment: string;
  technician: string;
  reason: typeof incompleteVisitReasons[number];
  work: string;
  nextAction: string;
  startedAt?: string;
  recordedAt: string;
};
