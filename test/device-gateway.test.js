import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createDeviceGateway, peerPolicy, receiverRoute } from '../services/device-gateway/gateway.js';
import { deviceTokenHash } from '../src/core/devices.js';
const key='a'.repeat(40),other='b'.repeat(40);
async function listen(server,t){server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});return `http://127.0.0.1:${server.address().port}`;}
test('network policy accepts address changes only within configured ranges',()=>{
 const allowed=peerPolicy(['192.0.2.0/24','2001:db8::/64']);
 for(const peer of ['192.0.2.10','192.0.2.99','::ffff:192.0.2.99','2001:db8::2','127.0.0.1','::1'])assert.equal(allowed(peer),true,peer);
 for(const peer of ['192.0.3.10','203.0.113.1','2001:db9::2','not-an-address'])assert.equal(allowed(peer),false,peer);
 assert.throws(()=>peerPolicy(['192.0.2.0/99']));
});
test('route gate excludes admin, plugin, traversal and wrong-method requests',()=>{
 for(const route of ['/api/admin/devices','//evil.test/api/devices/desk/config','/api/devices/desk/../config','/api/devices/desk/%63onfig','/api/devices/desk/plugins/media/action','/api/devices/desk/config#x'])assert.equal(receiverRoute('GET',route),null);
 assert.equal(receiverRoute('GET','/api/devices/desk/config?revision=1'),'desk');
 assert.equal(receiverRoute('POST','/api/devices/desk/touch'),'desk');
 assert.equal(receiverRoute('POST','/api/devices/desk/frame'),null);
});
test('gateway checks live device keys, revocation and scope before proxying',async t=>{
 let config={devices:{desk:{enabled:true,tokenHash:deviceTokenHash(key)},wall:{enabled:true,tokenHash:deviceTokenHash(other)}}},calls=0;
 const upstream=http.createServer((req,res)=>{calls++;assert.equal(req.headers['x-castboard-bridge'],undefined);assert.equal(req.headers.cookie,undefined);assert.match(req.headers.authorization,/^Bearer /);res.writeHead(200,{'Content-Type':'application/json','Content-Length':2});res.end('{}');});
 const base=await listen(upstream,t);
 const gateway=createDeviceGateway({upstream:base,getConfig:async()=>config});const url=await listen(gateway,t);
 const request=(id,token=key,extra={})=>fetch(`${url}/api/devices/${id}/config`,{headers:{Authorization:`Bearer ${token}`,cookie:'admin=private','x-castboard-bridge':'untrusted',...extra}});
 assert.equal((await request('desk')).status,200);assert.equal((await request('wall')).status,403);assert.equal((await request('wall',other)).status,200);
 config.devices.desk.enabled=false;assert.equal((await request('desk')).status,403);
 config.devices.desk.enabled=true;config.devices.desk.tokenHash=deviceTokenHash(other);assert.equal((await request('desk')).status,403);assert.equal((await request('desk',other)).status,200);
 config=null;assert.equal((await request('desk')).status,403);assert.equal(calls,3);
});
test('gateway refuses disallowed peers, overlarge bodies and unavailable configuration',async t=>{
 let calls=0;const upstream=http.createServer((req,res)=>{calls++;res.end('unexpected');});const base=await listen(upstream,t);
 const config={devices:{desk:{enabled:true,tokenHash:deviceTokenHash(key)}}};
 let allowed=false;const url=await listen(createDeviceGateway({upstream:base,getConfig:async()=>config,allowPeer:()=>allowed}),t);
 const headers={Authorization:`Bearer ${key}`};assert.equal((await fetch(url+'/api/devices/desk/config',{headers})).status,403);
 allowed=true;assert.equal((await fetch(url+'/api/devices/desk/touch',{method:'POST',headers,body:'x'.repeat(65537)})).status,413);assert.equal(calls,0);
});

test('truncated upstream replies fail promptly rather than hanging the receiver',async t=>{
 const upstream=http.createServer((req,res)=>{res.writeHead(200,{'Content-Length':100});res.write('abc');setTimeout(()=>res.destroy(),20);});
 const base=await listen(upstream,t);
 const config={devices:{desk:{enabled:true,tokenHash:deviceTokenHash(key)}}};
 const url=await listen(createDeviceGateway({upstream:base,getConfig:async()=>config}),t);
 const reply=await fetch(url+'/api/devices/desk/frame',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(2000)});
 await assert.rejects(reply.arrayBuffer());
});
