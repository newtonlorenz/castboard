import { escapeHtml, title, unavailable } from '/widget-kit.js?v=0.14.0';
import { normalizeVehicle, displayNumber, vehicleStatus } from './assets/model.js';
export function mount({element,config,context}) {
  element.classList.add('vehicle-widget');element.classList.toggle('vehicle-compact',config.compact===true);
  context.schedule(async()=>{try{
    const data=normalizeVehicle(await context.data()),battery=data.batteryPercent===null?'—':`${displayNumber(data.batteryPercent)}%`;
    const range=config.showRange===true?`<div class="vehicle-range">${data.rangeKm===null?'Range unavailable':`${displayNumber(config.distanceUnit==='mi'?data.rangeKm/1.609344:data.rangeKm)} ${config.distanceUnit==='mi'?'mi':'km'} range`}</div>`:'';
    if(config.compact){
      const drawing=data.chargingKw!==null && data.chargingKw>0;
      const powerLabel=data.chargingKw===null?'Charging draw unavailable':drawing?'Charging · draws power from home':'No charging draw';
      const direction=`<svg class="energy-direction" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${drawing?'M2 2l8 8M4 10h6V4':'M2 6h8'}"/></svg>`;
      const power=config.showPower!==false?`${direction}${data.chargingKw===null?'—':displayNumber(data.chargingKw,1)} kW`:config.showStatus===false?'':escapeHtml(vehicleStatus(data));
      element.innerHTML=`${title(config.title || data.label || 'Vehicle',config.demo?'Sample':'')}<div class="vehicle-summary"><strong>${battery}</strong><span class="vehicle-power" data-energy="${drawing?'demand':'idle'}" title="${config.showPower!==false?powerLabel:escapeHtml(vehicleStatus(data))}">${power}</span></div>${range}`;return;
    }
    element.innerHTML=`${title(config.title || 'Vehicle',config.label ? config.label+(config.demo?' · Sample':'') : data.label)}<div class="vehicle-battery"><svg viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="2" width="26" height="16" rx="3"/><path d="M30 7v6"/>${data.batteryPercent===null?'':`<rect x="4" y="5" width="${20*data.batteryPercent/100}" height="10" rx="1" fill="currentColor" stroke="none"/>`}</svg><strong>${battery}</strong><span>Battery</span></div><div class="vehicle-status">${config.showStatus===false?'':config.showStatus===false?'':escapeHtml(vehicleStatus(data))}${config.showPower!==false?`<strong>${data.chargingKw===null?'—':`${displayNumber(data.chargingKw,1)} kW`}</strong>`:''}</div>${config.showRange===true?`<div class="vehicle-range">${data.rangeKm===null?'Range unavailable':`${displayNumber(config.distanceUnit==='mi'?data.rangeKm/1.609344:data.rangeKm)} ${config.distanceUnit==='mi'?'mi':'km'} range`}</div>`:''}`;
  }catch(error){unavailable(element,config.title || 'Vehicle',error);}},(config.refreshSeconds || 30)*1000);
}
