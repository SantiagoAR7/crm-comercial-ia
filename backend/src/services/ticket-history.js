import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ticketDb, dbResult } from './ticket-supabase.js';

export function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4))<2020 || Number(month.slice(0,4))>2100) throw new Error('Mes inválido.');
  const [year,number]=month.split('-').map(Number);
  const midnight=(y,m)=>{
    const noon=new Date(Date.UTC(y,m,1,12));
    const localHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'numeric',hourCycle:'h23'}).format(noon));
    return new Date(Date.UTC(y,m,1,-(localHour-12))).toISOString();
  };
  return {start:midnight(year,number-1),end:midnight(year,number)};
}
export const currentMonth=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date());
export const previousMonth=()=>{const [y,m]=currentMonth().split('-').map(Number);return new Date(Date.UTC(y,m-2,15)).toISOString().slice(0,7);};
function monthQuery(db,month,test){
  const {start,end}=monthBounds(month);
  return db.from('ticket_submissions').select('*').eq('is_test',test).gte('received_at',start).lt('received_at',end).order('id');
}
export async function backupManifest(month,test=false){
  const db=ticketDb();const records=[];
  for(let offset=0;;offset+=500){const rows=dbResult(await monthQuery(db,month,test).range(offset,offset+499));records.push(...rows.map(r=>({id:r.id,owner:r.bot_alias==='Pagos Tarjeta'?'Pagos Tarjeta':r.technician||r.bot_alias})));if(rows.length<500)break;}
  const grouped=new Map();for(const r of records){if(!grouped.has(r.owner))grouped.set(r.owner,[]);grouped.get(r.owner).push(r.id);}
  const files=[];
  for(const [owner,ids] of grouped)for(let i=0;i<ids.length;i+=5){const part=Math.floor(i/5)+1;files.push({month,owner,ids:ids.slice(i,i+5),test,folder:'Tickets Automatización Telegram - PRUEBAS',fileName:`${test?'PRUEBA__':''}${month}__${owner.replace(/ /g,'_')}__parte-${String(part).padStart(4,'0')}.json.gz`});}
  return {month,timezone:'Europe/Madrid',total:records.length,files};
}
export async function backupPart(body){
  const {month,ids,test=false}=body;monthBounds(month);
  if(!Array.isArray(ids)||!ids.length||ids.length>5||ids.some(id=>!/^[a-f0-9-]{36}$/.test(id)))throw new Error('Parte de copia inválida.');
  const db=ticketDb();const rows=dbResult(await monthQuery(db,month,test===true).in('id',ids));
  if(rows.length!==ids.length)throw new Error('La copia no coincide con los documentos seleccionados.');
  const records=[];
  for(const row of rows){
    const blob=dbResult(await db.storage.from('ticket-evidence').download(row.storage_path));const bytes=Buffer.from(await blob.arrayBuffer());
    if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new Error('La evidencia no coincide con su huella original.');
    const audit=dbResult(await db.from('ticket_audit').select('*').eq('submission_id',row.id).order('created_at'));
    const deliveries=dbResult(await db.from('ticket_outbox').select('id,destination,status,attempts,last_error,result,created_at').eq('submission_id',row.id));
    records.push({submission:row,audit,deliveries,evidence:{mime_type:row.mime_type,sha256:row.sha256,base64:bytes.toString('base64')}});
  }
  return gzipSync(Buffer.from(JSON.stringify({format:'davofrio-ticket-history-v1',month,timezone:'Europe/Madrid',generated_at:new Date().toISOString(),is_test:test===true,records})),{level:6});
}
