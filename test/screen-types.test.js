import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverScreenTypes } from '../src/core/screen-type-registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePanel = { id: 'clock', plugin: 'clock' };

test('built-in screen types are discoverable and validate their own layouts', async () => {
  const config = { screens: {
    grid: { type: 'grid', layout: { columns: 4, rows: 2 }, panels: [{ ...basePanel, position: { column: 1, row: 1, width: 2, height: 1 } }] },
    flow: { type: 'flow', layout: { minPanelWidth: 180 }, panels: [{ ...basePanel, size: { columns: 1, rows: 2 } }] },
    single: { type: 'single', panels: [basePanel] },
  } };
  const types = await discoverScreenTypes({ screenTypesDir: path.join(ROOT, 'screen-types'), config });
  assert.deepEqual(types.map(type => type.id), ['flow', 'grid', 'single']);
});

test('grid and single screen-type validation rejects invalid layouts', async () => {
  await assert.rejects(() => discoverScreenTypes({ screenTypesDir: path.join(ROOT, 'screen-types'), config: { screens: {
    bad: { type: 'grid', layout: { columns: 2, rows: 2 }, panels: [{ ...basePanel, position: { column: 2, row: 1, width: 2, height: 1 } }] },
  } } }), /exceeds its grid/);
  await assert.rejects(() => discoverScreenTypes({ screenTypesDir: path.join(ROOT, 'screen-types'), config: { screens: {
    bad: { type: 'single', panels: [basePanel, { ...basePanel, id: 'two' }] },
  } } }), /exactly one panel/);
});
