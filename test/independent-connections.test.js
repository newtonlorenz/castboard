import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {once} from 'node:events';
import {pluginLibrary, changePluginConfig} from '../src/core/plugin-admin.js';
import {discoverPlugins} from '../src/core/plugin-registry.js';
import {createPlugin as calendarConnection} from '../plugins/ambient-calendar-source/plugin.js';

const pluginsDir = new URL('../plugins/', import.meta.url).pathname;
const context = {configDir: '/tmp', bindings: {}, getBranding: () => ({timeZone: 'UTC'})};

test('connection installation does not create a catch-all service or hidden provider instance', async () => {
  const packages = await pluginLibrary({pluginsDir, config: {}, configDir: '/tmp'});
  for (const domain of ['calendar', 'weather', 'solar', 'recovery', 'portfolio']) {
    const config = changePluginConfig({plugins: {}, screens: {}}, packages, {action: 'install', type: `ambient-${domain}-source`, id: `${domain}-account`});
    assert.deepEqual(Object.keys(config.plugins), [`${domain}-account`]);
    assert.equal(config.plugins[`${domain}-account`].provider, 'demo');
    const plugins = await discoverPlugins({pluginsDir, config, context});
    assert.equal(plugins.length, 1);
    assert.equal(plugins[0].contract, `${domain}-source@1`);
    const data = await plugins[0].getData();
    assert.equal(data.demo, true);
  }
});

