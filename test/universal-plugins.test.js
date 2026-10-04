import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin as metrics,metricState} from '../plugins/metrics/plugin.js';
import {createPlugin as statuses} from '../plugins/status-board/plugin.js';
import {createPlugin as menu} from '../plugins/menu/plugin.js';
import {createPlugin as images} from '../plugins/image-slideshow/plugin.js';
import {createPlugin as webpage} from '../plugins/web-page/plugin.js';
import {clockTimes} from '../plugins/clock/model.js';
import {nativeViews} from '../src/core/native-views.js';
import {publicUrl} from '../src/core/content-plugin.js';
const context={instanceId:'another-copy'};
test('metrics retain zero and unknown values, bound text and classify configured thresholds',async()=>{
 const plugin=metrics({config:{provider:'inline',metrics:[{label:'Zero',value:0,secret:'private'},{label:'Missing'},{label:'Hot',value:30,warningAbove:25}]},context});
 const data=await plugin.getData();assert.equal(data.metrics[0].value,0);assert.equal(data.metrics[1].value,null);assert.equal(metricState(data.metrics[1]),'Unknown');assert.equal(metricState(data.metrics[2]),'Warning');assert.equal(data.metrics[0].secret,undefined);
 assert.throws(()=>metrics({config:{provider:'inline',metrics:[{label:'Bad',value:false}]},context}),/finite number/);
 assert.throws(()=>metrics({config:{provider:'inline',metrics:Array.from({length:101},()=>({label:'x'}))},context}),/100 items/);
});
test('status feeds require known states and never imply health from missing data',async()=>{
 const data=await statuses({config:{provider:'inline',items:[{name:'Sensor'}]},context}).getData();assert.equal(data.items[0].status,'unknown');
 assert.throws(()=>statuses({config:{provider:'inline',items:[{name:'Sensor',status:'invented'}]},context}),/Status must/);
 assert.throws(()=>statuses({config:{provider:'inline',items:[{name:'Sensor',status:'__proto__'}]},context}),/Status must/);
});
test('menu prices distinguish free from missing and filter unavailable native entries',async()=>{
 const plugin=menu({config:{provider:'inline',items:[{name:'Water',price:0},{name:'Special'},{name:'Soup',price:5,available:false}]},context});
 const data=await plugin.getData();assert.equal(data.items[0].price,0);assert.equal(data.items[1].price,null);assert.equal(plugin.nativeView({data,options:{hideUnavailable:true}}).lines.length,2);
 assert.throws(()=>menu({config:{provider:'inline',items:[{name:'Bad',price:-1}]},context}),/finite number/);
});
test('display addresses reject active schemes and embedded credentials; sample assets respect copy IDs',async()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','https://user:password@example.test','/\\evil.test','//evil.test'])assert.throws(()=>publicUrl(url));
 assert.equal(publicUrl('/images/photo.png'),'/images/photo.png');
 const playlist=await images({config:{provider:'demo'},context}).getData();assert.match(playlist.images[0].url,/\/plugins\/another-copy\/assets\//);
 const page=webpage({config:{},context});assert.match(page.publicConfig().url,/another-copy/);assert.equal(page.publicConfig().allowScripts,false);
 assert.throws(()=>webpage({config:{url:'file:///etc/passwd'},context}));
});
test('world clocks show independent local dates and validate every configured zone',()=>{
 const now=new Date('2026-10-05T01:00:00Z');
 const clocks=clockTimes({timeZone:'UTC',locale:'en-GB',additionalClocks:[{label:'Los Angeles',timeZone:'America/Los_Angeles'}]}, {}, now);
 assert.match(clocks[0].date,/5/);assert.match(clocks[1].date,/4/);assert.equal(clocks[1].label,'Los Angeles');
 assert.throws(()=>clockTimes({additionalClocks:[{timeZone:'Not/AZone'}]}),/Invalid clock/);
 const native=nativeViews.clock({options:{additionalClocks:[{label:'Tokyo',timeZone:'Asia/Tokyo'}]},branding:{timeZone:'UTC'},now});assert.ok(native.lines.some(line=>line.text.includes('Tokyo')));
});
