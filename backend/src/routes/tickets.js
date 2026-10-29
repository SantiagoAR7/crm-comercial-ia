import { monthBounds, currentMonth, previousMonth, backupManifest, backupPart } from '../services/ticket-history.js';
import { advanceArchive } from '../services/ticket-delivery.js';
import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ticketDb, dbResult } from '../services/ticket-supabase.js';
import { validateReview, decodeImage, technicians } from '../services/ticket-validation.js';

export const ticketsRouter = Router();
export const ticketIntegrationRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const handle = fn => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { await fn(req, res); } catch (error) { res.status(error.status || 400).json({ error: error.status ? error.message : 'Revisa los datos enviados.' }); }
};
function validId(id) { if (!uuidPattern.test(id)) throw new Error('Identificador inválido.'); return id; }
function requireReviewers(req, res, next) {
  const allowed = String(process.env.TICKETS_REVIEWER_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(req.ticketsUser?.email || '').toLowerCase())) return res.status(403).json({ error: 'No tienes permisos para revisar facturas.' });
  return next();
}
ticketsRouter.use(requireReviewers);
ticketIntegrationRouter.use((req, res, next) => {
  const expected = process.env.TICKETS_INGEST_SECRET || '';
  const actual = req.get('x-tickets-secret') || '';
  const a = Buffer.from(expected), b = Buffer.from(actual);
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Integración no autorizada.' });
  return next();
});

ticketsRouter.get('/', handle(async (req, res) => {
  let query = ticketDb().from('ticket_submissions').select('id,technician,bot_alias,status,received_at,reviewed_at,reviewed_by,rejection_reason,reviewed_data,proposed_data,version,is_test', { count: 'exact' }).or('is_test.eq.false,file_id.like.codex-test-replay-%').order('received_at', { ascending: false });
  const month=String(req.query.month || currentMonth());
  if(month!=='TODOS'){const {start,end}=monthBounds(month);query=query.gte('received_at',start).lt('received_at',end);}
  const status = String(req.query.status || 'PENDIENTE');
  if (status !== 'TODAS') {
    if (!['PENDIENTE','APROBADA','RECHAZADA'].includes(status)) throw new Error('Estado inválido.');
    query = query.eq('status', status);
  }
  if (req.query.technician) {
    if (!technicians.includes(req.query.technician)) throw new Error('Técnico inválido.');
    query = query.eq('technician', req.query.technician);
  }
  if (req.query.bot_alias) {
    if (req.query.bot_alias !== 'Pagos Tarjeta') throw new Error('Bot inválido.');
    query = query.eq('bot_alias', 'Pagos Tarjeta');
  }
  const page = Math.max(0, Math.min(100000, Math.floor(Number(req.query.page) || 0)));
  const result = await query.range(page * 50, page * 50 + 49);
  res.json({ data: dbResult(result), total: result.count, page, pageSize: 50 });
}));
ticketsRouter.get('/:id', handle(async (req, res) => {
  const db = ticketDb();
  const row = dbResult(await db.from('ticket_submissions').select('*').eq('id', validId(req.params.id)).single());
  const signed = dbResult(await db.storage.from('ticket-evidence').createSignedUrl(row.storage_path, 120));
  const history = dbResult(await db.from('ticket_audit').select('*').eq('submission_id', row.id).order('created_at'));
  const tasks = dbResult(await db.from('ticket_outbox').select('id,destination,status,attempts,last_error,created_at').eq('submission_id', row.id));
  res.json({ data: row, imageUrl: signed.signedUrl, history, tasks });
}));
ticketsRouter.post('/:id/decision', handle(async (req, res) => {
  const body = req.body || {};
  if (!['APROBADA', 'RECHAZADA'].includes(body.status) || !Number.isInteger(body.version)) throw new Error('Decisión inválida.');
  const reason = String(body.reason || '').trim();
  if (body.status === 'RECHAZADA' && (!reason || reason.length > 2000)) return res.status(400).json({ error: 'Indica el motivo de rechazo (máximo 2000 caracteres).' });
  let reviewed = {};
  if (body.status === 'APROBADA') {
    try { reviewed = validateReview(body.data); } catch (error) { return res.status(400).json({ error: error.message }); }
  }
  const data = dbResult(await ticketDb().rpc('review_ticket', { p_id: validId(req.params.id), p_version: body.version, p_status: body.status, p_actor: req.ticketsUser.email, p_reason: reason, p_data: reviewed }));
  res.json({ data });
}));

