// Reads saved execution evidence. Never invokes publishing or generation nodes.
import { safeUrl } from './social-publications-store.js';
export const socialSources = [
  {id:'hSfbDBJKn3UtMKYT', category:'Alicante y Turismo'},
  {id:'Suj8sslSxFegUUBH', category:'Psicología Sanitaria'},
  {id:'OQhDp6FOtifPxBQ6', category:'El Mundo del Autismo'},
  {id:'HqQpLEX36mQkV6E2', category:'Jessica'},
];
const itemsOf = run => (run?.data?.main?.[0] || []).map(x => x.json || {});
const message = e => String(e?.message || e?.description || 'Error sin detalle').slice(0,1500).replace(/(?:Bearer\s+)[\w.\-]+/gi,'Bearer [oculto]').replace(/((?:access_token|api_key|token|authorization)["'\s:=]+)[^\s,"'&]+/gi,'$1[oculto]');
function publisher(node) {
  if (node.disabled) return null;
  if (node.type === 'n8n-nodes-base.facebookGraphApi' && node.parameters?.httpRequestMethod === 'POST') return {platform:'Facebook', mediaType:node.parameters.edge === 'videos'?'video':'imagen'};
  if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters?.method === 'POST' && /^https:\/\/graph(?:-video)?\.facebook\.com\/v[0-9.]+\/\d+\/(?:videos|photos)$/.test(node.parameters.url || '')) return {platform:'Facebook',mediaType:node.parameters.url.endsWith('/videos')?'video':'imagen'};
  if (/instagram\.instagram$/.test(node.type)) return {platform:'Instagram',mediaType:'imagen'};
  if (node.type === 'n8n-nodes-base.youTube' && node.parameters?.operation === 'upload') return {platform:'YouTube',mediaType:'video'};
  if (/TikTok.*Publicar/i.test(node.name)) return {platform:'TikTok',mediaType:'video'};
  return null;
}
function staticCaption(node) {
  const p=node.parameters || {};
  const options=p.options || {};
  const query=options.queryParameters?.parameter || [];
  const v=p.caption || query.find(x=>['message','description'].includes(x.name))?.value || options.description;
  return typeof v === 'string' && !v.includes('{{') ? v : '';
}
export function recordsFromExecution(execution, source, currentWorkflow) {
  const result=execution.data?.resultData || {};
  const runData=result.runData || {};
  const workflow=execution.workflowData || currentWorkflow || {nodes:[]};
  const nodes=workflow.nodes || [];
  const all=Object.entries(runData).flatMap(([name,runs]) => runs.flatMap(run => itemsOf(run).map(json=>({name,json}))));
  const normalized=all.filter(x=>x.name==='Code - Recuperar Datos + Post').map(x=>x.json);
  const input=all.filter(x=>x.name==='Code - Normalizar Entrada').map(x=>x.json);
  function context(index, platform) {
    const c=normalized[index] || normalized[0] || input[index] || input[0] || {};
    const emitted=all.map(x=>x.json);
    const video=emitted.map(x=>safeUrl(x.video_url || x.videoUrl || x.data?.video_url)).find(Boolean);
    const generatedImage=emitted.map(x=>safeUrl(x.imagen_final || x.image_url || x.imageUrl || x.images?.[0]?.source)).find(Boolean);
    const originalImage=safeUrl(c.imagen_original || c.imagen);
    return {
      sourceExecutionId:String(execution.id),workflowId:source.id,workflowName:workflow.name || currentWorkflow?.name,
      category:source.category,accountName:c.nombre_cuenta || source.category,
      title:c.titulo || c.title || '',
      content:String((platform==='Instagram'?c.instagram_post:platform==='Facebook'?c.facebook_post:platform==='YouTube'?c.youtube_description:c.post_generado) || c.post_generado || c.post || c.descripcion || ''),
      sourceUrl:safeUrl(c.url_noticia || c.url_original || c.enlace || c.link),
      imageUrl:generatedImage || originalImage,videoUrl:video || null,
      mediaOrigin:generatedImage?'recurso del flujo':originalImage?'imagen de la noticia':'',
      startedAt:execution.startedAt,finishedAt:execution.stoppedAt,
      publishedAt:execution.stoppedAt || execution.startedAt,
      executionStatus:execution.status,testMode:c.modo_prueba === true,
    };
  }
  const records=[];
  for(const node of nodes) {
    const pub=publisher(node);if(!pub)continue;
    for(const [runIndex,run] of (runData[node.name] || []).entries()) {
      if(run.error || run.executionStatus==='error') {
        records.push({...context(0,pub.platform),...pub,publicationKey:`${execution.id}:${node.id}:${runIndex}:error`,sourceNode:node.name,status:'error',errorMessage:message(run.error || result.error),accountId:String(node.parameters?.node || '').replace(/^=/,'')});continue;
      }
      for(const [index,json] of itemsOf(run).entries()) {
        const response=json.body || json;
        const id=response.post_id || response.video_id || response.id || response.data?.id;
        let status=pub.platform==='TikTok'?'pendiente':id?'publicado':'sin confirmar';
        if(response.error)status='error';
        // An Instagram media container is not a published post.
        if(pub.platform==='Instagram' && response.status_code==='IN_PROGRESS')status='pendiente';
        const link=safeUrl(response.permalink || response.post_url || response.url) || (id && pub.platform==='Facebook'?`https://www.facebook.com/${encodeURIComponent(id)}`:id && pub.platform==='YouTube'?`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`:null);
        const ctx=context(index,pub.platform);
        records.push({...ctx,...pub,content:staticCaption(node) || ctx.content,publicationKey:`${execution.id}:${node.id}:${runIndex}:${index}`,sourceNode:node.name,accountId:String(node.parameters?.node || '').replace(/^=/,''),status,externalPostId:id?String(id):null,externalUrl:link,errorMessage:response.error?message(response.error):null,visibility:pub.platform==='YouTube'?(response.status?.privacyStatus || node.parameters?.options?.privacyStatus || 'sin confirmar'):''});
      }
    }
  }
  for(const [name,runs] of Object.entries(runData)) {
    if(nodes.some(n=>n.name===name && publisher(n)))continue;
    for(const [index,run] of runs.entries()){const error=run.error || run.data?.main?.flat().find(item=>item.json?.error)?.json.error;if(error)records.push({...context(0,''),publicationKey:`${execution.id}:node-error:${name}:${index}`,platform:'Generación',mediaType:'texto',sourceNode:name,status:'error',errorMessage:message(typeof error==='string'?{message:error}:error)});}
  }
  const heygenIds=new Map();
  for(const entry of all.filter(x=>/^HeyGen /i.test(x.name))) {
    const data=entry.json.data || {};
    const id=data.video_id || (data.id && !data.session_id ? data.id : null);
    if(id && /^[a-zA-Z0-9_-]+$/.test(id))heygenIds.set(id,{...heygenIds.get(id),...data});
  }
  for(const [id,data] of heygenIds) {
    records.push({...context(0,''),publicationKey:`${execution.id}:heygen:${id}`,platform:'HeyGen',mediaType:'video',sourceNode:'HeyGen - Vídeo generado',status:data.status==='completed'?'generado':data.status==='failed'?'error':'pendiente',externalPostId:id,videoUrl:safeUrl(data.video_url),imageUrl:safeUrl(data.thumbnail_url),externalUrl:safeUrl(data.video_page_url),mediaOrigin:'vídeo generado en HeyGen',errorMessage:data.status==='failed'?message(data.error || {message:'HeyGen no pudo generar el vídeo.'}):null});
  }
  // Execution success does not imply any network accepted a post.
  if(result.error && !records.some(x=>x.status==='error'))records.push({...context(0,''),publicationKey:`${execution.id}:generation`,platform:'Generación',mediaType:'texto',sourceNode:result.lastNodeExecuted || '',status:'error',errorMessage:message(result.error)});
  if(!records.length)records.push({...context(0,''),publicationKey:`${execution.id}:generation`,platform:'Generación',mediaType:'texto',sourceNode:result.lastNodeExecuted || '',status:['running','waiting','new'].includes(execution.status)?'pendiente':normalized.length?'generado':'sin confirmar',errorMessage:normalized.length?'No consta una respuesta de publicación en esta ejecución.':'No hay datos de publicación conservados en n8n.'});
  return records;
}
