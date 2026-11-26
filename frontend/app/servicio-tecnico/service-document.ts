export type ServiceDocument = 'parte' | 'certificado';

export function documentLabel(kind: ServiceDocument | 'presupuesto') {
  if (kind === 'presupuesto') return 'Presupuesto de servicio técnico';
  return kind === 'certificado' ? 'Certificado de intervención' : 'Parte de trabajo';
}

export function downloadUrl(id: string, kind: ServiceDocument) {
  return '/servicio-tecnico/documento?' + new URLSearchParams({ aviso: id, tipo: kind });
}
