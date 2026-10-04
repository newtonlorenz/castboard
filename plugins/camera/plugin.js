import {demoTimestamp,fetchJson,proxyStream,validateProviderConfig} from '../../src/core/providers.js';
import {fetchSnapshot} from './snapshot.js';

export function createPlugin({config,context}) {
  validateProviderConfig('camera',config,['demo','stream','camera-service','home-assistant']);
  if(config.provider==='stream' && !config.streamUrl && !config.snapshotUrl)throw new Error('Camera requires a stream or snapshot URL');
  if(['camera-service','home-assistant'].includes(config.provider) && !config.baseUrl)throw new Error('Camera requires a service URL');
  let base;
  if(config.provider==='home-assistant') {
    try{base=new URL(config.baseUrl);}catch{throw new Error('Camera needs a Home Assistant URL');}
    if(!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || !config.token || !/^camera\.[a-z0-9_]+$/.test(config.entity || ''))throw new Error('Camera needs an HTTP(S) Home Assistant URL, token and camera entity');
  }
  let selectedCamera=null;
  async function resolveCamera() {
    const base=String(config.baseUrl).replace(/\/$/,'');
    const payload=await fetchJson(`${base}${config.listPath || '/api/cameras'}`,{headers:config.headers || {}},config.timeoutMs || 8000);
    const cameras=payload.cameras || payload.data || payload,list=Array.isArray(cameras)?cameras:[];
    const camera=list.find(item=>String(item.id)===String(config.preferredId)) || list[0];
    if(!camera)throw new Error('Camera service returned no cameras');
    selectedCamera=camera;
    return selectedCamera;
  }
  const sourceHeaders=()=>config.provider==='home-assistant'?{Authorization:`Bearer ${config.token}`}:(config.headers || {});
  async function sourceUrl(snapshot) {
    if(config.provider==='home-assistant')return `${base.href.replace(/\/$/,'')}/api/${snapshot?'camera_proxy':'camera_proxy_stream'}/${config.entity}`;
    if(config.provider==='camera-service') {
      const camera=selectedCamera || await resolveCamera(),base=String(config.baseUrl).replace(/\/$/,'');
      const route=(snapshot?camera.snapshotUrl:null) || camera.streamUrl;
      if(route)return new URL(route,base+'/').href;
      return base+(config.streamPath || '/api/cameras/{id}/mjpeg').replace('{id}',encodeURIComponent(camera.id));
    }
    return snapshot?(config.snapshotUrl || config.streamUrl):(config.streamUrl || config.snapshotUrl);
  }
  return {
    id:'camera',assets:['style.css'],styles:['style.css'],name:'Camera',nativeImages:config.provider!=='demo',
    publicConfig:()=>({demo:config.provider==='demo',title:config.title || '',name:config.name || 'Camera',displayMode:config.displayMode || 'stream',refreshSeconds:config.refreshSeconds || 3,showRefresh:config.showRefresh!==false,showTitle:config.showTitle!==false,fit:config.fit || 'cover'}),
    nativeView:({data,options,panel})=>options.displayMode==='shortcut'?{title:panel?.interaction && panel.interaction.showButton!==false?'':options.title || panel?.interaction?.label || options.name || 'Camera',lines:[]}:({title:options.showTitle===false?'':options.title || data.name || 'Camera',lines:config.provider==='demo'?[{text:'Sample camera — no live image',kind:'muted'}]:[],...(config.provider!=='demo'?{image:{key:String(selectedCamera?.id || config.provider),params:{mode:'snapshot'},fit:options.fit || 'cover'},controls:options.showRefresh===false?[]:[{type:'refresh',label:'Refresh image'}]}:{})}),
    async getData() {
      if(config.provider==='demo')return {name:config.name || 'Camera',status:'Sample',streamUrl:null,updatedAt:demoTimestamp()};
      let camera=null,status='Connected';
      if(config.provider==='camera-service')try{camera=await resolveCamera();}catch(error){if(!selectedCamera)throw error;camera=selectedCamera;status='Metadata unavailable';}
      return {name:camera?.name || config.name || 'Camera',status,streamUrl:`/api/plugins/${encodeURIComponent(context.instanceId || 'camera')}/stream`,updatedAt:demoTimestamp()};
    },
    async stream(req,res) {
      const snapshot=new URL(req.url,'http://castboard.local').searchParams.get('mode')==='snapshot';
      const url=await sourceUrl(snapshot);if(!url)throw new Error('Camera source is not configured');
      if(!snapshot)return proxyStream(url,req,res,{headers:sourceHeaders(),timeoutMs:config.timeoutMs || 15000});
      const controller=new AbortController(),abort=()=>controller.abort();req.once('aborted',abort);res.once('close',abort);
      try {
        const image=await fetchSnapshot(url,{headers:sourceHeaders(),signal:controller.signal,timeoutMs:config.timeoutMs || 10000});
        res.writeHead(200,{'Content-Type':image.contentType,'Content-Length':image.data.length,'Cache-Control':'no-store'});res.end(image.data);
      }finally {req.removeListener('aborted',abort);res.removeListener('close',abort);}
    },
  };
}
