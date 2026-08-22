import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCastPlan, parseCastArgs } from '../scripts/cast.mjs';

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

test('cast options can appear before or after the selected screen', () => {
  assert.deepEqual(parseCastArgs(['--protocol', 'url', 'office'], 'home'), { requested: 'office', protocolOverride: 'url' });
  assert.deepEqual(parseCastArgs(['--all', '--protocol', 'url'], 'home'), { requested: '--all', protocolOverride: 'url' });
  assert.throws(() => parseCastArgs(['home', '--all'], 'home'), /not both/);
  assert.throws(() => parseCastArgs(['--unknown'], 'home'), /Unknown option/);
});

test('a configured public URL is used for cast delivery', () => {
  const configured = { ...config, server: { ...config.server, publicUrl: 'https://dashboard.example.test/castboard/' } };
  assert.equal(buildCastPlan(configured, '192.168.1.10', 'office')[0].url, 'https://dashboard.example.test/castboard/screens/office');
});
