import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { ticketsRouter, ticketIntegrationRouter } from '../src/routes/tickets.js';
import { validateReview, decodeImage } from '../src/services/ticket-validation.js';
const valid = {technician:'TECNICO 04',category:'Aparcamientos',payment_method:'Pago con tarjeta',ticket_date:'2026-10-29',establishment:'Parking',amount:'12.50',currency:'EUR',document_type:'TICKET'};
test('rejects impossible dates, ambiguous payments and unsafe amounts',()=>{
  assert.equal(validateReview(valid).amount,'12.50');
  for (const patch of [{ticket_date:'2026-02-30'},{amount:'-5'},{amount:'12.555'},{payment_method:'Visa'},{technician:'TECNICO 18'},{amount:'1e5'}]) assert.throws(()=>validateReview({...valid,...patch}));
});
test('rejects files disguised as images',()=>{
  assert.throws(()=>decodeImage(Buffer.from('<script>alert(1)</script>').toString('base64'),'image/jpeg'));
  assert.throws(()=>decodeImage('%%%','image/png'));
  assert.equal(decodeImage(Buffer.from([255,216,255,1]).toString('base64'),'image/jpeg').length,4);
});
test('CRM permissions and integration secret fail closed without contacting Supabase',async()=>{
  process.env.TICKETS_REVIEWER_EMAILS='reviewer@example.test';
  process.env.TICKETS_INGEST_SECRET='test-only-secret';
  delete process.env.TICKETS_SUPABASE_URL;
  delete process.env.TICKETS_SUPABASE_SECRET_KEY;
  const app=express();app.use(express.json());
  app.use('/integration',ticketIntegrationRouter);
  app.use('/tickets',(req,_res,next)=>{req.ticketsUser={email:req.get('test-user')};next();},ticketsRouter);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const root=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(`${root}/tickets`)).status,403);
    assert.equal((await fetch(`${root}/integration/intake`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    assert.equal((await fetch(`${root}/tickets`,{headers:{'test-user':'reviewer@example.test'}})).status,503);
    const reject=await fetch(`${root}/tickets/00000000-0000-0000-0000-000000000000/decision`,{method:'POST',headers:{'Content-Type':'application/json','test-user':'reviewer@example.test'},body:JSON.stringify({status:'RECHAZADA',version:0,reason:'  '})});
    assert.equal(reject.status,400);
    assert.match((await reject.json()).error,/motivo/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
