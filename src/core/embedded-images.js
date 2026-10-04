import {deviceError} from './devices.js';

export async function requestNativeImage(embedded,input) {
  if(!embedded?.rendererUrl)throw deviceError('Native images need the optional image renderer',503);
  const length=input.width*input.height*2;
  let response;
  try {
    response=await fetch(new URL('/image',embedded.rendererUrl),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${embedded.rendererToken}`},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
    if(!response.ok || Number(response.headers.get('content-length'))!==length || response.headers.get('x-frame-format')!=='rgb565')throw new Error('Invalid image');
    const reader=response.body.getReader(),chunks=[];let total=0;
    try {for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>length)throw new Error('Image too large');chunks.push(Buffer.from(value));}}
    finally {if(total!==length)await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(total!==length)throw new Error('Incomplete image');
    return {buffer:Buffer.concat(chunks),frameId:response.headers.get('x-frame-id') || ''};
  } catch {await response?.body?.cancel().catch(()=>{});throw deviceError('Image unavailable; keep the last image and retry',503);}
}
