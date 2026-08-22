import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCastPlan } from '../scripts/cast.mjs';

const config = {
  server: { port: 8787 },
  defaultScreen: 'home',
  casting: { defaultProtocol: 'google-cast' },
  screens: {
    home: { path: '/', type: 'grid', castProtocol: 'google-cast', targets: [{ name: 'Kitchen', device: 'Kitchen Hub' }, { name: 'Hallway', endpoint: 'http://hallway/cast', protocol: 'http-webhook' }] },
    office: { path: '/screens/office', type: 'single', targets: [{ name: 'Office', device: 'Office Hub' }] },
  },
};

test('one screen can fan out to many Cast targets', () => {
  assert.deepEqual(buildCastPlan(config, '192.168.1.10', 'home'), [
    { screenId: 'home', screenType: 'grid', protocol: 'google-cast', target: { name: 'Kitchen', device: 'Kitchen Hub' }, url: 'http://192.168.1.10:8787/' },
    { screenId: 'home', screenType: 'grid', protocol: 'http-webhook', target: { name: 'Hallway', endpoint: 'http://hallway/cast', protocol: 'http-webhook' }, url: 'http://192.168.1.10:8787/' },
  ]);
});

test('--all produces a plan for every screen and target', () => {
  assert.equal(buildCastPlan(config, '192.168.1.10', '--all').length, 3);
});

test('a CLI protocol override applies to every selected target', () => {
  assert.ok(buildCastPlan(config, '192.168.1.10', '--all', 'url').every(item => item.protocol === 'url'));
});
