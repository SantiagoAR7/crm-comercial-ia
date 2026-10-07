import { Router } from 'express';
import { defaultSettings as defaults, readSettings, writeSettings } from '../services/settings-store.js';

export const settingsRouter = Router();
settingsRouter.get('/', async (_req, res) => {
  try { return res.json({ data: await readSettings() }); }
  catch (error) { return res.status(500).json({ error: 'No se pudo cargar la configuración.', detail: error.message }); }
});

settingsRouter.put('/', async (req, res) => {
  const input = req.body || {};
  const settings = {
    maxConcurrency: Math.min(10, Math.max(1, Number(input.maxConcurrency || defaults.maxConcurrency))),
    batchSize: Math.min(100, Math.max(1, Number(input.batchSize || defaults.batchSize))),
    maxAttempts: Math.min(5, Math.max(1, Number(input.maxAttempts || defaults.maxAttempts))),
    callingStart: String(input.callingStart || defaults.callingStart), callingEnd: String(input.callingEnd || defaults.callingEnd),
    timezone: 'Europe/Madrid', notificationEmail: String(input.notificationEmail || '').trim(),
    notificationBcc: String(input.notificationBcc || '').trim(), requireHumanApproval: input.requireHumanApproval !== false,
    respectDoNotCall: input.respectDoNotCall !== false,
  };
  if (!/^\d{2}:\d{2}$/.test(settings.callingStart) || !/^\d{2}:\d{2}$/.test(settings.callingEnd)) return res.status(400).json({ error: 'El horario no es válido.' });
  if (!settings.requireHumanApproval || !settings.respectDoNotCall) return res.status(400).json({ error: 'La aprobación humana y la lista de no llamar son protecciones obligatorias.' });
  try { await writeSettings(settings); return res.json({ data: settings, updatedAt: new Date().toISOString() }); }
  catch (error) { return res.status(500).json({ error: 'No se pudo guardar la configuración.', detail: error.message }); }
});
