import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPlugin as notices} from '../plugins/noticeboard/plugin.js';
import {activeNotices} from '../plugins/noticeboard/model.js';
import {createPlugin as countdown} from '../plugins/countdown/plugin.js';
import {countdownState,countdownText} from '../plugins/countdown/model.js';
import {validateSchema} from '../src/core/extensions.js';
import {readTextFile,validateHttpUrl,validateProviderConfig} from '../src/core/providers.js';
import {displayData} from '../plugins/ambient-services/adapters.js';
import {formatNumber} from '../public/widget-kit.js';
const now=Date.parse('2026-10-04T12:00:00Z');
test('announcements enforce scheduling, pauses, expiry and text contracts',async()=>{
 const data={notices:[{body:'Visible',startsAt:'2026-10-04T11:00:00Z',expiresAt:'2026-10-04T13:00:00Z'},{body:'Expired',expiresAt:'2026-10-04T12:00:00Z'},{body:'Paused',enabled:false},{body:'Future',startsAt:'2026-10-04T13:00:00Z'}]};
 assert.deepEqual(activeNotices(data,now).map(n=>n.body),['Visible']);assert.equal(data.notices.length,4);
 assert.throws(()=>activeNotices({notices:[{body:'Message',expiresAt:'bad'}]}),/schedule/);
 assert.throws(()=>notices({config:{provider:'inline',notices:[{body:''}]},context:{}}),/message/);
 const plugin=notices({config:{provider:'demo'},context:{}});const sample=await plugin.getData();assert.equal(sample.demo,true);assert.ok(sample.notices.length>1);assert.match(plugin.nativeView({data:sample,options:{}}).lines[0].text,/Sample/);
});
test('countdowns keep their target fixed and handle completion, elapsed time and explicit zones',async()=>{
 const target='2026-10-06T13:02:03Z';
 const before=countdownState({target},{showSeconds:true},now);assert.deepEqual([before.days,before.hours,before.minutes,before.seconds],[2,1,2,3]);assert.match(countdownText(before,{showSeconds:true}),/2d 1h 2m 3s remaining/);
 assert.equal(countdownText(countdownState({target},{},Date.parse(target)),{completionText:'Doors open'}),'Doors open');
 const after=countdownState({target},{afterTarget:'elapsed'},Date.parse(target)+90000);assert.match(countdownText(after),/1m elapsed/);
 assert.throws(()=>countdownState({target:'2026-10-06T13:02:03'}),/time zone/);
 assert.throws(()=>countdown({config:{provider:'inline'},context:{}}),/valid target/);
 const plugin=countdown({config:{provider:'demo'},context:{}});assert.equal((await plugin.getData()).target,(await plugin.getData()).target);
 assert.ok(plugin.nativeView({data:{target},options:{showDate:false},now:new Date(now)}).lines.every(l=>!l.text.includes(target)));
});
test('provider files are bounded before allocation and errors do not expose the configured path',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-bounded-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'sample.json');
 await fs.writeFile(file,'1234');assert.equal(await readTextFile(file,4),'1234');await assert.rejects(readTextFile(file,3),/exceeds 3/);await assert.rejects(readTextFile(path.join(dir,'missing')),e=>!e.message.includes(dir)&&/cannot be opened/.test(e.message));
});
test('configured source URLs and settings reject unsupported schemes, credentials and malformed values',()=>{
 for(const url of ['file:///etc/passwd','https://user:secret@example.test'])assert.throws(()=>validateProviderConfig('test',{provider:'http-json',url},['http-json']),/HTTP|authentication/);
 assert.equal(validateHttpUrl('http://192.0.2.1/api/',{base:true}),'http://192.0.2.1/api');assert.throws(()=>validateHttpUrl('https://example.test?token=x',{base:true}),/query/);
 assert.throws(()=>validateSchema('too long',{type:'string',maxLength:3}),/long/);assert.throws(()=>validateSchema('',{type:'string',minLength:1}),/short/);assert.throws(()=>validateSchema('2026-10-04T12:00',{type:'string',format:'date-time'}),/time zone/);
 assert.doesNotThrow(()=>validateSchema('2026-10-04T12:00:00+02:00',{type:'string',format:'date-time'}));
});
test('unknown readings remain unknown and true zero values remain visible',()=>{
 for(const value of [null,undefined,'',' ',false])assert.equal(formatNumber(value),'—');assert.equal(formatNumber(0),'0');
 assert.equal(displayData('solar',{loadKw:null,gridImportKw:0}).usedSolarKw,null);assert.equal(displayData('solar',{loadKw:0,gridImportKw:0}).usedSolarKw,0);
});
test('configured companion sources are defaults in validation and Studio with independent copies',async()=>{
 const {pluginLibrary,changePluginConfig}=await import('../src/core/plugin-admin.js');
 const {discoverPlugins}=await import('../src/core/plugin-registry.js');
 const {compatibleSource}=await import('../public/studio-model.js');
 const root=new URL('..',import.meta.url).pathname;
 let config={plugins:{},screens:{home:{panels:[]}}};const packages=await pluginLibrary({pluginsDir:path.join(root,'plugins'),config,configDir:root});
 config=changePluginConfig(config,packages,{action:'install',type:'ambient-weather',id:'lobby-weather'});
 config.plugins['custom-weather']={...config.plugins['ambient-weather-source'],type:'ambient-weather-source'};config.plugins['lobby-weather'].bindings.weather='custom-weather';config.screens.home.panels=[{id:'weather',plugin:'lobby-weather'}];
 const plugins=await discoverPlugins({pluginsDir:path.join(root,'plugins'),config,context:{configDir:root}});const widget=plugins.find(p=>p.id==='lobby-weather');assert.equal(widget.defaultSource,'custom-weather');
 assert.equal(compatibleSource(widget.id,{plugins:[widget],sources:plugins.filter(p=>p.getData)}),'custom-weather');
});
