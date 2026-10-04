import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeForecast,forecastDemo} from '../plugins/weather/forecast.js';
import {nativeViews} from '../src/core/native-views.js';
import {createPlugin} from '../plugins/weather/plugin.js';

test('forecast uses absolute times, local daily dates and preserves unavailable measurements',()=>{
  const now=Date.parse('2026-10-04T10:30:00Z'),time=now/1000-1800;
  const data=normalizeForecast({current:{time,temperature_2m:0,weather_code:0,wind_speed_10m:null},timezone:'Europe/Madrid',utc_offset_seconds:7200,hourly:{time:[time-3600,time,time+3600],temperature_2m:[12,null,14],weather_code:[3,2,0],uv_index:[1,0,2]},daily:{time:[Date.parse('2026-10-03T22:00:00Z')/1000],temperature_2m_max:[19],temperature_2m_min:[null],weather_code:[3]}},'Test town',now);
  assert.equal(data.updatedAt,'2026-10-04T10:00:00.000Z');assert.equal(data.uvIndex,0);assert.equal(data.windKph,null);assert.equal(data.hourly.length,2);assert.equal(data.hourly[0].temperatureC,null);assert.equal(data.daily[0].date,'2026-10-04');assert.equal(data.daily[0].lowC,null);
});

test('weather provider requests hourly and daily fields and keeps a private endpoint out of public settings',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let url;
  globalThis.fetch=async input=>{url=new URL(input);return new Response(JSON.stringify({current:{time:Date.now()/1000,temperature_2m:12}}));};
  const plugin=createPlugin({config:{provider:'open-meteo',latitude:51,longitude:0},context:{}});await plugin.getData();
  assert.match(url.searchParams.get('hourly'),/uv_index/);assert.match(url.searchParams.get('daily'),/temperature_2m_max/);assert.equal(url.searchParams.get('timeformat'),'unixtime');assert.equal(plugin.publicConfig().latitude,undefined);
});

test('native forecasts retain all requested hours and days with missing values shown explicitly',()=>{
  const now=new Date('2026-10-04T10:00:00Z'),data=forecastDemo(now.getTime());data.temperatureC=null;
  const view=nativeViews.weather({data,options:{view:'forecast',hours:24,days:7},branding:{timeZone:'UTC'},now});
  assert.equal(view.lines.length,36);assert.equal(view.lines[0].text,'—');assert.equal(view.lines.filter(line=>line.text.startsWith('10:00')).length,1);assert.match(view.lines.at(-1).text,/Sat/);
});

test('tap-only forecast pages retain every requested entry even in a short modal',async()=>{
  const {forecastPages}=await import('../plugins/weather/forecast.js');
  const now=Date.parse('2026-10-04T10:30:00Z'),data=forecastDemo(now);
  for(const height of [100,122,200,480,900]){
    const pages=forecastPages(data,{view:'forecast',hours:24,days:7},height,now);
    assert.equal(pages[0].kind,'current');
    assert.deepEqual(pages.filter(page=>page.kind==='hourly').flatMap(page=>page.items),data.hourly);
    assert.deepEqual(pages.filter(page=>page.kind==='daily').flatMap(page=>page.items),data.daily);
    assert.ok(pages.every(page=>page.items.length<=12));
  }
  assert.deepEqual(forecastPages({hourly:null},{view:'hourly'},122,now),[{kind:'hourly',label:'Hours',items:[]}]);
});


test('weather rejects blank coordinates and keeps partial JSON forecasts usable',()=>{
  for(const latitude of [null,'',91])assert.throws(()=>createPlugin({config:{provider:'open-meteo',latitude,longitude:0},context:{}}),/latitude/);
  const view=nativeViews.weather({data:{temperatureC:0,timeZone:'invalid-zone',hourly:[{time:'2026-10-04T11:00:00Z'}],daily:{}},options:{view:'forecast'},now:new Date('2026-10-04T10:00:00Z')});
  assert.equal(view.lines[0].text,'0°C');assert.match(view.lines.at(-1).text,/unavailable/);
});
