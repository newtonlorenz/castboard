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
    screens: { home: { path: '/', title: 'Home', targets: ['Private display'], grid: { columns: 4, rows: 2 }, panels: [{ id: 'sample', plugin: 'sample', position: { column: 1, row: 1, width: 2, height: 1 } }] } },
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

test('screen validation accepts many screens and rejects panels outside their grid', () => {
  const base = { server: { port: 8787 }, plugins: {}, defaultScreen: 'one' };
  const screen = path => ({ path, grid: { columns: 4, rows: 3 }, panels: [], targets: [] });
  assert.doesNotThrow(() => validateConfig({ ...base, screens: { one: screen('/'), two: screen('/screens/two') } }));
  assert.throws(() => validateConfig({ ...base, screens: { one: { ...screen('/'), panels: [{ id: 'wide', plugin: 'sample', position: { column: 4, row: 1, width: 2, height: 1 } }] } } }), /exceeds its grid/);
});
