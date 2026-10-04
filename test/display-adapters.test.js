import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {deflateRawSync} from 'node:zlib';
import {createApp} from '../src/server.js';
import {crc32,unpackDisplayPackage,zipFiles,installDisplayPackage} from '../src/core/display-packages.js';
import {validateAdapterManifest} from '../src/core/display-adapters.js';
import {deviceTokenHash} from '../src/core/devices.js';

const example=new URL('../display-adapters/.examples/monochrome/',import.meta.url);
async function packageFiles() {return new Map(await Promise.all(['adapter.json','adapter.mjs','README.md','LICENSE'].map(async name=>[name,await fs.readFile(new URL(name,example))])));}
const key='display-adapter-test-key-with-32-characters';

test('ZIP reader supports ordinary root/folder packages and rejects corrupt or unsafe archives',async()=>{
  const files=await packageFiles(),zip=zipFiles(files);
  assert.equal(unpackDisplayPackage(zip).manifest.id,'example-monochrome');
  const wrapped=new Map([...files].map(([name,data])=>['package/'+name,data]));assert.equal(unpackDisplayPackage(zipFiles(wrapped)).files.size,4);
  for(const name of ['../escape','/escape','folder/../../escape','folder\\escape','a:b','x/.env','x/.env.production','x/.GIT/config','secrets.h','config.local.h']) {
    assert.throws(()=>unpackDisplayPackage(zipFiles(new Map([...files,[name,Buffer.from('no')]]))),/unsafe|private/);
  }
  assert.throws(()=>unpackDisplayPackage(zipFiles(new Map([...files,['ADAPTER.JSON',files.get('adapter.json')]]))),/duplicate/);
  const corrupt=Buffer.from(zip);corrupt[30+'adapter.json'.length]^=1;assert.throws(()=>unpackDisplayPackage(corrupt),/integrity/);
  const symlink=Buffer.from(zip),central=symlink.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));symlink.writeUInt32LE(0xa0000000,central+38);assert.throws(()=>unpackDisplayPackage(symlink),/linked/);
  const huge=Buffer.from(zip);huge.writeUInt32LE(9*1024*1024,central+24);assert.throws(()=>unpackDisplayPackage(huge),/unsupported/);
  assert.throws(()=>unpackDisplayPackage(Buffer.alloc(8*1024*1024+1)),/8 MiB/);
  const manifest=JSON.parse(files.get('adapter.json'));
  assert.throws(()=>validateAdapterManifest({...manifest,entry:'../outside.mjs'}),/entry/);
  for(const defaults of [{width:0},{refreshMs:999},{mode:'native'},{format:'jpeg'},{touch:'yes'}])assert.throws(()=>validateAdapterManifest({...manifest,defaults}));
});

test('ZIP reader verifies deflated entries and constrains expanded output',()=>{
  function compressed(data,declared=data.length){
    const name=Buffer.from('adapter.json'),packed=deflateRawSync(data),crc=crc32(data),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(declared,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(declared,24);central.writeUInt16LE(name.length,28);
    end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+packed.length,16);
    return Buffer.concat([local,name,packed,central,name,end]);
  }
  const manifest={id:'test-display',name:'Test',version:'1.0.0',modes:['native'],formats:['rgb565']};
  assert.equal(unpackDisplayPackage(compressed(Buffer.from(JSON.stringify(manifest)))).manifest.id,'test-display');
  assert.throws(()=>unpackDisplayPackage(compressed(Buffer.alloc(9*1024*1024),20)),/size limit/);
});

test('failed uploaded code is rolled back without modifying existing packages',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-adapter-rollback-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const files=await packageFiles();files.set('adapter.mjs',Buffer.from('throw new Error("invalid adapter");'));
  await assert.rejects(installDisplayPackage({zip:zipFiles(files),configDir:dir,existing:new Map()}),/restart Castboard/);
  assert.deepEqual(await fs.readdir(path.join(dir,'extensions/displayAdapters')),[]);
});

