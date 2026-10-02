import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../src/server.js';
import {validateSchema, publicAsset} from '../src/core/extensions.js';

async function fixture(t, override = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'castboard-extensions-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'package.json'),'{"type":"module"}');
  const sources = {
    'meter': `export function createPlugin({config,context}) { let count=0; return {id:'meter',name:'Meter',contract:config.contract||'reading@1',dataSchema:{type:'object',required:['value'],properties:{value:{type:'number'}}},assets:['skin.css','escape.txt'],publicConfig:()=>({label:config.label}),getData:async()=>{await new Promise(r=>setTimeout(r,20));return {value:config.value,count:++count}},actionSchemas:{reset:{type:'object',required:['action'],properties:{action:{enum:['reset']}}}},action:()=>{count=0;return {reset:true}},dispose:()=>context.logger.disposed?.(context.instanceId)}}`,
    'view': `export function createPlugin(){return {id:'view',name:'View',inputContract:'reading@1',optionSchema:{type:'object',properties:{digits:{type:'integer',minimum:0,maximum:4}}}}}`,
  };
  for(const [id,source] of Object.entries(sources)) {
    const dir=path.join(root,'plugins',id);await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'plugin.js'),source);
    if(id==='view') await fs.writeFile(path.join(dir,'widget.js'),'export function mount({element,context}) {context.schedule(async()=>{element.textContent=(await context.data()).value},1000);}');
    await fs.writeFile(path.join(dir,'skin.css'),'p {color:red}');
  }
  await fs.writeFile(path.join(root,'secret.txt'),'private-token');
  await fs.symlink(path.join(root,'secret.txt'),path.join(root,'plugins/meter/escape.txt'));
  const typeDir=path.join(root,'types','canvas');await fs.mkdir(typeDir,{recursive:true});
  await fs.writeFile(path.join(typeDir,'type.js'),"export function createScreenType(){return {id:'canvas',name:'Canvas',layoutSchema:{type:'object',properties:{gutter:{type:'number',minimum:0}}},positionSchema:{type:'object',required:['slot'],properties:{slot:{type:'string'}}}}}");
  await fs.writeFile(path.join(typeDir,'renderer.js'),'export function prepare(){} export function place(){}');
  const config={server:{host:'127.0.0.1',port:8787},branding:{name:'Example',timeZone:'UTC'},defaultScreen:'home',extensions:{plugins:['plugins'],screenTypes:['types']},plugins:{north:{type:'meter',value:12,cacheMs:500,label:'North',secret:'never-public'},south:{type:'meter',value:24,label:'South'},numeric:{type:'view'}},screens:{home:{path:'/',type:'canvas',layout:{gutter:3},panels:[{id:'one',plugin:'numeric',source:'north',position:{slot:'left'},options:{digits:2}},{id:'two',plugin:'numeric',source:'south',position:{slot:'right'}}]}},...override};
  const disposed=[];
  const app=await createApp({loadedConfig:{config,rawConfig:config,configDir:root,configPath:path.join(root,'config.json')},logger:{error(){},disposed:id=>disposed.push(id)}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await app.dispose()});
  return {...app,root,config,disposed,url:`http://127.0.0.1:${app.server.address().port}`};
}

