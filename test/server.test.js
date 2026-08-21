import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.js';

async function fixture() {
  const config = {
    server: { host: '127.0.0.1', port: 8787 },
    branding: { name: 'Testboard', timeZone: 'UTC' },
    screens: { home: { path: '/', widgets: [{ plugin: 'clock', area: 'clock' }] } },
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
  assert.match(configResponse.headers.get('content-security-policy'), /default-src 'self'/);

  const widget = await fetch(`${app.baseUrl}/plugins/clock/widget.js`);
  assert.equal(widget.status, 200);
  assert.match(await widget.text(), /export function mount/);
});

test('unknown and traversal-like routes do not expose files', async t => {
  const app = await fixture();
  t.after(() => app.server.close());
  assert.equal((await fetch(`${app.baseUrl}/package.json`)).status, 404);
  assert.equal((await fetch(`${app.baseUrl}/plugins/not-installed/widget.js`)).status, 404);
  assert.equal((await fetch(`${app.baseUrl}/api/plugins/clock/action`, { method: 'POST', body: '{}' })).status, 405);
});
