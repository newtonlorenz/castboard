import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.js';
import { authenticateDevice, changeDeviceConfig, deviceScope, deviceTokenHash, validateDevices } from '../src/core/devices.js';
import { createNativeScenes } from '../src/core/native-scene.js';
import { gridLayout } from '../src/core/native-layout.js';

const key='test-device-key-with-at-least-32-characters';
function configFixture() {
  return { server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true},spotify:{enabled:true,provider:'demo'},weather:{enabled:true,provider:'demo',privateValue:'private-source-setting'}},screens:{
    home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'details'}}]},
    details:{path:'/details',type:'single',presentation:'modal',panels:[{id:'music',plugin:'spotify',interaction:{type:'action',action:'toggle',confirmation:'Change playback?'}}]},
    secret:{path:'/secret',type:'single',panels:[{id:'weather',plugin:'weather'}]},
  },devices:{desk:{name:'Desk',screenId:'home',mode:'native',format:'rgb565',width:800,height:480,refreshMs:5000,enabled:true,touch:true,allowActions:true,tokenHash:deviceTokenHash(key)}}};
}

test('device keys are one-time values; settings preserve private fields and revoke old keys',()=>{
  const config=configFixture();
  const changed=changeDeviceConfig(config,{action:'create',id:'second',device:{name:'Second',screenId:'home'}});
  assert.equal(changed.token.length,43);assert.equal(changed.config.devices.second.tokenHash,deviceTokenHash(changed.token));
  assert.equal(changed.config.plugins.weather.privateValue,'private-source-setting');
  assert.deepEqual([...deviceScope(config,config.devices.desk).screens],['home','details']);
  assert.deepEqual([...deviceScope(config,config.devices.desk).plugins],['clock','spotify']);
  const rotated=changeDeviceConfig(config,{action:'rotate',id:'desk'});
  assert.throws(()=>authenticateDevice(rotated.config,'desk',`Bearer ${key}`),/denied/);
  assert.equal(authenticateDevice(rotated.config,'desk',`Bearer ${rotated.token}`).name,'Desk');
  const invalid=structuredClone(config);delete invalid.screens.home;
  assert.throws(()=>validateDevices(invalid),/missing screen/);
  assert.throws(()=>changeDeviceConfig(config,{action:'create',id:'desk',device:{}}),/already exists/);
});

test('native events reject stale/unknown controls and execute confirmed actions once',async()=>{
  const config=configFixture(),device=config.devices.desk;
  let calls=0;
  const service=createNativeScenes({getConfig:()=>config,getScreenType:()=>({nativeLayout:screen=>screen.panels.map(panel=>({id:panel.id,x:0,y:0,width:800,height:400}))}),getPlugin:id=>({name:id,nativeView:()=>({title:id,lines:[{text:'Test'}]})}),read:async()=>({}),action:async()=>{calls++;}});
  const scene=await service.scene('desk',device);
  await assert.rejects(service.event('desk',device,{sceneId:'old',event:'panel:clock',eventId:'stale0001'}),/fresh scene/);
  await assert.rejects(service.event('desk',device,{sceneId:scene.sceneId,event:'panel:weather',eventId:'unknown01'}),/not available/);
  const modal=await service.event('desk',device,{sceneId:scene.sceneId,event:'panel:clock',eventId:'open00001'});
  assert.equal(modal.modal,true);assert.equal(modal.screenId,'details');
  const confirmation=await service.event('desk',device,{sceneId:modal.sceneId,event:'panel:music',eventId:'action001'});
  assert.equal(calls,0);assert.equal(confirmation.confirmation.message,'Change playback?');
  const event={sceneId:confirmation.sceneId,event:'confirm',eventId:'confirm01'};
  const complete=await service.event('desk',device,event);
  assert.equal(calls,1);assert.equal(complete.message,'Action completed');
  assert.deepEqual(await service.event('desk',device,event),complete);assert.equal(calls,1);
  await assert.rejects(service.event('desk',device,{...event,event:'cancel'}),/already used/);
  const back=await service.event('desk',device,{sceneId:complete.sceneId,event:'back',eventId:'back00001'});
  assert.equal(back.modal,false);assert.equal(back.screenId,'home');
  device.allowActions=false;
  const reset=await service.scene('desk',device);assert.equal(reset.screenId,'home');
});

