import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCastRecovery } from '../src/core/cast-recovery.js';
import { castTargetKey } from '../src/core/delivery.js';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cast-recovery-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const config = {
    server: { publicUrl: 'http://display.test' },
    casting: { recovery: { enabled: true }, protocols: { 'google-cast': { enabled: true } } },
    screens: {
      office: { path: '/office', targets: [{ address: '192.0.2.30' }] },
      kitchen: { path: '/kitchen', targets: [{ address: '192.0.2.28' }] },
      news: { path: '/news', targets: [] },
    },
  };
  const f = { config, clients: [], sent: [], locks: new Set(), time: 1000000,
    statePath: path.join(dir, 'state.json'), fail: false };
  f.options = { getConfig: () => config, getClients: () => f.clients,
    locks: f.locks, statePath: f.statePath, now: () => f.time,
    logger: { info() {}, error() {} }, send: async item => { f.sent.push(item); if (f.fail) throw Error('offline'); } };
  f.recovery = await createCastRecovery(f.options);
  t.after(() => f.recovery.stop());
  return f;
}

test('missing receivers recover independently; a recent physical heartbeat is left alone', async t => {
  const f = await fixture(t);
  f.clients = [{ remoteAddress: '::ffff:192.0.2.28', screenId: 'kitchen', lastSeenAt: new Date(f.time).toISOString() }];
  await f.recovery.tick();
  assert.deepEqual(f.sent.map(s => s.screenId), ['office']);
  assert.equal(f.sent[0].target.resetBeforeCast, true);
  assert.equal(f.sent[0].target.attempts, 1);
  assert.equal(f.sent[0].url, 'http://display.test/office');
  await f.recovery.tick();
  assert.equal(f.sent.length, 1, 'successful sends get time for the heartbeat to return');
});

test('outages retry indefinitely with bounded backoff, including an ack without heartbeat', async t => {
  const f = await fixture(t); delete f.config.screens.kitchen;
  f.fail = true;
  for (const delay of [60000, 120000, 240000, 300000, 300000, 300000]) {
    await f.recovery.tick();
    assert.equal(f.recovery.status().receivers[0].nextAttemptAt - f.time, delay);
    f.time += delay - 1;
    const count = f.sent.length; await f.recovery.tick(); assert.equal(f.sent.length, count);
    f.time += 1;
  }
  f.fail = false; await f.recovery.tick();
  assert.equal(f.recovery.status().receivers[0].result, 'awaiting-heartbeat');
  f.time += 180000; await f.recovery.tick();
  assert.equal(f.sent.length, 8, 'a cast acknowledgement alone does not end recovery');
});

test('only receiver telemetry counts; preview and stale/future heartbeats do not block recovery', async t => {
  const f = await fixture(t);
  f.clients = [
    { remoteAddress: '127.0.0.1', screenId: 'office', lastSeenAt: new Date(f.time).toISOString() },
    { remoteAddress: '192.0.2.30', lastSeenAt: new Date(f.time - 180000).toISOString() },
    { remoteAddress: '192.0.2.28', lastSeenAt: new Date(f.time + 10000).toISOString() },
  ];
  await f.recovery.tick(); assert.equal(f.sent.length, 2);
});

test('disabled/removed targets and protocols never cast; disposal stops retries', async t => {
  const f = await fixture(t);
  f.config.casting.recovery.enabled = false;
  await f.recovery.tick(); assert.equal(f.sent.length, 0);
  f.config.casting.recovery.enabled = true;
  f.config.screens.office.targets = [];
  f.config.casting.protocols['google-cast'].enabled = false;
  await f.recovery.tick(); assert.equal(f.sent.length, 0);
  f.config.casting.protocols['google-cast'].enabled = true;
  f.recovery.stop(); await f.recovery.tick(); assert.equal(f.sent.length, 0);
});

test('manual sends share the lock and their chosen dashboard survives restart', async t => {
  const f = await fixture(t); delete f.config.screens.kitchen;
  const item = { screenId: 'news', protocol: 'google-cast', target: f.config.screens.office.targets[0] };
  const key = castTargetKey(item);
  f.locks.add(key); await f.recovery.tick(); assert.equal(f.sent.length, 0);
  f.locks.delete(key); await f.recovery.remember(item);
  await f.recovery.tick(); assert.equal(f.sent.length, 0);
  f.recovery.stop();
  const restarted = await createCastRecovery(f.options); t.after(() => restarted.stop());
  await restarted.tick(); assert.equal(f.sent[0].screenId, 'news');
  assert.equal(f.sent[0].url, 'http://display.test/news');
  delete f.config.screens.news; f.time += 180000;
  await restarted.tick(); assert.equal(f.sent[1].screenId, 'office');
});

