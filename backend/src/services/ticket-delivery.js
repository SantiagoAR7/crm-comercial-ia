import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dbResult } from './ticket-supabase.js';
const config = JSON.parse(readFileSync(new URL('./ticket-export-config.json',import.meta.url)));
const graph = 'https://graph.microsoft.com/v1.0';
const enc = encodeURIComponent;
const columnName = index => { let result='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result; };
const safeText = v => /^[=+\-@\t\r]/.test(String(v??'')) ? "'"+String(v) : String(v??'');
export function archiveIdentity(submission) {
  const data=submission.reviewed_data;
  const timestamp=new Date(submission.source_received_at||submission.received_at);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(timestamp).map(p=>[p.type,p.value]));
  const owner=submission.bot_alias==='Pagos Tarjeta'?'Pagos Tarjeta':data.technician;
  const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_');
  const test=submission.file_id?.startsWith('codex-test-');
  if(test&&!process.env.TICKETS_TEST_WORKBOOK_ID)fault('No hay un Excel de pruebas configurado.',409);
  const target=config.targets[owner];
  return {
    folders:['Tickets Automatización Telegram - PRUEBAS',owner,data.category,parts.year,parts.month],
    fileName:`${slug(owner)}__BOT_${slug(submission.bot_alias)}__${parts.year}-${parts.month}-${parts.day}__${parts.hour}-${parts.minute}-${parts.second}__${submission.id}.${submission.mime_type==='image/png'?'png':'jpg'}`,
    target:test?{...target,table:target?.tableName,sheet:target?.sheetName}:target,workbook:test?process.env.TICKETS_TEST_WORKBOOK_ID:config.workbook,
  };
}
export function excelValues(submission,state) {
  const data=submission.reviewed_data;
  const row={ID_TICKET:submission.id,FECHA_RECEPCION:submission.source_received_at||submission.received_at,CLASIFICACION:data.category,ESTABLECIMIENTO:data.establishment,CIF_NIF:data.cif_nif||submission.proposed_data?.cif_nif||'',FECHA_TICKET:data.ticket_date,TOTAL:Number(data.amount),ESTADO:'APROBADA',RUTA_ONEDRIVE:state.folders.join('/'),NOMBRE_ARCHIVO:state.fileName,METODO_PAGO:data.payment_method};
  return state.headers.map(name=>name==='TOTAL'?row.TOTAL:safeText(row[String(name).trim().toUpperCase()]??''));
}
function fault(message,status=503){const e=new Error(message);e.status=status;throw e;}
function success(response){return response?.statusCode>=200&&response.statusCode<300;}
export async function advanceArchive(db,task,submission,input) {
  if(task.destination!=='ARCHIVE_EXPORT'||submission.status!=='APROBADA')fault('El documento no está aprobado para archivo.',409);
  let state=structuredClone(task.result||{});
  if(!state.phase){state={...archiveIdentity(submission),phase:'folder_lookup',folderIndex:0,parentId:null};if(!state.target)fault('No existe destino de Excel para este técnico.',409);}
  if(state.phase==='excel_resize'){state.phase='excel_verify';delete state.action;}
  if(input.response){
    if(!state.action||input.action_id!==state.action.id)fault('La respuesta no corresponde al paso actual.',409);
    const r=input.response,body=r.body||{};
    if(state.phase==='folder_lookup'&&r.statusCode===404){state.phase='folder_create';}
    else if(state.phase==='folder_create'&&r.statusCode===409){state.phase='folder_lookup';}
    else if(!success(r)){
      delete state.action;
      const message=`Microsoft (${r.statusCode||'sin respuesta'}): ${String(body.error?.message||r.error||'No se pudo completar la salida').slice(0,500)}`;
      dbResult(await db.rpc('finish_ticket_task',{p_id:task.id,p_lease:task.lease_token,p_status:'ERROR',p_result:state,p_error:message}));
      return {done:true,status:'ERROR',error:message};
    }else{
      switch(state.phase){
        case 'folder_lookup':case 'folder_create':
          if(!body.id||!body.folder)fault('Microsoft no devolvió una carpeta válida.');
          state.parentId=body.id;state.folderIndex++;state.phase=state.folderIndex===state.folders.length?'upload':'folder_lookup';break;
        case 'upload':state.fileId=body.id;state.fileUrl=body.webUrl;state.phase='excel_columns';break;
        case 'excel_columns':
          state.headers=(body.value||[]).sort((a,b)=>a.index-b.index).map(c=>c.name);
          if(!['ID_TICKET','FECHA_TICKET','TOTAL'].every(c=>state.headers.includes(c)))fault('La tabla Excel no tiene las columnas requeridas.',409);
          state.phase='excel_range';break;
        case 'excel_range':
          state.range=body;
          if(!Number.isInteger(body.rowIndex)||!Number.isInteger(body.rowCount)||body.columnCount!==state.headers.length)fault('El rango de la tabla Excel no es válido.');
          state.allocation=dbResult(await db.rpc('allocate_ticket_rows',{p_id:submission.id,p_output:'TICKETS_TECNICOS',p_workbook:state.workbook,p_table:state.target.table,p_next:body.rowIndex+body.rowCount,p_count:1}));
          state.phase='excel_write';break;
        case 'excel_write':state.phase='excel_verify';break;
        case 'excel_verify':
          if(!Number.isInteger(body.rowCount)||body.rowIndex+body.rowCount<state.allocation.row_start+1)fault('La tabla Excel no incluye todavía el registro escrito.');
          state.phase='complete';break;
        default:fault('Paso de archivo desconocido.',409);
      }
    }
    delete state.action;
  }
  if(state.phase==='complete'){
    dbResult(await db.rpc('finish_ticket_task',{p_id:task.id,p_lease:task.lease_token,p_status:'COMPLETADA',p_result:state,p_error:''}));
    return {done:true,status:'COMPLETADA'};
  }
  // A lost response can repeat writes safely: file name and allocated Excel range are stable.
  if(!state.action){
    let action;
    const tableBase=`/me/drive/items/${enc(state.workbook)}/workbook/tables/${enc(state.target.table)}`;
    const sheetBase=`/me/drive/items/${enc(state.workbook)}/workbook/worksheets/${enc(state.target.sheet)}`;
    switch(state.phase){
      case 'folder_lookup':action={method:'GET',url:`${graph}/me/drive/root:/${state.folders.slice(0,state.folderIndex+1).map(enc).join('/')}?$select=id,name,folder`};break;
      case 'folder_create':action={method:'POST',url:state.parentId?`${graph}/me/drive/items/${enc(state.parentId)}/children`:`${graph}/me/drive/root/children`,body:{name:state.folders[state.folderIndex],folder:{},'@microsoft.graph.conflictBehavior':'fail'}};break;
      case 'upload':action={method:'PUT',binary:true,url:`${graph}/me/drive/items/${enc(state.parentId)}:/${enc(state.fileName)}:/content`};break;
      case 'excel_columns':action={method:'GET',url:`${graph}${tableBase}/columns?$select=name,index`};break;
      case 'excel_range':action={method:'GET',url:`${graph}${tableBase}/range?$select=address,rowIndex,rowCount,columnIndex,columnCount`};break;
      case 'excel_write':{
        const first=columnName(state.range.columnIndex),last=columnName(state.range.columnIndex+state.range.columnCount-1),row=state.allocation.row_start+1;
        action={method:'PATCH',url:`${graph}${sheetBase}/range(address='${first}${row}:${last}${row}')`,body:{values:[excelValues(submission,state)]}};break;
      }
      case 'excel_verify':action={method:'GET',url:`${graph}${tableBase}/range?$select=address,rowIndex,rowCount,columnIndex,columnCount`};break;
      default:fault('Paso de archivo desconocido.',409);
    }
    state.action={id:randomUUID(),...action};
  }
  dbResult(await db.rpc('checkpoint_ticket_task',{p_id:task.id,p_lease:task.lease_token,p_result:state}));
  const output={done:false,task_id:task.id,lease_token:task.lease_token,action:state.action};
  if(state.action.binary)output.imageUrl=dbResult(await db.storage.from('ticket-evidence').createSignedUrl(submission.storage_path,600)).signedUrl;
  return output;
}
