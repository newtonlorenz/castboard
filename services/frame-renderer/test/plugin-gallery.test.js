import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {createApp} from '../../../src/server.js';
import {pluginLibrary,changePluginConfig} from '../../../src/core/plugin-admin.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
test('every bundled display installs with dependencies and mounts using sample data',{skip:process.env.CASTBOARD_BROWSER_TESTS!=='1',timeout:180000},async t=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-gallery-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 let config={server:{host:'127.0.0.1',port:8787},branding:{name:'Sample displays',timeZone:'UTC'},plugins:{},defaultScreen:'home',screens:{home:{path:'/',title:'Home',type:'single',panels:[]}}};
 const catalog=await pluginLibrary({pluginsDir:path.join(root,'plugins'),config,configDir:dir});
 for(const pkg of catalog.filter(pkg=>pkg.hasWidget)){
  if(!config.plugins[pkg.id])config=changePluginConfig(config,catalog,{action:'install',type:pkg.id,id:pkg.id});
  config.screens[pkg.id]={path:'/gallery/'+pkg.id,title:pkg.name,type:'single',panels:[{id:pkg.id,plugin:pkg.id}]};
 }
 config.screens.home.panels=[{id:'clock',plugin:'clock'}];
 const file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(config));const app=await createApp({configPath:file});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const origin=`http://127.0.0.1:${app.server.address().port}`;
 for(const viewport of [{width:320,height:240},{width:390,height:844},{width:1440,height:960}]){
  await page.setViewportSize(viewport);
  for(const pkg of catalog.filter(pkg=>pkg.hasWidget)){
   await page.goto(origin+'/gallery/'+pkg.id);await page.waitForFunction(()=>[...document.querySelectorAll('.widget')].some(el => (el.shadowRoot?.textContent || el.textContent).trim().length > 0),{},{timeout:10000});
   await page.waitForTimeout(180);
   const text=await page.locator('.widget').evaluate(el=>(el.shadowRoot?.querySelector('.module-root') || el).innerText);
   assert.equal(await page.locator('.widget').getAttribute('data-mounted'),'true',pkg.id+' '+text);
   assert.doesNotMatch(text,/Plugin could not load|Cannot read properties|is not defined/,pkg.id);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,pkg.id+' '+viewport.width);
   if(pkg.id==='ambient-clock')assert.match(text,/\d{2}:\d{2}/);
   if(pkg.id==='ambient-weather')assert.match(text,/22°C/);
   if(pkg.id==='ambient-portfolio')assert.match(text,/ACME/);
   if(pkg.id==='noticeboard')assert.match(text,/Welcome · Sample/);
   if(pkg.id==='countdown')assert.match(text,/remaining/);
   if(process.env.CASTBOARD_CAPTURE_DIR && ['noticeboard','countdown','ambient-news','ambient-calendar','ambient-portfolio'].includes(pkg.id)){
    await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,pkg.id+'-'+viewport.width+'.png'),animations:'disabled'});
   }
   assert.deepEqual(errors,[],pkg.id+' '+viewport.width);
  }
 }
 // The admin form preserves dates with explicit zones and offers a multiline message editor.
 await page.goto(origin+'/admin/plugins?plugin=countdown');await page.locator('#setting-provider').waitFor();await page.locator('#setting-provider').selectOption('inline');
 assert.equal(await page.locator('#setting-target').getAttribute('type'),'datetime-local');assert.equal(await page.locator('#setting-description').evaluate(el=>el.tagName),'TEXTAREA');
 await page.locator('#setting-target').fill('2030-12-25T09:00');await page.locator('#setting-eventTitle').fill('Community gathering');await page.locator('#save-plugin').click();await page.waitForFunction(()=>document.querySelector('#plugin-save-state').textContent==='All changes saved');
 assert.match(JSON.parse(await fs.readFile(file)).plugins.countdown.target,/Z$/);
 await page.goto(origin+'/admin/plugins?plugin=noticeboard');await page.locator('#setting-provider').waitFor();await page.locator('#setting-provider').selectOption('inline');await page.getByRole('button',{name:'Add notice',exact:true}).click();
 await page.locator('#record-notices-0-title').fill('Welcome');await page.locator('#record-notices-0-body').fill('Long instructions\nSecond line <script>alert(1)</script>');assert.equal(await page.locator('#record-notices-0-body').evaluate(el=>el.tagName),'TEXTAREA');
 await page.locator('#save-plugin').click();await page.waitForFunction(()=>document.querySelector('#plugin-save-state').textContent==='All changes saved');await page.goto(origin+'/gallery/noticeboard');await page.locator('.notice-body').waitFor();assert.match(await page.locator('.notice-body').textContent(),/<script>/);assert.equal(await page.locator('.notice-body script').count(),0);
 // External calendar labels are displayed as text, including HTML-like input.
 await page.route('**/api/plugins/ambient-calendar-source/data*',route=>route.fulfill({json:{ok:true,data:{events:[{title:'Visitor briefing',start:'00:00',end:'23:59',source:'<b>External calendar</b>'}]}}}));
 await page.goto(origin+'/gallery/ambient-calendar');await page.locator('.cal-event-src').waitFor();assert.equal(await page.locator('.cal-event-src').textContent(),'<b>External calendar</b>');assert.equal(await page.locator('.cal-event-src b').count(),0);
 // A list click opens the full story, which remains open during refresh and rotation.
 await page.route('**/api/runtime-config',async route=>{const response=await route.fetch(),body=await response.json();body.screens.news.panels[0].options={view:'list',refreshSeconds:1,rotationSeconds:1};await route.fulfill({response,json:body});});
 await page.goto(origin+'/gallery/news');await page.locator('[data-read="0"]').waitFor();await page.locator('[data-read="0"]').click();await page.waitForTimeout(1200);assert.equal(await page.locator('dialog.reader-dialog').evaluate(el=>el.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.reader-dialog').evaluate(el=>el.open),false);
 await page.goto(origin+'/setup');await page.locator('body').waitFor();await page.goto(origin+'/admin');await page.locator('body').waitFor();await page.goto(origin+'/admin/displays');await page.locator('body').waitFor();assert.deepEqual(errors,[]);
});