test('native plugin views cannot read sources outside the device assignment',async()=>{
  const config=configFixture();let reads=0;
  const service=createNativeScenes({getConfig:()=>config,getScreenType:()=>({nativeLayout:()=>[{id:'clock',x:0,y:0,width:200,height:100}]}),getPlugin:()=>({name:'Clock',nativeView:async({read})=>{await read('weather');return{lines:[]};}}),read:async()=>{reads++;return{};},action:async()=>{}});
  const scene=await service.scene('desk',config.devices.desk);
  assert.equal(reads,0);assert.equal(scene.panels[0].state,'unavailable');
});

test('device HTTP API scopes data, persists registration, masks keys and revokes immediately',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-device-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config=configFixture(),configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({loadedConfig:{config,rawConfig:structuredClone(config),configPath,configDir:dir},logger:{error(){}}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const get=(route,auth=key)=>fetch(base+route,{headers:{Authorization:`Bearer ${auth}`}});
  assert.equal((await get('/api/devices/desk/config','wrong')).status,401);
  const bootstrap=await(await get('/api/devices/desk/bootstrap')).json();
  assert.deepEqual(Object.keys(bootstrap.screens),['home','details']);
  assert.equal(JSON.stringify(bootstrap).includes('private-source-setting'),false);
  assert.equal(JSON.stringify(bootstrap).includes('tokenHash'),false);
  assert.equal((await get('/api/devices/desk/plugins/weather/data')).status,403);
  assert.equal((await get('/api/devices/desk/plugins/spotify/data')).status,200);
  const scene=await(await get('/api/devices/desk/scene')).json();assert.equal(scene.protocol,'castboard-scene/1');
  const report=await(await get('/api/admin/devices')).json();
  assert.equal(report.devices[0].tokenHash,undefined);assert.equal(report.devices[0].nativeIssues.length,0);
  const publicConfig=await(await get('/api/config')).json();assert.equal(publicConfig.devices,undefined);
  const rotate=await fetch(base+'/api/admin/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rotate',id:'desk',revision:report.revision})});
  assert.equal(rotate.status,200);const rotated=await rotate.json();assert.ok(rotated.connectionKey);
  assert.equal((await get('/api/devices/desk/config')).status,401);
  assert.equal((await get('/api/devices/desk/config',rotated.connectionKey)).status,200);
  const saved=JSON.parse(await fs.readFile(configPath));assert.equal(saved.devices.desk.tokenHash,deviceTokenHash(rotated.connectionKey));
  assert.equal(saved.plugins.weather.privateValue,'private-source-setting');
});

test('native fixed-grid geometry leaves gaps and follows panel spans',()=>{
  const boxes=gridLayout({layout:{columns:2,rows:1,gap:8,padding:8},panels:[{id:'left',position:{column:1,row:1,width:1,height:1}},{id:'right',position:{column:2,row:1,width:1,height:1}}]},{width:800,height:480});
  assert.deepEqual(boxes,[{id:'left',x:8,y:8,width:388,height:464},{id:'right',x:404,y:8,width:388,height:464}]);
});

