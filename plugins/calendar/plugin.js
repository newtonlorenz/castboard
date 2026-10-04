import { nativeViews } from '../../src/core/native-views.js';
import { demoTimestamp, fetchText, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';
import { parseIcs } from '../../src/core/ics.js';

export function createPlugin({ config, context }) {
  validateProviderConfig('calendar', config, ['demo', 'ics', 'http-json', 'file-json']);
  if (config.provider === 'ics' && !config.url) throw new Error('Plugin calendar ics provider requires url');
  return {
    id: 'calendar',
    nativeView: nativeViews.calendar,
    assets: ['style.css', 'events.js'],
    styles: ['style.css'],
    name: 'Calendar',
    publicConfig: () => ({compact:config.compact===true,  demo: config.provider==='demo', title: config.title || 'Agenda', maxEvents: config.maxEvents || 5 }),
    async getData() {
      if (config.provider === 'demo') {
        const now = new Date();
        const event = (hourOffset, title, source) => ({ id: `${hourOffset}:${title}`, title, start: new Date(now.getTime() + hourOffset * 3600000).toISOString(), end: new Date(now.getTime() + (hourOffset + 0.75) * 3600000).toISOString(), allDay: false, source });
        return { events: [event(-0.25, 'Product review', 'Work'), event(1.25, 'Lunch outside', 'Personal'), event(3.5, 'Project deep work', 'Work')], updatedAt: demoTimestamp() };
      }
      if (config.provider === 'ics') {
        if (!config.url) throw new Error('ics provider requires url');
        const { response, text } = await fetchText(config.url, { headers: { Accept: 'text/calendar' } }, config.timeoutMs || 12000);
        if (!response.ok) throw new Error(`Calendar provider returned HTTP ${response.status}`);
        return { events: parseIcs(text), updatedAt: demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
