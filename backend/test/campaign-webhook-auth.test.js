import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

// This isolated process never loads .env or starts the application's workers.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
const { campaignsRouter } = await import('../src/routes/campaigns.js');

test('both campaign callback routes fail closed before any database access', async () => {
  const app = express();
  app.use(express.json());
  app.use('/campaigns', campaignsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  const previous = process.env.N8N_WEBHOOK_SECRET;

  try {
    for (const route of ['retell-result', 'vapi-result']) {
      const request = headers => fetch(`${root}/campaigns/webhooks/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: '{}',
      });

      delete process.env.N8N_WEBHOOK_SECRET;
      assert.equal((await request({})).status, 401);
      assert.equal((await request({ 'x-cliente-secret': 'test-secret' })).status, 401);
      process.env.N8N_WEBHOOK_SECRET = 'test-secret';
      assert.equal((await request({})).status, 401);
      assert.equal((await request({ 'x-cliente-secret': 'wrong' })).status, 401);
      assert.equal((await request({ 'x-cliente-secret': 'test-secrex' })).status, 401);

      for (const header of ['x-cliente-secret', 'x-davofrio-secret']) {
        const response = await request({ [header]: 'test-secret' });
        // Valid authentication reaches body validation; {} never reaches Supabase.
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /identificar la llamada/);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
