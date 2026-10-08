import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../../../src/server.js';
import { deviceTokenHash } from '../../../src/core/devices.js';

const enabled=process.env.CASTBOARD_BROWSER_TESTS==='1';
test('Displays lists Cast and embedded receivers; dashboard switching, recasting and assignments work', {skip:!enabled,timeout:60000}, async t => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});
  t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-display-workflow-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const calls=path.join(dir,'calls.jsonl'),executable=path.join(dir,'receiver.mjs');
  await fs.writeFile(executable,`#!${process.execPath}\nimport fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(process.argv.slice(2))+'\\n');\n`);
  await fs.chmod(executable,0o700);
  const receiver={name:'Kitchen Nest',device:'Fixture kitchen',protocol:'google-cast'};
  const key='test-key-for-dashboard-assignment-only';
  const config={server:{host:'127.0.0.1',port:8787,publicUrl:'http://display.test'},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},
    casting:{protocols:{'google-cast':{enabled:true,executable,attempts:1,resetDelayMs:0}}},
    screens:{home:{title:'Home',path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}],targets:[receiver]},news:{title:'News',path:'/news',type:'single',panels:[{id:'news-clock',plugin:'clock'}],targets:[receiver,{name:'Office Nest',device:'Fixture office'}]}},
    devices:{esp:{name:'Kitchen ESP32',screenId:'home',mode:'native',width:800,height:480,format:'rgb565',refreshMs:5000,enabled:true,touch:true,allowActions:false,options:{keep:'saved'},tokenHash:deviceTokenHash(key)}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>{app.server.closeAllConnections();app.server.close();return app.dispose();});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/admin');await page.locator('#quick-screen option').nth(1).waitFor({state:'attached'});
  await page.locator('#screen-title').fill('Draft home');await page.locator('#screen-title').press('Tab');
  await page.getByLabel('Switch dashboard',{exact:true}).selectOption('news');
  assert.equal(await page.locator('#canvas-title').innerText(),'News');
  await page.getByLabel('Switch dashboard',{exact:true}).selectOption('home');
  assert.equal(await page.locator('#screen-title').inputValue(),'Draft home');
  assert.equal(await page.locator('#save-design').isEnabled(),true);
  // A fresh tab avoids discarding the Studio draft while exercising receiver controls.
  const displays=await browser.newPage({viewport:{width:1440,height:960}});
  displays.on('pageerror',error=>errors.push(error.message));
  await displays.goto(origin+'/admin/devices?screen=news');
  await displays.getByRole('heading',{name:'Kitchen Nest',exact:true}).waitFor();
  assert.equal(await displays.locator('.cast-row').count(),2); // shared Kitchen target appears once
  assert.equal(await displays.getByRole('heading',{name:'Kitchen ESP32',exact:true}).count(),1);
  const kitchen=displays.locator('.cast-row').filter({hasText:'Kitchen Nest'});
  assert.equal(await kitchen.locator('select').inputValue(),'news');
  await kitchen.getByRole('button',{name:'Cast',exact:true}).click();
  await kitchen.getByRole('status').filter({hasText:'Dashboard sent'}).waitFor();
  assert.deepEqual(JSON.parse((await fs.readFile(calls,'utf8')).trim()),['-d','Fixture kitchen','cast_site','http://display.test/news']);
  await kitchen.getByRole('button',{name:'Recast',exact:true}).click();
  await kitchen.getByRole('status').filter({hasText:'Dashboard sent'}).waitFor();
  const commands=(await fs.readFile(calls,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(commands.slice(-2),[['-d','Fixture kitchen','stop'],['-d','Fixture kitchen','cast_site','http://display.test/news']]);
  await displays.getByLabel('Dashboard for Kitchen ESP32').selectOption('news');
  await displays.locator('[data-assign="esp"]').click();
  await displays.locator('#toast').filter({hasText:'Dashboard assigned'}).waitFor();
  const saved=JSON.parse(await fs.readFile(configPath,'utf8'));
  assert.deepEqual(saved.devices.esp,{...config.devices.esp,screenId:'news'});
  const response=await fetch(origin+'/api/devices/esp/bootstrap',{headers:{Authorization:`Bearer ${key}`}});
  assert.equal(response.status,200);assert.equal((await response.json()).defaultScreen,'news');
  assert.deepEqual(saved.screens,config.screens);
  if(process.env.CASTBOARD_CAPTURE_DIR){await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await displays.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,'displays-desktop.png'),fullPage:true});}
  await displays.setViewportSize({width:390,height:844});
  assert.equal(await displays.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await kitchen.getByRole('button',{name:'Recast',exact:true}).isVisible(),true);
  if(process.env.CASTBOARD_CAPTURE_DIR)await displays.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,'displays-mobile.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.getByLabel('Switch dashboard',{exact:true}).isVisible(),true);
  assert.deepEqual(errors,[]);
});

