import { Router } from 'express';
import { listSocialPublications, upsertSocialPublication } from '../services/social-publications-store.js';

export const socialPublicationsRouter = Router();

socialPublicationsRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').toLowerCase().trim();
    const category = String(req.query.category || '').toLowerCase().trim();
    const status = String(req.query.status || '').toLowerCase().trim();
    const platform = String(req.query.platform || '').toLowerCase().trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 1000);
    let records = await listSocialPublications();

    if (search) records = records.filter((item) => [item.category, item.content, item.workflowName, item.platform]
      .some((value) => String(value || '').toLowerCase().includes(search)));
    if (category) records = records.filter((item) => item.category.toLowerCase() === category);
    if (status) records = records.filter((item) => item.status === status);
    if (platform) records = records.filter((item) => item.platform.toLowerCase() === platform);

    const all = await listSocialPublications();
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      data: records.slice(0, limit),
      summary: {
        total: all.length,
        today: all.filter((item) => String(item.publishedAt || '').startsWith(today)).length,
        published: all.filter((item) => item.status === 'publicado').length,
        errors: all.filter((item) => item.status === 'error').length,
      },
      filters: {
        categories: [...new Set(all.map((item) => item.category).filter(Boolean))].sort(),
        platforms: [...new Set(all.map((item) => item.platform).filter(Boolean))].sort(),
      },
    });
  } catch (error) { next(error); }
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
