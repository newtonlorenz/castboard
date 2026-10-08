import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {fetchSnapshot} from '../plugins/camera/snapshot.js';
import {createPlugin} from '../plugins/camera/plugin.js';

async function serve(t,handler){const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});return `http://127.0.0.1:${server.address().port}`;}
const jpeg=Buffer.from([255,216,0,1,2,255,217]);
test('camera extracts one MJPEG part across chunk boundaries and closes the stream',{timeout:2000},async t=>{
  let closed;
  const url=await serve(t,(req,res)=>{res.setHeader('Content-Type','multipart/x-mixed-replace; boundary=frame');closed=new Promise(resolve=>req.once('close',resolve));req.on('error',()=>{});res.write('--fra');setTimeout(()=>res.write(Buffer.concat([Buffer.from('me\r\nContent-Type: image/jpeg\r\nContent-Length: '+jpeg.length+'\r\n\r\n'),jpeg])),5);});
  const result=await fetchSnapshot(url);assert.deepEqual(result.data,jpeg);assert.equal(result.contentType,'image/jpeg');
  await closed;
});
test('camera supports snapshots and multipart boundaries without Content-Length',async t=>{
  const url=await serve(t,(req,res)=>{if(req.url==='/image'){res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(jpeg);return;}res.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary="frame"'});res.end(Buffer.concat([Buffer.from('--frame\r\nContent-Type: image/jpeg\r\n\r\n'),jpeg,Buffer.from('\r\n--frame\r\n')]));});
  assert.deepEqual((await fetchSnapshot(url+'/image')).data,jpeg);assert.deepEqual((await fetchSnapshot(url+'/mjpeg')).data,jpeg);
});
test('snapshot errors are bounded and do not disclose upstream responses',async t=>{
  const url=await serve(t,(req,res)=>{if(req.url==='/large'){res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(Buffer.alloc(2*1024*1024+1));}else if(req.url==='/hang'){res.writeHead(200,{'Content-Type':'image/jpeg'});res.write(jpeg);}else{res.writeHead(401,{'Content-Type':'text/plain'});res.end('private camera detail');}});
  for(const route of ['/large','/hang','/private'])await assert.rejects(fetchSnapshot(url+route,{timeoutMs:30}),error=>error.message==='Camera snapshot unavailable');
});
test('Home Assistant camera uses authenticated proxy routes without publishing credentials',async t=>{
  const requests=[];
  const base=await serve(t,(req,res)=>{requests.push({path:req.url,auth:req.headers.authorization});res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(jpeg);});
  const camera=createPlugin({config:{provider:'home-assistant',baseUrl:base,token:'private-test-token',entity:'camera.test'},context:{instanceId:'entrance'}});
  const proxy=await serve(t,(req,res)=>camera.stream(req,res));
  assert.deepEqual(Buffer.from(await(await fetch(proxy+'/?mode=snapshot')).arrayBuffer()),jpeg);
  assert.equal(requests[0].path,'/api/camera_proxy/camera.test');assert.equal(requests[0].auth,'Bearer private-test-token');
  assert.equal(JSON.stringify({...camera.publicConfig(),...await camera.getData()}).includes('private-test-token'),false);
  const view=camera.nativeView({data:await camera.getData(),options:{}});assert.equal(view.controls[0].type,'refresh');assert.equal(view.image.params.mode,'snapshot');
});

test('MJPEG boundary tokens can include their own leading hyphens',async t=>{
  for(const marker of ['----frame','--frame']){
    const url=await serve(t,(req,res)=>{res.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary="--frame"'});res.end(Buffer.concat([Buffer.from(marker+'\r\nContent-Type: image/jpeg\r\n\r\n'),jpeg,Buffer.from('\r\n'+marker+'--\r\n')]));});
    assert.deepEqual((await fetchSnapshot(url)).data,jpeg);
  }
});
test('camera-service stream templates preserve the configured base path',async t=>{
  const routes=[];
  const base=await serve(t,(req,res)=>{routes.push(req.url);if(req.url==='/bridge/api/cameras'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({cameras:[{id:'front door',name:'Front'}]}));return;}res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(jpeg);});
  const camera=createPlugin({config:{provider:'camera-service',baseUrl:base+'/bridge'},context:{}});
  const proxy=await serve(t,(req,res)=>camera.stream(req,res));
  assert.deepEqual(Buffer.from(await(await fetch(proxy+'/?mode=snapshot')).arrayBuffer()),jpeg);
  assert.deepEqual(routes,['/bridge/api/cameras','/bridge/api/cameras/front%20door/mjpeg']);
});

test('camera-service metadata outages preserve the last selected image source',async t=>{
  let missing=false,cameraId='front';
  const base=await serve(t,(req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({cameras:missing?[]:[{id:cameraId,name:'Camera'}]}));});
  const camera=createPlugin({config:{provider:'camera-service',baseUrl:base},context:{}});
  const before=camera.nativeView({data:await camera.getData(),options:{}});missing=true;
  const stale=await camera.getData();assert.equal(stale.status,'Metadata unavailable');
  assert.equal(camera.nativeView({data:stale,options:{}}).image.key,before.image.key);
  missing=false;cameraId='side';
  assert.notEqual(camera.nativeView({data:await camera.getData(),options:{}}).image.key,before.image.key);
});
