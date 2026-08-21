import { escapeHtml, getPluginData, schedule } from '/widget-kit.js';

function timeLabel(value, timeZone) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}

export function mount({ element, context }) {
  const load = async () => {
    const [calendar, recovery] = await Promise.all([
      getPluginData('calendar').catch(() => ({ events: [] })),
      getPluginData('recovery').catch(() => null),
    ]);
    const now = Date.now();
    const events = (calendar.events || []).filter(event => !event.end || new Date(event.end).getTime() > now);
    const current = events.find(event => new Date(event.start).getTime() <= now) || events[0];
    const kicker = current && new Date(current.start).getTime() <= now ? 'Now' : 'Next';
    element.innerHTML = `<div class="focus-kicker">${kicker}</div><div class="focus-value">${escapeHtml(current?.title || 'Open focus time')}</div><div class="focus-meta">${escapeHtml(current ? timeLabel(current.start, context.app.branding.timeZone) : 'No more events')}</div><div class="focus-value">${recovery ? `Recovery ${escapeHtml(recovery.score)} · ${escapeHtml(recovery.status || '')}` : 'Your day is clear'}</div>`;
  };
  schedule(() => load().catch(() => { element.innerHTML = '<div class="focus-kicker">Focus</div><div class="focus-value">Ready when you are</div>'; }), 60000);
}
