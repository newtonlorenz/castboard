import {demoTimestamp,readJsonSource,validateProviderConfig} from '../../src/core/providers.js';
export function createPlugin({config,context}) {
  const provider=config.provider||'demo';
  validateProviderConfig('ambient-alerts-source',{...config,provider},['demo','http-json','file-json']);
  return {id:'ambient-alerts-source',name:'Camera detections',contract:'camera-alerts@1',publicConfig:()=>({demo:provider==='demo'}),async getData(){
    if(provider==='demo')return {alerts:[],cameraName:'Sample camera',demo:true,updatedAt:demoTimestamp()};
    const data=await readJsonSource({...config,provider},context);
    if(!data||!Array.isArray(data.alerts))throw new Error('Camera detection source must return an alerts array');
    return data;
  }};
}
