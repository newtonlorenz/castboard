import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCastProtocols } from '../src/core/cast-protocol-registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cast protocols are enabled and discovered from configuration', async () => {
  const protocols = await discoverCastProtocols({
    protocolsDir: path.join(ROOT, 'cast-protocols'),
    config: { casting: { protocols: { 'google-cast': { enabled: false }, url: { enabled: true }, 'http-webhook': { enabled: true, endpoint: 'http://example.invalid' } } } },
  });
  assert.deepEqual(protocols.map(protocol => protocol.id), ['http-webhook', 'url']);
  const urlProtocol = protocols.find(protocol => protocol.id === 'url');
  assert.deepEqual(await urlProtocol.cast({ target: { name: 'Tablet' }, url: 'http://castboard.local/' }), {
    target: 'Tablet', url: 'http://castboard.local/', message: 'Open http://castboard.local/ on the target screen',
  });
});

test('configured delivery references must resolve to enabled protocols', async () => {
  const config = {
    casting: { protocols: { url: { enabled: true } }, defaultProtocol: 'missing' },
    screens: { home: { path: '/', panels: [], targets: [] } },
  };
  await assert.rejects(discoverCastProtocols({ protocolsDir: path.join(ROOT, 'cast-protocols'), config }), /defaultProtocol references disabled or missing/);
});
