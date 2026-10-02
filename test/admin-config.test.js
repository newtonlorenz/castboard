import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  authorizeAdmin,
  configRevision,
  extractDesign,
  isAllowedApplicationHost,
  isLocalAdminHost,
  mergeDesign,
  writableConfigPath,
  writeConfigAtomic,
} from '../src/core/admin-config.js';

function privateConfig() {
  return {
    server: { port: 8787 },
    branding: { name: 'Private board', accent: '#8ee6c2' },
    admin: { enabled: true, allowLan: true, token: '${ADMIN_TOKEN}' },
    defaultScreen: 'home',
    casting: { protocols: { 'http-webhook': { headers: { Authorization: '${WEBHOOK_TOKEN}' } } } },
    screens: {
      home: {
        path: '/', title: 'Home', type: 'grid', castProtocol: 'google-cast',
        targets: [{ name: 'Kitchen', device: 'kitchen-secret-device' }],
        layout: { columns: 4, rows: 2 },
        panels: [{ id: 'clock', plugin: 'clock', position: { column: 1, row: 1, width: 2, height: 1 } }],
      },
    },
    plugins: { clock: { enabled: true, token: '${CLOCK_TOKEN}' } },
  };
}

test('design extraction excludes delivery and provider secrets', () => {
  const serialized = JSON.stringify(extractDesign(privateConfig()));
  for (const secret of ['targets', 'castProtocol', 'kitchen-secret-device', 'WEBHOOK_TOKEN', 'CLOCK_TOKEN', 'ADMIN_TOKEN']) {
    assert.equal(serialized.includes(secret), false, `${secret} must stay server-side`);
  }
});

test('design merge preserves private settings and raw environment placeholders', () => {
  const raw = privateConfig();
  const design = extractDesign(raw);
  design.screens.home.title = 'Edited Home';
  design.screens.home.appearance = { accent: '#ffcc66', textColor: '#fff7e0', fontFamily: 'rounded', fontScale: 110, radius: 12 };
  design.screens.home.panels[0].appearance = { background: '#111111', fontFamily: 'mono', fontScale: 90 };
  design.screens.extra = { id: 'extra', path: '/extra', title: 'Extra', type: 'single', layout: { padding: 4 }, appearance: {}, panels: [{ id: 'news', plugin: 'clock' }] };
  const merged = mergeDesign(raw, design);
  assert.equal(merged.screens.home.title, 'Edited Home');
  assert.deepEqual(merged.screens.home.targets, raw.screens.home.targets);
  assert.equal(merged.screens.home.castProtocol, 'google-cast');
  assert.equal(merged.screens.home.appearance.fontFamily, 'rounded');
  assert.equal(merged.screens.home.panels[0].appearance.background, '#111111');
  assert.equal(merged.plugins.clock.token, '${CLOCK_TOKEN}');
  assert.equal(merged.casting.protocols['http-webhook'].headers.Authorization, '${WEBHOOK_TOKEN}');
  assert.deepEqual(merged.screens.extra.targets, []);
  assert.equal('id' in merged.screens.extra, false);
});

test('revisions change with configuration content', () => {
  const before = privateConfig();
  const after = privateConfig();
  after.screens.home.title = 'Changed';
  assert.notEqual(configRevision(before), configRevision(after));
  assert.equal(configRevision(before), configRevision(privateConfig()));
});

test('admin access is local by default and token-protected on the LAN', () => {
  const request = (address, authorization = '', host = 'localhost:8787') => ({ socket: { remoteAddress: address }, headers: { authorization, host } });
  assert.equal(authorizeAdmin(request('127.0.0.1'), { admin: {} }), true);
  assert.equal(authorizeAdmin(request('::ffff:127.0.0.1'), { admin: {} }), true);
  assert.equal(authorizeAdmin(request('127.0.0.1', '', 'attacker.example'), { admin: {} }), false);
  assert.equal(isLocalAdminHost('[::1]:8787'), true);
  assert.equal(isLocalAdminHost('localhost.attacker.example'), false);
  assert.equal(authorizeAdmin(request('192.168.1.20'), { admin: {} }), false);
  const config = { admin: { allowLan: true, token: 'correct-horse-battery' } };
  assert.equal(authorizeAdmin(request('192.168.1.20', 'Bearer wrong'), config), false);
  assert.equal(authorizeAdmin(request('192.168.1.20', 'Bearer correct-horse-battery'), config), true);
  assert.equal(authorizeAdmin(request('127.0.0.1'), { admin: { enabled: false } }), false);
});

test('application hosts reject public DNS rebinding names unless explicitly allowed', () => {
  for (const host of ['localhost:8787', '127.0.0.1:8787', '[::1]:8787', 'castboard.local:8787', 'home-server:8787']) {
    assert.equal(isAllowedApplicationHost(host), true, host);
  }
  assert.equal(isAllowedApplicationHost('attacker.example:8787'), false);
  assert.equal(isAllowedApplicationHost('dashboard.example.test:8787', ['dashboard.example.test']), true);
});

test('example config saves to an ignored local config using an atomic write', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-admin-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const examplePath = path.join(directory, 'castboard.config.example.json');
  const target = writableConfigPath(examplePath, directory);
  assert.equal(target, path.join(directory, 'castboard.config.json'));
  await writeConfigAtomic(target, privateConfig());
  const written = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(written.plugins.clock.token, '${CLOCK_TOKEN}');
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['castboard.config.json']);
});


test('trusted proxy receivers do not inherit local administrator privileges',()=>{
 const config={server:{trustedProxyAddresses:['127.0.0.1']},admin:{allowLan:true,token:'correct-horse-battery'}};
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost','x-castboard-receiver':'192.0.2.20'}};
 assert.equal(authorizeAdmin(req,config),false);
 req.headers.authorization='Bearer correct-horse-battery';
 assert.equal(authorizeAdmin(req,config),true);
 delete req.headers.authorization;
 req.headers['x-castboard-receiver']='127.0.0.1';
 assert.equal(authorizeAdmin(req,config),true);
 req.socket.remoteAddress='192.0.2.20';
 assert.equal(authorizeAdmin(req,config),false);
});