test('uploaded adapter encodes real frames, maps inputs, scopes credentials and cannot be removed while assigned',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-adapter-api-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  let received;
  const renderer=http.createServer(async(req,res)=>{
    const parts=[];for await(const chunk of req)parts.push(chunk);received=JSON.parse(Buffer.concat(parts));
    const frame=Buffer.alloc(received.width*received.height*2);[0xf800,0x07e0,0x001f,0xffff].forEach((colour,i)=>frame.writeUInt16LE(colour,i*2));
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':frame.length,'X-Frame-Id':'test-frame','X-Frame-Width':received.width,'X-Frame-Height':received.height,'X-Frame-Format':'rgb565'});res.end(frame);
  });renderer.listen(0,'127.0.0.1');await once(renderer,'listening');t.after(()=>{renderer.close();renderer.closeAllConnections();});
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}]}},embedded:{rendererUrl:`http://127.0.0.1:${renderer.address().port}`,rendererToken:'renderer-service-token-at-least-32-characters'},devices:{old:{name:'Existing',screenId:'home',mode:'native',format:'rgb565',width:320,height:240,refreshMs:5000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath,logger:{error(){}}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const zip=zipFiles(await packageFiles());
  const upload=trust=>fetch(base+'/api/admin/display-adapters',{method:'POST',headers:{'Content-Type':'application/zip',...(trust?{'X-Castboard-Trust-Package':'yes'}:{})},body:zip});
  assert.equal((await upload(false)).status,422);
  const installed=await upload(true);assert.equal(installed.status,200);assert.equal((await installed.json()).installed,'example-monochrome');
  assert.equal((await upload(true)).status,409);
  const report=await(await fetch(base+'/api/admin/devices')).json();assert.equal(report.adapters.length,3);
  const create=await fetch(base+'/api/admin/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',revision:report.revision,id:'mono',device:{name:'OLED',screenId:'home',adapter:'example-monochrome',touch:true}})});
  const created=await create.json();assert.equal(create.status,200,JSON.stringify(created));
  const device=created.devices.find(item=>item.id==='mono');assert.equal(device.width,128);assert.equal(device.height,64);assert.equal(device.format,'mono1');
  const auth={Authorization:`Bearer ${created.connectionKey}`};
  const info=await(await fetch(base+'/api/devices/mono/config',{headers:auth})).json();assert.equal(info.adapter.configuration.stride,16);assert.equal(info.adapter.options.threshold,128);assert.equal(JSON.stringify(info).includes('tokenHash'),false);
  const frame=await fetch(base+'/api/devices/mono/frame',{headers:auth});assert.equal(frame.status,200);assert.equal(frame.headers.get('x-frame-format'),'mono1');
  const pixels=Buffer.from(await frame.arrayBuffer());assert.equal(pixels.length,1024);assert.equal(pixels[0],0x50);assert.equal(received.format,'rgb565');
  assert.equal((await fetch(base+'/api/devices/mono/frame')).status,401);
  const etag=frame.headers.get('etag'),unchanged=await fetch(base+'/api/devices/mono/frame',{headers:{...auth,'If-None-Match':etag}});assert.equal(unchanged.status,304);assert.equal(unchanged.headers.get('x-frame-format'),'mono1');
  const beforeOptions=await(await fetch(base+'/api/admin/devices')).json();
  assert.equal((await fetch(base+'/api/admin/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',revision:beforeOptions.revision,id:'mono',device:{options:{invert:true}}})})).status,200);
  const changedFrame=await fetch(base+'/api/devices/mono/frame',{headers:{...auth,'If-None-Match':etag}});assert.equal(changedFrame.status,200);assert.notEqual(changedFrame.headers.get('etag'),etag);
  assert.equal(Buffer.from(await changedFrame.arrayBuffer())[0],0xaf);
  const tap=await fetch(base+'/api/devices/mono/touch',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({sequence:'touch-0001',revision:'test-frame',position:[12,18]})});assert.equal(tap.status,200);assert.deepEqual(received.event,{eventId:'touch-0001',frameId:'test-frame',x:12,y:18});
  const remove=()=>fetch(base+'/api/admin/display-adapters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',id:'example-monochrome'})});
  assert.equal((await remove()).status,409);
  assert.equal((await fetch(base+'/api/devices/old/scene',{headers:{Authorization:`Bearer ${key}`}})).status,200);
  const report2=await(await fetch(base+'/api/admin/devices')).json();
  assert.equal((await fetch(base+'/api/admin/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',id:'mono',revision:report2.revision})})).status,200);
  assert.equal((await remove()).status,200);assert.equal((await upload(true)).status,409);
  const names=await fs.readdir(path.join(dir,'extensions/displayAdapters'));assert.equal(names.some(name=>name.startsWith('.removed-')),true);
});


