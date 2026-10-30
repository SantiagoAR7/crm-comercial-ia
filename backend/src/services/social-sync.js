import fs from 'node:fs/promises';
import path from 'node:path';
import {socialSources,recordsFromExecution} from './social-execution-reader.js';
import {upsertSocialExecution,upsertSocialPublication,listSocialPublications} from './social-publications-store.js';
const stateFile=process.env.SOCIAL_SYNC_STATE_FILE || '/app/data/social-sync.json';
let state={lastSyncAt:null,lastError:null,executions:{},sources:[]};
let running=null;
export const socialSyncStatus=()=>({enabled:Boolean(process.env.SOCIAL_N8N_API_KEY),running:Boolean(running),lastSyncAt:state.lastSyncAt,lastError:state.lastError,sources:state.sources});
async function api(endpoint) {
  const base=process.env.SOCIAL_N8N_API_URL || 'https://n8n.iadavofrio.com/api/v1';
  const r=await fetch(base+endpoint,{headers:{'X-N8N-API-KEY':process.env.SOCIAL_N8N_API_KEY},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`n8n: HTTP ${r.status}`);
  return r.json();
}
async function persist() {
  await fs.mkdir(path.dirname(stateFile),{recursive:true});
  await fs.writeFile(stateFile+'.tmp',JSON.stringify(state),{mode:0o600});
  await fs.rename(stateFile+'.tmp',stateFile);
}
async function sync() {
  if(!process.env.SOCIAL_N8N_API_KEY)return socialSyncStatus();
  try {
    try{state=JSON.parse(await fs.readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(state.readerVersion!==3){state.executions={};state.readerVersion=3;}
    const sources=[];
    for(const source of socialSources) {
      const workflow=await api('/workflows/'+source.id);
      let count=0, cursor, pages=0;
      do {
        const list=await api(`/executions?workflowId=${source.id}&limit=100${cursor?'&cursor='+encodeURIComponent(cursor):''}`);
        let allSeen=true;
        for(const entry of list.data || []) {
          const stamp=[entry.status,entry.stoppedAt || '',entry.waitTill || ''].join(':');
          const terminal=['success','error','canceled','crashed'].includes(entry.status);
          if(terminal && state.executions[entry.id]===stamp)continue;
          allSeen=false;
          const execution=await api('/executions/'+entry.id+'?includeData=true');
          await upsertSocialExecution(recordsFromExecution(execution,source,workflow));
          if(terminal)state.executions[entry.id]=stamp;
          count++;
        }
        cursor=allSeen?null:list.nextCursor;
      }while(cursor && ++pages<10);
      sources.push({category:source.category,workflowId:source.id,name:workflow.name,active:workflow.active,imported:count});
      state.sources=sources;
    }
    if(process.env.SOCIAL_MEDIA_LOOKUP_URL && process.env.SOCIAL_MEDIA_LOOKUP_SECRET) {
      const records=await listSocialPublications();
      for(const record of records) {
        if((record.platform!=='HeyGen' && record.status !== 'publicado') || !['Instagram','Facebook','HeyGen'].includes(record.platform) || !(record.platform==='HeyGen'?/^[a-zA-Z0-9_-]+$/:/^[0-9_]+$/).test(record.externalPostId || ''))continue;
        if((record.platform==='HeyGen' || String(record.mediaOrigin).startsWith('publicación en ')) && record.externalUrl && record.mediaCheckedAt && Date.now()-Date.parse(record.mediaCheckedAt)<(record.platform==='HeyGen'&&record.status==='pendiente'?60000:6*3600000))continue;
        try {
          const response=await fetch(process.env.SOCIAL_MEDIA_LOOKUP_URL,{method:'POST',headers:{'Content-Type':'application/json','x-social-media-secret':process.env.SOCIAL_MEDIA_LOOKUP_SECRET},body:JSON.stringify({platform:record.platform,postId:record.externalPostId,category:record.category}),signal:AbortSignal.timeout(25000)});
          if(!response.ok)throw new Error('Recurso de la plataforma no disponible.');
          const raw=await response.json();const media=Array.isArray(raw)?raw[0]:raw;
          if(record.platform==='HeyGen') {
            const data=media.data || media;
            await upsertSocialPublication({...record,status:data.status==='completed'?'generado':data.status==='failed'?'error':'pendiente',videoUrl:data.video_url || record.videoUrl,imageUrl:data.thumbnail_url || record.imageUrl,externalUrl:data.video_page_url || record.externalUrl,mediaOrigin:'vídeo generado en HeyGen',mediaCheckedAt:new Date().toISOString(),mediaError:null,errorMessage:data.status==='failed'?'HeyGen no pudo completar la generación.':null});
            continue;
          }
          const isVideo=media.media_type==='VIDEO' || Boolean(media.source);
          await upsertSocialPublication({...record,
            imageUrl:(isVideo?media.thumbnail_url || media.picture:media.media_url || media.full_picture || media.picture) || record.imageUrl,
            videoUrl:(isVideo?media.media_url || media.source:null) || record.videoUrl,
            externalUrl:media.permalink || (media.permalink_url?.startsWith('/')?'https://www.facebook.com'+media.permalink_url:media.permalink_url) || record.externalUrl,
            content:media.caption || media.message || record.content,
            mediaType:isVideo?'video':record.mediaType,
            mediaOrigin:'publicación en '+record.platform,
            mediaCheckedAt:new Date().toISOString(),mediaError:null,
          });
        }catch {await upsertSocialPublication({...record,mediaCheckedAt:new Date().toISOString(),mediaError:'No se pudo recuperar el recurso desde la plataforma.'});}
      }
    }
    state.lastSyncAt=new Date().toISOString();state.lastError=null;
  }catch(e){state.lastError=String(e.message || 'No se pudo sincronizar n8n.').slice(0,300);console.error('Social sync:',state.lastError);}
  await persist();
  return socialSyncStatus();
}
export function syncSocialExecutions(){
  if(running)return running;
  running=sync().finally(()=>{running=null;});return running;
}
export function startSocialSync(){
  if(!process.env.SOCIAL_N8N_API_KEY)return;
  void syncSocialExecutions().catch(e=>console.error('Social sync storage:',e.message));
  setInterval(()=>{void syncSocialExecutions().catch(e=>console.error('Social sync storage:',e.message));},60000).unref();
}
