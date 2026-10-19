import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function replayFixture() {
  const widget=fs.readFileSync(new URL('../plugins/ambient-alerts/widget.js',import.meta.url),'utf8');
  const timers=new Map();let next=0;
  const node=()=>({hidden:false,src:'',readyState:0,events:{},addEventListener(k,f){this.events[k]=f;},removeAttribute(k){this[k]='';},pause(){},play(){return Promise.resolve();},load(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
  const nodes=Object.fromEntries(['modal','video','image','status','title','meta','close'].map(id=>['camera-detection-'+id,node()]));
  nodes['camera-detection-modal'].hidden=true;
  const scope={document:{getElementById:id=>nodes[id],contains:()=>false,addEventListener(){}},resourceUrl:p=>'/resource?path='+encodeURIComponent(p),setTimeout:(f,d)=>{timers.set(++next,{f,d});return next;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(scope);vm.runInContext(widget.slice(widget.indexOf('    var cameraDetectionReturnFocus'),widget.indexOf('    async function loadCameraAlerts')),scope);
  return {scope,nodes,timers,video:nodes['camera-detection-video'],status:nodes['camera-detection-status'],run(delay){const [id,t]=[...timers].find(([,t])=>t.d===delay);timers.delete(id);t.f();},open(){scope.openCameraDetection({imageUrl:'/frame.jpg',folder:'2026-10-09',filename:'1_appearance.jpg'});}};
}
test('fresh clips retry after errors and stalled requests, then play as soon as data arrives',()=>{
  const f=replayFixture();f.open();assert.match(f.video.src,/retry=1$/);
  f.video.events.error();assert.match(f.status.textContent,/retrying/);f.run(3000);assert.match(f.video.src,/retry=2$/);
  f.run(20000);f.run(3000);assert.match(f.video.src,/retry=3$/);
  f.video.readyState=2;f.video.events.loadeddata();assert.equal(f.video.hidden,false);assert.equal(f.status.textContent,'Detection video');assert.equal(f.timers.size,0);
});
test('replay retries stop after four attempts or closing the dialog',()=>{
  const f=replayFixture();f.open();
  for(let i=0;i<3;i++){f.video.events.error();f.run(3000);}
  f.video.events.error();assert.match(f.status.textContent,/Video unavailable/);assert.equal(f.timers.size,0);
  f.open();f.video.events.error();f.scope.closeCameraDetection();assert.equal(f.timers.size,0);assert.equal(f.video.src,'');
  f.video.events.loadeddata();assert.equal(f.nodes['camera-detection-modal'].hidden,true);
});
