import {fetchJson} from '../../src/core/providers.js';
const queries=new Set(['status','groups','playlists']);
const actions=new Set(['select','open','broadcast','radio','dj','enqueue','play','pause','next','previous','volume','toggle']);
export function createPlugin({config}){
 if(config.provider==='http-json'){let url;try{url=new URL(config.baseUrl);}catch{throw new Error('Enter the service URL');}if(!['http:','https:'].includes(url.protocol))throw new Error('Use an HTTP or HTTPS service URL');}
 const demo=(config.provider||'demo')==='demo';
 const read=async view=>{
  if(!queries.has(view))throw new Error('Unsupported media query');
  if(demo)return view==='status'?{state:'PAUSED',playing:false,title:'Demo playback',artist:'Castboard',speaker:'Demo speaker',volume:30,reachable:true,demo:true}:view==='groups'?{groups:[{name:"Demo speaker",coordinator:'Demo speaker'}],demo:true}:{playlists:[],demo:true};
  const data=await fetchJson(String(config.baseUrl).replace(/\/$/,'')+'/api/sonos/'+view,{headers:config.headers||{}},config.timeoutMs||15000);delete data.raw;return data;
 };
 return {id:'ambient-media-source',name:'Ambient media source',contract:'media@1',capabilities:['transport','speakers','volume','library','radio','dj'],getData:({url}={})=>read(url?.searchParams.get('view')||'status'),async action(payload){let action=payload?.action;if(!actions.has(action))throw new Error('Unsupported media action');if(action==='volume'&&(!Number.isFinite(Number(payload.value))||Number(payload.value)<0||Number(payload.value)>100))throw new Error('Volume must be from 0 to 100');if(demo)return {accepted:true,demo:true};if(action==='toggle')action=(await read('status')).state==='PLAYING'?'pause':'play';return fetchJson(String(config.baseUrl).replace(/\/$/,'')+'/api/sonos/'+action+'?'+new URLSearchParams(Object.fromEntries(['speaker','value'].filter(key=>payload[key]!==undefined).map(key=>[key,payload[key]]))),{method:'POST',headers:{'Content-Type':'application/json',...(config.headers||{})},body:JSON.stringify(payload)},config.timeoutMs||30000);}};
}
