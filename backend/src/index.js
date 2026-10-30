import 'dotenv/config';
import {startSocialSync} from './services/social-sync.js';
import cors from 'cors';
import express from 'express';
import { contactsRouter } from './routes/contacts.js';
import { dashboardRouter } from './routes/dashboard.js';
import { campaignsRouter } from './routes/campaigns.js';
import { installationsRouter } from './routes/installations.js';
import { commercialAiRouter } from './routes/commercial-ai.js';
import { prospectingRouter } from './routes/prospecting.js';
import { settingsRouter } from './routes/settings.js';
import { ticketsAuthRouter } from './routes/tickets-auth.js';
import { authRouter } from './routes/auth.js';
import { biAuthRouter } from './routes/bi-auth.js';
import { biRouter } from './routes/bi.js';
import { prospectingAuthRouter } from './routes/prospecting-auth.js';
import { socialAuthRouter } from './routes/social-auth.js';
import { socialPublicationsRouter } from './routes/social-publications.js';
import { requireSocialAuth, requireAuth, requireBiAuth, requireProspectingAuth, requireTicketsAuth } from './services/auth.js';
import { ticketsRouter, ticketIntegrationRouter } from './routes/tickets.js';
import { startProspectingEmailWorker } from './services/prospecting-email.js';

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS.'));
  },
}));

app.use('/api/ticket-integration', express.json({ limit: '12mb' }), ticketIntegrationRouter);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cliente-crm-backend' });
});

app.use('/api/tickets/auth', ticketsAuthRouter);
app.use('/api/tickets', requireTicketsAuth, ticketsRouter);
app.use('/api/social/auth', socialAuthRouter);
app.use('/api/social-publications', (req, res, next) => req.path === '/webhook/n8n' ? next() : requireSocialAuth(req, res, next), socialPublicationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/bi/auth', biAuthRouter);
app.use('/api/bi', requireBiAuth, biRouter);
app.use('/api/prospecting/auth', prospectingAuthRouter);
app.use('/api/prospecting', requireProspectingAuth, prospectingRouter);
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/campaigns/webhooks/')) return next();
  if (req.path === '/social-publications/webhook/n8n') return next();
  return requireAuth(req, res, next);
});

app.use('/api/contacts', contactsRouter);
app.use('/api/installations', installationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/commercial-ai', commercialAiRouter);
app.use('/api/settings', settingsRouter);


app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(port, () => {
  console.log(`cliente CRM backend disponible en http://localhost:${port}`);
  startProspectingEmailWorker();
  startSocialSync();
});
