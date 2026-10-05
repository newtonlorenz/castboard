import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createApp} from '../../../src/server.js';
import {pluginLibrary,changePluginConfig} from '../../../src/core/plugin-admin.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
test('News Reader source controls save structured feeds and display controls reach the screen',{skip:process.env.CASTBOARD_BROWSER_TESTS!=='1',timeout:60000},async t=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-plugin-settings-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 let config={server:{host:'127.0.0.1',port:8787},branding:{name:'Test',timeZone:'UTC'},plugins:{},defaultScreen:'home',screens:{home:{path:'/',title:'News',type:'single',panels:[]}}};
 const catalog=await pluginLibrary({pluginsDir:path.join(root,'plugins'),config,configDir:dir});config=changePluginConfig(config,catalog,{action:'install',type:'ambient-news',id:'reader'});config.screens.home.panels=[{id:'reader',plugin:'reader'}];
 const file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(config));const app=await createApp({configPath:file});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const origin=`http://127.0.0.1:${app.server.address().port}`;
 await page.goto(origin+'/');await page.locator('.lead-title').waitFor();await page.locator('[data-category="Design desk"]').click();assert.match(await page.locator('.lead-title').textContent(),/Weather, energy/);
 await page.goto(origin+'/admin/plugins?plugin=reader');await page.locator('#setting-provider').waitFor();assert.equal(await page.locator('.detail-heading h2').textContent(),'News Reader');
 assert.deepEqual(await page.locator('.plugin-settings-group:not([hidden])>h4').allTextContents(),['General','Data source','Content','Display','Updates']);
 await page.locator('#setting-provider').selectOption('rss');await page.getByRole('button',{name:'Add feed',exact:true}).click();await page.locator('#record-feeds-0-name').fill('Community');await page.locator('#record-feeds-0-url').fill('https://example.test/community.xml');await page.locator('#record-feeds-0-category').fill('Local');await page.locator('#record-feeds-0-enabled').uncheck();await page.locator('#setting-useDefaultFeeds').uncheck();await page.locator('#setting-displayName').fill('Lobby briefings');await page.locator('#setting-includeKeywords').fill('community\nworkshop');await page.locator('#save-plugin').click();await page.waitForFunction(()=>document.querySelector('#plugin-save-state').textContent==='All changes saved' && document.querySelector('#save-plugin').disabled);
 const saved=JSON.parse(await fs.readFile(file));assert.deepEqual(saved.plugins.reader.feeds,[{enabled:false,name:'Community',url:'https://example.test/community.xml',category:'Local'}]);assert.deepEqual(saved.plugins.reader.includeKeywords,['community','workshop']);assert.equal(saved.plugins.reader.displayName,'Lobby briefings');
 await page.goto(origin+'/');await page.locator('#lead-content').filter({hasText:'No stories match these source and content settings.'}).waitFor();assert.doesNotMatch(await page.locator('#lead-content').textContent(),/Loading/);await page.goto(origin+'/admin/plugins?plugin=reader');await page.locator('#setting-provider').waitFor();
 await page.locator('#setting-provider').selectOption('demo');await page.locator('#setting-includeKeywords').fill('');await page.locator('#setting-autoRotate').uncheck();await page.locator('#setting-showSummary').uncheck();await page.locator('#setting-showHeadlines').uncheck();await page.locator('#setting-showTicker').uncheck();await page.locator('#setting-showCategories').uncheck();await page.locator('#save-plugin').click();await page.waitForFunction(()=>document.querySelector('#plugin-save-state').textContent==='All changes saved' && document.querySelector('#save-plugin').disabled);
 for(const width of [1440,390]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.goto(origin+'/');await page.locator('.lead-title').waitFor();assert.match(await page.locator('.lead-title').textContent(),/command centre/);assert.equal(await page.locator('.lead-deck').textContent(),'');assert.equal(await page.locator('#story-play').getAttribute('aria-label'),'Resume rotation');assert.equal(await page.locator('.wire').isVisible(),false);assert.equal(await page.locator('.ticker').isVisible(),false);assert.equal(await page.locator('#category-bar').isVisible(),false);
 await page.locator('#story-read').click();await page.locator('#reader-overlay[open]').waitFor();await page.locator('#reader-close').click();assert.equal(await page.locator('#reader-overlay[open]').count(),0);
 assert.deepEqual(errors,[]);
});
