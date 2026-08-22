import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Docker build context excludes local configuration and secret files', async () => {
  const entries = new Set((await fs.readFile(path.join(ROOT, '.dockerignore'), 'utf8')).split(/\r?\n/).filter(Boolean));
  for (const required of ['.git', '.env', '.env.*', '.npmrc', 'castboard.config.json', 'node_modules', '*.log', '*.key', '*.pem']) {
    assert.equal(entries.has(required), true, `.dockerignore must include ${required}`);
  }
  const dockerfile = await fs.readFile(path.join(ROOT, 'Dockerfile'), 'utf8');
  assert.equal(dockerfile.includes('COPY --chown=node:node . .'), false, 'Dockerfile must use an explicit runtime allowlist');
  for (const directory of ['src', 'public', 'plugins', 'screen-types', 'cast-protocols']) assert.match(dockerfile, new RegExp(`COPY --chown=node:node ${directory}`));
  assert.match(dockerfile, /CASTBOARD_CONFIG=\/data\/castboard\.config\.json/);
  assert.match(dockerfile, /VOLUME \["\/data"\]/);
  const compose = await fs.readFile(path.join(ROOT, 'compose.yaml'), 'utf8');
  assert.match(compose, /castboard-data:\/data/);
  assert.match(compose, /CASTBOARD_ADMIN_TOKEN/);
});
