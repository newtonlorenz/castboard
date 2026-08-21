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
    screens: { home: { path: '/', widgets: [] } },
    plugins: { sample: { token: 'do-not-leak', url: 'http://private' } },
  };
  const output = publicAppConfig(config, [{ id: 'sample', name: 'Sample', publicConfig: () => ({ label: 'Public' }) }]);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('do-not-leak'), false);
  assert.equal(serialized.includes('http://private'), false);
  assert.equal(output.plugins[0].config.label, 'Public');
});
