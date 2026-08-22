import test from 'node:test';
import assert from 'node:assert/strict';
import { expandEnvironment, publicAppConfig, validateConfig } from '../src/core/config.js';

test('environment references expand recursively', () => {
  const result = expandEnvironment({ url: '${BASE_URL}/feed', nested: ['${TOKEN}'] }, { BASE_URL: 'http://localhost', TOKEN: 'private' });
  assert.deepEqual(result, { url: 'http://localhost/feed', nested: ['private'] });
});

test('missing environment values fail closed', () => {
  assert.throws(() => expandEnvironment('${MISSING}', {}), /Missing environment variable: MISSING/);
});

test('configuration validates screen and port boundaries', () => {
  assert.throws(() => validateConfig({ server: { port: 0 }, screens: {}, plugins: {} }), /server.port/);
  assert.throws(() => validateConfig({ server: { port: 8787 }, screens: { home: { path: 'home' } }, plugins: {} }), /must start with/);
});

test('public configuration contains only explicit plugin output', () => {
  const config = {
    server: { port: 8787 },
    branding: { name: 'Test' },
    defaultScreen: 'home',
    screens: { home: { path: '/', title: 'Home', type: 'grid', targets: [{ name: 'Private display', device: 'private-device' }], layout: { columns: 4, rows: 2 }, panels: [{ id: 'sample', plugin: 'sample', position: { column: 1, row: 1, width: 2, height: 1 } }] } },
    plugins: { sample: { token: 'do-not-leak', url: 'http://private' } },
  };
  const output = publicAppConfig(config, [{ id: 'sample', name: 'Sample', publicConfig: () => ({ label: 'Public' }) }]);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('do-not-leak'), false);
  assert.equal(serialized.includes('http://private'), false);
  assert.equal(serialized.includes('Private display'), false);
  assert.equal(output.plugins[0].config.label, 'Public');
  assert.equal(output.screens.home.panels[0].position.width, 2);
});

test('base screen validation accepts many screen types and target protocols', () => {
  const base = { server: { port: 8787 }, plugins: {}, defaultScreen: 'one' };
  const screen = (path, type) => ({ path, type, layout: {}, panels: [], targets: [{ name: 'Display', protocol: 'url' }] });
  assert.doesNotThrow(() => validateConfig({ ...base, screens: { one: screen('/', 'flow'), two: screen('/screens/two', 'single') } }));
  assert.throws(() => validateConfig({ ...base, screens: { one: { ...screen('/', 'flow'), targets: [{ protocol: 'url' }] } } }), /requires name, device, or endpoint/);
});

test('admin and screen appearance settings validate safe boundaries', () => {
  const base = { server: { port: 8787 }, plugins: {}, defaultScreen: 'home', screens: { home: { path: '/', panels: [] } } };
  assert.doesNotThrow(() => validateConfig({ ...base, admin: { enabled: true, allowLan: false }, screens: { home: { path: '/', panels: [{ id: 'clock', plugin: 'clock', appearance: { fontFamily: 'mono', fontScale: 85, background: '#101010', padding: 6, shadow: 'none' } }], appearance: { background: '#07100f', accent: '#8ee6c2', textColor: '#f3faf7', mutedColor: '#91a49e', fontFamily: 'rounded', headingFontFamily: 'serif', fontScale: 120, radius: 48, panelPadding: 0, borderWidth: 1.5, shadow: 'deep' } } } }));
  assert.throws(() => validateConfig({ ...base, admin: { allowLan: true } }), /admin.token is required/);
  assert.throws(() => validateConfig({ ...base, screens: { home: { path: '/', panels: [], appearance: { background: 'red' } } } }), /must be a hex color/);
  assert.throws(() => validateConfig({ ...base, screens: { home: { path: '/', panels: [], appearance: { radius: 49 } } } }), /radius must be from 0 to 48/);
  assert.throws(() => validateConfig({ ...base, screens: { home: { path: '/', panels: [], appearance: { fontFamily: 'comic-sans' } } } }), /fontFamily must be/);
  assert.throws(() => validateConfig({ ...base, screens: { home: { path: '/', panels: [{ id: 'clock', plugin: 'clock', appearance: { fontScale: 200 } }] } } }), /fontScale must be from 60 to 180/);
});
