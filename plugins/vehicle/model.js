const numeric=value=>(typeof value==='number' || typeof value==='string' && value.trim()!=='') && Number.isFinite(Number(value))?Number(value):null;
const iso=value=>value && Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export function normalizeVehicle(value = {}) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Vehicle data must be an object');
  const battery=numeric(value.batteryPercent),power=numeric(value.chargingKw),range=numeric(value.rangeKm);
  const chargingKw=power!==null && power>=0?power:null;
  return {batteryPercent:battery!==null && battery>=0 && battery<=100?battery:null,chargingKw,charging:typeof value.charging==='boolean'?value.charging:chargingKw===null?null:chargingKw>0,rangeKm:range!==null && range>=0?range:null,updatedAt:iso(value.updatedAt),label:typeof value.label==='string'?value.label.slice(0,80):''};
}
export function stateNumber(state) {return numeric(state?.state);}
export function powerKw(state,unit='auto') {
  const value=stateNumber(state);if(value===null)return null;
  const selected=unit==='auto'?String(state?.attributes?.unit_of_measurement || '').toLowerCase():unit.toLowerCase();
  return selected==='w'?value/1000:selected==='kw'?value:null;
}
export function chargingState(state) {
  const value=String(state?.state ?? '').toLowerCase();
  if(['on','true','1','charging'].includes(value))return true;
  if(['off','false','0','not_charging','not charging','stopped','idle','complete','disconnected'].includes(value))return false;
  return null;
}
export function displayNumber(value,digits=0){return value===null || value===undefined?'—':Number(value).toLocaleString('en',{maximumFractionDigits:digits});}
export function vehicleStatus(data){return data.charging===true?'Charging':data.charging===false?'Not charging':'Charging status unavailable';}
export function nativeVehicle({data,options={}}) {
  const value=normalizeVehicle(data),lines=[{text:value.batteryPercent===null?'Battery unavailable':`${displayNumber(value.batteryPercent)}% battery`,kind:'metric'},...(options.showStatus===false?[]:[{text:vehicleStatus(value),kind:'body'}])];
  if(options.showPower!==false)lines.push({text:value.chargingKw===null?'Charging power unavailable':`${displayNumber(value.chargingKw,1)} kW`,kind:'body'});
  if(options.showRange===true)lines.push({text:value.rangeKm===null?'Range unavailable':`${displayNumber(options.distanceUnit==='mi'?value.rangeKm/1.609344:value.rangeKm)} ${options.distanceUnit==='mi'?'mi':'km'} range`,kind:'muted'});
  const compactLines=[{text:`${displayNumber(value.batteryPercent)}% battery · ${options.showPower!==false?displayNumber(value.chargingKw,1)+' kW':options.showStatus===false?'':vehicleStatus(value)}`,kind:'small'}];
  if(options.showRange===true)compactLines.push({...lines.at(-1),kind:'small'});
  return {title:(options.title || value.label || 'Vehicle')+(options.demo?' · Sample':''),lines:options.compact?compactLines:lines};
}