test('external modules support independent instances, source reuse and custom renderers',async t=>{
  const app=await fixture(t);
  const config=await (await fetch(app.url+'/api/config')).json();
  assert.equal(config.plugins.find(p=>p.id==='north').type,'meter');
  assert.equal(JSON.stringify(config).includes('never-public'),false);
  assert.equal(JSON.stringify(config).includes(app.root),false);
  assert.equal(config.screens.home.panels[1].source,'south');
  assert.equal((await fetch(app.url+'/screen-types/canvas/renderer.js')).status,200);
  const read=async id=>(await (await fetch(app.url+`/api/plugins/${id}/data`)).json()).data;
  const values=await Promise.all([read('north'),read('north'),read('south')]);
  assert.deepEqual(values.map(x=>x.value),[12,12,24]);assert.equal(values[0].count,1);assert.equal(values[1].count,1);
  assert.equal((await read('north')).count,1);
  const action=await fetch(app.url+'/api/plugins/north/action',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"bad"}'});assert.equal(action.status,422);
  assert.equal((await fetch(app.url+'/api/plugins/north/action',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"reset"}'})).status,200);
  assert.equal((await read('north')).count,1);
  const catalog=await (await fetch(app.url+'/api/admin/design')).json();
  assert.deepEqual(catalog.catalog.plugins.map(x=>x.id),['numeric']);assert.equal(catalog.catalog.sources.length,2);
  await app.dispose();await app.dispose();assert.deepEqual(app.disposed.sort(),['north','south']);
});

test('only manifest assets inside the real package root are public',async t=>{
  const app=await fixture(t);
  assert.equal((await fetch(app.url+'/plugins/north/assets/skin.css')).status,200);
  for(const asset of ['plugin.js','escape.txt','secret.txt','missing.css']) assert.equal((await fetch(app.url+'/plugins/north/assets/'+asset)).status,404,asset);
  assert.equal(await publicAsset({directory:path.join(app.root,'plugins/meter'),assets:['../secret.txt']},'../secret.txt'),null);
});

test('schemas reject invalid options, layouts and data without coercing zero',()=>{
  assert.doesNotThrow(()=>validateSchema({value:0},{type:'object',required:['value'],properties:{value:{type:'number',minimum:0}}}));
  assert.throws(()=>validateSchema({value:'0'},{type:'object',properties:{value:{type:'number'}}}),/number/);
  assert.throws(()=>validateSchema([5],{type:'array',items:{type:'integer',maximum:4}}),/maximum/);
  assert.throws(()=>validateSchema({private:1},{type:'object',additionalProperties:false,properties:{}}),/not supported/);
});

test('missing bindings and incompatible source contracts fail before serving',async t=>{
  await assert.rejects(fixture(t,{plugins:{numeric:{type:'view',bindings:{missing:'absent'}}}}),/references missing/);
  await assert.rejects(fixture(t,{plugins:{numeric:{type:'view'},north:{type:'view'},south:{type:'meter',value:1}}}),/missing source/);
});

test('client health diagnostics are administrative and omit widget payloads',async t=>{
 const app=await fixture(t);
 const response=await fetch(app.url+'/api/client-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screenId:'home',panels:[{id:'one',state:'live',value:'financial-value'}]})});assert.equal(response.status,200);
 const health=await (await fetch(app.url+'/api/admin/health')).json();
 assert.equal(health.clients[0].panels[0].state,'live');assert.equal(JSON.stringify(health).includes('financial-value'),false);
 assert.equal((await fetch(app.url+'/api/client-status',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"screenId":"unknown","panels":[]}'})).status,422);
 assert.equal((await fetch(app.url+'/api/runtime-config')).status,200);
});

test('the editor rejects invalid source bindings without replacing clients',async t=>{
 const app=await fixture(t);const before=await (await fetch(app.url+'/api/admin/design')).json();
 before.design.screens.home.panels[0].bindings={bad:'missing'};
 const response=await fetch(app.url+'/api/admin/design',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:before.revision,design:before.design})});
 assert.equal(response.status,422);assert.deepEqual(app.disposed,[]);
});


test('action schemas reject inherited property names before invoking handlers',async t=>{
 const app=await fixture(t);
 for(const action of ['__proto__','constructor','toString']){
  const response=await fetch(app.url+'/api/plugins/north/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
  assert.equal(response.status,422,action);
 }
 const read=await (await fetch(app.url+'/api/plugins/north/data')).json();
 assert.equal(read.data.count,1);
});

test('source contracts reject a real semantic mismatch',async t=>{
 await assert.rejects(fixture(t,{plugins:{north:{type:'meter',value:12,contract:'other@1'},south:{type:'meter',value:24},numeric:{type:'view'}}}),/requires reading@1, received other@1/);
});


test('schema allowlists and required fields use declared own properties',()=>{
 const schema={type:'object',additionalProperties:false,properties:{}};
 assert.throws(()=>validateSchema(JSON.parse('{"constructor":"unexpected"}'),schema),/not supported/);
 assert.throws(()=>validateSchema({}, {type:'object',required:['toString']}),/is required/);
});
