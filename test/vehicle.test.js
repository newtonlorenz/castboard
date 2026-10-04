import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin} from '../plugins/vehicle/plugin.js';
import {normalizeVehicle,nativeVehicle} from '../plugins/vehicle/model.js';

test('vehicle readings preserve zero, reject invalid measurements and remain safe for native views',()=>{
  const empty=normalizeVehicle({batteryPercent:null,chargingKw:'',rangeKm:-1});
  assert.equal(empty.batteryPercent,null);assert.equal(empty.chargingKw,null);assert.equal(empty.charging,null);assert.equal(empty.rangeKm,null);
  assert.equal(normalizeVehicle({batteryPercent:true,chargingKw:' ',rangeKm:Infinity}).batteryPercent,null);
  const zero=normalizeVehicle({batteryPercent:0,chargingKw:0,rangeKm:0});assert.equal(zero.batteryPercent,0);assert.equal(zero.charging,false);
  assert.equal(normalizeVehicle({batteryPercent:101}).batteryPercent,null);
  assert.throws(()=>normalizeVehicle(null),/object/);
  assert.match(nativeVehicle({data:empty}).lines[0].text,/unavailable/);
  assert.equal(nativeVehicle({data:{batteryPercent:75,chargingKw:7.2,rangeKm:160.9344},options:{showRange:true,distanceUnit:'mi'}}).lines.at(-1).text,'100 mi range');
});

test('Home Assistant vehicle provider keeps credentials private and converts sensor units',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const requests=[];
  const states={battery:{state:'72',last_updated:'2026-10-04T10:00:00Z'},power:{state:'4800',attributes:{unit_of_measurement:'W'},last_updated:'2026-10-04T10:02:00Z'},charging:{state:'off'},range:{state:'100',attributes:{unit_of_measurement:'mi'}}};
  globalThis.fetch=async(input,options)=>{const url=new URL(input);requests.push({url,options});return new Response(JSON.stringify(states[url.pathname.split('.').at(-1)]));};
  const plugin=createPlugin({config:{provider:'home-assistant',baseUrl:'https://ha.example.test',token:'test-private-token',batteryEntity:'sensor.battery',powerEntity:'sensor.power',chargingEntity:'binary_sensor.charging',rangeEntity:'sensor.range'},context:{}});
  const data=await plugin.getData();assert.equal(data.batteryPercent,72);assert.equal(data.chargingKw,4.8);assert.equal(data.charging,false);assert.equal(data.rangeKm,160.9344);assert.equal(data.updatedAt,'2026-10-04T10:00:00.000Z');
  assert.equal(requests.length,4);assert.equal(requests[0].options.headers.Authorization,'Bearer test-private-token');assert.equal(requests[0].url.pathname,'/api/states/sensor.battery');
  assert.equal(JSON.stringify({...plugin.publicConfig(),...data}).includes('test-private-token'),false);assert.equal(JSON.stringify(data).includes('sensor.'),false);
});

test('partial sensor failures keep available vehicle data; total connection failure is explicit',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const plugin=createPlugin({config:{provider:'home-assistant',baseUrl:'https://ha.example.test',token:'test-token',batteryEntity:'sensor.battery',powerEntity:'sensor.power'},context:{}});
  globalThis.fetch=async input=>new URL(input).pathname.endsWith('.battery')?new Response(JSON.stringify({state:'unavailable'})):new Response(JSON.stringify({state:'5',attributes:{unit_of_measurement:'kW'}}));
  let data=await plugin.getData();assert.equal(data.batteryPercent,null);assert.equal(data.chargingKw,5);assert.equal(data.charging,true);
  globalThis.fetch=async input=>{if(new URL(input).pathname.endsWith('.power'))throw new Error('private upstream failure');return new Response(JSON.stringify({state:'80'}));};
  data=await plugin.getData();assert.equal(data.batteryPercent,80);assert.equal(data.chargingKw,null);assert.equal(data.charging,null);
  globalThis.fetch=async()=>{throw new Error('private upstream failure');};await assert.rejects(plugin.getData(),error=>error.message==='Home Assistant vehicle sensors are unavailable');
});

test('compact vehicle views retain selected range, charging state and sample labeling',()=>{
 const view=nativeVehicle({data:{batteryPercent:75,charging:false,rangeKm:160.9344},options:{compact:true,showPower:false,showRange:true,distanceUnit:'mi',demo:true}});
 assert.match(view.title,/Sample/);assert.match(view.lines[0].text,/Not charging/);
 assert.equal(view.lines[1].text,'100 mi range');assert.ok(view.lines.every(line=>line.kind==='small'));
});
