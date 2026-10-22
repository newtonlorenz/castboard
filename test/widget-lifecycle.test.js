import test from 'node:test';
import assert from 'node:assert/strict';
import { createWidgetContext } from '../public/widget-kit.js';

function context() {
  const plugin = { id: 'clock' };
  return createWidgetContext({ app: { plugins: [plugin] }, screen: {}, plugin, panel: {}, element: {} });
}

test('widget disposal releases late async mounts immediately and exactly once', () => {
  const widget = context();
  const calls = [];
  widget.onDispose(() => calls.push('first'));
  widget.onDispose(() => { calls.push('second'); throw new Error('failed cleanup'); });
  widget.dispose();
  widget.onDispose(() => calls.push('late mount'));
  widget.dispose();
  assert.deepEqual(calls, ['second', 'first', 'late mount']);
  assert.equal(widget.signal.aborted, true);
});

test('an async widget cannot create polling timers after disposal', t => {
  const widget = context();
  widget.dispose();
  let intervals = 0;
  t.mock.method(globalThis, 'setInterval', () => { intervals++; });
  widget.schedule(() => { throw new Error('Disposed widgets must not refresh'); }, 1000);
  assert.equal(intervals, 0);
});
