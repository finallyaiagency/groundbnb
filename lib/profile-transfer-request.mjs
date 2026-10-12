import { randomUUID } from 'node:crypto';
import { sessionConfiguration, resolveSessionIdentity } from './session-identity.mjs';
import { browserAuthConfiguration } from './browser-auth.mjs';
import { profileTransferConfiguration, persistProfileTransfer } from './profile-transfer-persistence.mjs';
const headers = {'Cache-Control':'no-store, private',Vary:'Cookie'};
function response(result,requestId) {
  if (result?.ok) return Response.json({ok:true,profile:result.profile,operationId:result.operationId,
    operationKind:result.operationKind,savedAt:result.savedAt,affectedIds:result.affectedIds,requestId},{headers});
  const category=['auth','validation','conflict'].includes(result?.category)?result.category:'unavailable';
  const body={ok:false,category,requestId,retryable:category==='unavailable',
    message:category==='auth'?'Sign in to an available account.':category==='validation'?'Review the selected profile fields and notes.':
      category==='conflict'?'Your profile changed. Review the current values before importing these changes.':
      'Could not confirm the import. Keep your reviewed selection and check the save status.'};
  if (category==='conflict') Object.assign(body,{currentRevision:result.currentRevision,fieldComparison:result.fieldComparison});
  return Response.json(body,{status:{auth:401,validation:400,conflict:409,unavailable:503}[category],headers});
}
export async function handleProfileTransferRequest(request,env,resolve=resolveSessionIdentity,store=persistProfileTransfer) {
  const requestId=randomUUID();
  if (!profileTransferConfiguration(env) || (env.GROUND_BROWSER_AUTH_MODE==='synthetic' && !browserAuthConfiguration(env))) {
    return response({ok:false,category:'unavailable'},requestId);
  }
  const config=sessionConfiguration(env);
  if (request.method!=='PATCH' || new URL(request.url).search || request.headers.get('origin')!==config.origin ||
      ![null,'same-origin'].includes(request.headers.get('sec-fetch-site')) ||
      request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') return response({ok:false,category:'validation'},requestId);
  try {
    const session=await resolve(env,request.headers.get('cookie'));
    if (!session.ok) return response(session,requestId);
    const reader=request.body?.getReader();
    if (!reader) return response({ok:false,category:'validation'},requestId);
    const chunks=[];let bytes=0;
    try {
      for (;;) {
        const {done,value}=await reader.read();if(done) break;
        bytes+=value.byteLength;
        if(bytes>16384) {await reader.cancel();return response({ok:false,category:'validation'},requestId);}
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    let body;
    try {body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
    catch{return response({ok:false,category:'validation'},requestId);}
    if (!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>
      !['operationId','expectedRevision','patch','noteUpserts'].includes(key))) return response({ok:false,category:'validation'},requestId);
    return response(await store(env,session.identity,{...body,kind:'transfer'}),requestId);
  } catch{return response({ok:false,category:'unavailable'},requestId);}
}
