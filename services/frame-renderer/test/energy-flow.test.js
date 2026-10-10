import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../../../src/server.js';

test('compact power flow stays readable at 320 × 240 across supply, consumption and idle states', {skip:process.env.CASTBOARD_BROWSER_TESTS!=='1',timeout:60000}, async t=>{
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-energy-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const config={server:{host:'127.0.0.1',port:8787},plugins:{solar:{provider:'demo'},vehicle:{provider:'demo'}},screens:{home:{path:'/',title:'Energy',type:'grid',viewport:{width:320,height:240},layout:{columns:12,rows:12,gap:2,padding:4},appearance:{panelPadding:4,fontScale:100,panelBackground:'#171b22',mutedColor:'#aeb8c5'},panels:[{id:'solar',plugin:'solar',options:{compact:true,loadLabel:'Home load'},position:{column:1,row:4,width:4,height:5},appearance:{fontScale:80}},{id:'vehicle',plugin:'vehicle',options:{compact:true},position:{column:1,row:9,width:4,height:2},appearance:{fontScale:80}}]}}};
  const configPath=path.join(directory,'config.json');await fs.writeFile(configPath,JSON.stringify(config));
  const app=await createApp({configPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.close();app.server.closeAllConnections();await app.dispose();});
  const page=await browser.newPage({viewport:{width:320,height:240}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let solar,vehicle;
  await page.route('**/api/plugins/solar/data',route=>route.fulfill({json:{ok:true,data:solar}}));
  await page.route('**/api/plugins/vehicle/data',route=>route.fulfill({json:{ok:true,data:vehicle}}));
  for(const fixture of [
    {solar:{generatedKw:5,loadKw:2,gridImportKw:0,gridExportKw:3},vehicle:{batteryPercent:75,chargingKw:7.2},states:['supply','demand','supply'],label:'Grid out',car:'demand'},
    {solar:{generatedKw:.3,loadKw:2,gridImportKw:1.7,gridExportKw:0},vehicle:{batteryPercent:75,chargingKw:0},states:['supply','demand','demand'],label:'Grid in',car:'idle'},
    {solar:{generatedKw:0,loadKw:0,gridImportKw:0,gridExportKw:0},vehicle:{batteryPercent:0,chargingKw:null},states:['idle','idle','idle'],label:'Grid idle',car:'idle'},
    {solar:{generatedKw:null,loadKw:null,gridImportKw:null,gridExportKw:null},vehicle:{batteryPercent:null,chargingKw:null},states:['idle','idle','idle'],label:'Grid unknown',car:'idle'},
  ]) {
    solar=fixture.solar;vehicle=fixture.vehicle;
    await page.goto(`http://127.0.0.1:${app.server.address().port}`);await page.locator('.vehicle-power').waitFor();
    assert.deepEqual(await page.locator('.solar-metric').evaluateAll(nodes=>nodes.map(n=>n.dataset.energy)),fixture.states);
    assert.match(await page.locator('.solar-metrics').textContent(),new RegExp(fixture.label));
    assert.equal(await page.locator('.vehicle-power').getAttribute('data-energy'),fixture.car);
    if(fixture.car==='demand')assert.match(await page.locator('.vehicle-power').getAttribute('title'),/draws power from home/);
    const overflow=await page.locator('.solar-metric,.vehicle-summary').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.textContent));
    assert.deepEqual(overflow,[]);
    assert.equal(await page.locator('.widget-solar').evaluate(node=>node.scrollHeight<=node.clientHeight+1),true);
    assert.equal(await page.locator('.vehicle-widget').evaluate(node=>node.scrollHeight<=node.clientHeight+1),true);
    assert.equal(await page.locator('.solar-metric svg').count(),3);
  }
  assert.deepEqual(errors,[]);
});
