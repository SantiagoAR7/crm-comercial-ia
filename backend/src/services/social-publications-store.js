import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const storeFile = process.env.SOCIAL_PUBLICATIONS_FILE || '/app/data/social-publications.json';
const MAX_RECORDS = 5000;

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
  await fs.writeFile(temporary, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2), { mode: 0o600 });
  await fs.rename(temporary, storeFile);
}

export async function listSocialPublications() {
  return readAll();
}

export async function upsertSocialPublication(input) {
  const records = await readAll();
  const now = new Date().toISOString();
  const sourceExecutionId = String(input.sourceExecutionId || input.executionId || '').trim();
  const existingIndex = sourceExecutionId
    ? records.findIndex((item) => item.sourceExecutionId === sourceExecutionId)
    : -1;

  const existing = existingIndex >= 0 ? records[existingIndex] : null;
  const record = {
    id: existing?.id || crypto.randomUUID(),
    sourceExecutionId: sourceExecutionId || null,
    workflowId: String(input.workflowId || existing?.workflowId || '').trim() || null,
    workflowName: String(input.workflowName || existing?.workflowName || '').trim() || null,
    category: String(input.category || input.area || existing?.category || 'Sin categoría').trim(),
    content: String(input.content || input.text || input.caption || existing?.content || '').trim(),
    mediaType: normalizeMediaType(input.mediaType || input.format || existing?.mediaType),
    platform: String(input.platform || input.network || existing?.platform || 'Sin especificar').trim(),
    status: normalizeStatus(input.status || existing?.status),
    publishedAt: normalizeDate(input.publishedAt || input.finishedAt || existing?.publishedAt || now),
    startedAt: normalizeDate(input.startedAt || existing?.startedAt, true),
    finishedAt: normalizeDate(input.finishedAt || existing?.finishedAt, true),
    externalPostId: String(input.externalPostId || input.postId || existing?.externalPostId || '').trim() || null,
    externalUrl: String(input.externalUrl || input.postUrl || existing?.externalUrl || '').trim() || null,
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
  const normalized = String(value || 'publicado').toLowerCase().trim();
  if (['error', 'failed', 'fallido', 'fallida'].includes(normalized)) return 'error';
  if (['pending', 'pendiente', 'running', 'en curso'].includes(normalized)) return 'pendiente';
  if (['skipped', 'omitido', 'omitida'].includes(normalized)) return 'omitido';
  return 'publicado';
}

function normalizeDate(value, nullable = false) {
  if (!value && nullable) return null;
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? (nullable ? null : new Date().toISOString()) : date.toISOString();
}
