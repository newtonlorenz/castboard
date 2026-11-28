import test from 'node:test';
import assert from 'node:assert/strict';
import {characterGrid, formatPluginText, mount} from '../public/text-widget.js';
import {textDisplay, panelStyle, previewStructure, FONT_STACKS} from '../public/appearance-model.js';
import {validateConfig} from '../src/core/config.js';

test('character displays wrap, crop and pad without splitting Unicode characters', () => {
  assert.equal(characterGrid('ABCDE\nZ', 4, 3), 'ABCD\nE   \nZ   ');
  assert.equal(characterGrid('ABCDE\nZ', 4, 1), 'ABCD');
  assert.equal(characterGrid('😀AB', 2, 2), '😀A\nB ');
  assert.equal(characterGrid('A', undefined, 2), 'A\n');
  assert.equal(characterGrid('A\nB', undefined, undefined), 'A\nB');
});

test('text mode inherits, panels can opt out, and default text uses a fixed-width font', () => {
  assert.deepEqual(textDisplay({}, {displayMode:'text', textColumns:16, textRows:2}), {mode:'text', columns:16, rows:2});
  assert.equal(textDisplay({displayMode:'visual'}, {displayMode:'text'}).mode, 'visual');
  assert.equal(panelStyle({}, {displayMode:'text'})['font-family'], FONT_STACKS.mono);
  assert.equal(panelStyle({fontFamily:'sans'}, {displayMode:'text'})['font-family'], FONT_STACKS.sans);
});

test('preview remounts for text mode and character dimensions but updates fonts in place', () => {
  const config = {plugins:[], screens:{home:{panels:[{id:'a',plugin:'clock'}]}}};
  const signature = previewStructure(config, 'home');
  config.screens.home.appearance = {fontFamily:'mono'};
  assert.equal(previewStructure(config, 'home'), signature);
  config.screens.home.appearance.displayMode = 'text';
  assert.notEqual(previewStructure(config, 'home'), signature);
  const text = previewStructure(config, 'home');
  config.screens.home.panels[0].appearance = {textColumns:16, textRows:2};
  assert.notEqual(previewStructure(config, 'home'), text);
});

test('character dimensions validate at screen and panel level', () => {
  const config = appearance => ({server:{port:8787},plugins:{},screens:{home:{path:'/',appearance,panels:[{id:'a',plugin:'clock',appearance}]}}});
  assert.doesNotThrow(() => validateConfig(config({displayMode:'text',fontFamily:'mono',textColumns:16,textRows:2})));
  for (const appearance of [{displayMode:'lcd'}, {textColumns:0}, {textColumns:241}, {textRows:1.5}, {textRows:'2'}, {textRows:121}]) {
    assert.throws(() => validateConfig(config(appearance)), /displayMode|textColumns|textRows/);
  }
  assert.throws(() => validateConfig({server:{port:8787},plugins:{},screens:{home:{path:'/',panels:[{id:'a',plugin:'clock',appearance:{textRows:0}}]}}}), /panels\[0\].appearance.textRows/);
});

test('standard and Ambient data produce meaningful readings without media URLs', () => {
  assert.match(formatPluginText('weather', {temperatureC:0,windKph:0,condition:'Clear'}), /0 C Clear\nWind 0 km\/h/);
  assert.match(formatPluginText('ambient-weather', {temp:22,code:1,windspeed:12,demo:true}, {temperatureUnit:'fahrenheit'}), /Demo: weather[\s\S]*72 F Mostly clear/);
  assert.match(characterGrid(formatPluginText('weather', {temperatureC:22}, {demo:true}), 16, 2), /^Demo: weather/);
  assert.match(formatPluginText('ambient-solar', {generatedKw:2,usedSolarKw:1,usedGridKw:.5,gridExportKw:1}), /Load 1.5 kW/);
  assert.match(formatPluginText('ambient-recovery', {recovery:{score:82},sleep:{hours:8}}), /82\/100[\s\S]*Sleep 8 h/);
  assert.match(formatPluginText('ambient-portfolio', {positions:[{symbol:'ABC',price:10,changePct:0}],summary:{netLiquidation:100,baseCurrency:'EUR'}}), /Total 100 EUR[\s\S]*ABC 10 0%/);
  for (const type of ['spotify','sonos','ambient-media']) {
    const text = formatPluginText(type, {playing:false,title:'A track',artworkUrl:'https://art.test',artist:'Artist'});
    assert.match(text, /Paused\nA track\nArtist/);
    assert.doesNotMatch(text, /https:|<img|<button/);
  }
  assert.match(formatPluginText('camera', {name:'Garden',status:'Live',streamUrl:'http://stream.test'}), /Garden\nLive/);
  assert.match(formatPluginText('ambient-alerts', {alerts:[{label:'Person'}]}), /Person/);
  assert.match(formatPluginText('custom', {aqi:24,label:'Good',imageUrl:'http://art.test'}), /aqi: 24\nlabel: Good$/);
});

