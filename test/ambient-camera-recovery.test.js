import test from 'node:test';
import assert from 'node:assert/strict';
import {mount} from '../plugins/ambient-camera/widget.js';

const runtime = 'data:text/javascript,export async function scope(element,context){return context.fixtureScope}';
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
async function fixture(t,{ai=true,discovery=true,preferredId='camera-1',enabled=true,refreshMs=1200}={}) {
  t.mock.timers.enable({apis:['Date'],now:1_000_000});
  const element={dataset:{},classList:{remove(){}},removeAttribute(key){if(key==='data-provider-error')delete this.dataset.providerError;}};
  const nodes=new Map([['outdoor-camera-status',{style:{},textContent:''}],['outdoor-camera-name',{textContent:''}]]);
  class Frame {
    naturalWidth=0;src='';onload=null;onerror=null;
    cloneNode(){return new Frame();}
    removeAttribute(key){if(key==='src'){this.src='';this.naturalWidth=0;}}
    replaceWith(next){nodes.set('outdoor-camera-frame',next);}
  }
  nodes.set('outdoor-camera-frame',new Frame());
  const timers=new Map(),cleanups=[],requests=[];let timerId=0,frameNumber=0;
  const add=(fn,delay,repeat)=>{const id=++timerId;timers.set(id,{fn,delay,repeat});return id;};
  const controls={ai,discovery};const abort=new AbortController();
  const context={app:{branding:{timeZone:'UTC'}},signal:abort.signal,onDispose:fn=>cleanups.push(fn),source(id){
    if(id==='runtime')return {asset:()=>runtime};
    if(id==='config')return {data:async()=>({camera:{name:'Test Camera',preferredId},clearcam:{enabled,cameraName:'Test Camera',refreshMs}})};
    throw new Error('Unexpected source '+id);
  }};
  context.fixtureScope={document:{getElementById:id=>nodes.get(id)},resourceUrl:path=>path,
    setTimeout:(fn,d)=>add(fn,d,false),setInterval:(fn,d)=>add(fn,d,true),clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),
    request:async(path)=>{
      requests.push(path);
      const ok=path.includes('/api/cameras')?controls.discovery:controls.ai;
      // Match createWidgetContext.data: each provider request sets freshness.
      element.dataset.freshness=ok?'live':'unavailable';
      if(!ok)throw new Error('Provider returned HTTP 503');
      if(path.includes('/api/cameras'))return [{id:'camera-1',name:'Test Camera',enabled:true}];
      return {cameras:[{name:'Test Camera',frameAgeSeconds:0,sourceFrameAgeSeconds:0,sourceFrameNumber:++frameNumber}]};
    }
  };
  const dispose=()=>{abort.abort();for(const fn of cleanups.splice(0))fn();};
  t.after(dispose);
  await mount({element,context,config:{}});await flush();
  return {element,controls,requests,timers,get frame(){return nodes.get('outdoor-camera-frame');},get status(){return nodes.get('outdoor-camera-status').textContent;},dispose,
    async run(delay,repeat){const found=[...timers].find(([,timer])=>timer.delay===delay&&timer.repeat===repeat);assert.ok(found,`timer ${delay}/${repeat} exists`);const [id,timer]=found;if(!timer.repeat)timers.delete(id);await timer.fn();await flush();},
    loaded(){this.frame.naturalWidth=640;this.frame.onload?.();},
  };
}

test('working fallback remains live when optional AI health returns 503',async t=>{
  const f=await fixture(t,{ai:false});
  assert.equal(f.element.dataset.freshness,'unavailable');
  assert.match(f.frame.src,/mjpeg/);
  // Chromium can decode MJPEG before emitting its load event.
  f.frame.naturalWidth=640;await f.run(2000,true);
  assert.equal(f.element.dataset.freshness,'live');
  await f.run(15000,false);
  assert.equal(f.element.dataset.freshness,'live');
  assert.match(f.status,/AI STANDBY/);
});

test('healthy metadata alone cannot mark an unrendered or stale camera live',async t=>{
  const f=await fixture(t);
  assert.match(f.frame.src,/live.jpg/);assert.equal(f.element.dataset.freshness,'unavailable');
  f.loaded();assert.equal(f.element.dataset.freshness,'live');
  t.mock.timers.setTime(1_016_000);await f.run(5000,true);
  assert.equal(f.element.dataset.freshness,'unavailable');
});

test('fallback renews the image and stops counting old frames after its freshness limit',async t=>{
  const f=await fixture(t,{ai:false});f.loaded();const old=f.frame;
  await f.run(90000,true);
  assert.notEqual(f.frame,old);assert.equal(f.frame.naturalWidth,0);assert.equal(old.src,'');
  t.mock.timers.setTime(1_106_000);await f.run(2000,true);
  assert.equal(f.element.dataset.freshness,'unavailable');
  f.loaded();assert.equal(f.element.dataset.freshness,'live');
});

test('camera discovery retries after startup failure even when AI is disabled',async t=>{
  const f=await fixture(t,{ai:false,discovery:false,preferredId:'',enabled:false});
  assert.equal(f.element.dataset.freshness,'unavailable');
  f.controls.discovery=true;await f.run(15000,false);
  assert.match(f.frame.src,/camera-1\/mjpeg/);
  f.loaded();assert.equal(f.element.dataset.freshness,'live');
});

test('AI recovery returns from fallback and disposal removes camera timers and handlers',async t=>{
  const f=await fixture(t,{ai:false});f.loaded();f.controls.ai=true;
  await f.run(15000,false);assert.match(f.frame.src,/live.jpg/);
  f.loaded();assert.equal(f.element.dataset.freshness,'live');
  f.dispose();assert.equal(f.timers.size,0);assert.equal(f.frame.onload,null);assert.equal(f.frame.onerror,null);
});

test('camera health respects a slower configured image refresh interval',async t=>{
  const f=await fixture(t,{refreshMs:60000});f.loaded();
  t.mock.timers.setTime(1_061_000);await f.run(2000,true);
  assert.equal(f.element.dataset.freshness,'live');
  t.mock.timers.setTime(1_121_000);await f.run(2000,true);
  assert.equal(f.element.dataset.freshness,'unavailable');
});
