export function quoteMailSubject(version: number) {
  return 'Davofrío | Presupuesto de servicio técnico · versión ' + version;
}

export function quoteMailBody(link: string) {
  return 'Hola,\n\nAdjuntamos el presupuesto de Servicio técnico de Davofrío. Puedes consultar esta versión y registrar tu respuesta durante 14 días en este enlace privado:\n\n'
    + link + '\n\nSaludos,\nServicio técnico de Davofrío';
}
