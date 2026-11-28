import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.CASTBOARD_BROWSER_TESTS === '1';
const input = { id: 'bench', token: 'x'.repeat(32), width: 16, height: 16, format: 'jpeg', revision: 'before' };
const appOrigin = 'http://display.example.test';

test('replacing a renderer session reserves its slot until the old browser context closes', { skip: !enabled }, async t => {
  const { createFrameRenderer } = await import('../renderer.js');
  const { default: sharp } = await import('sharp');
  const pixels = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#234' } }).png().toBuffer();
  const closeStarted = Promise.withResolvers();
  const finishClose = Promise.withResolvers();
  const contexts = [];
  const page = { on() {}, goto: async () => ({ ok: () => true }), waitForFunction: async () => {}, evaluate: async () => null, screenshot: async () => pixels };
  const browser = { async newContext() {
    const context = { route: async () => {}, newPage: async () => page, close: async () => {} };
    if (!contexts.length) context.close = () => { closeStarted.resolve(); return finishClose.promise; };
    contexts.push(context);
    return context;
  } };
  const renderer = createFrameRenderer({ browser, appOrigin, maxSessions: 1 });
  t.after(() => { finishClose.resolve(); return renderer.dispose(); });

  await renderer.render(input);
  const replacement = renderer.render({ ...input, revision: 'after' });
  await closeStarted.promise;
  await assert.rejects(renderer.render({ ...input, revision: 'after' }), { statusCode: 409 });
  await assert.rejects(renderer.render({ ...input, id: 'other' }), { statusCode: 503 });
  assert.equal(contexts.length, 1);
  finishClose.resolve();
  await replacement;
  assert.equal(contexts.length, 2);
  await renderer.dispose();
  await assert.rejects(renderer.render(input), { statusCode: 503 });
});

test('a browser context created during renderer shutdown is released', { skip: !enabled }, async () => {
  const { createFrameRenderer } = await import('../renderer.js');
  const pending = Promise.withResolvers();
  const renderer = createFrameRenderer({ appOrigin, browser: { newContext: () => pending.promise } });
  const render = renderer.render(input);
  const shutdown = renderer.dispose();
  let closed = false;
  pending.resolve({ close() { closed = true; } });
  await assert.rejects(render, { statusCode: 503 });
  await shutdown;
  assert.equal(closed, true);
});
