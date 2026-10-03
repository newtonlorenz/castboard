import {fetchJson} from '../../src/core/providers.js';
const reads=new Set(['/api/config','/api/calendar','/api/weather','/api/solar','/api/whoop','/api/dashboard/portfolio','/api/dashboard/signals','/api/dashboard/status','/api/live-prices','/api/dashboard/theses','/api/camera-alerts','/api/apple-reminders']);
function route(value,method='GET'){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))throw new Error('Invalid data route');
 const url=new URL(value,'http://local');
 if(url.origin!=='http://local')throw new Error('Invalid route origin');
 const allowed=method==='GET'?(reads.has(url.pathname)||/^\/api\/briefings\/[a-z0-9-]+$/.test(url.pathname)||/^\/api\/super-productivity\/(status|tasks|projects|tags|task-control\/current)$/.test(url.pathname)):/^\/api\/(apple-reminders\/[^/]+\/complete|super-productivity\/(task-control\/(current|stop)|tasks\/[^/]+\/start))$/.test(url.pathname);
 if(!allowed)throw new Error('This data route is not supported');
 return url.pathname+url.search;
}
export function demoData(value){
 const pathname=new URL(value,'http://local').pathname,now=new Date().toISOString(),base={demo:true,updatedAt:now,timestamp:now};
 if(pathname==='/api/config')return {...base,weather:{label:'Demo location'},calendar:{timeZone:'UTC'},camera:{},clearcam:{},briefings:[{key:'top-stories',name:"Top stories",emoji:'TS'}]};
 if(pathname==='/api/calendar')return {...base,events:[]};
 if(pathname==='/api/weather')return {...base,temp:22,apparentTemp:21,code:1,humidity:56,windspeed:12,uvIndex:2};
 if(pathname==='/api/solar')return {...base,ok:true,generatedKw:2.1,usedSolarKw:1.2,usedGridKw:0.3,gridExportKw:0.9};
 if(pathname==='/api/whoop')return {...base,recovery:{score:82},sleep:{hours:7.8},strain:{score:4.2}};
 if(pathname==='/api/dashboard/portfolio')return {...base,source:'Demo portfolio',positions:[{symbol:'ACME',currency:'EUR',quantity:10,price:120,value:1200,changePct:1.5,dailyPnl:18}],summary:{baseCurrency:'EUR',netLiquidation:1200,dailyPnl:18,totalPnl:120},ibGateway:{status:'demo'}};
 if(pathname.startsWith('/api/briefings/'))return {...base,content:'# Demo stories\n\n## Index\n- [A configurable display](https://example.com/display) · Demo story\n- [Screen-specific settings](https://example.com/settings) · Demo story\n\n---\n## Sample stories\n### [A configurable display](https://example.com/display)\nConnect your own data source to replace these sample stories.\n\n### [Screen-specific settings](https://example.com/settings)\nEach panel has its own display options.\n'};
 if(pathname==='/api/camera-alerts')return {...base,alerts:[],cameraName:'Demo camera'};
 if(pathname==='/api/apple-reminders')return {...base,reminders:[]};
 if(pathname.endsWith('/task-control/current'))return {...base,task:null};
 if(pathname.endsWith('/status'))return {...base,ok:true,available:false,status:'demo'};
 return {...base,items:[],tasks:[],projects:[],tags:[],signals:[]};
}
export function createPlugin({config}){
 if(!['demo','http-json'].includes(config.provider||'demo'))throw new Error('Choose Demo or HTTP JSON');
 if(config.provider==='http-json'){
  let base;try{base=new URL(config.baseUrl);}catch{throw new Error('Enter the service URL');}if(!['http:','https:'].includes(base.protocol))throw new Error('Use an HTTP or HTTPS service URL');
 }
 const remote=(value,init={})=>fetchJson(String(config.baseUrl).replace(/\/$/,'')+value,{...init,headers:{...(config.headers||{}),...(init.headers||{})}},config.timeoutMs||15000);
 return {id:'ambient-services',name:'Ambient services',getData:({url}={})=>{const value=route(url?.searchParams.get('route')||'/api/config');return config.provider==='http-json'?remote(value):demoData(value);},async action(payload){if(payload?.action!=='request')throw new Error('Unsupported service action');const value=route(payload.route,'POST');if(config.provider!=='http-json')return {accepted:true,demo:true};return remote(value,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload.body||{})});}};
}
