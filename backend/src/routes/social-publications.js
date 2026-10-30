import {socialSyncStatus,syncSocialExecutions} from '../services/social-sync.js';
import { Router } from 'express';
import { listSocialPublications, upsertSocialPublication } from '../services/social-publications-store.js';
import {
  linkedinIdeasContext,
  listLinkedinIdeas,
  saveGeneratedLinkedinIdeas,
  updateLinkedinIdea,
  updateLinkedinSettings,
} from '../services/linkedin-ideas-store.js';

export const socialPublicationsRouter = Router();

socialPublicationsRouter.post('/sync', async (_req, res, next) => {
  try {await syncSocialExecutions();res.json(socialSyncStatus());}catch(e){next(e);}
});

socialPublicationsRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').toLowerCase().trim();
    const category = String(req.query.category || '').toLowerCase().trim();
    const platform = String(req.query.platform || '').toLowerCase().trim();
    const mediaType = String(req.query.mediaType || '').toLowerCase().trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 1000);
    const published = (await listSocialPublications()).filter(item => item.status === 'publicado' && item.externalPostId && item.externalUrl && (!['Facebook','Instagram'].includes(item.platform) || String(item.mediaOrigin).startsWith('publicación en ')) && ['Facebook','Instagram','TikTok','YouTube'].includes(item.platform));
    let records = published;

    if (search) records = records.filter((item) => [item.category, item.content, item.workflowName, item.platform]
      .some((value) => String(value || '').toLowerCase().includes(search)));
    if (category) records = records.filter((item) => item.category.toLowerCase() === category);
    if (platform) records = records.filter((item) => item.platform.toLowerCase() === platform);

    if (mediaType) records = records.filter(item => item.mediaType === mediaType);
    const all = published;
    const day = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date(value));
    const today = day(Date.now());
    res.json({
      data: records.slice(0, limit).map(({id,category,accountName,title,content,mediaType,platform,publishedAt,externalUrl,imageUrl,videoUrl}) => ({id,category,accountName,title,content,mediaType,platform,publishedAt,externalUrl,imageUrl,videoUrl})),
      sync: {lastSyncAt:socialSyncStatus().lastSyncAt},
      summary: {
        images: all.filter(item=>item.mediaType==='imagen').length,
        videos: all.filter(item=>item.mediaType==='video').length,
        latest: all[0]?.publishedAt || null,
        total: all.length,
        today: all.filter(item => day(item.publishedAt) === today).length,
        published: all.filter((item) => item.status === 'publicado').length,
      },
      filters: {
        categories: [...new Set(all.map((item) => item.category).filter(Boolean))].sort(),
        platforms: [...new Set(all.map((item) => item.platform).filter(Boolean))].sort(),
      },
    });
  } catch (error) { next(error); }
});

socialPublicationsRouter.get('/linkedin/context', async (_req, res, next) => {
  try {
    return res.json({ data: await linkedinIdeasContext() });
  } catch (error) { return next(error); }
});

socialPublicationsRouter.get('/linkedin/ideas', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const accountId = String(req.query.accountId || '').trim();
    const verticalId = String(req.query.verticalId || '').trim();
    const data = await listLinkedinIdeas({ status, accountId, verticalId });
    return res.json({
      data,
      summary: {
        total: data.length,
        pending: data.filter((item) => item.status === 'pendiente').length,
        approved: data.filter((item) => item.status === 'aprobada').length,
        rejected: data.filter((item) => item.status === 'rechazada').length,
        scheduled: data.filter((item) => item.status === 'programada').length,
      },
    });
  } catch (error) { return next(error); }
});

socialPublicationsRouter.post('/linkedin/ideas/generate', async (req, res, next) => {
  try {
    const data = await saveGeneratedLinkedinIdeas(req.body || {});
    return res.status(201).json({ data, generated: data.length });
  } catch (error) { return next(error); }
});

socialPublicationsRouter.patch('/linkedin/ideas/:id', async (req, res, next) => {
  try {
    const data = await updateLinkedinIdea(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ error: 'Idea de LinkedIn no encontrada.' });
    return res.json({ data });
  } catch (error) { return next(error); }
});

socialPublicationsRouter.patch('/linkedin/settings', async (req, res, next) => {
  try {
    return res.json({ data: await updateLinkedinSettings(req.body || {}) });
  } catch (error) { return next(error); }
});

socialPublicationsRouter.post('/webhook/n8n', async (req, res, next) => {
  try {
    const configuredSecret = process.env.N8N_WEBHOOK_SECRET;
    const suppliedSecret = req.get('x-cliente-secret') || req.get('x-webhook-secret');
    if (!configuredSecret || suppliedSecret !== configuredSecret) {
      return res.status(401).json({ error: 'Webhook no autorizado.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo debe ser un objeto JSON.' });
    }
    const record = await upsertSocialPublication(req.body);
    return res.status(201).json({ ok: true, data: record });
  } catch (error) { return next(error); }
});
