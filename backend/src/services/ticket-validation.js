export const categories = ['Aparcamientos', 'Combustible', 'Revisión', 'Supermercados', 'Varios'];
export const payments = ['Pago con tarjeta', 'Pago en efectivo'];
export const technicians = Array.from({ length: 17 }, (_, i) => `TECNICO ${String(i + 1).padStart(2, '0')}`);
export function validateReview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos de revisión inválidos.');
  const { technician, category, payment_method, ticket_date, establishment, amount, document_type } = value;
  if (![...technicians,'Pagos Tarjeta'].includes(technician)) throw new Error('Selecciona un técnico válido.');
  if (!categories.includes(category) || !payments.includes(payment_method)) throw new Error('Selecciona clasificación y método de pago.');
  if (!['TICKET', 'FACTURA'].includes(document_type)) throw new Error('Selecciona el tipo de documento.');
  if (typeof ticket_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ticket_date) || !Number.isFinite(Date.parse(ticket_date)) || new Date(ticket_date).toISOString().slice(0, 10) !== ticket_date) throw new Error('Fecha de ticket inválida.');
  if (typeof establishment !== 'string' || !establishment.trim() || establishment.length > 300) throw new Error('Indica el establecimiento (máximo 300 caracteres).');
  const amountText = String(amount ?? '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) throw new Error('Importe positivo con un máximo de dos decimales.');
  const currency = String(value.currency || 'EUR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Moneda inválida.');
  const cif_nif = value.cif_nif ?? '';
  if (typeof cif_nif !== 'string' || cif_nif.length > 50) throw new Error('CIF/NIF inválido.');
  return { cif_nif: cif_nif.trim().toUpperCase(), technician, category, payment_method, ticket_date, establishment: establishment.trim(), amount: amountText, currency, document_type };
}
export function decodeImage(base64, mime) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Imagen base64 inválida.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('La imagen debe ocupar entre 1 byte y 8 MB.');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if ((mime === 'image/jpeg' && jpeg) || (mime === 'image/png' && png)) return bytes;
  throw new Error('Solo se admiten imágenes JPEG o PNG con contenido válido.');
}