test('image and native receivers open the same modal; images accept valid touches once', {skip:!enabled,timeout:60000}, async t=>{
  const {chromium}=await import('playwright');
  const {createFrameRenderer}=await import('../renderer.js');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});
  t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-browser-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const key='only-for-automated-test-device-connections';
  const baseDevice={name:'Test',screenId:'home',mode:'frame',width:480,height:320,format:'rgb565',refreshMs:5000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)};
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{title:'Home',path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'details'}}]},details:{title:'Clock details',path:'/details',type:'single',presentation:'modal',viewport:{width:400,height:230},appearance:{background:'#203d60',fontFamily:'mono'},panels:[{id:'detail-clock',plugin:'clock'}]}},devices:{image:baseDevice,native:{...baseDevice,name:'Native',mode:'native'},tiny:{...baseDevice,name:'Tiny',width:128,height:64}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({loadedConfig:{config,rawConfig:structuredClone(config),configPath,configDir:dir}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const bridgePaths=[];app.server.prependListener('request',req=>{if(req.headers['x-castboard-bridge']==='fixture-bridge')bridgePaths.push(req.url);});
  const renderer=createFrameRenderer({browser,appOrigin:origin,bridgeToken:'fixture-bridge'});t.after(()=>renderer.dispose());
  const input={id:'image',token:key,width:480,height:320,format:'rgb565',revision:'test'};
  const before=await renderer.render(input);assert.equal(before.buffer.length,480*320*2);
  assert.ok(bridgePaths.includes('/device-view/image'));assert.ok(bridgePaths.some(route=>route.startsWith('/api/devices/image/bootstrap')));
  const touched=await renderer.render({...input,event:{frameId:before.frameId,eventId:'touch0001',x:80,y:80}});
  assert.notEqual(touched.frameId,before.frameId);
  const duplicate=await renderer.render({...input,event:{frameId:before.frameId,eventId:'touch0001',x:80,y:80}});
  assert.equal(duplicate.frameId,touched.frameId);
  await assert.rejects(renderer.render({...input,event:{frameId:before.frameId,eventId:'touch0002',x:80,y:80}}),/fresh frame/);
  await assert.rejects(renderer.render({...input,event:{frameId:touched.frameId,eventId:'badcoords',x:500,y:80}}),/outside/);
  const scene=await(await fetch(origin+'/api/devices/native/scene',{headers:{Authorization:`Bearer ${key}`}})).json();
  const opened=await(await fetch(origin+'/api/devices/native/events',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({sceneId:scene.sceneId,eventId:'native001',event:'panel:clock'})})).json();
  assert.equal(opened.title,'Clock details');assert.equal(opened.modal,true);
  // Separate browser sessions must not leak navigation between devices.
  const second=await renderer.render({...input,id:'native'});assert.equal(second.buffer.length,before.buffer.length);
  assert.notEqual(second.frameId,touched.frameId);
  const tiny=await renderer.render({...input,id:'tiny',width:128,height:64});assert.equal(tiny.buffer.length,128*64*2);
  const jpeg=await renderer.render({...input,format:'jpeg'});assert.equal(jpeg.buffer[0],0xff);assert.equal(jpeg.buffer[1],0xd8);
});

