import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const storeFile = process.env.SOCIAL_PUBLICATIONS_FILE || '/app/data/social-publications.json';
let writes = Promise.resolve();

async function readAll() {
  try {
    const parsed = JSON.parse(await fs.readFile(storeFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return [];
  }
}

async function writeAll(records) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  const temporary = `${storeFile}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(records, null, 2), { mode: 0o600 });
  await fs.rename(temporary, storeFile);
}

export async function listSocialPublications() {
  const records = await readAll();
  const seen = new Set();
  return records.filter(record => {
    if (record.platform !== 'HeyGen' || !record.externalPostId) return true;
    const key = `${record.category}:${record.externalPostId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function upsertSocialPublication(input) {
  const result = writes.then(() => upsert(input));
  writes = result.catch(() => undefined);
  return result;
}

async function upsert(input) {
  const records = await readAll();
  const now = new Date().toISOString();
  const sourceExecutionId = String(input.sourceExecutionId || input.executionId || '').trim();
  const publicationKey = String(input.publicationKey || [sourceExecutionId, input.platform || input.network || '', input.sourceNode || ''].join(':'));
  const existingIndex = sourceExecutionId
    ? records.findIndex((item) => (item.publicationKey || [item.sourceExecutionId, item.platform || '', item.sourceNode || ''].join(':')) === publicationKey)
    : -1;

  const existing = existingIndex >= 0 ? records[existingIndex] : null;
  const preservePublishedMedia = Boolean(existing?.mediaOrigin?.startsWith('publicación en ') && input.observer && !input.mediaCheckedAt);
  const record = {
    id: existing?.id || crypto.randomUUID(),
    publicationKey,
    observer: Boolean(input.observer ?? existing?.observer),
    sourceNode: String(input.sourceNode || existing?.sourceNode || ''),
    accountName: String(input.accountName || existing?.accountName || ''),
    accountId: String(input.accountId || existing?.accountId || ''),
    title: String(input.title || existing?.title || ''),
    sourceUrl: safeUrl(input.sourceUrl || existing?.sourceUrl),
    imageUrl: preservePublishedMedia ? existing.imageUrl : safeUrl(input.imageUrl || existing?.imageUrl),
    videoUrl: preservePublishedMedia ? existing.videoUrl : safeUrl(input.videoUrl || existing?.videoUrl),
    mediaCheckedAt: input.mediaCheckedAt || existing?.mediaCheckedAt || null,
    mediaError: input.mediaError ?? existing?.mediaError ?? null,
    mediaOrigin: preservePublishedMedia ? existing.mediaOrigin : String(input.mediaOrigin || existing?.mediaOrigin || ''),
    executionStatus: String(input.executionStatus || existing?.executionStatus || ''),
    visibility: String(input.visibility || existing?.visibility || ''),
    testMode: Boolean(input.testMode ?? existing?.testMode),
    sourceExecutionId: sourceExecutionId || null,
    workflowId: String(input.workflowId || existing?.workflowId || '').trim() || null,
    workflowName: String(input.workflowName || existing?.workflowName || '').trim() || null,
    category: String(input.category || input.area || existing?.category || 'Sin categoría').trim(),
    content: preservePublishedMedia ? existing.content : String(input.content || input.text || input.caption || existing?.content || '').trim(),
    mediaType: preservePublishedMedia ? existing.mediaType : normalizeMediaType(input.mediaType || input.format || existing?.mediaType),
    platform: String(input.platform || input.network || existing?.platform || 'Sin especificar').trim(),
    status: normalizeStatus(input.status || existing?.status),
    publishedAt: normalizeDate(input.publishedAt || input.finishedAt || existing?.publishedAt || now),
    startedAt: normalizeDate(input.startedAt || existing?.startedAt, true),
    finishedAt: normalizeDate(input.finishedAt || existing?.finishedAt, true),
    externalPostId: String(input.externalPostId || input.postId || existing?.externalPostId || '').trim() || null,
    externalUrl: preservePublishedMedia ? existing.externalUrl : safeUrl(input.externalUrl || input.postUrl || existing?.externalUrl),
    errorMessage: String(input.errorMessage || input.error || existing?.errorMessage || '').trim() || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const next = existingIndex >= 0
    ? records.map((item, index) => index === existingIndex ? record : item)
    : [record, ...records];
  next.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  await writeAll(next);
  return record;
}

function normalizeMediaType(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (normalized.includes('video')) return 'video';
  if (normalized.includes('carrusel') || normalized.includes('carousel')) return 'carrusel';
  if (normalized.includes('imagen') || normalized.includes('image') || normalized.includes('foto')) return 'imagen';
  if (normalized.includes('texto') || normalized === 'text') return 'texto';
  return 'sin multimedia';
}

function normalizeStatus(value) {
  const normalized = String(value || 'sin confirmar').toLowerCase().trim();
  if (['error', 'failed', 'fallido', 'fallida'].includes(normalized)) return 'error';
  if (['pending', 'pendiente', 'running', 'en curso'].includes(normalized)) return 'pendiente';
  if (['skipped', 'omitido', 'omitida'].includes(normalized)) return 'omitido';
  if (['publicado', 'published'].includes(normalized)) return 'publicado';
  if (normalized === 'generado') return 'generado';
  return 'sin confirmar';
}

function normalizeDate(value, nullable = false) {
  if (!value && nullable) return null;
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? (nullable ? null : new Date().toISOString()) : date.toISOString();
}

export function safeUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || /(?:access_token|api_key|authorization)=/i.test(url.search)) return null;
    return url.href;
  } catch { return null; }
}

export function upsertSocialExecution(records) {
  if (!records.length) return Promise.resolve();
  const result = writes.then(async () => {
    const keys = new Set(records.map(record => record.publicationKey));
    const all = await readAll();
    const next = all.filter(record => !(record.observer && record.sourceExecutionId === records[0].sourceExecutionId && !keys.has(record.publicationKey)));
    if (next.length !== all.length) await writeAll(next);
    for (const record of records) await upsert({...record, observer: true});
  });
  writes = result.catch(() => undefined);
  return result;
}
