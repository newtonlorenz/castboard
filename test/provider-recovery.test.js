import test from 'node:test';
import assert from 'node:assert/strict';
import {RecoveryLoop} from '../src/core/provider-recovery.js';

test('sustained outage recovers once, backs off, persists and confirms recovery',async()=>{
 let now=0,healthy=false,actions=0,saved;
 const task={id:'test',probe:async()=>({healthy,action:'restart',reason:'offline'}),recover:async()=>{actions++;}};
 const loop=new RecoveryLoop({tasks:[task],now:()=>now,save:async s=>{saved=structuredClone(s);}});
 await loop.tick();now=30000;await loop.tick();assert.equal(actions,0);
 now=60000;await loop.tick();assert.equal(actions,1);assert.equal(saved.test.status,'unavailable');
 assert.equal(saved.test.nextAttemptAt,180000);
 const restarted=new RecoveryLoop({tasks:[task],state:saved,now:()=>now});
 now=90000;await restarted.tick();assert.equal(actions,1);
 now=180000;await restarted.tick();assert.equal(actions,2);assert.equal(saved.test.nextAttemptAt,420000);
 healthy=true;now=210000;await restarted.tick();assert.equal(saved.test.attempts,2);
 now=240000;await restarted.tick();now=270000;await restarted.tick();assert.equal(saved.test.attempts,0);
 assert.equal(saved.test.status,'healthy');assert.equal(saved.test.nextAttemptAt,0);
});

test('short outages, offline dependencies and flapping never create restart storms',async()=>{
 let now=0,actions=0,result={healthy:false};
 const loop=new RecoveryLoop({now:()=>now,tasks:[{id:'t',probe:async()=>result,recover:async()=>actions++}]});
 for(let i=0;i<10;i++){now+=30000;await loop.tick();}assert.equal(actions,0);
 result={healthy:true};await loop.tick();result={healthy:false,action:'restart'};now+=30000;await loop.tick();
 result={healthy:true};now+=30000;await loop.tick();assert.equal(actions,0);
});

test('overlapping polls coalesce, shutdown prevents actions and state failure fails closed',async()=>{
 let release,calls=0,actions=0;
 const loop=new RecoveryLoop({now:()=>90000,state:{t:{failures:3,failureSince:0}},tasks:[{id:'t',probe:()=>{calls++;return new Promise(r=>release=r);},recover:async()=>actions++}]});
 const first=loop.tick(),second=loop.tick();assert.equal(first,second);assert.equal(calls,1);
 loop.stop();release({healthy:false,action:'restart'});await first;assert.equal(actions,0);
 const broken=new RecoveryLoop({now:()=>90000,state:{t:{failures:3,failureSince:0}},save:async()=>{throw Error('disk full');},tasks:[{id:'t',probe:async()=>({healthy:false,action:'restart'}),recover:async()=>actions++}]});
 await assert.rejects(broken.tick());assert.equal(actions,0);
});

test('failed actions remain bounded and one failing provider cannot block another',async()=>{
 let now=60000,actions=0;
 const loop=new RecoveryLoop({now:()=>now,state:{a:{failures:3,failureSince:0}},tasks:[
  {id:'a',probe:async()=>({healthy:false,action:'restart'}),recover:async()=>{actions++;throw Error('private token');}},
  {id:'b',probe:async()=>({healthy:true})}
 ]});
 await loop.tick();assert.equal(loop.state.a.actionResult,'failed');assert.equal(loop.state.b.status,'healthy');
 now+=30000;await loop.tick();assert.equal(actions,1);assert.ok(!JSON.stringify(loop.state).includes('private token'));
});

test('decoder grace and exponential backoff are respected and capped at thirty minutes',async()=>{
 let now=0,actions=0;
 const loop=new RecoveryLoop({now:()=>now,tasks:[{id:'t',probe:async()=>({healthy:false,action:'restart',minFailureMs:180000}),recover:async()=>actions++}]});
 await loop.tick();now=30000;await loop.tick();now=60000;await loop.tick();assert.equal(actions,0);
 now=180000;await loop.tick();assert.equal(actions,1);
 for(let i=0;i<8;i++){now=loop.state.t.nextAttemptAt;await loop.tick();}
 assert.equal(loop.state.t.nextAttemptAt-now,1800000);
});


test('HTTP disconnect and reconnect confirm recovery through subsequent probes',async t=>{
 const {createServer}=await import('node:http');
 const {fetchJson}=await import('../src/core/providers.js');
 let connected=false,actions=0,now=0;
 const server=createServer((req,res)=>{
  if(!connected){req.socket.destroy();return;}
  res.setHeader('Content-Type','application/json');res.end('{"connected":true}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const url=`http://127.0.0.1:${server.address().port}/health`;
 const loop=new RecoveryLoop({now:()=>now,tasks:[{
  id:'source',async probe(){
   try{return {healthy:(await fetchJson(url,{},500)).connected};}
   catch{return {healthy:false,reason:'disconnected',action:'reconnect'};}
  },async recover(){actions++;connected=true;}
 }]});
 await loop.tick();now=30000;await loop.tick();assert.equal(actions,0);
 now=60000;await loop.tick();assert.equal(actions,1);assert.equal(loop.state.source.status,'unavailable');
 now=90000;await loop.tick();assert.equal(loop.state.source.status,'healthy');
});
