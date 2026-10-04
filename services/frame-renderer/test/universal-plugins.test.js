import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {once} from 'node:events';
import {createApp} from '../../../src/server.js';
const ids=['weather','calendar','noticeboard','clock','news','metrics','status-board','menu','image-slideshow','web-page'];
test('universal panels adapt, rotate without refresh starvation and keep readers in control',{skip:process.env.CASTBOARD_BROWSER_TESTS!=='1',timeout:120000},async t=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch();t.after(()=>browser.close());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-universal-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const remote=http.createServer((req,res)=>{if(req.url==='/slide.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="green"/></svg>');}if(req.url==='/missing.svg'){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>External sample page</h1><script>document.body.dataset.executed="yes";try{parent.document.body.dataset.leaked="true"}catch{document.body.dataset.isolated="yes"}</script>');});remote.listen(0,'127.0.0.1');await once(remote,'listening');t.after(()=>new Promise(resolve=>remote.close(resolve)));const remoteOrigin='http://127.0.0.1:'+remote.address().port;
 const config={server:{host:'127.0.0.1',port:8787},branding:{name:'Sample panels',timeZone:'UTC'},defaultScreen:'clock',plugins:{},screens:{}};
 for(const id of ids){config.plugins[id]={enabled:true,provider:'demo'};config.screens[id]={path:'/'+id,type:'single',panels:[{id,plugin:id}]};}
 config.screens.weather.panels[0].options={view:'forecast',forecastLayout:'overview',autoRotate:true,rotationSeconds:5};
 config.screens.calendar.panels[0].options={eventsPerPage:1,autoRotate:true,rotationSeconds:5,refreshSeconds:15};
 config.screens.clock.panels[0].options={additionalClocks:[{label:'Tokyo',timeZone:'Asia/Tokyo'},{label:'London',timeZone:'Europe/London'}]};
 config.screens.news.panels[0].options={view:'headline',autoRotate:true,rotationSeconds:5};
 config.plugins['web-page']={enabled:true,url:remoteOrigin,allowScripts:true};config.plugins['image-slideshow']={enabled:true,provider:'inline',images:[{url:remoteOrigin+'/slide.svg',caption:'External image'},{url:remoteOrigin+'/missing.svg',caption:'Missing image'}]};
 const file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(config));const app=await createApp({configPath:file});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));const origin='http://127.0.0.1:'+app.server.address().port;
 for(const size of [{width:320,height:240},{width:390,height:844},{width:1024,height:600},{width:1920,height:1080}]){
  await page.setViewportSize(size);
  for(const id of ids){await page.goto(origin+'/'+id);await page.locator('.widget[data-mounted=true]').waitFor();await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,id+' '+size.width);
   assert.doesNotMatch(await page.locator('.widget').innerText(),/Plugin could not load|is not defined|Invalid/);
   const controls=await page.locator('button:visible').evaluateAll(buttons=>buttons.map(button=>({text:button.textContent,h:button.getBoundingClientRect().height})));assert.ok(controls.every(button=>button.h>=44),id+' '+JSON.stringify(controls));
   if(id==='image-slideshow')assert.equal(await page.locator('img').evaluate(img=>img.complete && img.naturalWidth>0),true);
   if(id==='web-page'){assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');await page.frameLocator('iframe').getByText('External sample page').waitFor();assert.equal(await page.frameLocator('iframe').locator('body').getAttribute('data-isolated'),'yes');assert.equal(await page.locator('body').getAttribute('data-leaked'),null);}
   if(process.env.CASTBOARD_CAPTURE_DIR){await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,'universal-'+id+'-'+size.width+'.png')});}
  }
 }
 await page.goto(origin+'/image-slideshow');await page.locator('[data-step="1"]').click();await page.getByText('Image unavailable. Check its address in Plugins.').waitFor();await page.locator('[data-step="1"]').click();await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth>0);
 const adminPolicy=(await fetch(origin+'/admin')).headers.get('content-security-policy');assert.match(adminPolicy,/frame-src 'self';/);assert.ok(!adminPolicy.includes(remoteOrigin));
 // Upstream requests happen more often than rotation: updates must not postpone it.
 await page.route('**/api/runtime-config',async route=>{const response=await route.fetch(),body=await response.json();body.screens.news.panels[0].options.refreshSeconds=1;body.screens.noticeboard.panels[0].options={rotationSeconds:1,refreshSeconds:1};await route.fulfill({response,json:body});});
 await page.goto(origin+'/news');const first=await page.locator('.news-story strong').textContent();await page.waitForTimeout(5500);assert.notEqual(await page.locator('.news-story strong').textContent(),first);
 await page.goto(origin+'/weather');await page.waitForTimeout(5500);assert.match(await page.locator('.widget').innerText(),/Next 7 days/);
 await page.goto(origin+'/calendar');await page.locator('[data-step="1"]').click();const selected=await page.locator('.calendar-event strong').textContent();assert.notEqual(selected,'Product review');await page.waitForTimeout(5500);assert.equal(await page.locator('.calendar-event strong').textContent(),selected);
 await page.goto(origin+'/noticeboard');await page.locator('[data-step="1"]').click();await page.locator('[data-pause]').click();const notice=await page.locator('.notice-content h2').textContent();await page.waitForTimeout(1500);assert.equal(await page.locator('.notice-content h2').textContent(),notice);
 assert.deepEqual(errors,[]);
});
