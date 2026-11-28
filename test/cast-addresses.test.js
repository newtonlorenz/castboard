import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshCastAddresses } from '../src/core/cast-addresses.js';

const config = () => ({ casting: { defaultProtocol: 'google-cast' }, screens: {
  office: { path: '/office', targets: [{ uuid: 'office-uuid', address: '192.0.2.30', device: 'Office Display', resetBeforeCast: true }] },
  kitchen: { path: '/kitchen', targets: [{ uuid: 'kitchen-uuid', address: '192.0.2.28' }] },
} });

test('DHCP address refresh matches UUID, preserving settings and the input configuration', async () => {
  const c = config();
  const next = await refreshCastAddresses(c, c, async () => [
    { uuid: 'OFFICE-UUID', host: '192.0.2.60', friendly_name: 'Renamed Office' },
    { uuid: 'kitchen-uuid', host: '192.0.2.58' },
  ]);
  assert.equal(next.screens.office.targets[0].address, '192.0.2.60');
  assert.equal(next.screens.office.targets[0].resetBeforeCast, true);
  assert.equal(next.screens.kitchen.targets[0].address, '192.0.2.58');
  assert.equal(c.screens.office.targets[0].address, '192.0.2.30');
});

test('names, duplicate UUIDs, missing discovery and invalid addresses cannot change recipient scope', async () => {
  const c = config();
  for (const devices of [[],
    [{ uuid: 'other-uuid', host: '192.0.2.60', friendly_name: 'Office Display' }],
    [{ uuid: 'office-uuid', host: '192.0.2.60' }, { uuid: 'office-uuid', host: '192.0.2.61' }],
    [{ uuid: 'office-uuid', host: 'example.com' }],
    [{ uuid: 'office-uuid', host: '192.0.2.30' }],
  ]) assert.equal(await refreshCastAddresses(c, c, async () => devices), null);
  await assert.rejects(refreshCastAddresses(c, c, async () => { throw Error('discovery offline'); }));
});

test('unpinned receivers do not trigger discovery and unrelated protocols are preserved', async () => {
  const c = config();
  for (const screen of Object.values(c.screens)) delete screen.targets[0].uuid;
  assert.equal(await refreshCastAddresses(c, c, async () => { throw Error('must not scan'); }), null);
  c.screens.office.targets[0].uuid = 'office-uuid';
  c.screens.office.targets[0].protocol = 'webhook';
  assert.equal(await refreshCastAddresses(c, c, async () => [{ uuid: 'office-uuid', host: '192.0.2.60' }]), null);
});
