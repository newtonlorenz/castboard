export function createPlugin({config}) {
 return {id:'readings',name:'Configurable readings',contract:'readings@1',
 dataSchema:{type:'object',required:['value','maximum'],properties:{value:{type:'number'},maximum:{type:'number',minimum:1}}},
 getData:()=>({value:config.value,maximum:config.maximum,updatedAt:new Date().toISOString()})};
}
