import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {createApp} from '../../../src/server.js';
import {deviceTokenHash} from '../../../src/core/devices.js';
const enabled=process.env.CASTBOARD_BROWSER_TESTS==='1';

test('camera snapshots, live stream, manual refresh and native images retain scope and recover from failure',{skip:!enabled,timeout:60000},async t=>{
  const {chromium}=await import('playwright'),{default:sharp}=await import('sharp'),{renderNativeImage}=await import('../images.js');
  const browser=await chromium.launch({headless:true,...(process.env.CASTBOARD_CHROMIUM_PATH?{executablePath:process.env.CASTBOARD_CHROMIUM_PATH}:{})});t.after(()=>browser.close());
  const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});return `http://127.0.0.1:${server.address().port}`;};
  const png=await sharp({create:{width:320,height:180,channels:3,background:'#d84432'}}).png().toBuffer(),jpeg=await sharp(png).jpeg().toBuffer();
  let offline=false,snapshots=0,streams=0;
  const upstream=await listen(http.createServer((req,res)=>{
    if(offline){res.writeHead(503);res.end();return;}
    if(req.url.startsWith('/snapshot')){snapshots++;res.writeHead(200,{'Content-Type':'image/png'});res.end(png);return;}
    streams++;res.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary=frame'});
    const frame=()=>res.write(Buffer.concat([Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`),jpeg,Buffer.from('\r\n')]));frame();const timer=setInterval(frame,250);timer.unref();req.once('close',()=>{clearInterval(timer);streams--;});
  }));
  let origin,corrupt=false;
  const worker=await listen(http.createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;const frame=await renderNativeImage(JSON.parse(body),origin);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':corrupt?3:frame.buffer.length,'X-Frame-Id':frame.frameId,'X-Frame-Format':'rgb565'});res.end(corrupt?Buffer.alloc(3):frame.buffer);}catch{res.writeHead(503);res.end();}}));
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-camera-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const key='test-camera-device-key-with-32-characters';
  const config={server:{host:'127.0.0.1',port:8787},branding:{timeZone:'UTC'},embedded:{rendererUrl:worker,rendererToken:'test-private-renderer-token-at-least-32'},plugins:{clock:{enabled:true},camera:{enabled:true,provider:'stream',name:'Test camera',streamUrl:upstream+'/mjpeg',snapshotUrl:upstream+'/snapshot',displayMode:'snapshot',refreshSeconds:300}},screens:{home:{path:'/',type:'single',panels:[{id:'clock',plugin:'clock',interaction:{type:'modal',screenId:'camera'}}]},camera:{path:'/camera',type:'single',title:'Test camera',presentation:'modal',layout:{padding:4},appearance:{panelPadding:6},panels:[{id:'camera',plugin:'camera',options:{showTitle:false,fit:'contain'}}]},stream:{path:'/stream',type:'single',panels:[{id:'stream',plugin:'camera',options:{displayMode:'stream'}}]}},devices:{native:{name:'Test display',screenId:'home',mode:'native',width:320,height:240,format:'rgb565',refreshMs:3000,enabled:true,touch:true,allowActions:false,tokenHash:deviceTokenHash(key)}}};
  config.devices.image={...config.devices.native,mode:'frame'};
  const configPath=path.join(dir,'config.json');await fs.writeFile(configPath,JSON.stringify(config));const app=await createApp({configPath});origin=await listen(app.server);t.after(()=>app.dispose());
  const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const home=await(await fetch(origin+'/api/devices/native/scene',{headers})).json();
  const opened=await(await fetch(origin+'/api/devices/native/events',{method:'POST',headers,body:JSON.stringify({sceneId:home.sceneId,event:'panel:clock',eventId:'camera001'})})).json();
  assert.equal(opened.modal,true);assert.ok(opened.panels[0].image);assert.equal(JSON.stringify(opened).includes(upstream),false);
  const imageUrl=origin+'/api/devices/native'+opened.panels[0].image.path;
  let response=await fetch(imageUrl,{headers});assert.equal(response.status,200);let bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,opened.panels[0].image.width*opened.panels[0].image.height*2);
  const size=opened.panels[0].image;assert.equal(bytes.readUInt16LE((Math.floor(size.height/2)*size.width+Math.floor(size.width/2))*2),((0xd8&0xf8)<<8)|((0x44&0xfc)<<3)|(0x32>>3));
  assert.equal((await fetch(imageUrl,{headers:{Authorization:'Bearer wrong'}})).status,401);
  assert.equal((await fetch(imageUrl.replace('/images/0','/images/1'),{headers})).status,403);
  assert.equal((await fetch(imageUrl.replace(opened.sceneId,'stale'),{headers})).status,409);
  corrupt=true;assert.equal((await fetch(imageUrl,{headers})).status,503);corrupt=false;
  const refresh=await fetch(origin+'/api/devices/native/events',{method:'POST',headers,body:JSON.stringify({sceneId:opened.sceneId,event:opened.panels[0].controls[0].event,eventId:'refresh001'})});assert.equal(refresh.status,200);
  const {createFrameRenderer}=await import('../renderer.js');
  const renderer=createFrameRenderer({browser,appOrigin:origin});t.after(()=>renderer.dispose());
  const frameInput={id:'image',token:key,width:320,height:240,format:'rgb565',revision:'camera-test'};
  const start=await renderer.render(frameInput);
  let frame=await renderer.render({...frameInput,event:{frameId:start.frameId,eventId:'image-open-001',x:80,y:80}});
  const red=((0xd8&0xf8)<<8)|((0x44&0xfc)<<3)|(0x32>>3);
  const redPixels=buffer=>{let count=0;for(let i=0;i<buffer.length;i+=2)if(buffer.readUInt16LE(i)===red)count++;return count;};
  for(let n=0;n<10 && redPixels(frame.buffer)<1000;n++){await new Promise(resolve=>setTimeout(resolve,50));frame=await renderer.render(frameInput);}
  assert.ok(redPixels(frame.buffer)>1000,'image receiver must contain decoded camera pixels');
  const imageSnapshots=snapshots;
  frame=await renderer.render({...frameInput,event:{frameId:frame.frameId,eventId:'image-refresh-001',x:255,y:205}});
  assert.ok(snapshots>imageSnapshots,'image receiver Refresh must fetch a replacement');
  await renderer.render({...frameInput,event:{frameId:frame.frameId,eventId:'image-close-001',x:270,y:35}});
  await renderer.dispose();
  const page=await browser.newPage({viewport:{width:320,height:240}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const capture=async name=>{if(!process.env.CASTBOARD_CAPTURE_DIR)return;await fs.mkdir(process.env.CASTBOARD_CAPTURE_DIR,{recursive:true});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:path.join(process.env.CASTBOARD_CAPTURE_DIR,name+'.png'),animations:'disabled'});};
  await page.goto(origin);await page.locator('.panel-interaction').click();await page.waitForFunction(()=>document.querySelector('dialog .camera-status')?.textContent.startsWith('Updated'));await capture('camera-modal-320');
  const before=snapshots;await page.locator('dialog [data-camera-refresh]').click();await page.waitForFunction(()=>document.querySelector('dialog .camera-status')?.textContent.startsWith('Updated'));assert.ok(snapshots>before);
  const prior=await page.locator('dialog .camera-frame').getAttribute('src');offline=true;await page.locator('dialog [data-camera-refresh]').click();await page.waitForFunction(()=>document.querySelector('dialog .camera-status')?.textContent==='Showing previous image');assert.equal(await page.locator('dialog .camera-frame').getAttribute('src'),prior);await capture('camera-failed-320');
  offline=false;await page.locator('dialog [data-camera-refresh]').click();await page.waitForFunction(()=>document.querySelector('dialog .camera-status')?.textContent.startsWith('Updated'));
  assert.equal(await page.locator('dialog [data-camera-refresh]').evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.bottom<=innerHeight&&r.right<=innerWidth;}),true);
  await page.locator('.screen-modal-header button').click();assert.equal(await page.locator('dialog[open]').count(),0);
  for(const viewport of [{width:390,height:844},{width:1440,height:960}]){await page.setViewportSize(viewport);await page.goto(origin+'/camera');await page.waitForFunction(()=>document.querySelector('.camera-status')?.textContent.startsWith('Updated'));await capture('camera-'+viewport.width);assert.equal(await page.locator('.camera-widget').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);}
  await page.setViewportSize({width:320,height:240});await page.goto(origin+'/stream');await page.waitForFunction(()=>document.querySelector('.camera-status')?.textContent==='Stream');assert.ok(streams>0);await capture('camera-stream-320');await page.goto(origin);for(let n=0;n<20 && streams;n++)await new Promise(resolve=>setTimeout(resolve,50));assert.equal(streams,0);
  assert.deepEqual(errors,[]);
});
