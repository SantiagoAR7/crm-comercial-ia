import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import express from 'express';
import {createSessionToken,getSession,requireAuth,requireTicketsAuth,verifyCredentials} from '../src/services/auth.js';
import {ticketsAuthRouter} from '../src/routes/tickets-auth.js';
process.env.CRM_SESSION_SECRET='crm-test-signing-secret';
process.env.TICKETS_SESSION_SECRET='tickets-test-signing-secret';
process.env.TICKETS_ACCESS_USERNAME='facturas';
const salt='abcdef0123456789';
process.env.TICKETS_ACCESS_PASSWORD_HASH=`scrypt$${salt}$${scryptSync('test-password',Buffer.from(salt,'hex'),64).toString('hex')}`;
test('ticket credentials never fall back to CRM and sessions cannot cross modules',()=>{
 assert.equal(verifyCredentials('facturas','test-password','tickets'),true);
 assert.equal(verifyCredentials('facturas','wrong','tickets'),false);
 const crm=createSessionToken('facturas','crm'),tickets=createSessionToken('facturas','tickets');
 assert.equal(getSession({headers:{cookie:`tickets_session=${crm}`}},'tickets_session','tickets'),null);
 assert.equal(getSession({headers:{cookie:`crm_session=${tickets}`}}),null);
 assert.equal(getSession({headers:{cookie:`tickets_session=${tickets}`}},'tickets_session','tickets').access,'tickets');
});
test('login and logout issue only the tickets cookie; CRM session cannot access the tickets API',async()=>{
 const app=express();app.use(express.json());app.use('/auth',ticketsAuthRouter);
 app.get('/tickets',requireTicketsAuth,(_req,res)=>res.json({ok:true}));
 app.get('/crm',requireAuth,(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const root=`http://127.0.0.1:${server.address().port}`;
 try{
  const crm=createSessionToken('facturas','crm');
  assert.equal((await fetch(`${root}/tickets`,{headers:{cookie:`crm_session=${crm}`}})).status,401);
  const login=await fetch(`${root}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'facturas',password:'test-password'})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/^tickets_session=/);assert.doesNotMatch(cookie,/crm_session=/);
  assert.equal((await fetch(`${root}/tickets`,{headers:{cookie:cookie.split(';')[0]}})).status,200);
  assert.equal((await fetch(`${root}/crm`,{headers:{cookie:cookie.split(';')[0]}})).status,401);
  const logout=await fetch(`${root}/auth/logout`,{method:'POST'});assert.match(logout.headers.get('set-cookie'),/^tickets_session=.*Max-Age=0$/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
