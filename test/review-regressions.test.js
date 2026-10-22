import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createApp } from '../src/server.js';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-review-'));
  const configPath = path.join(directory, 'config.json');
  await fs.writeFile(configPath, JSON.stringify({
    server: { host: '127.0.0.1', port: 8787, trustedProxyAddresses: ['127.0.0.1'] },
    admin: { enabled: false, allowLan: false },
    screens: { home: { path: '/', layout: { columns: 2, rows: 1 }, panels: [], targets: [] } },
    plugins: { clock: { enabled: true } },
  }));
  const token = 'review-test-environment-token';
  const app = await createApp({ configPath, env: { CASTBOARD_ADMIN_TOKEN: token }, logger: { error() {} } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { app.server.close(); app.server.closeAllConnections(); await app.dispose(); await fs.rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Castboard-Receiver': '192.0.2.25', Authorization: `Bearer ${token}` };
  const request = (route, options = {}) => fetch(base + route, { ...options, headers: { ...headers, ...options.headers } });
  return { app, base, headers, request, configPath, token };
}

test('all live save paths preserve environment admin access without persisting its token', async t => {
  const { app, request, configPath, token } = await fixture(t);
  for (const change of ['design', 'plugin', 'delivery', 'configuration']) {
    const initial = await (await request('/api/admin/design')).json();
    let response;
    if (change === 'design') {
      initial.design.screens.home.title = 'Updated';
      response = await request('/api/admin/design', { method: 'PUT', body: JSON.stringify(initial) });
    } else if (change === 'plugin') {
      response = await request('/api/admin/plugins', { method: 'POST', body: JSON.stringify({ revision: initial.revision, action: 'configure', id: 'clock', settings: { title: 'Desk' } }) });
    } else if (change === 'delivery') {
      response = await request('/api/admin/delivery', { method: 'POST', body: JSON.stringify({ revision: initial.revision, action: 'add', screenId: 'home', name: 'Test receiver', device: '192.0.2.30' }) });
    } else {
      response = await request('/api/admin/configuration', { method: 'PATCH', body: JSON.stringify({ revision: initial.revision, dryRun: false, operations: [{ op: 'set', path: '/branding/name', value: 'Reviewed' }] }) });
    }
    assert.equal(response.status, 200, `${change}: ${await response.text()}`);
    assert.equal((await request('/api/admin/design')).status, 200, `${change} retains access`);
    assert.equal((await request('/api/admin/design', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    assert.equal(app.config.admin.token, token);
    assert.equal((await fs.readFile(configPath, 'utf8')).includes(token), false);
  }
});

test('JSON APIs reject non-object bodies, invalid status entries and misleading content types', async t => {
  const { request } = await fixture(t);
  for (const body of ['null', '[]', '42', '"hello"']) {
    const response = await request('/api/client-status', { method: 'POST', body });
    assert.equal(response.status, 400, body);
    assert.equal((await response.json()).error.code, 'INVALID_JSON');
  }
  for (const panels of [[null], [42], [{ id: {} }]]) {
    assert.equal((await request('/api/client-status', { method: 'POST', body: JSON.stringify({ screenId: 'home', panels }) })).status, 422);
  }
  assert.equal((await request('/api/client-status', { method: 'POST', headers: { 'Content-Type': 'application/jsonp' }, body: '{}' })).status, 415);
});

test('saving UTF-8 split across network chunks preserves the exact screen title', async t => {
  const { request, base, headers } = await fixture(t);
  const initial = await (await request('/api/admin/design')).json();
  initial.design.screens.home.title = 'Café ☀️ 東京';
  const bytes = Buffer.from(JSON.stringify(initial));
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + '/api/admin/design', { method: 'PUT', headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(bytes.subarray(0, split));
    setTimeout(() => req.end(bytes.subarray(split)), 25);
  });
  assert.equal(status, 200);
  const saved = await (await request('/api/admin/design')).json();
  assert.equal(saved.design.screens.home.title, 'Café ☀️ 東京');
});
