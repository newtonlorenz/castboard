import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.js';
import { deviceTokenHash } from '../src/core/devices.js';

test('only an administrator can stage firmware, and only its display can download the verified image', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-firmware-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const key='firmware-test-device-key-with-32-characters';
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}]}},devices:{desk:{name:'Desk',screenId:'home',mode:'native',format:'rgb565',width:320,height:240,refreshMs:5000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)}}};
  const app=await createApp({loadedConfig:{config,rawConfig:structuredClone(config),configPath:path.join(dir,'config.json'),configDir:dir},logger:{error(){}}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const route='/api/admin/devices/desk/firmware',deviceRoute='/api/devices/desk/firmware';
  const data=Buffer.alloc(2048,0x42);data[0]=0xe9;
  assert.equal((await fetch(base+deviceRoute)).status,401);
  assert.equal((await fetch(base+deviceRoute,{headers:{Authorization:`Bearer ${key}`}})).status,200);
  assert.equal((await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/octet-stream',Origin:'https://other.example'},body:data})).status,403);
  assert.equal((await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:Buffer.alloc(2048)})).status,422);
  const uploaded=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:data});
  assert.equal(uploaded.status,200);
  const {firmware}=await uploaded.json();assert.match(firmware.sha256,/^[a-f0-9]{64}$/);
  const manifest=await(await fetch(base+deviceRoute,{headers:{Authorization:`Bearer ${key}`}})).json();
  assert.equal(manifest.firmware.sha256,firmware.sha256);
  const image=await fetch(base+deviceRoute+'/image',{headers:{Authorization:`Bearer ${key}`}});
  assert.equal(image.status,200);assert.equal(image.headers.get('x-firmware-sha256'),firmware.sha256);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),data);
  assert.equal((await fetch(base+'/api/devices/other/firmware/image',{headers:{Authorization:`Bearer ${key}`}})).status,401);
});

import {stageFirmware,firmwareImage} from '../src/core/device-firmware.js';
test('concurrent staging stays coherent and corrupted staged data fails closed',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-ota-concurrent-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const images=Array.from({length:20},(_,i)=>{const image=Buffer.alloc(2048,i);image[0]=0xe9;return image;});
 await Promise.all(images.map(image=>stageFirmware(dir,'desk',image,'a'.repeat(64))));
 assert.deepEqual((await firmwareImage(dir,'desk','a'.repeat(64))).data,images.at(-1));
 await assert.rejects(firmwareImage(dir,'desk','b'.repeat(64)),/No firmware/);
 await fs.writeFile(path.join(dir,'device-firmware/desk.bin'),Buffer.alloc(2048));
 await assert.rejects(firmwareImage(dir,'desk','a'.repeat(64)),/integrity/);
 await assert.rejects(stageFirmware(dir,'../private',images[0],'a'.repeat(64)),/Invalid display/);
 await assert.rejects(stageFirmware(dir,'desk',Buffer.alloc(3*1024*1024+1),'a'.repeat(64)),/Upload/);
});

test('reference receiver only starts OTA on authenticated HTTPS connections',async()=>{
 const code=await fs.readFile(new URL('../receivers/esp32/src/CastboardReceiver.cpp',import.meta.url),'utf8');
 assert.match(code,/String\(settings_\.server\)\.startsWith\("https:\/\/"\) && xTaskCreate\(firmwareNetworkTask/);
 assert.match(code,/tls->setCACert\(settings_\.rootCA\)/);
});
