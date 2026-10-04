import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.js';
import { createMcp, MCP_TOOLS, documentationResources, readDocumentation } from '../src/mcp.js';
import { configurationView, patchConfiguration, safeConfigurationError } from '../src/core/ai-config.js';

const raw = () => ({
  server: { host: '127.0.0.1', port: 8787 },
  branding: { name: 'MCP board' }, defaultScreen: 'home',
  admin: { token: 'secret-admin-value' },
  screens: { home: { path: '/', type: 'single', panels: [{ id: 'clock', plugin: 'clock' }], targets: [] } },
  plugins: { clock: { enabled: true }, calendar: { enabled: false, url: 'https://example.test/private-feed' }, stocks: { enabled: false, apiKey: '${STOCK_KEY}' } },
});
const packages = [{ id: 'calendar', settingsSchema: { properties: { url: { sensitive: true } } } }];
const rpc = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });

test('AI configuration reads redact literal and schema secrets, preserving raw placeholders', () => {
  const config = raw();
  config.plugins.clock.headers = { Authorization: 'secret-header-value' };
  config.plugins.clock.url = 'https://service.test/feed?token=private';
  const view = configurationView(config, packages);
  const text = JSON.stringify(view);
  for (const secret of ['secret-admin-value', 'secret-header-value', 'private-feed', '?token=private']) assert.equal(text.includes(secret), false);
  assert.equal(view.config.plugins.stocks.apiKey, '${STOCK_KEY}');
  assert.ok(view.protectedPaths.includes('/plugins/calendar/url'));
  assert.deepEqual(raw(), { ...config, plugins: raw().plugins });
  const message = safeConfigurationError(new Error('Failed secret-admin-value https://host.test/private'), [config], packages);
  assert.equal(message.includes('secret-admin-value'), false);
  assert.equal(message.includes('host.test'), false);
});

test('targeted configuration patches preserve secrets and reject pollution and redacted writes', () => {
  const config = raw();
  const next = patchConfiguration(config, [{ op: 'set', path: '/branding/name', value: 'Changed' }, { op: 'set', path: '/casting/protocols/url', value: { enabled: true } }]);
  assert.equal(next.admin.token, config.admin.token);
  assert.equal(next.branding.name, 'Changed');
  assert.equal(config.branding.name, 'MCP board');
  for (const operation of [
    { op: 'set', path: '/__proto__/polluted', value: true },
    { op: 'set', path: '/plugins/clock', value: JSON.parse('{"constructor":{"polluted":true}}') },
    { op: 'set', path: '/admin/token', value: '[REDACTED]' },
    { op: 'set', path: '/screens/home/panels/0/id', value: 'bad' },
    { op: 'set', path: '/branding/~2name', value: 'bad' },
    { op: 'remove', path: '/does-not-exist' },
  ]) assert.throws(() => patchConfiguration(config, [operation]));
  assert.equal({}.polluted, undefined);
  assert.equal(patchConfiguration({ 'a/b': { '~c': 1 } }, [{ op: 'set', path: '/a~1b/~0c', value: 2 }])['a/b']['~c'], 2);
});

test('MCP discovers tools, documentation and prompts offline, validating input and protocol errors', async () => {
  const mcp = createMcp({ fetchImpl: () => { throw new Error('offline'); } });
  const initialized = await mcp.handle(rpc('initialize', { protocolVersion: '2024-11-05' }));
  assert.equal(initialized.result.protocolVersion, '2024-11-05');
  assert.deepEqual(Object.keys(initialized.result.capabilities), ['tools', 'resources', 'prompts']);
  assert.equal(await mcp.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await mcp.handle(rpc('tools/list'))).result.tools.length, MCP_TOOLS.length);
  const resources = await documentationResources();
  assert.ok(resources.some(item => item.uri === 'castboard://docs/mcp'));
  for (const resource of resources) assert.ok((await readDocumentation(resource.name)).text.length);
  assert.match((await mcp.handle(rpc('resources/read', { uri: 'castboard://docs/mcp' }))).result.contents[0].text, /dryRun/);
  assert.equal((await mcp.handle(rpc('resources/read', { uri: 'castboard://docs/../../.env' }))).error.code, -32602);
  assert.equal((await mcp.handle(rpc('nonexistent'))).error.code, -32601);
  assert.equal((await mcp.handle({ method: 'ping', id: 1 })).error.code, -32600);
  assert.equal((await mcp.handle(rpc('tools/call', { name: 'castboard_get_design', arguments: { extra: 1 } }))).result.isError, true);
  assert.equal((await mcp.handle(rpc('tools/call', { name: 'unknown' }))).error.code, -32602);
  assert.match((await mcp.handle(rpc('prompts/get', { name: 'configure-castboard', arguments: { goal: 'Madrid weather' } }))).result.messages[0].content.text, /Madrid weather/);
  assert.match((await mcp.handle(rpc('tools/call', { name: 'castboard_get_configuration' }))).result.content[0].text, /Cannot reach/);
  assert.throws(() => createMcp({ baseUrl: 'http://remote.test', token: 'secret' }), /HTTPS/);
  assert.throws(() => createMcp({ baseUrl: 'https://user:pass@remote.test' }), /origin/);
});

