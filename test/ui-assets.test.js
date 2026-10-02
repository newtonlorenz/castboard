import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the full-screen news rail cannot expand its bounded grid track', async () => {
  const css = await fs.readFile(path.join(root, 'plugins/news/style.css'), 'utf8');
  const rule = css.match(/\.briefing-wire\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(rule, /min-height:\s*0/);
  assert.match(rule, /overflow:\s*hidden/);
});
