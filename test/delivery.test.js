import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import http from 'node:http';
import { changeDelivery, deliveryReport, deliveryTarget, displayBaseUrl, screenDisplayUrl } from '../src/core/delivery.js';
import { createApp } from '../src/server.js';

const example = () => ({
  server: {host:'127.0.0.1',port:8787,publicUrl:'http://display.test/base'},
  plugins:{clock:{enabled:true}},
  screens:{home:{title:'Home',path:'/home',type:'grid',layout:{columns:2,rows:2},panels:[],targets:[]}},
});

test('display links respect bind addresses, public proxies and private URL fields', () => {
  const config = example();
  assert.equal(screenDisplayUrl(config, config.screens.home), 'http://display.test/base/home');
  config.server.publicUrl='https://user:password@display.test/base?token=private';
  const report = deliveryReport(config,config);
  assert.equal(report.screens[0].displayUrl,null);
  assert.doesNotMatch(JSON.stringify(report),/password|token=private/);
  assert.equal(screenDisplayUrl(config,config.screens.home),'https://user:password@display.test/base/home?token=private');
  delete config.server.publicUrl;
  assert.equal(displayBaseUrl(config),null);
  const addresses={wifi:[{family:'IPv4',internal:false,address:'192.168.1.5'}]};
  config.server.host='0.0.0.0';
  assert.equal(displayBaseUrl(config,addresses),'http://192.168.1.5:8787');
  config.server.host='::1';assert.equal(displayBaseUrl(config,addresses),null);
  config.server.host='192.168.1.8';assert.equal(displayBaseUrl(config,addresses),'http://192.168.1.8:8787');
});

test('adding and removing displays preserves custom delivery, data and private fields', () => {
  const raw = example();
  raw.casting={protocols:{'http-webhook':{headers:{Authorization:'private'}},'google-cast':{executable:'/private/catt'}}};
  raw.screens.home.targets=[{protocol:'http-webhook',name:'Other display',endpoint:'https://private.example',headers:{secret:'private'}}];
  const next=changeDelivery(raw,{action:'add',screenId:'home',name:' Reception ',device:' Reception TV ',executable:'malicious'});
  assert.equal(raw.screens.home.targets.length,1);
  assert.deepEqual(next.screens.home.targets[1],{name:'Reception',device:'Reception TV',protocol:'google-cast'});
  assert.deepEqual(next.casting,raw.casting);
  assert.deepEqual(next.plugins,raw.plugins);
  const report=deliveryReport(next,next);
  assert.doesNotMatch(JSON.stringify(report),/private|executable|endpoint|headers|Reception TV/);
  assert.equal(report.screens[0].targets[1].canSend,true);
  assert.throws(()=>changeDelivery(next,{action:'add',screenId:'home',name:'Again',device:'Reception TV'}),/already connected/);
  assert.deepEqual(changeDelivery(next,{action:'remove',screenId:'home',index:1}),raw);
  assert.throws(()=>deliveryTarget(raw,'home',-1),/no longer exists/);
  assert.throws(()=>changeDelivery(raw,{action:'remove',screenId:'__proto__',index:0}),/no longer exists/);
  raw.casting.protocols['google-cast'].enabled=false;
  assert.throws(()=>changeDelivery(raw,{action:'add',screenId:'home',name:'New',device:'TV'}),/disabled/);
});

test('delivery API saves, handles conflicts and sends only configured destinations through a simulated receiver', async t => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-delivery-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const executable=path.join(directory,'catt-fixture');
  const output=path.join(directory,'received.json');
  await fs.writeFile(executable,`#!${process.execPath}\nimport fs from 'node:fs';\nif(process.argv.includes('Fail')) process.exit(1);\nfs.writeFileSync(${JSON.stringify(output)},JSON.stringify(process.argv.slice(2)));\nawait new Promise(r=>setTimeout(r,150));\n`);
  // .mjs makes the receiver fixture independent of Node's extension heuristics.
  await fs.rename(executable,executable+'.mjs');await fs.chmod(executable+'.mjs',0o700);
  const config=example();
  config.casting={protocols:{'google-cast':{enabled:true,executable:executable+'.mjs',attempts:1}}};
  const configPath=path.join(directory,'castboard.config.json');
  await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath,logger:{error(){}}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(async()=>{app.server.closeAllConnections();app.server.close();await app.dispose();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const get=async()=>await(await fetch(base+'/api/admin/delivery')).json();
  const post=body=>fetch(base+'/api/admin/delivery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let state=await get();
  let response=await post({action:'add',screenId:'home',name:'Test receiver',device:'Demo',revision:state.revision});
  assert.equal(response.status,200);state=await response.json();
  const oldRevision=state.revision;
  assert.equal((await post({action:'send',screenId:'home',index:0,revision:'stale'})).status,409);
  assert.equal((await post({action:'send',screenId:'home',index:99,revision:state.revision})).status,404);
  const pending=post({action:'send',screenId:'home',index:0,revision:state.revision,target:{device:'Attacker'},url:'https://attacker.test'});
  await new Promise(r=>setTimeout(r,50));
  assert.equal((await post({action:'send',screenId:'home',index:0,revision:state.revision})).status,409);
  response=await pending;assert.equal(response.status,200);
  assert.match((await response.json()).message,/Check the display/);
  assert.deepEqual(JSON.parse(await fs.readFile(output,'utf8')),['-d','Demo','cast_site','http://display.test/base/home']);
  assert.doesNotMatch(JSON.stringify(await(await fetch(base+'/api/config')).json()),/Test receiver|Demo|catt-fixture/);
  response=await post({action:'add',screenId:'home',name:'Failure test',device:'Fail',revision:state.revision});state=await response.json();
  response=await post({action:'send',screenId:'home',index:1,revision:state.revision});assert.equal(response.status,502);
  assert.match((await response.json()).error.message,/Check that the display is online/);
  assert.equal((await post({action:'remove',screenId:'home',index:0,revision:oldRevision})).status,409);
  response=await post({action:'remove',screenId:'home',index:1,revision:state.revision});assert.equal(response.status,200);
  assert.equal(JSON.parse(await fs.readFile(configPath,'utf8')).screens.home.targets.length,1);
  const unauthorized = await new Promise((resolve, reject) => {
    http.get(base+'/api/admin/delivery', {headers:{Host:'192.168.1.100'}}, response => { response.resume(); response.on('end',()=>resolve(response.statusCode)); }).on('error',reject);
  });
  assert.equal(unauthorized,403);
  assert.equal((await fetch(base+'/api/admin/delivery',{method:'POST',body:'{}'})).status,415);
});