test('separate calendar connections own their endpoints, credentials and results', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({path: req.url, authorization: req.headers.authorization});
    res.setHeader('Content-Type', 'application/json');
    const start = new Date(); start.setUTCHours(12, 0, 0, 0);
    res.end(JSON.stringify({events: [{id: req.url, title: req.url, start: start.toISOString(), end: new Date(start.getTime() + 3600000).toISOString()}]}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const a = calendarConnection({config: {provider: 'http-json', url: `${base}/a`, headers: {Authorization: 'account-a'}}, context});
  const b = calendarConnection({config: {provider: 'http-json', url: `${base}/b`, headers: {Authorization: 'account-b'}}, context});
  const [first, second] = await Promise.all([a.getData(), b.getData()]);
  assert.equal(first.events[0].title, '/a');
  assert.equal(second.events[0].title, '/b');
  assert.deepEqual(requests.sort((a, b) => a.path.localeCompare(b.path)), [{path: '/a', authorization: 'account-a'}, {path: '/b', authorization: 'account-b'}]);
  assert.doesNotMatch(JSON.stringify([a.publicConfig(), b.publicConfig()]), /account-a|account-b|http:/);
});

test('package dependencies check available code without configuring another instance', async () => {
  const pkg = JSON.parse(await fs.readFile(new URL('../plugins/ambient-calendar-source/plugin.json', import.meta.url), 'utf8'));
  assert.throws(() => changePluginConfig({plugins: {}}, [{...pkg, id: 'ambient-calendar-source', managed: true}], {action: 'install', type: 'ambient-calendar-source', id: 'timeline-data'}), /Required package.*calendar/);
});


test('single-domain companion displays install without shared services or global configuration', async () => {
  const packages = await pluginLibrary({pluginsDir, config: {}, configDir: '/tmp'});
  for (const domain of ['calendar', 'weather', 'solar', 'recovery', 'portfolio']) {
    const config = changePluginConfig({plugins: {}, screens: {}}, packages, {action: 'install', type: `ambient-${domain}`, id: `${domain}-panel`});
    assert.equal(Object.values(config.plugins).some(value => ['ambient-services', 'ambient-config-source'].includes(value.type)), false);
    const plugins = await discoverPlugins({pluginsDir, config, context});
    const view = plugins.find(plugin => plugin.id === `${domain}-panel`);
    assert.equal(view.defaultSource, view.bindings[domain]);
    const source = plugins.find(plugin => plugin.id === view.defaultSource);
    assert.equal(source.contract, view.inputContract);
    assert.equal((await source.getData()).demo, true);
  }
});


test('a clock owns its display settings and installs only rendering dependencies', async () => {
  const packages = await pluginLibrary({pluginsDir, config: {}, configDir: '/tmp'});
  const config = changePluginConfig({plugins: {}, screens: {}}, packages, {action: 'install', type: 'ambient-clock', id: 'lobby-clock'});
  assert.deepEqual(Object.keys(config.plugins).sort(), ['ambient-runtime', 'ambient-theme', 'lobby-clock']);
  config.plugins['lobby-clock'].location = 'Lobby';
  config.plugins['lobby-clock'].timeZone = 'Europe/Madrid';
  const plugins = await discoverPlugins({pluginsDir, config, context});
  const clock = plugins.find(plugin => plugin.id === 'lobby-clock');
  assert.equal(clock.inputContract, undefined);
  assert.equal(clock.publicConfig().location, 'Lobby');
  assert.equal(clock.publicConfig().timeZone, 'Europe/Madrid');
});


test('the companion focus lane requires only its calendar source', async () => {
  const packages = await pluginLibrary({pluginsDir, config: {}, configDir: '/tmp'});
  const config = changePluginConfig({plugins: {}, screens: {}}, packages, {action: 'install', type: 'ambient-focus', id: 'focus-lane'});
  assert.deepEqual(Object.keys(config.plugins).sort(), ['ambient-calendar-source', 'ambient-runtime', 'ambient-theme', 'focus-lane']);
  const plugins = await discoverPlugins({pluginsDir, config, context});
  const view = plugins.find(plugin => plugin.id === 'focus-lane');
  assert.equal(view.defaultSource, view.bindings.calendar);
});


test('implicit legacy service mode still validates its actual active dependency', async () => {
  const config={plugins:{'old-calendar':{type:'ambient-calendar-source',bindings:{services:'removed-service'}}},screens:{}};
  await assert.rejects(discoverPlugins({pluginsDir,config,context}),/requires data/);
});


test('every companion display installs independently without a catch-all integration', async () => {
  const packages = await pluginLibrary({pluginsDir, config: {}, configDir: '/tmp'});
  const displays=packages.filter(pkg=>pkg.id.startsWith('ambient-')&&pkg.hasWidget);
  assert.equal(displays.length,11);
  for(const pkg of displays){
    const config=changePluginConfig({plugins:{},screens:{}},packages,{action:'install',type:pkg.id,id:'standalone-view'});
    assert.equal(Object.values(config.plugins).some(item=>['ambient-services','ambient-config-source'].includes(item.type)),false,pkg.id);
    const plugins=await discoverPlugins({pluginsDir,config,context});
    assert.equal(plugins.some(plugin=>plugin.id==='standalone-view'),true,pkg.id);
  }
});

test('ambient and external examples validate independent sources and deliberate panel sharing', async () => {
  const {createApp}=await import('../src/server.js');
  const root=new URL('../',import.meta.url).pathname;
  const ambient=JSON.parse(await fs.readFile(new URL('../examples/ambient/castboard.config.json',import.meta.url),'utf8'));
  assert.equal(Object.values(ambient.plugins).some(item=>['ambient-services','ambient-config-source'].includes(item.type)),false);
  await createApp({cwd:root,configPath:'examples/ambient/castboard.config.json',env:{}});
  const flexible=JSON.parse(await fs.readFile(new URL('../examples/flexible/castboard.config.example.json',import.meta.url),'utf8'));
  assert.equal(flexible.plugins.north.type,flexible.plugins.south.type);
  assert.notEqual(flexible.plugins.north.value,flexible.plugins.south.value);
  assert.deepEqual(flexible.screens.home.panels.map(panel=>panel.source),['north','north','south','south']);
  await createApp({cwd:root,configPath:'examples/flexible/castboard.config.example.json',env:{}});
});