test('MCP bridge runs a complete live dry-run/save/conflict workflow without leaking private values', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-mcp-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, 'castboard.config.json');
  await fs.writeFile(configPath, JSON.stringify(raw()));
  const app = await createApp({ cwd: directory, configPath, env: { STOCK_KEY: 'expanded-stock-key' }, logger: { error() {} } });
  t.after(async () => { app.server.close(); app.server.closeAllConnections(); await app.dispose(); });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const mcp = createMcp({ baseUrl });
  async function call(name, args) {
    return (await mcp.handle(rpc('tools/call', { name, arguments: args }))).result;
  }
  const view = (await call('castboard_get_configuration')).structuredContent;
  assert.equal(JSON.stringify(view).includes('expanded-stock-key'), false);
  assert.equal(JSON.stringify(view).includes('private-feed'), false);
  const operations = [{ op: 'set', path: '/branding/name', value: 'AI configured' }, { op: 'set', path: '/plugins/weather', value: { type: 'weather', enabled: true, provider: 'open-meteo', latitude: 40.4, longitude: -3.7 } }];
  const before = await fs.readFile(configPath, 'utf8');
  const validated = await call('castboard_patch_configuration', { revision: view.revision, operations });
  assert.equal(validated.structuredContent.valid, true);
  assert.equal(validated.structuredContent.applied, false);
  assert.equal(await fs.readFile(configPath, 'utf8'), before);
  assert.equal(app.config.branding.name, 'MCP board');
  const saved = (await call('castboard_patch_configuration', { revision: view.revision, operations, dryRun: false })).structuredContent;
  assert.equal(saved.applied, true);
  assert.notEqual(saved.revision, view.revision);
  assert.equal(app.config.branding.name, 'AI configured');
  assert.ok(app.plugins.some(plugin => plugin.id === 'weather'));
  assert.equal(app.rawConfig.plugins.stocks.apiKey, '${STOCK_KEY}');
  assert.equal(app.rawConfig.admin.token, 'secret-admin-value');
  assert.equal((await fs.stat(configPath)).mode & 0o777, 0o600);
  assert.equal((await call('castboard_patch_configuration', { revision: view.revision, operations, dryRun: false })).isError, true);
  const invalid = await call('castboard_patch_configuration', { revision: saved.revision, operations: [{ op: 'set', path: '/screens/home/type', value: 'missing' }], dryRun: false });
  assert.equal(invalid.isError, true);
  assert.equal(app.config.screens.home.type, 'single');
  const port = await call('castboard_patch_configuration', { revision: saved.revision, operations: [{ op: 'set', path: '/server/port', value: 9999 }] });
  assert.equal(port.structuredContent.restartRequired, true);
  assert.equal((await call('castboard_get_status')).structuredContent.health.ok, true);
  assert.equal((await call('castboard_get_plugins')).structuredContent.instances.some(item => item.id === 'weather'), true);
  if (MCP_TOOLS.some(tool => tool.name === 'castboard_get_devices')) {
    const devices = (await call('castboard_get_devices')).structuredContent;
    assert.equal((await call('castboard_get_display_adapters')).structuredContent.ok, true);
    const created = (await call('castboard_change_device', { revision: devices.revision, action: 'create', id: 'test-display', device: { name: 'Test display', screenId: 'home', mode: 'native' } })).structuredContent;
    assert.ok(created.connectionKey);
    const hash = app.rawConfig.devices['test-display'].tokenHash;
    const deviceView = (await call('castboard_get_configuration')).structuredContent;
    assert.equal(deviceView.config.devices['test-display'].tokenHash, '[REDACTED]');
    const rejected = await call('castboard_patch_configuration', { revision: deviceView.revision, operations: [{ op: 'set', path: '/devices/test-display/format', value: 'unsupported' }], dryRun: false });
    assert.equal(rejected.isError, true);
    const edited = await call('castboard_patch_configuration', { revision: deviceView.revision, operations: [{ op: 'set', path: '/devices/test-display/width', value: 320 }], dryRun: false });
    assert.equal(edited.structuredContent.applied, true);
    assert.equal(app.config.devices['test-display'].width, 320);
    assert.equal(app.rawConfig.devices['test-display'].tokenHash, hash);
  }
  const forbidden = await fetch(`${baseUrl}/api/admin/configuration`, { headers: { 'x-castboard-receiver': '192.0.2.1' } });
  // With no trusted proxy configured, caller-supplied forwarding is ignored.
  assert.equal(forbidden.status, 200);
  app.config.admin.enabled = false;
  assert.equal((await fetch(`${baseUrl}/api/admin/configuration`)).status, 403);
});

test('stdio entrypoint handles actual framing, notifications, parse errors and clean EOF', async () => {
  const child = spawn(process.execPath, ['src/mcp.js'], { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const exited = once(child, 'exit');
  child.stdin.end([JSON.stringify(rpc('initialize', { protocolVersion: '2025-11-25' }, 0)), JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), '{invalid', JSON.stringify(rpc('tools/list', {}, 2)), JSON.stringify(rpc('tools/call', { name: 'castboard_read_documentation', arguments: { topic: 'mcp' } }, 3)), ''].join('\n'));
  const [code] = await exited;
  assert.equal(code, 0, stderr);
  assert.equal(stderr, '');
  const messages = stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(messages.map(item => item.id), [0, null, 2, 3]);
  assert.equal(messages[1].error.code, -32700);
  assert.equal(messages[2].result.tools.length, MCP_TOOLS.length);
  assert.match(messages[3].result.content[0].text, /Castboard MCP/);
});
