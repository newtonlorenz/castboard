import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson } from '../src/core/providers.js';
import { createPlugin as createCamera } from '../plugins/camera/plugin.js';

test('camera keeps its source name unless an explicit panel title is configured', async () => {
  const camera = createCamera({ config: { provider: 'demo', name: 'Front door' }, context: { instanceId: 'front-door' } });
  const data = await camera.getData();
  const settings = camera.publicConfig();
  assert.equal(settings.title || data.name || settings.name, 'Front door');
  const titled = createCamera({ config: { provider: 'demo', name: 'Front door', title: 'Entrance' }, context: { instanceId: 'front-door' } });
  assert.equal(titled.publicConfig().title, 'Entrance');
});

test('provider timeout covers a stalled response body', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => new Response(new ReadableStream({
    start(controller) {
      const timer = setTimeout(() => controller.enqueue(new TextEncoder().encode('{"late":true}')), 1000);
      options.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.error(options.signal.reason);
      }, { once: true });
    },
  }));
  await assert.rejects(fetchJson('http://provider.test', {}, 10), /timed out/);
});

test('provider JSON responses are size-bounded and upstream errors are not reflected', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('{"value":"0123456789"}');
  await assert.rejects(fetchJson('http://provider.test', {}, 1000, 8), /exceeds 8 bytes/);
  globalThis.fetch = async () => new Response('{"error":{"message":"private backend detail"}}', { status: 500 });
  await assert.rejects(fetchJson('http://provider.test'), error => error.message === 'Provider returned HTTP 500');
});

test('Fronius keeps missing readings unknown and preserves import/export signs',async t=>{
 const {createPlugin}=await import('../plugins/solar/plugin.js');
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 let site={P_PV:0},sentHeaders;globalThis.fetch=async(url,options)=>{sentHeaders=options.headers;return new Response(JSON.stringify({Body:{Data:{Site:site}}}));};
 const plugin=createPlugin({config:{provider:'fronius',baseUrl:'http://solar.example.test',headers:{Authorization:'Bearer fixture-only'}},context:{}});
 let data=await plugin.getData();assert.equal(sentHeaders.Authorization,'Bearer fixture-only');assert.equal(JSON.stringify(plugin.publicConfig()).includes('fixture-only'),false);assert.equal(data.generatedKw,0);assert.equal(data.loadKw,null);assert.equal(data.gridImportKw,null);assert.equal(data.gridExportKw,null);
 site={P_PV:3800,P_Load:-2000,P_Grid:-1800};data=await plugin.getData();assert.equal(data.loadKw,2);assert.equal(data.gridExportKw,1.8);assert.equal(data.gridImportKw,0);
 site.P_Grid=1200;data=await plugin.getData();assert.equal(data.gridImportKw,1.2);assert.equal(data.gridExportKw,0);
});

test('native camera shortcuts retain their label when the action button is hidden',()=>{
 const plugin=createCamera({config:{provider:'demo'},context:{}});
 const result=plugin.nativeView({data:{},options:{displayMode:'shortcut'},panel:{interaction:{type:'modal',showButton:false,label:'View camera'}}});
 assert.equal(result.title,'View camera');assert.equal(result.image,undefined);
});
