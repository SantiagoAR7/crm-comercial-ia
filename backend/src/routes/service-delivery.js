import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, raw } from 'express';
import { GraphMailError, sendGraphMail } from '../services/graph-mail.js';

export const serviceDeliveryRouter = Router();
const mailbox = 'transformaciondigital@davofrio.com';
const address = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i;
const identifier = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

serviceDeliveryRouter.post('/', raw({ type: 'application/json', limit: '4mb' }), async (req, res) => {
  const secret = process.env.SERVICE_DELIVERY_SECRET;
  const time = req.get('x-delivery-time') || '';
  const digest = req.get('x-delivery-signature') || '';
  if (!secret || secret.length < 32 || !Buffer.isBuffer(req.body) || !/^\d{13}$/.test(time)
    || Math.abs(Date.now() - Number(time)) > 60_000 || !/^[a-f0-9]{64}$/.test(digest)) {
    return res.status(401).json({ outcome: 'failed' });
  }
  const expected = createHmac('sha256', secret).update('davofrio:service-delivery:' + time + ':').update(req.body).digest();
  if (!timingSafeEqual(Buffer.from(digest, 'hex'), expected)) return res.status(401).json({ outcome: 'failed' });

  let envelope;
  try { envelope = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ outcome: 'failed' }); }
  const { to, subject, message, file, filename, attempt, test, noticeType } = envelope || {};
  if (typeof test !== 'boolean' || typeof to !== 'string' || to.length > 254 || !address.test(to)
    || (test && to.toLowerCase() !== mailbox) || typeof subject !== 'string' || !subject.trim() || subject.length > 160 || /[\r\n]/.test(subject)
    || typeof message !== 'string' || !message.trim() || message.length > 4000
    || (noticeType === 'visit' ? file !== undefined || filename !== undefined
      : noticeType !== undefined || typeof file !== 'string' || !file.startsWith('JVBERi0') || file.length > 3_900_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file)
    || typeof filename !== 'string' || (!/^(parte|certificado)-davofrio-[a-f0-9-]{36}\.pdf$/i.test(filename)
      && !/^presupuesto-davofrio-[a-f0-9-]{36}-v[1-9][0-9]*\.pdf$/i.test(filename)))
    || typeof attempt !== 'string' || !identifier.test(attempt)) return res.status(400).json({ outcome: 'failed' });

  try {
    const reference = await sendGraphMail({
      mailbox, to, subject, text: message, reference: attempt,
      attachments: noticeType === 'visit' ? [] : [{ '@odata.type': '#microsoft.graph.fileAttachment', name: filename, contentType: 'application/pdf', contentBytes: file }],
    });
    return res.status(202).json({ outcome: 'accepted', reference });
  } catch (error) {
    const outcome = error instanceof GraphMailError ? error.outcome : 'unknown';
    console.error('Correo de Servicio técnico', attempt, error instanceof GraphMailError ? error.message : 'resultado no confirmado');
    return res.status(502).json({ outcome });
  }
});
