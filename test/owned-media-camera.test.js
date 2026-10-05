import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createPlugin as mediaSource} from '../plugins/ambient-media-source/plugin.js';
import {createPlugin as cameraResources} from '../plugins/ambient-resources/plugin.js';
import {createPlugin as detections} from '../plugins/ambient-alerts-source/plugin.js';

async function serve(t,handler){const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});return `http://127.0.0.1:${server.address().port}`;}

test('speaker source owns credentials and translates toggle without unrelated service requests',async t=>{
 const requests=[];
 const baseUrl=await serve(t,(req,res)=>{requests.push({path:req.url,method:req.method,auth:req.headers.authorization});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state:'PLAYING',raw:{secret:'private'},accepted:true}));});
 const plugin=mediaSource({config:{provider:'http-json',baseUrl,headers:{Authorization:'speaker-account'}}});
 assert.equal(plugin.contract,'media@1');assert.equal((await plugin.getData()).raw,undefined);
 await plugin.action({action:'toggle'});
 assert.deepEqual(requests.map(item=>{const url=new URL(item.path,'http://fixture');return url.pathname+url.search;}),['/api/sonos/status','/api/sonos/status','/api/sonos/pause']);
 assert.equal(requests.at(-1).method,'POST');assert.equal(requests.every(item=>item.auth==='speaker-account'),true);
 await assert.rejects(plugin.action({action:'volume',value:101}),/Volume/);
 assert.equal(requests.length,3);
});

test('camera resources restrict queries and resource paths to camera delivery',async()=>{
 const plugin=cameraResources({config:{provider:'demo'}});
 assert.equal(plugin.contract,'camera-resources@1');assert.equal((await plugin.getData()).demo,true);
 assert.throws(()=>plugin.getData({url:new URL('http://local?path=/api/calendar')}),/Unsupported camera/);
 for(const path of ['https://other.example/image','//other.example/image','/clearcam/../../api/config','/api/calendar'])assert.throws(()=>plugin.stream({}, {},{url:new URL('http://local?'+new URLSearchParams({path}))}),/Unsupported camera resource/);
});

test('separate detection sources retain their own datasets and credentials',async t=>{
 const requests=[];
 const base=await serve(t,(req,res)=>{requests.push({path:req.url,auth:req.headers.authorization});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/invalid'?{events:[]}:{alerts:[{filename:req.url,captured_at:1}]}));});
 const a=detections({config:{provider:'http-json',url:base+'/a',headers:{Authorization:'camera-a'}},context:{}});
 const b=detections({config:{provider:'http-json',url:base+'/b',headers:{Authorization:'camera-b'}},context:{}});
 assert.equal((await a.getData()).alerts[0].filename,'/a');assert.equal((await b.getData()).alerts[0].filename,'/b');
 assert.deepEqual(requests,[{path:'/a',auth:'camera-a'},{path:'/b',auth:'camera-b'}]);
 assert.doesNotMatch(JSON.stringify([a.publicConfig(),b.publicConfig()]),/camera-a|camera-b|http:/);
 await assert.rejects(detections({config:{provider:'http-json',url:base+'/invalid'},context:{}}).getData(),/alerts array/);
});
