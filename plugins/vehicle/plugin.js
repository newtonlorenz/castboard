import { fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';
import { normalizeVehicle, nativeVehicle, stateNumber, powerKw, chargingState } from './model.js';

export function createPlugin({config,context}) {
  validateProviderConfig('vehicle',config,['demo','home-assistant','http-json','file-json']);
  let base;
  if(config.provider==='home-assistant') {
    try{base=new URL(config.baseUrl);}catch{throw new Error('Vehicle needs a Home Assistant URL');}
    if(!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)throw new Error('Use an HTTP(S) Home Assistant URL without credentials or query parameters');
    if(!config.token || !config.batteryEntity)throw new Error('Vehicle needs a Home Assistant token and battery entity');
    for(const key of ['batteryEntity','powerEntity','chargingEntity','rangeEntity'])if(config[key] && !/^[a-z_]+\.[a-z0-9_]+$/.test(config[key]))throw new Error(`Vehicle ${key} must be an entity ID`);
  }
  return {
    id:'vehicle',name:'Vehicle',assets:['style.css','model.js'],styles:['style.css'],nativeView:nativeVehicle,
    publicConfig:()=>({demo:config.provider==='demo',title:config.title || 'Vehicle',label:config.label || '',showPower:config.showPower!==false,showRange:config.showRange===true,distanceUnit:config.distanceUnit || 'km',refreshSeconds:config.refreshSeconds || 30}),
    async getData(){
      if(config.provider==='demo')return normalizeVehicle({label:config.label || 'Demo vehicle',batteryPercent:72,chargingKw:4.8,charging:true,rangeKm:286,updatedAt:new Date().toISOString()});
      if(config.provider!=='home-assistant')return normalizeVehicle(await readJsonSource(config,context));
      const names=['batteryEntity','powerEntity','chargingEntity','rangeEntity'];
      const entries=await Promise.all(names.map(async name=>{
        if(!config[name])return [name,null];
        const url=new URL(`${base.href.replace(/\/$/,'')}/api/states/${encodeURIComponent(config[name])}`);
        try{return [name,await fetchJson(url,{headers:{Authorization:`Bearer ${config.token}`}},config.timeoutMs || 8000)];}catch{return [name,null];}
      }));
      const states=Object.fromEntries(entries);
      if(!entries.some(([,state])=>state))throw new Error('Home Assistant vehicle sensors are unavailable');
      let range=stateNumber(states.rangeEntity);
      const rangeUnit=String(states.rangeEntity?.attributes?.unit_of_measurement || '').toLowerCase();
      if(range!==null)range=rangeUnit==='mi'?range*1.609344:rangeUnit==='km'?range:null;
      const times=entries.map(([,state])=>state?.last_reported || state?.last_updated).filter(value=>Number.isFinite(Date.parse(value)));
      const charging=chargingState(states.chargingEntity);
      return normalizeVehicle({label:config.label,batteryPercent:stateNumber(states.batteryEntity),chargingKw:powerKw(states.powerEntity,config.powerUnit || 'auto'),...(charging===null?{}:{charging}),rangeKm:range,updatedAt:times.length?new Date(Math.min(...times.map(Date.parse))).toISOString():null});
    }
  };
}