test('clock and calendar use the configured time zone, skipping expired events', () => {
  const now = new Date('2026-10-04T10:00:00Z');
  assert.match(formatPluginText('clock', {}, {showDate:false}, {timeZone:'UTC'}, now), /10:00/);
  assert.match(formatPluginText('calendar', {events:[{title:'Old',start:'2026-10-04T08:00:00Z',end:'2026-10-04T09:00:00Z'},{title:'Next',start:'2026-10-04T11:00:00Z',end:'2026-10-04T12:00:00Z'}]}, {}, {timeZone:'UTC'}, now), /11:00.*Next/);
  assert.doesNotMatch(formatPluginText('calendar', {events:[{title:'Old',end:'2026-10-04T09:00:00Z'}]}, {}, {timeZone:'UTC'}, now), /Old/);
});

function fixture(type, source, data) {
  const output = {style:{setProperty(){}},dataset:{}};
  const element = {ownerDocument:{createElement:() => output},replaceChildren(node){this.child = node;},dataset:{},classList:{add(){},remove(){}}};
  const calls = [];
  const context = {plugin:{id:'copy',type,hasData:true},panel:{source,appearance:{textColumns:16,textRows:2}},screen:{},app:{branding:{timeZone:'UTC'}},signal:{aborted:false},
    data:async () => {calls.push('data');return data;},source:id => ({data:async parameters => {calls.push({id,parameters});return data;}}),schedule(load, interval){this.load = load;this.interval = interval;}};
  return {element, output, context, calls};
}

test('text mounting uses the selected source and writes untrusted values as text', async () => {
  const {element,output,context,calls} = fixture('ambient-weather', 'other-source', {temp:20,condition:'<img src=x onerror=alert(1)>'});
  await mount({element,config:{sourceAlias:'weather'},context});
  await context.load();
  assert.deepEqual(calls, ['data']);
  assert.equal(element.child, output);
  assert.equal(output.textContent.split('\n').length, 2);
  assert.ok(output.textContent.includes('<img'));
  assert.equal(output.innerHTML, undefined);
});

test('Ambient text reads aliases and resource metadata without requesting streams', async () => {
  for (const [type,config,id,parameters] of [['ambient-weather',{sourceAlias:'weather'},'weather',undefined], ['ambient-camera',{},'resources',{path:'/camera/api/cameras'}], ['ambient-alerts',{},'services',{route:'/api/camera-alerts'}]]) {
    const {element,context,calls} = fixture(type, undefined, {});
    await mount({element,config,context});await context.load();
    assert.deepEqual(calls, [{id,parameters}]);
  }
});

test('text refresh recovers after provider failure and ignores results after disposal', async () => {
  const {element,output,context} = fixture('weather', undefined, {temperatureC:20});
  let failing = true;
  context.data = async () => {if (failing) throw new Error('Offline');return {temperatureC:20};};
  await mount({element,config:{},context});await context.load();
  assert.match(output.textContent, /Unavailable/);
  assert.equal(element.dataset.freshness, 'unavailable');
  failing = false;await context.load();assert.match(output.textContent, /20 C/);assert.equal(element.dataset.freshness, 'live');
  const current = output.textContent;context.signal.aborted = true;await context.load();
  assert.equal(output.textContent, current);
});

test('owned News Reader data is used before attempting legacy routes', async () => {
  const {element,output,context,calls} = fixture('ambient-news', undefined, {stories:[{title:'Headline'}]});
  await mount({element,config:{},context});
  await context.load();
  assert.deepEqual(calls,['data']);
  assert.match(output.textContent,/Headline/);
});
