import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { probeCastTarget } from '../src/core/cast-health.js';

const target = { address: '192.0.2.37' };

test('the control probe uses the fixed Cast port and releases its connection', async () => {
  let destroyed = false;
  const socket = new EventEmitter();
  socket.destroy = () => { destroyed = true; };
  const result = await probeCastTarget(target, { connect: options => {
    assert.deepEqual(options, { host: target.address, port: 8009 });
    queueMicrotask(() => socket.emit('connect'));
    return socket;
  } });
  assert.deepEqual(result, { reachable: true, reason: 'cast-reachable' });
  assert.equal(destroyed, true);
});

test('a stalled or rejected Cast control connection is unsuccessful', async () => {
  let released = 0;
  for (const event of ['error', 'close', null]) {
    const socket = new EventEmitter();
    socket.destroy = () => { released++; };
    const result = await probeCastTarget(target, { timeoutMs: 10, connect: () => {
      if (event) queueMicrotask(() => socket.emit(event, new Error('offline')));
      return socket;
    } });
    assert.deepEqual(result, { reachable: false, reason: 'cast-unreachable' });
  }
  assert.equal(released, 3);
});

test('non-IP receiver addresses never reach the network', async () => {
  for (const address of ['receiver.example.test', '192.0.2.37:1234', '', undefined]) {
    assert.deepEqual(await probeCastTarget({ address }, { connect: () => assert.fail('unexpected connection') }),
      { reachable: false, reason: 'invalid-receiver-address' });
  }
});
