import { clockTimes } from './model.js';
import { nativeViews } from '../../src/core/native-views.js';
export function createPlugin({ config }) {
  clockTimes(config);
  if(config.timeZone){try{new Intl.DateTimeFormat('en',{timeZone:config.timeZone}).format();}catch{throw new Error('Enter a valid time zone, such as Europe/London or UTC');}}
  return {
    id: 'clock',
    nativeView: nativeViews.clock,
    assets: ['style.css', 'model.js'],
    styles: ['style.css'],
    name: 'Clock',
    publicConfig: () => ({compact:config.compact===true,  showSeconds: config.showSeconds === true,timeZone:config.timeZone||'',hour12:config.hour12===true,title:config.title||'' }),
  };
}