test('in-flight checks cannot overlap and one offline display does not block the other', async t => {
  const f = await fixture(t);
  let release;
  f.options.send = async item => {
    f.sent.push(item);
    if (item.screenId === 'office') await new Promise(resolve => { release = resolve; });
  };
  f.recovery.stop(); f.recovery = await createCastRecovery(f.options);
  const first = f.recovery.tick();
  await f.recovery.tick();
  assert.deepEqual(f.sent.map(s => s.screenId), ['office', 'kitchen']);
  release(); await first; assert.equal(f.locks.size, 0);
});

test('address discovery runs before a due retry; stable identity preserves the selected dashboard', async t => {
  const f = await fixture(t); delete f.config.screens.kitchen;
  const target = f.config.screens.office.targets[0]; target.uuid = 'office-uuid';
  let discoveries = 0;
  f.options.refreshTargets = async () => { discoveries++; target.address = '192.0.2.60'; };
  f.recovery.stop(); f.recovery = await createCastRecovery(f.options);
  await f.recovery.remember({ screenId: 'news', protocol: 'google-cast', target });
  f.time += 180000;
  await f.recovery.tick();
  assert.equal(discoveries, 1);
  assert.equal(f.sent[0].target.address, '192.0.2.60');
  assert.equal(f.sent[0].screenId, 'news');
  await f.recovery.tick(); assert.equal(discoveries, 1, 'backoff also bounds discovery');
  f.clients = [{ remoteAddress: '192.0.2.60', lastSeenAt: new Date(f.time).toISOString() }];
  await f.recovery.tick(); assert.equal(f.recovery.status().receivers[0].result, 'connected');
});

test('discovery failure still permits retries to the configured address', async t => {
  const f = await fixture(t); delete f.config.screens.kitchen;
  f.config.screens.office.targets[0].uuid = 'office-uuid';
  f.options.refreshTargets = async () => { throw Error('offline'); };
  f.recovery.stop(); f.recovery = await createCastRecovery(f.options);
  await f.recovery.tick(); assert.equal(f.sent[0].target.address, '192.0.2.30');
});

test('unreachable Cast control skips impossible sends and reconnects on the next 30-second check', async t => {
  const f = await fixture(t); delete f.config.screens.kitchen;
  let reachable = false, probes = 0;
  f.options.probe = async () => { probes++; return {reachable,reason:'cast-unreachable'}; };
  f.recovery.stop(); f.recovery = await createCastRecovery(f.options);
  await f.recovery.tick();
  assert.equal(f.sent.length,0); assert.equal(f.locks.size,0);
  assert.equal(f.recovery.status().receivers[0].result,'waiting-for-control');
  assert.equal(f.recovery.status().receivers[0].nextAttemptAt,f.time+30000);
  await f.recovery.tick(); assert.equal(probes,1);
  f.time += 30000; reachable=true; await f.recovery.tick();
  assert.equal(f.sent.length,1);assert.equal(f.recovery.status().receivers[0].result,'awaiting-heartbeat');
  assert.equal(f.recovery.status().receivers[0].controlReachable,true);
  f.clients=[{remoteAddress:'192.0.2.30',lastSeenAt:new Date(f.time).toISOString()}];
  await f.recovery.tick();assert.equal(f.recovery.status().receivers[0].result,'connected');
});

