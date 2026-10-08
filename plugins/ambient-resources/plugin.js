import {validateHttpUrl} from '../../src/core/providers.js';
import {fetchJson,proxyStream} from '../../src/core/providers.js';
export function createPlugin({config}){
 if(config.provider==='http-json')validateHttpUrl(config.baseUrl,{base:true});
 if(config.provider==='http-json'){let url;try{url=new URL(config.baseUrl);}catch{throw new Error('Enter the service URL');}if(!['http:','https:'].includes(url.protocol))throw new Error('Use an HTTP or HTTPS service URL');}
 return {id:'ambient-resources',name:"Ambient camera resources",contract:"camera-resources@1",publicConfig:()=>({demo:(config.provider||'demo')==='demo'}),getData:({url}={})=>{
  const path=url?.searchParams.get('path')||'/camera/api/cameras';if(!['/camera/api/cameras','/clearcam/health'].includes(path))throw new Error('Unsupported camera query');
  if((config.provider||'demo')==='demo')return path==='/clearcam/health'?{ok:false,demo:true,cameras:[]}:{cameras:[],demo:true};
  return fetchJson(String(config.baseUrl).replace(/\/$/,'')+path,{headers:config.headers||{}},config.timeoutMs||15000);
 },stream(req,res,{url}){
  const input=url.searchParams.get('path')||'',normalized=new URL(input,'http://local');
  if(!input.startsWith('/')||input.startsWith('//')||normalized.origin!=='http://local'||!(/^\/clearcam\//.test(normalized.pathname)||/^\/camera\/api\/cameras\/[^/]+\/mjpeg$/.test(normalized.pathname)||normalized.pathname==='/api/camera-alert-clip'))throw new Error('Unsupported camera resource');
  if((config.provider||'demo')==='demo')throw new Error('Configure a camera service to display live images');
  return proxyStream(String(config.baseUrl).replace(/\/$/,'')+normalized.pathname+normalized.search,req,res,{headers:config.headers||{},timeoutMs:config.timeoutMs||15000});
 }};
}
