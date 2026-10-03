import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson } from '../src/core/providers.js';
import { createPlugin as createCamera } from '../plugins/camera/plugin.js';

test('camera keeps its source name unless an explicit panel title is configured', async () => {
  const camera = createCamera({ config: { provider: 'demo', name: 'Front door' }, context: { instanceId: 'front-door' } });
  const data = await camera.getData();
  const settings = camera.publicConfig();
  assert.equal(settings.title || data.name || settings.name, 'Front door');
  const titled = createCamera({ config: { provider: 'demo', name: 'Front door', title: 'Entrance' }, context: { instanceId: 'front-door' } });
  assert.equal(titled.publicConfig().title, 'Entrance');
});

test('provider timeout covers a stalled response body', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => new Response(new ReadableStream({
    start(controller) {
      const timer = setTimeout(() => controller.enqueue(new TextEncoder().encode('{"late":true}')), 1000);
      options.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.error(options.signal.reason);
      }, { once: true });
    },
  }));
  await assert.rejects(fetchJson('http://provider.test', {}, 10), /timed out/);
});

test('provider JSON responses are size-bounded and upstream errors are not reflected', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('{"value":"0123456789"}');
  await assert.rejects(fetchJson('http://provider.test', {}, 1000, 8), /exceeds 8 bytes/);
  globalThis.fetch = async () => new Response('{"error":{"message":"private backend detail"}}', { status: 500 });
  await assert.rejects(fetchJson('http://provider.test'), error => error.message === 'Provider returned HTTP 500');
});
