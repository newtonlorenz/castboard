import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCastPlan } from '../scripts/cast.mjs';

const config = {
  server: { port: 8787 },
  defaultScreen: 'home',
  screens: {
    home: { path: '/', targets: ['Kitchen', 'Hallway'] },
    office: { path: '/screens/office', targets: ['Office'] },
  },
};

test('one screen can fan out to many Cast targets', () => {
  assert.deepEqual(buildCastPlan(config, '192.168.1.10', 'home'), [
    { screenId: 'home', device: 'Kitchen', url: 'http://192.168.1.10:8787/' },
    { screenId: 'home', device: 'Hallway', url: 'http://192.168.1.10:8787/' },
  ]);
});

test('--all produces a plan for every screen and target', () => {
  assert.equal(buildCastPlan(config, '192.168.1.10', '--all').length, 3);
});