test('native adapters encode scenes and reject invalid translated events without exposing credentials',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-native-adapter-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const manifest={id:'native-test',name:'Native test',version:'1.0.0',entry:'adapter.mjs',modes:['native'],formats:['rgb565'],defaults:{mode:'native',width:128,height:128}};
  const files=new Map([['adapter.json',JSON.stringify(manifest)],['adapter.mjs',`
    export function configure(context){if('tokenHash' in context.device)throw new Error('credential leaked');return {renderer:'text'};}
    export function encodeScene(scene){return {data:Buffer.from(JSON.stringify({revision:scene.sceneId,title:scene.title})),contentType:'application/x-castboard-scene'};}
    export function decodeInput(bytes){const event=JSON.parse(bytes);if(event.invalid)return null;return {sceneId:event.revision,eventId:event.sequence,event:event.target};}
  `]]);
  await installDisplayPackage({zip:zipFiles(files),configDir:dir,existing:new Map()});
  const device={adapter:'native-test',name:'Text display',screenId:'home',mode:'native',format:'rgb565',width:128,height:128,refreshMs:5000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)};
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{title:'Home',path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'details'}}]},details:{title:'Details',path:'/details',type:'single',presentation:'modal',panels:[{id:'clock',plugin:'clock'}]}},devices:{text:device}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath,logger:{error(){}}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  const base=`http://127.0.0.1:${app.server.address().port}`,headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const info=await(await fetch(base+'/api/devices/text/config',{headers})).json();assert.equal(info.adapter.configuration.renderer,'text');
  const response=await fetch(base+'/api/devices/text/scene',{headers});assert.equal(response.headers.get('content-type'),'application/x-castboard-scene');
  const scene=await response.json();assert.equal(response.headers.get('x-scene-id'),scene.revision);
  const post=body=>fetch(base+'/api/devices/text/events',{method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await post({invalid:true})).status,422);
  const opened=await post({revision:scene.revision,sequence:'native-input-001',target:'panel:clock'});const openedBody=await opened.json();assert.equal(opened.status,200,JSON.stringify(openedBody));assert.equal(openedBody.title,'Details');
  assert.equal((await post({revision:scene.revision,sequence:'native-input-002',target:'panel:clock'})).status,409);
});

test('display plugin upload and downloads require admin authorization and reject cross-origin writes',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-adapter-auth-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787,trustedProxyAddresses:['127.0.0.1']},admin:{allowLan:true,token:'synthetic-admin-token'},plugins:{clock:{enabled:true}},screens:{home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}]}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath,logger:{error(){}}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  const base=`http://127.0.0.1:${app.server.address().port}`,headers={'X-Castboard-Receiver':'192.0.2.20'},zip=zipFiles(await packageFiles());
  for(const route of ['/api/admin/display-adapters','/api/admin/display-adapters/example'])assert.equal((await fetch(base+route,{headers})).status,403);
  const uploadHeaders={...headers,'Content-Type':'application/zip','X-Castboard-Trust-Package':'yes'};
  assert.equal((await fetch(base+'/api/admin/display-adapters',{method:'POST',headers:uploadHeaders,body:zip})).status,403);
  assert.equal((await fetch(base+'/api/admin/display-adapters',{method:'POST',headers:{...uploadHeaders,Authorization:'Bearer synthetic-admin-token',Origin:'https://evil.example'},body:zip})).status,403);
  assert.equal((await fetch(base+'/api/admin/display-adapters',{method:'POST',headers:{...uploadHeaders,Authorization:'Bearer synthetic-admin-token'},body:zip})).status,200);
  const brokenFiles=await packageFiles(),brokenManifest=JSON.parse(brokenFiles.get('adapter.json'));brokenManifest.id='failed-upload';brokenFiles.set('adapter.json',JSON.stringify(brokenManifest));brokenFiles.set('adapter.mjs','throw new Error("load failed");');
  const send=body=>fetch(base+'/api/admin/display-adapters',{method:'POST',headers:{...uploadHeaders,Authorization:'Bearer synthetic-admin-token'},body});
  const failed=await send(zipFiles(brokenFiles));assert.equal(failed.status,422);assert.match((await failed.json()).error.message,/restart Castboard/);
  brokenFiles.set('adapter.mjs',(await packageFiles()).get('adapter.mjs'));assert.equal((await send(zipFiles(brokenFiles))).status,409);
  assert.equal((await fs.readdir(path.join(dir,'extensions/displayAdapters'))).includes('failed-upload'),false);
});
