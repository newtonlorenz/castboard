import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCastProtocols } from '../src/core/cast-protocol-registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cast protocols are enabled and discovered from configuration', async () => {
  const protocols = await discoverCastProtocols({
    protocolsDir: path.join(ROOT, 'cast-protocols'),
    config: { casting: { protocols: { 'google-cast': { enabled: false }, url: { enabled: true }, 'http-webhook': { enabled: true, endpoint: 'http://example.invalid' } } } },
  });
  assert.deepEqual(protocols.map(protocol => protocol.id), ['http-webhook', 'url']);
  const urlProtocol = protocols.find(protocol => protocol.id === 'url');
  assert.deepEqual(await urlProtocol.cast({ target: { name: 'Tablet' }, url: 'http://castboard.local/' }), {
    target: 'Tablet', url: 'http://castboard.local/', message: 'Open http://castboard.local/ on the target screen',
  });
});

test('configured delivery references must resolve to enabled protocols', async () => {
  const config = {
    casting: { protocols: { url: { enabled: true } }, defaultProtocol: 'missing' },
    screens: { home: { path: '/', panels: [], targets: [] } },
  };
  await assert.rejects(discoverCastProtocols({ protocolsDir: path.join(ROOT, 'cast-protocols'), config }), /defaultProtocol references disabled or missing/);
});

test('Google Cast retries a moved saved address through the friendly name', async t => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const {createProtocol} = await import('../cast-protocols/google-cast/protocol.js');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-catt-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const executable=path.join(directory,'catt');
  await fs.writeFile(executable,'#!/bin/sh\nif [ "$2" = "Moved display" ]; then\n  exit 0\nfi\nexit 1\n',{mode:0o700});
  const protocol=createProtocol({config:{executable,attempts:2}});
  const result=await protocol.cast({target:{device:'192.0.2.20',name:'Moved display'},url:'http://example.test/'});
  assert.equal(result.device,'Moved display');
  await assert.rejects(protocol.cast({target:{device:'192.0.2.20',attempts:1},url:'http://example.test/'}),/exited/);
});

test('Google Cast resets opted-in sessions and bounds hung delivery',async t=>{
 const fs=await import('node:fs/promises');
 const os=await import('node:os');
 const {createProtocol}=await import('../cast-protocols/google-cast/protocol.js');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-delivery-'));
 t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const executable=path.join(directory,'catt'),log=path.join(directory,'calls.jsonl');
 await fs.writeFile(executable,`#!${process.execPath}\nimport fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(log)},JSON.stringify(process.argv.slice(2))+'\\n');\nif(process.argv.includes('hung'))setInterval(()=>{},1000);\n`,{mode:0o700});
 await fs.writeFile(path.join(directory,'package.json'),'{"type":"module"}');
 const protocol=createProtocol({config:{executable,resetBeforeCast:true,resetDelayMs:0,attempts:1}});
 await protocol.cast({target:{address:'192.0.2.20'},url:'http://example.test/'});
 const calls=(await fs.readFile(log,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(calls,[['-d','192.0.2.20','stop'],['-d','192.0.2.20','cast_site','http://example.test/']]);
 await assert.rejects(protocol.cast({target:{address:'hung',timeoutMs:100},url:'http://example.test/'}),/timed out/);
});