ticketIntegrationRouter.post('/intake', handle(async (req, res) => {
  const b = req.body || {};
  for (const key of ['bot_id', 'chat_id', 'message_id']) if (!/^-?\d{1,20}$/.test(String(b[key] || ''))) return res.status(400).json({ error: `Falta ${key} válido.` });
  if (!/^[a-zA-Z0-9_ -]{1,100}$/.test(String(b.bot_alias || ''))) throw new Error('Alias inválido.');
  if (b.technician && !technicians.includes(b.technician) && !(b.technician==='Pagos Tarjeta' && b.bot_alias==='Pagos Tarjeta')) throw new Error('Técnico inválido.');
  if (typeof b.file_id !== 'string' || !b.file_id || typeof b.file_unique_id !== 'string' || !b.file_unique_id) throw new Error('Falta identidad del archivo.');
  const db = ticketDb();
  const identity = { bot_id: String(b.bot_id), chat_id: String(b.chat_id), message_id: String(b.message_id) };
  let lookup = db.from('ticket_submissions').select('id,status');
  for (const [key, value] of Object.entries(identity)) lookup = lookup.eq(key, value);
  const existing = dbResult(await lookup.maybeSingle());
  if (existing) return res.json({ data: existing, duplicate: true });
  let bytes;
  try { bytes = decodeImage(b.image_base64, b.mime_type); } catch (error) { return res.status(400).json({ error: error.message }); }
  const hash = createHash('sha256').update(bytes).digest('hex');
  const extension = b.mime_type === 'image/png' ? 'png' : 'jpg';
  const path = `${identity.bot_id}/${identity.chat_id}/${identity.message_id}.${extension}`;
  // A deterministic path plus upsert:false keeps the first received original immutable.
  const upload = await db.storage.from('ticket-evidence').upload(path, bytes, { contentType: b.mime_type, upsert: false });
  if (upload.error) {
    // A simultaneous delivery may already have stored the same bytes.
    const stored = await db.storage.from('ticket-evidence').download(path);
    if (stored.error || createHash('sha256').update(Buffer.from(await stored.data.arrayBuffer())).digest('hex') !== hash) {
      const error = new Error('No se pudo guardar la evidencia original.'); error.status = 503; throw error;
    }
  }
  const sourceReceivedAt = b.source_received_at && Number.isFinite(Date.parse(b.source_received_at)) ? new Date(b.source_received_at).toISOString() : null;
  const prior = dbResult(await db.from('ticket_submissions').select('id,status').eq('bot_id',identity.bot_id).eq('chat_id',identity.chat_id).eq('sha256',hash).order('received_at',{ascending:false}).limit(1).maybeSingle());
  const insert = await db.from('ticket_submissions').upsert({ is_test: b.file_id.startsWith('codex-test-'), source_received_at: sourceReceivedAt, previous_submission_id: prior?.status==='RECHAZADA'?prior.id:null, ...identity, bot_alias: b.bot_alias, technician: b.technician || null, file_id: b.file_id, file_unique_id: b.file_unique_id, storage_path: path, sha256: hash, mime_type: b.mime_type, proposed_data: b.proposed_data || {}, ocr_error: String(b.ocr_error || '').slice(0, 1000) || null }, { onConflict: 'bot_id,chat_id,message_id', ignoreDuplicates: true }).select('id,status');
  dbResult(insert);
  if (insert.data.length) return res.status(201).json({ data: insert.data[0], duplicate: false });
  let concurrent = db.from('ticket_submissions').select('id,status');
  for (const [key, value] of Object.entries(identity)) concurrent = concurrent.eq(key, value);
  return res.json({ data: dbResult(await concurrent.single()), duplicate: true });
}));

ticketIntegrationRouter.post('/tasks/claim', handle(async (_req, res) => {
  const db = ticketDb();
  const tasks = dbResult(await db.rpc('claim_ticket_task'));
  if (!tasks.length) return res.json({ data: null });
  const task = tasks[0];
  const submission = dbResult(await db.from('ticket_submissions').select('*').eq('id', task.submission_id).single());
  const signed = task.destination==='ARCHIVE_EXPORT' ? dbResult(await db.storage.from('ticket-evidence').createSignedUrl(submission.storage_path, 600)) : null;
  res.json({ data: { task, submission, imageUrl: signed?.signedUrl || null } });
}));
ticketIntegrationRouter.post('/tasks/:id/finish', handle(async (req, res) => {
  const b = req.body || {};
  if (!['COMPLETADA','ERROR','INCIERTA'].includes(b.status)) throw new Error('Estado inválido.');
  const data = dbResult(await ticketDb().rpc('finish_ticket_task', { p_id: validId(req.params.id), p_lease: validId(b.lease_token || ''), p_status: b.status, p_result: b.result || {}, p_error: String(b.error || '') }));
  res.json({ data });
}));

// OCR cannot change the reviewed fields or reopen a decision.
ticketIntegrationRouter.post('/submissions/:id/extraction', handle(async (req,res) => {
  const b=req.body||{};
  if(!b.data||typeof b.data!=='object'||Array.isArray(b.data)||JSON.stringify(b.data).length>15000)throw new Error('Extracción inválida.');
  const applied=dbResult(await ticketDb().rpc('update_ticket_extraction',{p_id:validId(req.params.id),p_data:b.data,p_error:String(b.error||'')}));
  res.json({ok:true,applied});
}));
ticketIntegrationRouter.post('/tasks/:id/archive/next', handle(async (req,res) => {
  const b=req.body||{};
  const db=ticketDb();
  const task=dbResult(await db.from('ticket_outbox').select('*').eq('id',validId(req.params.id)).single());
  if(task.status!=='EN_PROCESO'||task.lease_token!==validId(b.lease_token||'')||Date.parse(task.lease_until)<Date.now()){
    return res.status(409).json({error:'Bloqueo de tarea caducado o inválido.'});
  }
  const submission=dbResult(await db.from('ticket_submissions').select('*').eq('id',task.submission_id).single());
  res.json(await advanceArchive(db,task,submission,b));
}));

// Monthly copies include every decision state and the original image; CRM originals are retained.
ticketIntegrationRouter.post('/history/manifest', handle(async (req,res)=>{
  res.json(await backupManifest(String(req.body?.month||previousMonth()),req.body?.test===true));
}));
ticketIntegrationRouter.post('/history/part', handle(async (req,res)=>{
  const data=await backupPart(req.body||{});
  res.type('application/gzip').set('Content-Disposition','attachment; filename="historial.json.gz"').send(data);
}));
