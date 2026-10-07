import 'dotenv/config';
import { supabase } from '../src/services/supabase.js';

const crmBase = 'https://crm.example.com';
const shouldSend = process.argv.includes('--send');
const phoneArgIndex = process.argv.indexOf('--phone');
const testPhone = phoneArgIndex >= 0
  ? process.argv[phoneArgIndex + 1]
  : '+34600000000';

if (!/^\+[1-9]\d{7,14}$/.test(testPhone)) {
  throw new Error(`Número de prueba no válido: ${testPhone}`);
}

const campaignResponse = await fetch(`${crmBase}/api/campaigns`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: `Prueba controlada ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    type: 'VERANO',
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    notes: 'Prueba técnica autorizada: un único destinatario.',
  }),
});
const campaignBody = await campaignResponse.json();
if (!campaignResponse.ok) throw new Error(JSON.stringify(campaignBody));
const campaign = campaignBody.data;

const { data: contact, error: contactError } = await supabase
  .from('campaign_contacts')
  .insert({
    campaign_id: campaign.id,
    id_activo: `TEST-${Date.now()}`,
    id_cliente: 'TEST-CRM',
    customer_name: 'Prueba cliente',
    contact_name: 'Contacto de prueba',
    normalized_phone: testPhone,
    normalized_email: 'qa@example.com',
    selected: true,
    excluded: false,
    status: 'SELECCIONADO',
    review_status: 'APROBADO',
    approved_at: new Date().toISOString(),
    approved_by: 'prueba_controlada',
    brand: 'Daikin',
    model: 'Prueba CRM',
    province: 'Prueba',
    population: 'Prueba',
    source_snapshot: { source: 'controlled_test', authorized: true },
  })
  .select('id')
  .single();
if (contactError) throw new Error(contactError.message);

const { error: approveError } = await supabase
  .from('campaigns')
  .update({
    status: 'APROBADA',
    candidate_count: 1,
    approved_at: new Date().toISOString(),
  })
  .eq('id', campaign.id);
if (approveError) throw new Error(approveError.message);

console.log(JSON.stringify({ campaignId: campaign.id, contactId: contact.id, approved: true }));

if (shouldSend) {
  const sendResponse = await fetch(`${crmBase}/api/campaigns/${campaign.id}/send-to-n8n`, {
    method: 'POST',
  });
  const sendBody = await sendResponse.json();
  if (!sendResponse.ok) throw new Error(JSON.stringify(sendBody));
  console.log(JSON.stringify({
    sent: true,
    runId: sendBody.run?.id,
    queuedContacts: sendBody.queuedContacts,
    n8nExecutionId: sendBody.n8nResponse?.executionId,
  }));
}