test('Studio previews navigate modals but never send plugin actions; device forms save and reconnect', {skip:!enabled,timeout:60000},async t=>{
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-studio-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true},spotify:{enabled:true,provider:'demo',controllable:true}},screens:{home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'details'}}]},details:{title:'Music details',path:'/details',type:'single',presentation:'modal',panels:[{id:'music',plugin:'spotify',interaction:{type:'action',action:'toggle'}}]}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({loadedConfig:{config,rawConfig:structuredClone(config),configPath,configDir:dir}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[],actions=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/action'))actions.push(request.url());});
  await page.goto(origin+'/admin');await page.waitForSelector('#screen-list button');
  await page.locator('[data-mode="preview"]').click();
  const frame=page.frameLocator('#live-preview');
  await frame.locator('.panel-interaction').click();await frame.locator('dialog[open] h2').waitFor();
  assert.equal(await frame.locator('dialog[open] h2').textContent(),'Music details');
  await frame.locator('dialog .panel-interaction').click();
  assert.equal(actions.length,0);
  await page.locator('#reset-preview').click();await frame.locator('dialog[open]').waitFor({state:'detached'});await frame.locator('#dashboard .panel-interaction').waitFor();
  assert.equal(await frame.locator('dialog[open]').count(),0);
  await page.goto(origin+'/admin/devices');await page.locator('#first-device').click();
  await page.locator('#device-name').fill('Small screen');await page.locator('#device-mode').selectOption('native');
  await page.locator('#device-form button[type=submit]').click();await page.locator('#key-dialog[open]').waitFor();
  const connection=JSON.parse(await page.locator('#device-connection').inputValue());assert.equal(connection.deviceId,'small-screen');assert.equal(connection.connectionKey.length,43);
  await page.locator('#key-dialog .primary').click();await page.waitForFunction(()=>document.querySelector('#device-connection').value==='');
  assert.equal(await page.locator('#device-connection').inputValue(),'');
  assert.equal((await fetch(origin+'/api/devices/small-screen/config',{headers:{Authorization:`Bearer ${connection.connectionKey}`}})).status,200);
  assert.deepEqual(errors,[]);
});


