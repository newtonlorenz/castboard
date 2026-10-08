// Public screenshots always come from the real app and bundled demo content.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createApp } from '../src/server.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(new URL('../services/frame-renderer/package.json',import.meta.url));
const {chromium}=require('playwright');
const sharp=require('sharp');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-public-preview-'));
let app,browser;
try {
  const config=JSON.parse(await fs.readFile(path.join(root,'castboard.config.example.json'),'utf8'));
  config.server.host='127.0.0.1';
  // Use the shipped demo provider instead of external feeds. Never read a deployment config.
  config.plugins.news={enabled:true,provider:'demo'};
  const configPath=path.join(directory,'config.json');
  await fs.writeFile(configPath,JSON.stringify(config));
  app=await createApp({configPath});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const assets=path.join(root,'public/assets');
  const capture=async(name,format) => {
    await page.evaluate(async()=>{await document.fonts.ready;});
    const buffer=await page.screenshot({fullPage:false,animations:'disabled'});
    if(format==='webp')await sharp(buffer).webp({quality:92}).toFile(path.join(assets,name));
    else if(format==='jpeg')await sharp(buffer).jpeg({quality:92}).toFile(path.join(assets,name));
    else await fs.writeFile(path.join(assets,name),buffer);
  };
  await page.goto(origin+'/');
  await page.waitForFunction(()=>document.querySelectorAll('.widget').length===10 && [...document.querySelectorAll('.widget')].every(el=>el.dataset.mounted==='true'));
  await capture('castboard-hero.webp','webp');
  await capture('castboard-home.jpg','jpeg');
  await page.goto(origin+'/screens/office');
  await page.waitForFunction(()=>document.querySelector('.widget')?.dataset.mounted==='true');
  await capture('castboard-market-wire.jpg','jpeg');
  await page.setViewportSize({width:1440,height:960});
  await page.goto(origin+'/admin?screen=home&panel=weather');
  await page.locator('#quick-screen option[value=home]').waitFor({state:'attached'});
  await page.locator('#design-surface .canvas-panel').first().waitFor();
  await capture('castboard-studio.png','png');
  await capture('castboard-studio.jpg','jpeg');
  await page.goto(origin+'/admin/plugins?plugin=news');
  await page.locator('#setting-provider').waitFor();
  await capture('castboard-plugins.png','png');
  if(errors.length)throw new Error('Preview errors: '+errors.join('; '));
  console.log('Captured Home, Market Wire, Dashboard Studio and Plugins from the bundled demo configuration.');
} finally {
  await browser?.close();
  if(app){app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();}
  await fs.rm(directory,{recursive:true,force:true});
}
