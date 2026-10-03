import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSetupReport, discoverCastDevices, executableStatus, testPluginConnection } from '../src/core/setup.js';

test('setup report describes readiness without exposing private connection values', async () => {
  const config = {
    server: { port: 8787, publicUrl: 'https://user:secret-password@example.com?token=private' },
    casting: { defaultProtocol: 'google-cast', protocols: { 'google-cast': { executable: 'definitely-not-installed-catt' } } },
    screens: { home: { path: '/', title: 'Home', targets: [{ name: 'Secret device', device: 'private-speaker' }], panels: [{ id: 'weather', plugin: 'weather' }] } },
    plugins: { weather: { enabled: true, provider: 'open-meteo', latitude: 1, longitude: 2, token: 'private-token' }, spotify: { enabled: true, provider: 'spotify-player', executable: 'definitely-not-installed-spotify' } },
  };
  const report = await buildSetupReport({ config, configPath: '/tmp/castboard.config.json', plugins: [{ id: 'weather', name: 'Weather' }, { id: 'spotify', name: 'Spotify' }] });
  assert.equal(report.plugins.find(plugin => plugin.id === 'weather').status, 'ready');
  assert.equal(report.plugins.find(plugin => plugin.id === 'spotify').status, 'blocked');
  assert.equal(report.screens[0].targetCount, 1);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('private-token'), false);
  assert.equal(serialized.includes('private-speaker'), false);
  assert.equal(serialized.includes('Secret device'), false);
  assert.equal(report.urls.lan, null);
  assert.equal(serialized.includes('secret-password'), false);
});

test('setup executable and provider tests return actionable results', async () => {
  const node = await executableStatus(process.execPath, ['--version']);
  assert.equal(node.installed, true);
  const success = await testPluginConnection([{ id: 'sample', getData: async () => ({ ok: true }) }], 'sample');
  assert.equal(success.ok, true);
  const failure = await testPluginConnection([{ id: 'sample', getData: async () => { throw new Error('connection refused'); } }], 'sample');
  assert.deepEqual({ ok: failure.ok, message: failure.message }, { ok: false, message: 'connection refused' });
});

test('Cast discovery returns copy-safe device details from catt JSON', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-catt-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'catt-fixture');
  await fs.writeFile(executable, '#!/bin/sh\nprintf \'%s\' \'{"Kitchen":{"friendly_name":"Kitchen Hub","manufacturer":"Google","model_name":"Nest Hub"}}\'\n');
  await fs.chmod(executable, 0o700);
  const result = await discoverCastDevices({ casting: { protocols: { 'google-cast': { executable } } } });
  assert.deepEqual(result.devices, [{ name: 'Kitchen Hub', manufacturer: 'Google', model: 'Nest Hub' }]);
});


test('connection reports resolve independent module types and count their source use', async () => {
 const report = await buildSetupReport({config:{server:{port:8787},plugins:{outside:{type:'weather',provider:'open-meteo'}},screens:{home:{path:'/',panels:[{id:'reading',plugin:'view',source:'outside'}]}}},configPath:'/tmp/config.json',plugins:[{id:'outside',type:'weather',name:'Outside'}]});
 assert.equal(report.plugins[0].status,'ready');
 assert.equal(report.plugins[0].usedBy,1);
 assert.equal(report.plugins[0].type,'weather');
});