test('display packages upload from Admin and keep their per-device settings on desktop and mobile', {skip:!enabled,timeout:60000},async t=>{
  const {chromium}=await import('playwright');
  const {zipFiles}=await import('../../../src/core/display-packages.js');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-upload-ui-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{title:'Demo screen',path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}]}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  const origin=`http://127.0.0.1:${app.server.address().port}`,page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const capture=async name=>{if(!process.env.CASTBOARD_CAPTURE_DIR)return;await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,name+'.png'),fullPage:!await page.locator('dialog[open]').count(),animations:'disabled'});};
  await page.goto(origin+'/admin/devices');await page.locator('#adapter-standard').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-adapter-example').click();const download=await downloadPromise;const zip=await fs.readFile(await download.path());
  await page.locator('#show-adapter-upload').click();
  await page.locator('#adapter-file').setInputFiles({name:'monochrome.zip',mimeType:'application/zip',buffer:zip});
  assert.equal(await page.locator('#adapter-trust').evaluate(input=>input.validity.valueMissing),true);
  await capture('display-upload-desktop');
  await page.setViewportSize({width:390,height:844});await capture('display-upload-mobile');
  await page.locator('#adapter-trust').check();await page.locator('#install-adapter').click();await page.locator('#adapter-example-monochrome').waitFor();
  await page.locator('#add-device').click();await page.locator('#device-name').fill('OLED demo');await page.locator('#device-adapter').selectOption('example-monochrome');
  assert.equal(await page.locator('#device-width').inputValue(),'128');assert.equal(await page.locator('#device-height').inputValue(),'64');
  assert.equal(await page.locator('#device-touch').isChecked(),false);
  await page.locator('#device-adapter-options-threshold').fill('160');await page.locator('#device-adapter-options-invert').check();
  await page.locator('#device-form button[type=submit]').click();await page.locator('#key-dialog[open]').waitFor();await page.locator('#key-dialog .primary').click();
  await page.locator('[data-edit="oled-demo"]').waitFor();assert.equal(await page.locator('[data-remove-adapter="example-monochrome"]').isDisabled(),true);
  await page.evaluate(()=>window.scrollTo(0,0));await capture('display-plugins-mobile');
  await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>window.scrollTo(0,0));await capture('display-plugins-desktop');
  await page.locator('[data-edit="oled-demo"]').click();assert.equal(await page.locator('#device-adapter-options-threshold').inputValue(),'160');assert.equal(await page.locator('#device-adapter-options-invert').isChecked(),true);
  await capture('display-plugin-settings-desktop');await page.setViewportSize({width:390,height:844});await capture('display-plugin-settings-mobile');await page.locator('#device-enabled').scrollIntoViewIfNeeded();await capture('display-plugin-settings-mobile-bottom');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.locator('#device-form button[type=submit]').click();await page.locator('#device-dialog[open]').waitFor({state:'hidden'});
  const saved=JSON.parse(await fs.readFile(configPath));assert.deepEqual(saved.devices['oled-demo'].options,{threshold:160,invert:true});
  // A multi-format adapter must preserve its second format on subsequent edits.
  const example=new URL('../../../display-adapters/.examples/monochrome/',import.meta.url),files=new Map(await Promise.all(['adapter.json','adapter.mjs'].map(async name=>[name,await fs.readFile(new URL(name,example))])));
  const manifest=JSON.parse(files.get('adapter.json'));manifest.id='multi-format';manifest.formats=['mono1','mono-alt'];files.set('adapter.json',JSON.stringify(manifest));
  assert.equal((await fetch(origin+'/api/admin/display-adapters',{method:'POST',headers:{'Content-Type':'application/zip','X-Castboard-Trust-Package':'yes'},body:zipFiles(files)})).status,200);
  await page.reload();await page.locator('[data-edit="oled-demo"]').click();await page.locator('#device-adapter').selectOption('multi-format');await page.locator('#device-format').selectOption('mono-alt');await page.locator('#device-form button[type=submit]').click();await page.locator('#device-dialog[open]').waitFor({state:'hidden'});
  await page.locator('[data-edit="oled-demo"]').click();assert.equal(await page.locator('#device-format').inputValue(),'mono-alt');await page.locator('#device-form button[type=submit]').click();await page.locator('#device-dialog[open]').waitFor({state:'hidden'});
  await page.locator('[data-remove-adapter="example-monochrome"]').click();await page.locator('#device-confirm-ok').click();await page.locator('#adapter-example-monochrome').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
});

