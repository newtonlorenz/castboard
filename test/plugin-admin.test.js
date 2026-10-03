import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createApp} from '../src/server.js';
import {changePluginConfig,pluginInstances} from '../src/core/plugin-admin.js';
const packages=[{id:'meter',name:'Meter',managed:true,settingsSchema:{type:'object',properties:{value:{type:'number'},token:{type:'string',sensitive:true}}},defaultConfig:{value:1}},{id:'view',managed:true,settingsSchema:{type:'object',properties:{}},dependencies:['meter'],defaultBindings:{reading:'meter'}}];
const base={plugins:{north:{type:'meter',value:12,token:'secret'}},screens:{home:{path:'/',panels:[{id:'one',plugin:'north'}]}}};
test('plugin settings protect credentials and forbid removing used sources',()=>{
 const visible=pluginInstances(base,packages,[])[0];assert.equal(JSON.stringify(visible).includes('secret'),false);assert.deepEqual(visible.protectedFields,['token']);
 for(const action of ['remove','enable'])assert.throws(()=>changePluginConfig(base,packages,{action,id:'north',enabled:false}),/in use/);
 const next=changePluginConfig(base,packages,{action:'configure',id:'north',settings:{value:0}});assert.equal(next.plugins.north.value,0);assert.equal(next.plugins.north.token,'secret');assert.equal(base.plugins.north.value,12);
 assert.throws(()=>changePluginConfig(base,packages,{action:'configure',id:'north',settings:{arbitrary:'value'}}),/not editable/);
});
test('install connects an existing dependency by type without replacing it',()=>{
 const next=changePluginConfig(base,packages,{action:'install',type:'view',id:'display'});assert.deepEqual(next.plugins.display.bindings,{reading:'north'});assert.equal(Object.keys(next.plugins).length,2);assert.equal(next.plugins.north.token,'secret');
 const cycle=[{id:'a',managed:true,defaultBindings:{b:'b'}},{id:'b',managed:true,defaultBindings:{a:'a'}}];assert.throws(()=>changePluginConfig({plugins:{},screens:{}},cycle,{action:'install',type:'a',id:'a'}),/cycle/);
});
test('installation reports duplicate copies and disabled dependencies without partial changes',()=>{
 const disabled={plugins:{meter:{type:'meter',enabled:false,value:7}},screens:{}};
 assert.throws(()=>changePluginConfig(disabled,packages,{action:'install',type:'view',id:'display'}),/Enable meter/);
 assert.deepEqual(disabled.plugins,{meter:{type:'meter',enabled:false,value:7}});
 assert.throws(()=>changePluginConfig(base,packages,{action:'install',type:'meter',id:'north'}),/already installed/);
 const first=changePluginConfig(base,packages,{action:'install',type:'meter',id:'second'});
 const next=changePluginConfig(first,packages,{action:'configure',id:'second',settings:{value:99}});
 assert.equal(next.plugins.north.value,12);assert.equal(next.plugins.second.value,99);
});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-plugin-admin-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'package.json'),'{"type":"module"}');
 const directory=path.join(root,'extensions/plugins/meter');await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,'plugin.json'),JSON.stringify(packages[0]));
 await fs.writeFile(path.join(directory,'plugin.js'),`export function createPlugin({config,context}){context.logger.created(context.instanceId);if(config.value===13)throw new Error('Rejected value');return {id:'meter',name:'Meter',getData:()=>({value:config.value}),dispose:()=>context.logger.disposed(context.instanceId)}}`);
 await fs.writeFile(path.join(directory,'widget.js'),'export function mount(){}');
 const config={server:{host:'127.0.0.1',port:8787},branding:{name:'Fixture'},defaultScreen:'home',plugins:{north:{type:'meter',value:12,token:'${KEY}'},south:{type:'meter',value:24}},screens:{home:{path:'/',type:'single',panels:[{id:'one',plugin:'north'}]}}};
 const created=[],disposed=[];const app=await createApp({loadedConfig:{config:{...config,plugins:{...config.plugins,north:{...config.plugins.north,token:'secret'}}},rawConfig:config,configDir:root,configPath:path.join(root,'config.json')},env:{KEY:'secret'},logger:{error(){},created:id=>created.push(id),disposed:id=>disposed.push(id)}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 return {url:`http://127.0.0.1:${app.server.address().port}`,root,created,disposed,app};
}
test('admin applies one changed plugin and preserves unrelated clients and raw secrets',async t=>{
 const app=await fixture(t);const broken=path.join(app.root,'extensions/plugins/broken');await fs.mkdir(broken);await fs.writeFile(path.join(broken,'plugin.js'),'export function createPlugin(){throw new Error("must not execute")}');await fs.writeFile(path.join(broken,'plugin.json'),'{bad');let before=await(await fetch(app.url+'/api/admin/plugins')).json();assert.equal(before.packages.find(p=>p.id==='meter').origin,'Local package');assert.equal(before.packages.find(p=>p.id==='broken').managed,false);assert.equal(JSON.stringify(before).includes('secret'),false);
 const change={action:'configure',id:'north',settings:{value:30},revision:before.revision};let response=await fetch(app.url+'/api/admin/plugins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(change)});assert.equal(response.status,200);const after=await response.json();assert.deepEqual(app.created,['north','south','north']);assert.deepEqual(app.disposed,['north']);assert.equal((await app.app.plugins.find(plugin=>plugin.id==='north').getData()).value,30);const raw=JSON.parse(await fs.readFile(path.join(app.root,'config.json'),'utf8'));assert.equal(raw.plugins.north.token,'${KEY}');assert.equal((await(await fetch(app.url+'/api/plugins/north/data')).json()).data.value,30);
 response=await fetch(app.url+'/api/admin/plugins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(change)});assert.equal(response.status,409);
 response=await fetch(app.url+'/api/admin/plugins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...change,revision:after.revision,settings:{value:13}})});assert.equal(response.status,422);assert.equal((await(await fetch(app.url+'/api/plugins/north/data')).json()).data.value,30);assert.equal(JSON.parse(await fs.readFile(path.join(app.root,'config.json'),'utf8')).plugins.north.value,30);
});
test('plugin changes validate settings before replacing providers',async t=>{
 const app=await fixture(t);const before=await(await fetch(app.url+'/api/admin/plugins')).json();const response=await fetch(app.url+'/api/admin/plugins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'configure',id:'north',settings:{value:'bad'},revision:before.revision})});assert.equal(response.status,422);assert.deepEqual(app.disposed,[]);assert.equal((await(await fetch(app.url+'/api/plugins/north/data')).json()).data.value,12);
});
