import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../../../src/server.js';

const enabled=process.env.CASTBOARD_BROWSER_TESTS==='1';
test('compact forecasts keep every hour and day reachable with taps, including Studio preview', {skip:!enabled,timeout:60000},async t=>{
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-compact-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},plugins:{weather:{enabled:true,provider:'demo'},vehicle:{enabled:true,provider:'demo'}},screens:{home:{path:'/',title:'Weather',type:'single',panels:[{id:'weather',plugin:'weather',interaction:{type:'modal',screenId:'forecast'}}]},forecast:{path:'/forecast',title:'Forecast',type:'single',presentation:'modal',layout:{padding:4},appearance:{panelPadding:6},panels:[{id:'forecast',plugin:'weather',options:{view:'forecast',hours:12,days:7}}]},vehicle:{path:'/vehicle',title:'Vehicle',type:'single',panels:[{id:'vehicle',plugin:'vehicle',options:{showRange:true}}]}}};
  config.screens.overview={...config.screens.forecast,path:'/overview',panels:[{id:'forecast',plugin:'weather',options:{view:'forecast',forecastLayout:'overview'}}]};
  config.screens['overview-home']={...config.screens.home,path:'/overview-home',panels:[{id:'weather',plugin:'weather',interaction:{type:'modal',screenId:'overview'}}]};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.close();app.server.closeAllConnections();await app.dispose();});
  const origin=`http://127.0.0.1:${app.server.address().port}`,page=await browser.newPage({viewport:{width:320,height:240}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const capture=async name=>{if(!process.env.CASTBOARD_CAPTURE_DIR)return;await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,name+'.png'),animations:'disabled'});};
  await page.goto(origin);await page.locator('.weather-temp').waitFor();await page.locator('.panel-interaction').click();await page.locator('dialog .weather-pagination').waitFor();await capture('weather-320-current');
  const seen=new Set(),bounds=[];
  for(let n=0;n<40;n++){
    assert.match(await page.locator('dialog .widget-head small').textContent(),/Sample/);
    for(const time of await page.locator('dialog [data-forecast-time]').evaluateAll(nodes=>nodes.map(node=>node.dataset.forecastTime)))seen.add(time);
    bounds.push(...await page.locator('dialog [data-forecast-time], dialog button, dialog .weather-main, dialog .weather-detail').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),content=node.closest('.weather-content')?.getBoundingClientRect();return {text:node.textContent,visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&(!content||r.top>=content.top-1&&r.bottom<=content.bottom+1)};})));
    if(n===1)await capture('weather-320-hours');
    if(await page.locator('dialog .widget-head small').textContent().then(text=>text.startsWith('Days')))await capture('weather-320-days');
    const next=page.locator('dialog [data-weather-step="1"]');if(await next.isDisabled())break;await next.click();
  }
  assert.equal(seen.size,19);assert.deepEqual(bounds.filter(item=>!item.visible),[]);
  await page.locator('dialog [data-weather-step="-1"]').click();assert.equal(await page.locator('dialog [data-weather-step="1"]').isDisabled(),false);
  await page.locator('dialog .screen-modal-header button').click();assert.equal(await page.locator('dialog[open]').count(),0);
  for(const viewport of [{width:320,height:240},{width:390,height:844},{width:1440,height:960}]){
    await page.setViewportSize(viewport);await page.goto(origin+'/vehicle');await page.locator('.vehicle-status').waitFor();await capture('vehicle-'+viewport.width);
    assert.match(await page.locator('.vehicle-widget').textContent(),/72%.*Battery.*Charging.*4.8 kW.*286 km range/s);
    assert.equal(await page.locator('.vehicle-widget').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),true);
    await page.goto(origin+'/forecast');await page.locator('.weather-temp').waitFor();await capture('weather-'+viewport.width);
    if(viewport.height<500)assert.equal(await page.locator('.weather-widget').getAttribute('data-weather-paged'),'true');
  }
  // The overview fits all 24 hours and all seven days in exactly two pages.
  for(const viewport of [{width:320,height:240},{width:390,height:844},{width:1440,height:960}]){
    await page.setViewportSize(viewport);await page.goto(origin+'/overview-home');await page.locator('.panel-interaction').click();
    await page.locator('dialog .weather-hour-chart').waitFor();
    assert.equal(await page.locator('dialog [data-forecast-time]').count(),24);
    assert.equal(await page.locator('dialog [data-weather-page]').count(),2);
    await capture('weather-overview-hours-'+viewport.width);
    for(const tab of ['1','0']){
      await page.locator(`dialog [data-weather-page="${tab}"]`).click();
      assert.equal(await page.locator('dialog [data-forecast-time]').count(),tab==='1'?7:24);
      if(tab==='1')await capture('weather-overview-days-'+viewport.width);
      assert.equal(await page.locator('dialog .weather-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),true);
      assert.equal(await page.locator('dialog .weather-content').evaluate(el=>{const p=el.getBoundingClientRect();return [...el.querySelectorAll('time,strong,small,.weather-day-icon,.weather-low,.weather-chart-summary')].every(node=>{const r=node.getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1&&r.left>=p.left-1&&r.right<=p.right+1;});}),true);
      assert.equal(await page.locator(`dialog [data-weather-page="${tab}"]`).evaluate(el=>el.getBoundingClientRect().height>=44),true);

    }
    await page.locator('dialog .screen-modal-header button').click();assert.equal(await page.locator('dialog[open]').count(),0);
  }
  // Local pagination is allowed in Studio while provider actions stay blocked.
  await page.goto(origin+'/admin');await page.locator('[data-mode="preview"]').click();const frame=page.frameLocator('#live-preview');await frame.locator('.panel-interaction').click();await frame.locator('dialog [data-weather-step="1"]').click();assert.ok(await frame.locator('dialog [data-forecast-time]').count()>0);
  await page.route('**/api/runtime-config',async route=>{const response=await route.fetch();const body=await response.json();body.screens.vehicle.panels[0].options.label='Test vehicle label';await route.fulfill({response,json:body});});
  await page.goto(origin+'/vehicle');await page.locator('.vehicle-status').waitFor();assert.match(await page.locator('.vehicle-widget .widget-head').textContent(),/Test vehicle label · Sample/);
  assert.deepEqual(errors,[]);
});
