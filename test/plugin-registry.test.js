import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverPlugins } from '../src/core/plugin-registry.js';

async function pluginFixture(t, source, withWidget = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-plugin-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'sample');
  await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, 'plugin.js'), source);
  if (withWidget) await fs.writeFile(path.join(directory, 'widget.js'), 'export function mount() {}\n');
  return root;
}

const config = {
  plugins: { sample: { enabled: true } },
  screens: { home: { panels: [{ id: 'sample', plugin: 'sample' }] } },
};

test('plugin descriptors validate hook types at startup', async t => {
  const root = await pluginFixture(t, "export function createPlugin() { return { id: 'sample', name: 'Sample', getData: true }; }\n");
  await assert.rejects(discoverPlugins({ pluginsDir: root, config, context: {} }), /getData must be a function/);
});

test('a plugin placed on a screen must provide a browser widget', async t => {
  const root = await pluginFixture(t, "export function createPlugin() { return { id: 'sample', name: 'Sample' }; }\n", false);
  await assert.rejects(discoverPlugins({ pluginsDir: root, config, context: {} }), /without widget\.js/);
});


test('display defaults preserve the public hook instance context and configured false values',async t=>{
 const root=await pluginFixture(t,"export function createPlugin(){return {id:'sample',name:'Sample',publicConfig(){return {id:this.id,title:this.name,show:true};}}}");
 await fs.writeFile(path.join(root,'sample','plugin.json'),JSON.stringify({name:'Sample package',settingsSchema:{type:'object',properties:{displayName:{type:'string'},show:{type:'boolean'}}},optionSchema:{type:'object',properties:{show:{type:'boolean',default:true}}}}));
 const [plugin]=await discoverPlugins({pluginsDir:root,config:{plugins:{copy:{type:'sample',displayName:'Lobby display',show:false}},screens:{home:{panels:[{id:'copy',plugin:'copy'}]}}},context:{}});
 assert.deepEqual(plugin.publicConfig(),{show:false,id:'copy',title:'Lobby display'});
});