test('view-only devices reject direct plugin actions while retaining data access',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-device-permissions-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config=configFixture();
  config.plugins.spotify.controllable=true;
  for(const mode of ['frame','native']) {
    for(const [suffix,touch,allowActions] of [['view',false,true],['navigation',true,false],['control',true,true]]) {
      config.devices[`${mode}-${suffix}`]={...config.devices.desk,mode,touch,allowActions};
    }
  }
  const configPath=path.join(dir,'config.json');
  await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({loadedConfig:{config,rawConfig:structuredClone(config),configPath,configDir:dir},logger:{error(){}}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>{app.server.close();app.server.closeAllConnections();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  for(const [id,device] of Object.entries(config.devices)) {
    const route=`${base}/api/devices/${id}/plugins/spotify`;
    assert.equal((await fetch(`${route}/data`,{headers})).status,200,id);
    const response=await fetch(`${route}/action`,{method:'POST',headers,body:JSON.stringify({action:'toggle'})});
    assert.equal(response.status,device.touch && device.allowActions?200:403,id);
  }
});

test('native image resources stay scoped to the active scene and refresh requires no provider-action permission',async()=>{
  const config=configFixture(),device=config.devices.desk;device.allowActions=false;
  let actions=0;
  const service=createNativeScenes({getConfig:()=>config,getScreenType:()=>({nativeLayout:()=>[{id:'clock',x:0,y:0,width:320,height:240}]}),getPlugin:id=>({name:id,stream:()=>{},nativeView:()=>({title:'Image',lines:[],image:{params:{mode:'snapshot'}},controls:[{type:'refresh',label:'Refresh image'}]})}),read:async()=>({}),action:async()=>{actions++;}});
  const scene=await service.scene('desk',device),image=scene.panels[0].image;
  assert.equal(image.format,'rgb565');assert.match(image.path,/^\/images\/0\?sceneId=/);assert.equal(image.source,undefined);
  assert.equal(service.image('desk',device,'0',scene.sceneId).source,'clock');
  assert.throws(()=>service.image('desk',device,'1',scene.sceneId),/not available/);
  assert.throws(()=>service.image('desk',device,'0','stale'),/fresh scene/);
  const next=await service.event('desk',device,{sceneId:scene.sceneId,event:scene.panels[0].controls[0].event,eventId:'refresh001'});
  assert.equal(actions,0);assert.ok(next.panels[0].image);
  device.tokenHash='0'.repeat(64);assert.throws(()=>service.image('desk',device,'0',scene.sceneId),/fresh scene/);
});

test('native image hooks cannot select an unassigned plugin',async()=>{
  const config=configFixture();
  const service=createNativeScenes({getConfig:()=>config,getScreenType:()=>({nativeLayout:()=>[{id:'clock',x:0,y:0,width:320,height:240}]}),getPlugin:id=>({name:id,stream:()=>{},nativeView:()=>({lines:[],image:{source:'weather'}})}),read:async()=>({}),action:async()=>{}});
  await assert.rejects(service.scene('desk',config.devices.desk),/Invalid native image/);
});

test('native image identity survives changing data but rejects reassignment and navigation',async()=>{
  const config=configFixture(),device=config.devices.desk;
  config.plugins.camera={enabled:true,provider:'camera-service'};
  config.screens.home.panels.push({id:'camera',plugin:'camera'});
  config.screens.details.panels=[{id:'camera',plugin:'camera'}];
  let clock='12:00',cameraKey='front';
  const service=createNativeScenes({getConfig:()=>config,getScreenType:()=>({nativeLayout:screen=>screen.panels.map(panel=>({id:panel.id,x:0,y:0,width:320,height:192}))}),getPlugin:id=>({name:id,getData:()=>{},stream:()=>{},nativeView:()=>id==='camera'?{lines:[],image:{key:cameraKey,params:{mode:'snapshot'}}}:{lines:[{text:clock}]}}),read:async()=>({}),action:async()=>{}});
  const first=await service.scene('desk',device);clock='12:01';
  const updated=await service.scene('desk',device);
  assert.notEqual(first.sceneId,updated.sceneId);
  assert.equal(first.panels[1].image.resourceId,updated.panels[1].image.resourceId);
  assert.throws(()=>service.image('desk',device,'1',first.sceneId),/fresh scene/);
  cameraKey='side';const reassigned=await service.scene('desk',device);
  assert.notEqual(updated.panels[1].image.resourceId,reassigned.panels[1].image.resourceId);
  const modal=await service.event('desk',device,{sceneId:reassigned.sceneId,event:'panel:clock',eventId:'camera-modal-1'});
  assert.notEqual(modal.panels[0].image.resourceId,reassigned.panels[1].image.resourceId);
  config.plugins.camera.provider='stream';
  const reconfigured=await service.scene('desk',device);
  assert.notEqual(reconfigured.panels[1].image.resourceId,reassigned.panels[1].image.resourceId);
});
