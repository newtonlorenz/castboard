import { demoTimestamp, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';
import { activeNotices } from './model.js';
export function createPlugin({ config, context }) {
  validateProviderConfig('noticeboard', config, ['demo','inline','http-json','file-json']);
  if (config.provider === 'inline') activeNotices({ notices: config.notices || [] });
  return {
    id: 'noticeboard', name: 'Noticeboard', assets: ['style.css','model.js'], styles: ['style.css'],
    async getData() {
      const data = config.provider === 'demo' ? {demo:true,notices:[{id:'welcome',title:'Welcome · Sample',body:'Use this space for opening hours, visitor instructions or a daily announcement.\n\nChoose Enter here in Plugins to write your own notices.'},{id:'workshop',title:'A space for everyone · Sample',body:'Give each screen its own title and timing. Notices can appear and expire on a schedule.'}],updatedAt:demoTimestamp()} : config.provider === 'inline' ? {notices:config.notices||[],updatedAt:demoTimestamp()} : await readJsonSource(config,context);
      return {notices:activeNotices(data),updatedAt:data.updatedAt || demoTimestamp(),demo:data.demo===true};
    },
    nativeView: ({data, options}) => ({title:options.title || 'Noticeboard',lines:data.notices.length ? data.notices.slice(0,12).flatMap(notice=>[{text:notice.title,kind:'body'},{text:notice.body,kind:'body'}]) : [{text:options.emptyText || 'No current notices',kind:'muted'}]}),
  };
}
