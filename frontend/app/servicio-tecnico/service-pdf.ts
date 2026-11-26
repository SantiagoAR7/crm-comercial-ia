import { certificateNumber, type ServiceCertificate } from './service-certificate-store';
import { checkResults } from './service-worksheet';
import { formatWorkTime } from './service-work-time';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { documentLabel, type ServiceDocument } from './service-document';
import { formatKilograms, leakResults } from './service-refrigerant';
import { charges, chargeLabels } from './service-coverage';
import type { ServiceNotice } from './service-store';

const navy = '#0B2850';
const ink = '#172536';
const muted = '#475569';
const line = '#D8E2ED';
const margin = 48;

function printable(value: string) {
  return value.replace(/[‐‑–—]/g, '-').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
}

function imageBytes(value: string) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || value.length > 175000) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (match[1] === 'png') {
    if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
    const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    if (!width || !height || width > 2048 || height > 2048) return null;
  }
  return bytes;
}

export async function renderServicePdf(notice: ServiceNotice, kind: ServiceDocument | 'presupuesto', certificate?: ServiceCertificate | null, quoteVersion?: number) {
  const title = documentLabel(kind);
  const doc = new PDFDocument({ size: 'A4', margins: { top: margin, right: margin, bottom: 62, left: margin },
    bufferPages: true, info: { Title: title, Author: 'Davofrío' } });
  const fontDir = join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');
  doc.registerFont('Inter', join(fontDir, 'inter-latin-400-normal.woff'));
  doc.registerFont('Inter-Bold', join(fontDir, 'inter-latin-700-normal.woff'));
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (data: Buffer) => chunks.push(data));
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
  });
  const width = doc.page.width - margin * 2;

  function keepSpace(height: number) {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  function section(label: string) {
    keepSpace(52);
    doc.moveDown(0.8);
    doc.font('Inter-Bold').fontSize(13).fillColor(navy).text(label, margin, doc.y, { width });
    doc.moveDown(0.35);
  }

  function paragraph(value: string) {
    doc.font('Inter').fontSize(10.5).fillColor(ink).text(printable(value || '-'), margin, doc.y, { width, lineGap: 3 });
  }

  function row(label: string, value: string) {
    const column = 150;
    doc.font('Inter').fontSize(10);
    const text = printable(value || '-');
    const valueHeight = doc.heightOfString(text, { width: width - column });
    const labelHeight = doc.font('Inter-Bold').heightOfString(label, { width: column - 10 });
    const height = Math.max(17, valueHeight + 5, labelHeight + 5);
    keepSpace(height);
    const y = doc.y;
    doc.font('Inter-Bold').fillColor(muted).text(label, margin, y, { width: column - 10 });
    doc.font('Inter').fillColor(ink).text(text, margin + column, y, { width: width - column });
    doc.x = margin;
    doc.y = y + height;
  }

  function evidence(value: string, caption: string, height: number) {
    keepSpace(height + 22);
    const y = doc.y;
    doc.font('Inter').fontSize(9).fillColor(muted).text(caption, margin, y, { width });
    const buffer = imageBytes(value);
    if (buffer) {
      try {
        doc.image(buffer, margin, y + 17, { fit: [width, height], valign: 'center' });
        doc.y = y + height + 25;
      } catch {
        paragraph('Imagen no disponible en este documento.');
      }
    } else {
      paragraph('Imagen no disponible en este documento.');
    }
  }

  doc.rect(margin, margin, width, 5).fill(navy);
  doc.font('Inter-Bold').fontSize(13).fillColor(navy).text('DAVOFRÍO', margin, margin + 19, { width });
  doc.fontSize(25).fillColor(ink).text(title, margin, doc.y + 9, { width });
  if (kind === 'certificado' && certificate) {
    doc.font('Inter-Bold').fontSize(12).fillColor(navy).text(certificateNumber(certificate), margin, doc.y + 6, { width });
    doc.font('Inter').fontSize(9).fillColor(muted).text('Emisión ' + formatWorkTime(certificate.issued_at), margin, doc.y + 4, { width });
  }
  doc.font('Inter').fontSize(9).fillColor(muted).text('Referencia: ' + notice.id, margin, doc.y + 7, { width });
  doc.moveDown(0.8);

  if (kind === 'presupuesto') {
    const quote = quoteVersion && notice.quotes?.[quoteVersion - 1];
    if (!quote) throw new Error('Presupuesto no disponible');
    row('Versión', String(quoteVersion));
    row('Emisión', formatWorkTime(quote.issuedAt));
    row('Cliente', quote.subject.customer);
    row('Equipo', quote.subject.equipment);
    row('Número de serie', quote.subject.serial);
    section('Intervención solicitada');
    paragraph(quote.subject.issue);
    section('Importes a cargo del cliente');
    const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
    let total = 0;
    for (const charge of charges) {
      if ((notice.payers?.[charge] || 'customer') !== 'customer') continue;
      const amount = quote.amounts[charge] ?? 0;
      row(chargeLabels[charge], money.format(amount / 100));
      total += amount;
    }
    row('Total para el cliente', money.format(total / 100));
  } else {
    section('Datos de la intervención');
    row('Cliente', notice.customer);
    row('Equipo', notice.equipment);
    row('Número de serie', notice.serial);
    row('Técnico', notice.technician);
    row('Visita', notice.appointment.replace('T', ' '));
    if (notice.startedAt) row('Inicio', formatWorkTime(notice.startedAt));
    if (notice.finishedAt) row('Cierre', formatWorkTime(notice.finishedAt));
    row('Tiempo trabajado', notice.minutes == null ? '' : notice.minutes + ' min');

    section('Trabajo realizado');
    paragraph(notice.report);

    if (notice.worksheet) {
      section(notice.worksheet.title);
      for (const check of notice.worksheet.checks) row(check.label, checkResults[check.result]);
      if (notice.worksheet.notes) paragraph(notice.worksheet.notes);
    }

    const work = notice.refrigerantWork;
    if (work) {
      section('Registro de refrigerante');
      row('Fecha de la actuación', work.performedOn.split('-').reverse().join('/'));
      row('Refrigerante', work.refrigerant);
      row('Carga nominal del equipo', formatKilograms(work.chargeGrams));
      row('Cantidad añadida', formatKilograms(work.addedGrams));
      row('Cantidad recuperada', formatKilograms(work.recoveredGrams));
      row('Control de fugas', leakResults[work.leakResult]);
      row('Acreditación del técnico', work.technicianCredential);
      if (work.followUp) {
        section('Actuación o seguimiento');
        paragraph(work.followUp);
      }
    }

    if (kind === 'parte') {
      section('Piezas utilizadas');
      const parts = notice.consumedParts || [];
      for (const part of parts) paragraph(part.reference + ' | ' + part.units.toLocaleString('es-ES') + ' | ' + part.location);
      if (notice.usedParts) paragraph(notice.usedParts);
      if (!parts.length && !notice.usedParts) paragraph('-');
      if (notice.reportPhotos?.length) {
        keepSpace(210);
        section('Fotos del trabajo');
        notice.reportPhotos.forEach((photo, index) => evidence(photo, 'Foto ' + (index + 1), 148));
      }
    }
    if (notice.reportSignature) {
      keepSpace(150);
      section('Firma del cliente');
      evidence(notice.reportSignature, printable(notice.reportSigner || 'Firma manuscrita'), 68);
    }
  }

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(pages.start + index);
    const footer = doc.page.height - 39;
    doc.moveTo(margin, footer - 7).lineTo(margin + width, footer - 7).lineWidth(0.5).strokeColor(line).stroke();
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 20;
    doc.font('Inter').fontSize(8).fillColor(muted).text('Davofrío | Servicio técnico', margin, footer, { width, lineBreak: false });
    doc.text((index + 1) + ' / ' + pages.count, margin, footer, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return output;
}
