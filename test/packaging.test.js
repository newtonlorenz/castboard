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


test('public flexible example starts from its publishable configuration',async t=>{
 const {createApp}=await import('../src/server.js');
 const app=await createApp({configPath:path.join(ROOT,'examples/flexible/castboard.config.example.json')});
 t.after(()=>app.dispose());
 assert.equal(app.plugins.find(p=>p.id==='north').type,'readings');
 assert.equal((await app.plugins.find(p=>p.id==='north').getData()).value,12);
 assert.equal((await app.plugins.find(p=>p.id==='south').getData()).value,75);
 assert.equal(app.publicConfig.screens.home.panels.length,4);
 assert.equal(app.screenTypes.some(type=>type.id==='area-grid'),true);
});

test('renderer Docker image includes every local runtime import',async()=>{
 const dir=path.join(ROOT,'services/frame-renderer'),dockerfile=await fs.readFile(path.join(dir,'Dockerfile'),'utf8');
 for(const entry of ['server.js','renderer.js','images.js']){
  assert.ok(dockerfile.includes(entry),`Renderer image is missing ${entry}`);
  const source=await fs.readFile(path.join(dir,entry),'utf8');
  for(const match of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g))assert.ok(dockerfile.includes(match[1]),`Renderer image is missing imported ${match[1]}`);
 }
});
