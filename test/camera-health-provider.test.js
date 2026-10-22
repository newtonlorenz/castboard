import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin} from '../plugins/ambient-resources/plugin.js';
const plugin=()=>createPlugin({config:{provider:'http-json',baseUrl:'https://camera.example.test',headers:{Authorization:'Bearer test-camera-token'},timeoutMs:500}});
const request={url:new URL('http://local/data?path=/clearcam/health')};

test('degraded camera health remains explicit data for fallback decisions',async t=>{
 const health={status:'degraded',cameras:[{name:'Test',fresh:false,sourceFrameAgeSeconds:90}]};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(String(url),'https://camera.example.test/clearcam/health');
  assert.equal(options.headers.Authorization,'Bearer test-camera-token');
  return new Response(JSON.stringify(health),{status:503});
 });
 assert.deepEqual(await plugin().getData(request),health);
});

test('healthy camera health preserves fresh frame evidence',async t=>{
 const health={status:'ok',cameras:[{name:'Test',fresh:true,sourceFrameAgeSeconds:0.1}]};
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(health)));
 assert.deepEqual(await plugin().getData(request),health);
});

test('unexpected HTTP failures and malformed health are not masked',async t=>{
 for(const [body,status] of [['bad gateway',502],['{}',503],['{}',200],[JSON.stringify({status:'degraded',cameras:[]}),401]]){
  t.mock.method(globalThis,'fetch',async()=>new Response(body,{status}));
  await assert.rejects(plugin().getData(request),/Camera health/);
 }
});
