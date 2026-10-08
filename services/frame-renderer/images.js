import sharp from 'sharp';
import {createHash} from 'node:crypto';
const fail=message=>Object.assign(new Error(message),{statusCode:422});
export async function renderNativeImage(input,appOrigin,bridgeToken) {
  const {id,token,source,width,height,params={}}=input;
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(id || '') || !/^[a-z][a-z0-9-]*$/.test(source || '') || !/^[A-Za-z0-9_-]{32,128}$/.test(token || '') || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || width>1920 || height>1920 || width*height>1920*1080 || !params || typeof params!=='object' || Array.isArray(params) || JSON.stringify(params).length>1024)throw fail('Invalid native image request');
  const url=new URL(`/api/devices/${id}/plugins/${source}/stream`,appOrigin);
  for(const [key,value] of Object.entries(params))if(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) && ['string','number','boolean'].includes(typeof value))url.searchParams.set(key,String(value));else throw fail('Invalid image parameter');
  const response=await fetch(url,{headers:{...(bridgeToken?{'X-Castboard-Bridge':bridgeToken}:{}),Authorization:`Bearer ${token}`,Accept:'image/jpeg,image/png'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok || !/^image\/(jpeg|png)(?:;|$)/i.test(response.headers.get('content-type') || '')){await response.body?.cancel();throw fail('The plugin did not return a snapshot');}
  const maxBytes=2*1024*1024,reader=response.body.getReader(),chunks=[];let total=0;
  try {for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes)throw fail('Snapshot exceeds 2 MiB');chunks.push(Buffer.from(value));}}
  finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  const background=/^#[0-9a-f]{6}$/i.test(input.background || '')?input.background:'#14201e';
  const {data,info}=await sharp(Buffer.concat(chunks),{limitInputPixels:16000000}).rotate().resize(width,height,{fit:input.fit==='cover'?'cover':'contain',background}).flatten({background}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  const buffer=Buffer.alloc(width*height*2);
  for(let pixel=0;pixel<width*height;pixel++){const i=pixel*info.channels;buffer.writeUInt16LE(((data[i]&0xf8)<<8)|((data[i+1]&0xfc)<<3)|(data[i+2]>>3),pixel*2);}
  return {buffer,width,height,format:'rgb565',frameId:createHash('sha256').update(buffer).digest('hex').slice(0,32)};
}
