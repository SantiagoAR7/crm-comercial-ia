import type { VisitChange, VisitMail } from './service-store';

export function visitDate(appointment: string) {
  const [day, time] = appointment.split('T');
  return day.split('-').reverse().join('/') + ' a las ' + time;
}

export function visitSubject(id: string, change: VisitChange) {
  return 'Davofrío | ' + (change.previousAppointment ? 'Visita reprogramada' : 'Confirmación de visita') + ' · ' + id.slice(0, 8).toUpperCase();
}

export function visitMessage(id: string, change: VisitChange, location: string) {
  const introduction = change.previousAppointment
    ? 'Hemos reprogramado la visita de Servicio técnico que estaba prevista para el ' + visitDate(change.previousAppointment) + '.'
    : 'Confirmamos tu visita de Servicio técnico de Davofrío.';
  return 'Hola,\n\n' + introduction + '\n\n'
    + (change.previousAppointment ? 'Nueva fecha y hora: ' : 'Fecha y hora: ') + visitDate(change.appointment)
    + ' (hora local de la instalación)\nUbicación: ' + location + '\nReferencia del aviso: ' + id
    + '\n\nSi necesitas solicitar un cambio, responde a este correo.\n\nSaludos,\nServicio técnico de Davofrío';
}

export function visitMailLabel(mail: VisitMail) {
  if (mail.state === 'sending' && Date.now() - Date.parse(mail.at) >= 120_000) return 'Sin confirmación';
  return { sending: 'En proceso', accepted: 'Aceptado por Microsoft', failed: 'Rechazado', unknown: 'Sin confirmación' }[mail.state];
}
