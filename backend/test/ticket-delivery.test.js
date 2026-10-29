import test from 'node:test';import assert from 'node:assert/strict';
import {archiveIdentity,advanceArchive,excelValues} from '../src/services/ticket-delivery.js';
const submission={id:'10000000-0000-0000-0000-000000000004',status:'APROBADA',bot_alias:'TECNICO 04',mime_type:'image/jpeg',source_received_at:'2026-10-29T10:12:34Z',received_at:'2026-10-29T10:12:40Z',storage_path:'4/1/1.jpg',proposed_data:{cif_nif:'B123'},reviewed_data:{technician:'TECNICO 04',establishment:'=HYPERLINK("bad")',category:'Aparcamientos',ticket_date:'2026-10-28',amount:'12.50',payment_method:'Pago con tarjeta'}};
const headers=['ID_TICKET','FECHA_RECEPCION','CLASIFICACION','ESTABLECIMIENTO','CIF_NIF','FECHA_TICKET','TOTAL','ESTADO','RUTA_ONEDRIVE','NOMBRE_ARCHIVO'];
test('names use receipt identity and date; card bot retains its own destination',()=>{
 const s=archiveIdentity(submission);assert.match(s.fileName,/2026-10-29__11-12-34__10000000/);assert.ok(!s.fileName.includes('SIN_'));
 assert.equal(s.target.sheetName,'TECNICO 04');
 assert.equal(archiveIdentity({...submission,bot_alias:'Pagos Tarjeta'}).target.sheetName,'PAGOS TARJETA');
 const values=excelValues(submission,{...s,headers});assert.equal(values[5],'2026-10-28');assert.equal(values[6],12.5);assert.ok(values[3].startsWith("'="));
});
test('archive steps checkpoint file and fixed Excel row; rejected tickets cannot export',async()=>{
 const task={id:'task',destination:'ARCHIVE_EXPORT',lease_token:'lease',result:null};let completed=false;
 const db={rpc:async(name,args)=>{
  if(name==='checkpoint_ticket_task'){task.result=structuredClone(args.p_result);return {data:task};}
  if(name==='allocate_ticket_rows')return {data:{row_start:4,row_count:1}};
  if(name==='finish_ticket_task'){completed=args.p_status==='COMPLETADA';task.result=args.p_result;return {data:task};}
  throw new Error('Unexpected RPC '+name);
 },storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://test.invalid/image'}})})}};
 await assert.rejects(()=>advanceArchive(db,task,{...submission,status:'RECHAZADA'},{}));
 let next=await advanceArchive(db,task,submission,{});let writes=0;
 for(let i=0;i<30&&!next.done;i++){
  const again=await advanceArchive(db,task,submission,{});assert.equal(again.action.id,next.action.id);
  let response={statusCode:200,body:{}};
  if(next.action.url.includes('/root:/'))response={statusCode:404,body:{}};
  else if(next.action.url.endsWith('/children'))response={statusCode:201,body:{id:'folder'+i,folder:{}}};
  else if(next.action.binary)response={statusCode:201,body:{id:'file-id',webUrl:'https://test.invalid/file'}};
  else if(next.action.url.includes('/columns?'))response.body={value:headers.map((name,index)=>({name,index}))};
  else if(next.action.url.includes('/range?'))response.body={rowIndex:0,rowCount:writes?5:4,columnIndex:0,columnCount:10};
  else if(next.action.method==='PATCH'){writes++;assert.match(next.action.url,/A5:J5/);assert.equal(next.action.body.values[0][0],submission.id);}
  next=await advanceArchive(db,task,submission,{action_id:next.action.id,response});
 }
 assert.equal(completed,true);assert.equal(writes,1);assert.equal(task.result.fileId,'file-id');
});
