import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.js';
import { loadConfig } from '../src/core/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture() {
  const config = {
    server: { host: '127.0.0.1', port: 8787 },
    branding: { name: 'Testboard', timeZone: 'UTC' },
    defaultScreen: 'clock-screen',
    screens: { 'clock-screen': { path: '/screens/clock', type: 'grid', targets: [{ name: 'Private clock display', device: 'clock-device' }], layout: { columns: 2, rows: 1 }, panels: [{ id: 'clock', plugin: 'clock', position: { column: 1, row: 1, width: 2, height: 1 } }] } },
    plugins: { clock: { enabled: true, privateValue: 'never-public' } },
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
  assert.deepEqual(health.plugins, ['clock']);

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
});

test('unknown and traversal-like routes do not expose files', async t => {
  const app = await fixture();
  t.after(() => app.server.close());
  assert.equal((await fetch(`${app.baseUrl}/package.json`)).status, 404);
  assert.equal((await fetch(`${app.baseUrl}/plugins/not-installed/widget.js`)).status, 404);
  assert.equal((await fetch(`${app.baseUrl}/api/plugins/clock/action`, { method: 'POST', body: '{}' })).status, 405);
});

test('example configuration loads every first-party plugin in demo mode', async () => {
  const loadedConfig = loadConfig({ cwd: ROOT, env: {} });
  const app = await createApp({ loadedConfig, logger: { error() {} } });
  assert.deepEqual(app.plugins.map(plugin => plugin.id), ['calendar', 'camera', 'clock', 'focus', 'news', 'recovery', 'solar', 'spotify', 'stocks', 'weather']);
  for (const plugin of app.plugins) {
    if (plugin.getData) assert.ok(await plugin.getData({}), `${plugin.id} should return demo data`);
  }
  const media = app.plugins.find(plugin => plugin.id === 'spotify');
  assert.deepEqual(await media.action({ action: 'toggle' }), { accepted: true, action: 'toggle' });
});
