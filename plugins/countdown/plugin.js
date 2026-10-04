import { demoTimestamp, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';
import { countdownState, countdownText } from './model.js';
export function createPlugin({ config, context }) {
  validateProviderConfig('countdown',config,['demo','inline','http-json','file-json']);
  if (config.timeZone) try { new Intl.DateTimeFormat('en',{timeZone:config.timeZone}).format(); } catch { throw new Error('Enter a valid display time zone, such as Europe/London or UTC'); }
  if (config.locale) try { new Intl.DateTimeFormat(config.locale).format(); } catch { throw new Error('Enter a valid language and region, such as en-GB'); }
  const sampleTarget = new Date(Date.now() + 2*86400000).toISOString();
  if (config.provider === 'inline') countdownState({target:config.target});
  return {
    id:'countdown',name:'Countdown',assets:['style.css','model.js'],styles:['style.css'],
    async getData() {
      const data = config.provider === 'demo' ? {demo:true,target:sampleTarget,title:'Next gathering · Sample',description:'Choose an event date and time in Plugins.',updatedAt:demoTimestamp()} : config.provider === 'inline' ? {target:config.target,title:config.eventTitle || '',description:config.description || '',updatedAt:demoTimestamp()} : await readJsonSource(config,context);
      countdownState(data); if (data.title != null && typeof data.title !== 'string' || data.description != null && typeof data.description !== 'string') throw new Error('Event name and description must be text');
      return {target:data.target,title:(data.title || '').slice(0,160),description:(data.description || '').slice(0,2000),updatedAt:data.updatedAt || demoTimestamp(),demo:data.demo===true};
    },
    nativeView:({data,options,now=new Date()})=>({title:options.title || data.title || 'Countdown',lines:[{text:countdownText(countdownState(data,options,now.getTime()),options),kind:'metric'},...(options.showDate === false ? [] : [{text:data.target,kind:'body'}]),{text:data.description || '',kind:'muted'},...(data.demo?[{text:'Sample data',kind:'muted'}]:[])]}),
  };
}
