import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectStories} from '../plugins/news/selection.js';
import {createPlugin as news} from '../plugins/news/plugin.js';
import {createPlugin as reader} from '../plugins/ambient-news/plugin.js';
import {calendarEvents} from '../plugins/calendar/events.js';
import {displayForecast} from '../plugins/weather/forecast.js';
import {nativeViews} from '../src/core/native-views.js';
import {discoverPlugins} from '../src/core/plugin-registry.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const now=Date.parse('2026-10-04T12:00:00Z');
const stories=[
 {title:'Solar equipment',body:'Community workshop',source:'Local',category:'Energy',url:'https://example.test/a?utm_source=x',publishedAt:'2026-10-04T11:00:00Z'},
 {title:'Solar equipment duplicate',source:'Local',category:'Energy',url:'https://example.test/a',publishedAt:'2026-10-04T10:00:00Z'},
 {title:'Old solar',source:'Local',category:'Energy',publishedAt:'2026-10-01T00:00:00Z'},
 {title:'Solar advertisement',source:'Local',category:'Energy'},
 {title:'Solar abroad',source:'World',category:'Energy'},
 {title:'Undated community',source:'Local',category:'Community'}
];
test('news filters combine keywords, categories, sources, age and duplicate links',()=>{
 const selected=selectStories(stories,{includeKeywords:['SOLAR'],excludeKeywords:['advertisement'],categories:['energy'],sources:['local'],maxAgeHours:24,sortOrder:'newest'},now);
 assert.deepEqual(selected.map(s=>s.title),['Solar equipment']);
 assert.equal(selectStories(stories,{deduplicate:false},now).length,6);
 assert.deepEqual(selectStories(stories,{sortOrder:'title',maxStories:2},now).map(s=>s.title),['Old solar','Solar abroad']);
 assert.deepEqual(selectStories(stories,{maxAgeHours:24},now).map(s=>s.title),['Solar equipment','Solar advertisement','Solar abroad','Undated community']);
 assert.equal(stories.length,6);
});
test('RSS controls pause feeds, bound per-feed content, forward headers and share source refresh',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let requests=0;
 globalThis.fetch=async(url,options)=>{requests++;assert.equal(String(url),'https://enabled.test/rss');assert.equal(options.headers.Authorization,'Bearer private');return new Response('<rss><channel>'+[1,2,3].map(i=>`<item><title>Story ${i}</title><link>https://example.test/${i}</link></item>`).join('')+'</channel></rss>');};
 const plugin=news({config:{provider:'rss',headers:{Authorization:'Bearer private'},maxStoriesPerFeed:2,feeds:[{url:'https://disabled.test/rss',enabled:false},{url:'https://enabled.test/rss'}]},context:{}});
 assert.equal((await plugin.getData()).stories.length,2);await plugin.getData();assert.equal(requests,1);assert.equal(JSON.stringify(plugin.publicConfig()).includes('private'),false);
 const empty=news({config:{provider:'rss',useDefaultFeeds:false},context:{}});assert.deepEqual((await empty.getData()).stories,[]);assert.equal(requests,1);
});
test('the immersive reader reuses canonical providers without exposing source credentials',async()=>{
 const plugin=reader({config:{provider:'demo',maxStories:2,autoRotate:false,showSummary:false,headers:{Authorization:'secret'}},context:{}});
 assert.equal(plugin.id,'ambient-news');assert.equal((await plugin.getData()).stories.length,2);assert.equal(plugin.publicConfig().readerProvider,'demo');assert.equal(plugin.publicConfig().showSummary,false);assert.equal(JSON.stringify(plugin.publicConfig()).includes('secret'),false);
});
test('calendar horizon and filters retain active events and selected calendars',()=>{
 const events=[{title:'Ended',end:'2026-10-04T11:00:00Z'},{title:'Active',start:'2026-10-04T10:00:00Z',end:'2026-10-04T13:00:00Z',source:'Work'},{title:'All day',start:'2026-10-04',allDay:true},{title:'Later',start:'2026-10-09T10:00:00Z'},{title:'Hidden',source:'Private'}];
 assert.deepEqual(calendarEvents({events},{daysAhead:1,showAllDay:false,excludeSources:['private']},now).map(e=>e.title),['Active']);
});
test('weather units preserve missing readings and source values in browser and native output',()=>{
 const original={temperatureC:0,windKph:16.09344,hourly:[{temperatureC:null},{temperatureC:20}],daily:[{highC:10,lowC:''}]};
 const converted=displayForecast(original,{temperatureUnit:'fahrenheit'});assert.equal(converted.temperatureC,32);assert.equal(converted.hourly[0].temperatureC,null);assert.equal(converted.hourly[1].temperatureC,68);assert.equal(converted.daily[0].lowC,null);assert.equal(original.temperatureC,0);
 const native=nativeViews.weather({data:original,options:{temperatureUnit:'fahrenheit',windUnit:'mph'}});assert.match(native.lines.map(l=>l.text).join(' '),/32°F.*10 mph/s);
});
test('registry publishes display defaults and copy options while protecting source settings',async()=>{
 const config={plugins:{news:{enabled:true,provider:'demo',displayName:'Community announcements',headers:{Authorization:'private'},showTicker:false,rotationSeconds:25},weather:{enabled:true,provider:'demo',temperatureUnit:'fahrenheit'},recovery:{enabled:true,provider:'demo'}},screens:{home:{panels:[]}}};
 const plugins=await discoverPlugins({pluginsDir:path.join(root,'plugins'),config,context:{configDir:root}});
 assert.equal(plugins[0].name,'Community announcements');const display=plugins[0].publicConfig();assert.equal(display.showTicker,false);assert.equal(display.rotationSeconds,25);assert.equal(display.autoRotate,true);assert.equal(JSON.stringify(display).includes('private'),false);assert.equal(plugins.find(p=>p.id==='weather').publicConfig().temperatureUnit,'fahrenheit');
 await assert.rejects(discoverPlugins({pluginsDir:path.join(root,'plugins'),config:{...config,plugins:{recovery:{enabled:true,provider:'demo',warningThreshold:90}}},context:{configDir:root}}),/threshold/);
});
test('every bundled package explains its purpose and exposes a name for each installed copy',async()=>{
 for(const directory of await fs.readdir(path.join(root,'plugins'))){let m;try{m=JSON.parse(await fs.readFile(path.join(root,'plugins',directory,'plugin.json')));}catch{continue;}
 assert.ok(m.settingsSchema.properties.displayName,directory);assert.ok(['Display plugins','Dashboard panels','Data connectors','Support'].includes(m.category),directory);assert.ok(m.description.length>45,directory);assert.doesNotMatch(m.name,/Ambient|Mission|Office Wire/,directory);
 for(const field of Object.values(m.settingsSchema.properties))assert.ok(field.group,directory);
 }
});