test('a close tap survives a background frame refresh but cannot close a different modal', {skip:!enabled,timeout:60000}, async t=>{
  const {chromium}=await import('playwright');
  const {createFrameRenderer}=await import('../renderer.js');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});
  t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-close-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const key='only-for-automated-close-button-test';
  const device={name:'Touch test',screenId:'home',mode:'frame',width:320,height:240,format:'rgb565',refreshMs:3000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)};
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{clock:{enabled:true}},screens:{home:{title:'Home',path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'details'}}]},details:{title:'Details',path:'/details',type:'single',presentation:'modal',panels:[{id:'detail-clock',plugin:'clock'}]}},devices:{image:device}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  let page;
  const trackedBrowser={async newContext(options){const context=await browser.newContext(options);context.on('page',value=>{page=value;});return context;}};
  const renderer=createFrameRenderer({browser:trackedBrowser,appOrigin:`http://127.0.0.1:${app.server.address().port}`});t.after(()=>renderer.dispose());
  const input={id:'image',token:key,width:320,height:240,format:'rgb565',revision:'close-test'};
  const home=await renderer.render(input);
  const open=await renderer.render({...input,event:{frameId:home.frameId,eventId:'open-modal-1',x:80,y:80}});
  const close=page.locator('.screen-modal-header button');
  const box=await close.boundingBox();
  assert.ok(box.width>=80 && box.height>=44,'close must have a large target');
  assert.ok(box.x>=12 && box.y>=8 && box.x+box.width<=308,'close must be inset from the glass edge');
  // Force pixels to change without changing the dialog or its controls, like a
  // clock/camera update arriving while the receiver is transmitting its tap.
  await page.locator('dialog .widget').evaluate(el=>{el.style.background='#56310e';});
  const refreshed=await renderer.render(input);assert.notEqual(refreshed.frameId,open.frameId);
  const tap={frameId:open.frameId,eventId:'close-modal-1',x:box.x+box.width/2,y:box.y+box.height/2};
  await renderer.render({...input,event:tap});assert.equal(await page.locator('dialog[open]').count(),0);
  // Retrying the same event is harmless, and an old close never applies to a
  // freshly opened dialog even when it has identical title and coordinates.
  await renderer.render({...input,event:tap});assert.equal(await page.locator('dialog[open]').count(),0);
  const current=await renderer.render(input);
  await renderer.render({...input,event:{frameId:current.frameId,eventId:'open-modal-2',x:80,y:80}});
  await assert.rejects(renderer.render({...input,event:{...tap,eventId:'close-old-modal'}}),/fresh frame/);
  assert.equal(await page.locator('dialog[open]').count(),1);
});


test('new embedded screens save and connect through Displays while Cast setup stays separate', {skip:!enabled,timeout:60000}, async t=>{
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-setup-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787},plugins:{clock:{enabled:true}},screens:{home:{title:'Home',path:'/',type:'single',panels:[{id:'clock',plugin:'clock'}]}}};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.close();app.server.closeAllConnections();return app.dispose();});
  const origin=`http://127.0.0.1:${app.server.address().port}`,page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/admin');await page.locator('#screen-list button').first().waitFor();
  await page.locator('#add-screen').click();await page.locator('#new-screen-title').fill('Desk display');await page.locator('#new-screen-device').selectOption('embedded');
  assert.match(await page.locator('#new-device-help').textContent(),/open Displays/);
  await page.locator('#create-screen').click();await page.locator('#plugin-list button').filter({hasText:'Clock'}).first().click();
  await page.locator('#save-design').click();await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='All changes saved');
  const saved=JSON.parse(await fs.readFile(configPath));assert.equal(saved.screens['desk-display'].panels.length,1);
  assert.equal(await page.locator('#screen-presentation').count(),1);assert.equal(await page.locator('#screen-width').count(),1);
  await page.locator('[data-inspector=screen]').click();
  const nextPage=page.context().waitForEvent('page');await page.locator('#set-up-display').click();const setup=await nextPage;
  await setup.waitForURL(/device=embedded/);await setup.locator('.device-embedded:visible').waitFor();
  assert.equal(await setup.locator('.device-browser:visible').count(),0);
  assert.match(await setup.locator('.device-embedded:visible').textContent(),/connection key/);
  const picker=setup.locator('[data-screen="desk-display"] [data-device-kind]');
  await picker.selectOption('cast');await setup.locator('[data-screen="desk-display"] [data-discover]').waitFor();
  assert.equal(await setup.locator('.device-embedded:visible').count(),0);assert.equal(await setup.locator('.device-browser:visible').count(),0);
  await picker.selectOption('embedded');await setup.getByRole('link',{name:'Manage displays'}).click();
  await setup.waitForURL(origin+'/admin/devices');await setup.locator('#first-device').waitFor();
  assert.deepEqual(errors,[]);
});
