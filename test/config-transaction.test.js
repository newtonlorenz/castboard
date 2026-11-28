import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createApp } from '../src/server.js';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-transaction-'));
  let app;
  t.after(async () => {
    await app?.dispose();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const pluginDir = path.join(directory, 'extensions/plugins/probe');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(path.join(pluginDir, 'package.json'), '{"type":"module"}');
  const log = path.join(directory, 'events');
  const failPublic = path.join(directory, 'fail-public');
  await fs.writeFile(path.join(pluginDir, 'plugin.js'), `
    import { appendFileSync, existsSync } from 'node:fs';
    export function createPlugin({ config }) {
      const tag = config.tag;
      const event = name => appendFileSync(${JSON.stringify(log)}, name + ':' + tag + '\\n');
      event('create');
      return {
        id: 'probe', name: 'Probe', getData: () => ({ tag }),
        publicConfig() {
          if (existsSync(${JSON.stringify(failPublic)})) throw new Error('Probe cannot publish');
          return { tag };
        },
        dispose: () => event('dispose')
      };
    }
  `);
  const configPath = path.join(directory, 'castboard.config.example.json');
  const savedPath = path.join(directory, 'castboard.config.json');
  const config = {
    server: { host: '127.0.0.1', port: 8787 },
    screens: {
      home: { path: '/', type: 'single', panels: [{ id: 'clock', plugin: 'clock', interaction: { type: 'modal', screenId: 'details' } }] },
      details: { path: '/details', type: 'single', panels: [{ id: 'detail-clock', plugin: 'clock' }] },
      other: { path: '/other', type: 'single', panels: [{ id: 'other-clock', plugin: 'clock' }] },
    },
    plugins: { clock: {}, probe: { tag: 'original' } },
  };
  const initial = JSON.stringify(config);
  await fs.writeFile(configPath, initial);
  app = await createApp({ configPath, env: {} });

  // Exercise the normal request handler without binding an OS socket.
  function request(url, { method = 'GET', data, headers = {} } = {}) {
    return new Promise(resolve => {
      const req = Readable.from(data === undefined ? [] : [Buffer.from(JSON.stringify(data))]);
      Object.assign(req, {
        url, method, socket: { remoteAddress: '127.0.0.1' },
        headers: { host: 'localhost', 'content-type': 'application/json', ...headers },
      });
      const result = { headers: {} };
      const res = {
        setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
        writeHead(status, responseHeaders) {
          result.status = status;
          for (const [name, value] of Object.entries(responseHeaders)) this.setHeader(name, value);
        },
        end(body) { resolve({ ...result, body: body && JSON.parse(body) }); },
      };
      app.server.emit('request', req, res);
    });
  }
  return { app, request, configPath, savedPath, initial, failPublic, events: async () => (await fs.readFile(log, 'utf8')).trim().split('\n') };
}

test('a rejected public projection leaves the design file, revision and live providers intact', async t => {
  const { app, request, configPath, savedPath, initial, failPublic, events } = await fixture(t);
  const { body: draft } = await request('/api/admin/design');
  const { body: before } = await request('/api/runtime-config');
  draft.design.screens.home.title = 'Changed';
  await fs.writeFile(failPublic, '');
  const failed = await request('/api/admin/design', { method: 'PUT', data: draft });
  assert.equal(failed.status, 422);
  assert.match(failed.body.error.message, /Probe cannot publish/);
  assert.equal(await fs.readFile(configPath, 'utf8'), initial);
  await assert.rejects(fs.stat(savedPath), { code: 'ENOENT' });
  assert.equal(app.configPath, configPath);
  assert.deepEqual((await request('/api/runtime-config')).body, before);
  assert.equal((await request('/api/admin/design')).body.revision, draft.revision);
  assert.deepEqual(await events(), ['create:original']);
});

test('dry runs and failed renames dispose staged providers; commits retire only the replaced provider', async t => {
  const { app, request, configPath, savedPath, initial, events } = await fixture(t);
  const { body: draft } = await request('/api/admin/design');
  const patch = (value, dryRun) => request('/api/admin/configuration', { method: 'PATCH', data: {
    revision: draft.revision, dryRun, operations: [{ op: 'set', path: '/plugins/probe/tag', value }],
  } });
  const activeClock = app.plugins.find(plugin => plugin.id === 'clock');
  const { body: checked } = await patch('check', true);
  assert.equal(checked.applied, false);
  assert.equal(checked.revision, draft.revision);
  await assert.rejects(fs.stat(savedPath), { code: 'ENOENT' });

  await fs.mkdir(savedPath);
  assert.equal((await patch('blocked', false)).status, 422);
  assert.equal(await fs.readFile(configPath, 'utf8'), initial);
  assert.equal((await request('/api/plugins/probe/data')).body.data.tag, 'original');
  assert.deepEqual(await events(), ['create:original', 'create:check', 'dispose:check', 'create:blocked', 'dispose:blocked']);
  await fs.rmdir(savedPath);

  const responses = await Promise.all([patch('saved', false), patch('stale', false)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const winner = JSON.parse(await fs.readFile(savedPath, 'utf8')).plugins.probe.tag;
  assert.equal(app.configPath, savedPath);
  assert.equal((await request('/api/plugins/probe/data')).body.data.tag, winner);
  assert.equal(app.plugins.find(plugin => plugin.id === 'clock'), activeClock);
  assert.deepEqual((await events()).slice(-2), [`create:${winner}`, 'dispose:original']);
});

test('dashboard revision requests cover linked screens, path changes, and deletion', async t => {
  const { request } = await fixture(t);
  const { body: before } = await request('/api/runtime-config');
  const check = id => request(`/api/dashboard-revision/${id}`, { headers: { 'if-none-match': `"${before.dashboardRevisions[id]}"` } });
  const unchanged = await check('home');
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, undefined);

  const { body: draft } = await request('/api/admin/design');
  draft.design.screens.details.title = 'New details';
  draft.design.screens.details.path = '/details-new';
  const { body: applied } = await request('/api/admin/design', { method: 'PUT', data: draft });
  assert.equal(applied.applied, true);
  assert.equal((await check('other')).status, 304);
  assert.deepEqual((await check('details')).body, { path: '/details-new' });
  assert.deepEqual((await check('home')).body, { path: '/' });

  delete applied.design.screens.other;
  assert.equal((await request('/api/admin/design', { method: 'PUT', data: applied })).status, 200);
  assert.deepEqual((await check('other')).body, { path: '/' });
});
