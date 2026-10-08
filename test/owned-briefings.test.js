import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createPlugin} from '../plugins/ambient-news/plugin.js';
import {parseBrief} from '../plugins/ambient-news/briefing.js';

test('briefing category paragraphs preserve article text without fabricating empty-news headlines',()=>{
 const parsed=parseBrief('## Index\n- [Solar storage update](https://example.com/story) · Energy\n---\n## Energy\nSolar storage update: The new battery stores enough power for the evening.');
 assert.equal(parsed.stories[0].category,'Energy');
 assert.match(parsed.stories[0].article,/stores enough power/);
 assert.deepEqual(parseBrief('## Index\n- No qualifying stories today\n---\n## Gaming\nNo new stories.').stories,[]);
});

test('explicit linked article bodies take precedence over category paragraphs',()=>{
 const parsed=parseBrief('## Index\n- [Solar storage update](https://example.com/story)\n---\n## Energy\nSolar storage update introduction\n### [Solar storage update](https://example.com/story)\nFull article body');
 assert.equal(parsed.stories[0].article,'Full article body');
});

test('two briefing readers own separate routes and credentials, bounded to configured IDs',async t=>{
 const requests=[];
 const server=http.createServer((req,res)=>{requests.push({url:req.url,auth:req.headers.authorization});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({content:'## Index\n- [Headline](https://example.com/story)\n---\n## News\nHeadline '+req.url}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 const a=createPlugin({config:{provider:'briefings',briefingBaseUrl:base+'/a',headers:{Authorization:'reader-a'},briefings:[{key:'news',name:'News'}]},context:{bindings:{}}});
 const b=createPlugin({config:{provider:'briefings',briefingBaseUrl:base+'/b',headers:{Authorization:'reader-b'},briefings:[{key:'news',name:'News'}]},context:{bindings:{}}});
 await Promise.all([a.getData(),b.getData()]);
 assert.deepEqual(requests.sort((a,b)=>a.url.localeCompare(b.url)),[{url:'/a/news',auth:'reader-a'},{url:'/b/news',auth:'reader-b'}]);
 await assert.rejects(a.getData({url:new URL('http://local?briefing=unconfigured')}),/configured/);
 assert.doesNotMatch(JSON.stringify([a.publicConfig(),b.publicConfig()]),/reader-a|reader-b|127.0.0.1/);
});

test('explicit legacy briefing services remain usable without a new endpoint',async()=>{
 const requests=[];
 const plugin=createPlugin({config:{provider:'briefings'},context:{bindings:{services:'legacy'},read:async(id,{url})=>{requests.push({id,route:url.searchParams.get('route')});return {content:'Legacy briefing'};}}});
 assert.equal((await plugin.getData()).content,'Legacy briefing');
 assert.deepEqual(requests,[{id:'legacy',route:'/api/briefings/top-stories'}]);
});
