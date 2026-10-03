import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {pluginLibrary,changePluginConfig} from '../src/core/plugin-admin.js';
import {createApp} from '../src/server.js';
const root=fileURLToPath(new URL('..',import.meta.url));
test('every Ambient display installs its declared dependencies and serves typed demo data',async t=>{
 const configDir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-ambient-'));t.after(()=>fs.rm(configDir,{recursive:true,force:true}));
 let config={server:{host:'127.0.0.1',port:8787},branding:{name:'Demo gallery',timeZone:'UTC'},defaultScreen:'gallery',plugins:{},screens:{gallery:{path:'/',type:'grid',layout:{columns:12,rows:8,gap:8,padding:8},panels:[]}}};
 const catalog=await pluginLibrary({pluginsDir:path.join(root,'plugins'),config,configDir});
 const display=catalog.filter(pkg=>pkg.id.startsWith('ambient-')&&pkg.hasWidget);assert.equal(display.length,11);
 for(const pkg of display)config=changePluginConfig(config,catalog,{action:'install',id:pkg.id,type:pkg.id});
 const source={clock:'config',focus:'calendar',calendar:'calendar',weather:'weather',solar:'solar',recovery:'recovery',portfolio:'portfolio',media:'media'};
 config.screens.gallery.panels=display.map((pkg,index)=>{const kind=pkg.id.slice(8);return{id:pkg.id,plugin:pkg.id,...(source[kind]?{source:`ambient-${source[kind]}-source`}:{}),position:{column:(index%4)*3+1,row:Math.floor(index/4)*2+1,width:3,height:2}};});
 const app=await createApp({loadedConfig:{config,rawConfig:config,configDir,configPath:path.join(configDir,'config.json')},logger:{error(){}}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 const url=`http://127.0.0.1:${app.server.address().port}`;
 for(const name of ['config','calendar','weather','solar','recovery','portfolio','media']){const response=await fetch(`${url}/api/plugins/ambient-${name}-source/data`);assert.equal(response.status,200,name);const data=await response.json();assert.equal(data.ok,true,name);assert.equal(data.data.demo,true,name);}
 for(const name of ['runtime','theme']){const asset=name==='runtime'?'runtime.js':'mission.css';assert.equal((await fetch(`${url}/plugins/ambient-${name}/assets/${asset}`)).status,200);}
 const publicConfig=await(await fetch(url+'/api/runtime-config')).json();assert.equal(JSON.stringify(publicConfig).includes('settingsSchema'),false);assert.equal(JSON.stringify(publicConfig).includes('_configSignature'),false);assert.equal(publicConfig.screens.gallery.panels.length,11);
});

import {calendarData,displayData} from '../plugins/ambient-services/adapters.js';
test('calendar adapter handles time zones, midnight and exclusive all-day ends',()=>{
 const now=new Date('2026-10-02T12:00:00Z');
 const events=[
  {id:'local',start:'2026-10-02T09:00:00Z',end:'2026-10-02T10:00:00Z'},
  {id:'overnight',start:'2026-10-01T23:00:00Z',end:'2026-10-02T02:00:00Z'},
  {id:'yesterday',allDay:true,start:'2026-10-01',end:'2026-10-02'},
  {id:'today',allDay:true,start:'2026-10-02',end:'2026-10-03'},
  {id:'midnight',start:'2026-10-01T20:00:00Z',end:'2026-10-02T00:00:00Z'},
  {id:'invalid',start:'bad'}
 ];
 const data=calendarData({events},'UTC',now);assert.deepEqual(data.events.map(e=>[e.id,e.start,e.end]),[['local','09:00','10:00'],['overnight','00:00','02:00'],['today','all-day','all-day']]);
 assert.equal(calendarData({events:events.slice(0,1)},'America/New_York',now).events[0].start,'05:00');
 assert.equal(calendarData({events:[events[3]]},'America/New_York',now).events.length,1);
});
test('native providers adapt into rich display contracts without changing units or currency',()=>{
 assert.equal(displayData('weather',{temperatureC:12,windKph:8}).temp,12);
 assert.deepEqual(displayData('recovery',{score:91}).recovery,{score:91});
 assert.equal(displayData('solar',{loadKw:2.4,gridImportKw:.4}).usedSolarKw,2);
 const data=displayData('portfolio',{positions:[{currency:'USD'}],totalValue:123,dailyChange:4});assert.equal(data.summary.baseCurrency,'USD');assert.equal(data.summary.netLiquidation,123);
});