test('sustained unreachable service records an actionable transition without leaking probe errors', async t => {
  const f = await fixture(t);delete f.config.screens.kitchen;
  f.options.probe=async()=>({reachable:false,reason:'private probe details'});
  f.recovery.stop();f.recovery=await createCastRecovery(f.options);
  for(let i=0;i<=6;i++){await f.recovery.tick();f.time+=30000;}
  const state=f.recovery.status().receivers[0];
  assert.equal(state.needsAttention,true);assert.equal(state.result,'needs-attention');
  assert.equal(state.attempts,0);assert.equal(state.failedProbes,7);
  assert.equal(f.sent.length,0);
  const events=(await fs.readFile(f.statePath+'.events.jsonl','utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(e=>e.result),['waiting-for-control','needs-attention']);
  assert.ok(events.every(e=>e.reason==='probe-unavailable'));
  assert.ok(!JSON.stringify([state,events]).includes('private probe details'));
});

test('healthy receiver remains untouched and a failed probe cannot block another display', async t => {
  const f=await fixture(t);f.options.probe=async target=>({reachable:target.address.endsWith('.28'),reason:'cast-unreachable'});
  f.recovery.stop();f.recovery=await createCastRecovery(f.options);
  await f.recovery.tick();assert.deepEqual(f.sent.map(s=>s.screenId),['kitchen']);assert.equal(f.locks.size,0);
  f.clients=[{remoteAddress:'192.0.2.30',lastSeenAt:new Date(f.time).toISOString()}];
  await f.recovery.tick();assert.equal(f.recovery.status().receivers[0].result,'connected');assert.equal(f.sent.length,1);
});

test('stopping or removing a receiver while its probe is pending prevents the cast', async t => {
  for(const change of ['stop','remove','disable']){
    const f=await fixture(t);delete f.config.screens.kitchen;
    let finish;f.options.probe=()=>new Promise(resolve=>{finish=resolve;});
    f.recovery.stop();f.recovery=await createCastRecovery(f.options);
    const pending=f.recovery.tick();
    if(change==='stop')f.recovery.stop();
    if(change==='remove')f.config.screens.office.targets=[];
    if(change==='disable')f.config.casting.recovery.enabled=false;
    finish({reachable:true});await pending;
    assert.equal(f.sent.length,0,change);assert.equal(f.locks.size,0,change);
  }
});

test('outage journal rotates within a fixed storage bound', async t=>{
 const f=await fixture(t);delete f.config.screens.kitchen;
 await fs.writeFile(f.statePath+'.events.jsonl','x'.repeat(128*1024+1));
 await f.recovery.tick();
 assert.equal((await fs.stat(f.statePath+'.events.jsonl.1')).size,128*1024+1);
 assert.ok((await fs.stat(f.statePath+'.events.jsonl')).size<1024);
});
test('a physical heartbeat arriving during a probe prevents an unnecessary recast', async t=>{
 const f=await fixture(t);delete f.config.screens.kitchen;
 let finish;f.options.probe=()=>new Promise(resolve=>{finish=resolve;});
 f.recovery.stop();f.recovery=await createCastRecovery(f.options);
 const pending=f.recovery.tick();
 f.clients=[{remoteAddress:'192.0.2.30',lastSeenAt:new Date(f.time).toISOString()}];
 finish({reachable:true});await pending;
 assert.equal(f.sent.length,0);assert.equal(f.recovery.status().receivers[0].result,'connected');
});
test('failed assignment persistence never latches the recovery loop', async t=>{
 const f=await fixture(t);delete f.config.screens.kitchen;
 await fs.mkdir(f.statePath);
 await f.recovery.remember({screenId:'office',protocol:'google-cast',target:f.config.screens.office.targets[0]});
 await f.recovery.tick();
 f.time+=180000;await f.recovery.tick();assert.equal(f.sent.length,1);
 f.time+=180000;await f.recovery.tick();assert.equal(f.sent.length,2);
});
test('address or dashboard changes during a probe never send stale delivery details', async t=>{
 for(const change of ['address','path']){
  const f=await fixture(t);delete f.config.screens.kitchen;
  f.config.screens.office.targets[0].uuid='stable-receiver';
  let finish;f.options.probe=()=>new Promise(resolve=>{finish=resolve;});
  f.recovery.stop();f.recovery=await createCastRecovery(f.options);
  const pending=f.recovery.tick();await new Promise(setImmediate);
  if(change==='address')f.config.screens.office.targets[0].address='192.0.2.60';
  else f.config.screens.office.path='/new-dashboard';
  finish({reachable:true});await pending;assert.equal(f.sent.length,0,change);
  f.options.probe=async()=>({reachable:true});
  const retry=f.recovery.tick();await new Promise(setImmediate);finish({reachable:true});await retry;
  assert.equal(f.sent.length,1,change);
  if(change==='address')assert.equal(f.sent[0].target.address,'192.0.2.60');
  else assert.equal(f.sent[0].url,'http://display.test/new-dashboard');
 }
});
