import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.js';
import { loadConfig } from '../src/core/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requestStatus(baseUrl, host) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: target.hostname, port: target.port, path: '/api/health', headers: { Host: host } }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

async function fixture() {
  const config = {
    server: { host: '127.0.0.1', port: 8787 },
    branding: { name: 'Testboard', timeZone: 'UTC' },
    defaultScreen: 'clock-screen',
    screens: { 'clock-screen': { path: '/screens/clock', type: 'grid', targets: [{ name: 'Private clock display', device: 'clock-device' }], layout: { columns: 2, rows: 1 }, panels: [{ id: 'clock', plugin: 'clock', position: { column: 1, row: 1, width: 2, height: 1 } }] } },
    plugins: { clock: { enabled: true, privateValue: 'never-public' }, spotify: { enabled: true, provider: 'demo' } },
  };
  const app = await createApp({ loadedConfig: { config, configPath: '/tmp/test-config.json', configDir: '/tmp' }, logger: { error() {} } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const address = app.server.address();
  return { ...app, baseUrl: `http://127.0.0.1:${address.port}` };
}

test('server exposes health, public config, and widget module', async t => {
  const app = await fixture();
  t.after(() => app.server.close());
  const health = await (await fetch(`${app.baseUrl}/api/health`)).json();
  assert.deepEqual(health.plugins, ['clock', 'spotify']);

  const configResponse = await fetch(`${app.baseUrl}/api/config`);
  const config = await configResponse.json();
  assert.equal(config.branding.name, 'Testboard');
  assert.equal(JSON.stringify(config).includes('never-public'), false);
  assert.equal(JSON.stringify(config).includes('Private clock display'), false);
  assert.equal(config.defaultScreen, 'clock-screen');
  assert.equal(config.screens['clock-screen'].type, 'grid');
  assert.deepEqual(config.screenTypes.map(type => type.id), ['flow', 'grid', 'single']);
  assert.match(configResponse.headers.get('content-security-policy'), /default-src 'self'/);

  assert.equal((await fetch(`${app.baseUrl}/screens/clock`)).status, 200);

  const widget = await fetch(`${app.baseUrl}/plugins/clock/widget.js`);
  assert.equal(widget.status, 200);
  assert.match(await widget.text(), /export function mount/);
  assert.equal((await fetch(`${app.baseUrl}/screen-types/grid/renderer.js`)).status, 200);
  const logo = await fetch(`${app.baseUrl}/assets/castboard-logo.png`);
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get('content-type'), 'image/png');
  const vectorLogo = await fetch(`${app.baseUrl}/assets/castboard-logo.svg`);
  assert.equal(vectorLogo.status, 200);
  assert.equal(vectorLogo.headers.get('content-type'), 'image/svg+xml');
});

test('unknown and traversal-like routes do not expose files', async t => {
  const app = await fixture();
  t.after(() => app.server.close());
  assert.equal((await fetch(`${app.baseUrl}/package.json`)).status, 404);
  assert.equal(await requestStatus(app.baseUrl, 'attacker.example'), 421);
  assert.equal((await fetch(`${app.baseUrl}/plugins/not-installed/widget.js`)).status, 404);
  assert.equal((await fetch(`${app.baseUrl}/api/plugins/clock/action`, { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await fetch(`${app.baseUrl}/api/plugins/spotify/action`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"action":"toggle"}' })).status, 415);
  const action = await fetch(`${app.baseUrl}/api/plugins/spotify/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"toggle"}' });
  assert.equal(action.status, 200);
});

test('admin studio exposes only the editable design catalog', async t => {
  const app = await fixture();
  t.after(() => app.server.close());
  assert.equal((await fetch(`${app.baseUrl}/admin`)).status, 200);
  assert.equal((await fetch(`${app.baseUrl}/admin.js`)).status, 200);
  assert.equal((await fetch(`${app.baseUrl}/admin-preview`)).status, 200);
  assert.equal((await fetch(`${app.baseUrl}/studio-model.js`)).status, 200);

  assert.equal((await fetch(`${app.baseUrl}/setup`)).status, 200);
  assert.equal((await fetch(`${app.baseUrl}/setup.js`)).status, 200);
  const setup = await (await fetch(`${app.baseUrl}/api/admin/setup`)).json();
  assert.equal(setup.ok, true);
  assert.equal(setup.plugins.find(plugin => plugin.id === 'spotify').name, 'Spotify');
  const response = await fetch(`${app.baseUrl}/api/admin/design`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  const serialized = JSON.stringify(payload);
  assert.equal(payload.design.screens['clock-screen'].title, undefined);
  assert.deepEqual(payload.catalog.plugins.map(({id,type,name})=>({id,type,name})), [{ id: 'clock', type: 'clock', name: 'Clock' }, { id: 'spotify', type: 'spotify', name: 'Spotify' }]);
  assert.equal(payload.catalog.plugins[0].optionSchema.properties.showSeconds.type,'boolean');
  assert.equal(serialized.includes('settingsSchema'),false);
  assert.equal(serialized.includes('never-public'), false);
  assert.equal(serialized.includes('Private clock display'), false);
  assert.equal(serialized.includes('clock-device'), false);
});

test('admin saves atomically, preserves private values, and hot-applies public design', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-server-admin-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, 'castboard.config.json');
  const rawConfig = {
    server: { host: '127.0.0.1', port: 8787 },
    branding: { name: 'Testboard', timeZone: 'UTC' },
    admin: { enabled: true, allowLan: false },
    defaultScreen: 'home',
    screens: { home: { path: '/', title: 'Before', type: 'grid', targets: [{ name: 'Private display', device: 'private-device' }], layout: { columns: 2, rows: 1 }, panels: [{ id: 'clock', plugin: 'clock', position: { column: 1, row: 1, width: 2, height: 1 } }] } },
    plugins: { clock: { enabled: true, privateValue: 'preserve-me' } },
  };
  await fs.writeFile(configPath, JSON.stringify(rawConfig));
  const app = await createApp({ loadedConfig: { config: cloneForTest(rawConfig), rawConfig, configPath, configDir: directory }, logger: { error() {} } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.server.close());
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const initial = await (await fetch(`${baseUrl}/api/admin/design`)).json();
  initial.design.screens.home.title = 'After';
  initial.design.screens.home.path = '/after';
  initial.design.screens.home.appearance = { accent: '#ffcc66', textColor: '#fff7e0', fontFamily: 'rounded', headingFontFamily: 'serif', fontScale: 115, radius: 10, borderWidth: 2, shadow: 'deep' };
  initial.design.screens.home.panels[0].appearance = { fontFamily: 'mono', fontScale: 90, background: '#111111', padding: 6 };
  const savedResponse = await fetch(`${baseUrl}/api/admin/design`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: initial.revision, design: initial.design }),
  });
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  assert.equal(saved.applied, true);
  assert.notEqual(saved.revision, initial.revision);
  const publicConfig = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(publicConfig.screens.home.title, 'After');
  assert.equal(publicConfig.screens.home.path, '/after');
  assert.equal(publicConfig.screens.home.appearance.fontScale, 115);
  assert.equal(publicConfig.screens.home.panels[0].appearance.fontFamily, 'mono');
  assert.equal((await fetch(`${baseUrl}/after`)).status, 200);
  const onDisk = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(onDisk.plugins.clock.privateValue, 'preserve-me');
  assert.equal(onDisk.screens.home.targets[0].device, 'private-device');

  const conflict = await fetch(`${baseUrl}/api/admin/design`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: initial.revision, design: initial.design }),
  });
  assert.equal(conflict.status, 409);
});

function cloneForTest(value) {
  return JSON.parse(JSON.stringify(value));
}

test('example configuration loads every first-party plugin without requiring credentials', async () => {
  const loadedConfig = loadConfig({ cwd: ROOT, env: {} });
  const app = await createApp({ loadedConfig, logger: { error() {} } });
  assert.deepEqual(app.plugins.map(plugin => plugin.id), ['calendar', 'camera', 'clock', 'focus', 'news', 'recovery', 'solar', 'sonos', 'spotify', 'stocks', 'weather']);
  for (const plugin of app.plugins) {
    if (plugin.getData && plugin.id !== 'news') assert.ok(await plugin.getData({}), `${plugin.id} should return local or demo data`);
  }
  assert.equal(loadedConfig.config.plugins.news.provider, 'rss');
  assert.equal(app.plugins.find(plugin => plugin.id === 'news').publicConfig().maxStories, 40);
  const media = app.plugins.find(plugin => plugin.id === 'spotify');
  assert.deepEqual(await media.action({ action: 'toggle' }), { accepted: true, action: 'toggle' });
});
