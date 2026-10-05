import {displayData} from '../../src/core/display-data.js';
import {createPlugin as createProvider} from '../calendar/plugin.js';
export function createPlugin({config,context}) {
  const provider=config.provider || (context.bindings.services?'services':'demo');
  const local=provider==='services'||provider==='plugin'?null:createProvider({config:{...config,provider},context});
  return {id:'ambient-calendar-source',name:'Calendar connection',contract:'calendar-source@1',defaultConfig:{provider},
    publicConfig:()=>({demo:provider==='demo',provider}),
    dispose:()=>local?.dispose?.(),
    async getData(){
      if(provider==='services')return context.read(context.bindings.services,{url:new URL('/data?'+new URLSearchParams({route:config.route||'/api/calendar'}),'http://local')});
      const source=provider==='plugin'?context.getPlugin(context.bindings.upstream):local;
      const data=provider==='plugin'?await context.read(context.bindings.upstream):await local.getData();
      return displayData('calendar',{...data,demo:source.publicConfig?.().demo===true||provider==='demo'},config.timeZone||context.getBranding?.().timeZone||'UTC');
    }
  };
}
