import { escapeHtml, getPluginData, schedule } from '/widget-kit.js?v=0.13.0';

function timeLabel(value, timeZone) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}

export function mount({ element, config, context }) {
  const load = async () => {
    const [calendar, recovery] = await Promise.all([
      Promise.resolve().then(()=>context.source('calendar').data()).catch(() => ({ events: [] })),
      Promise.resolve().then(()=>config.showRecovery===false?null:context.source('recovery').data()).catch(() => null),
    ]);
    const now = Date.now();
    const events = (calendar.events || []).filter(event => !event.end || new Date(event.end).getTime() > now);
    const current = events.find(event => new Date(event.start).getTime() <= now) || events[0];
    const kicker = current && new Date(current.start).getTime() <= now ? 'Now' : 'Next';
    element.innerHTML = `<div class="focus-kicker">${escapeHtml(config.title || kicker)}</div><div class="focus-value">${escapeHtml(current?.title || config.emptyText || 'Open focus time')}</div><div class="focus-meta">${escapeHtml(current ? timeLabel(current.start, config.timeZone || context.app.branding.timeZone) : 'No more events')}</div><div class="focus-value">${config.showRecovery===false?'':recovery ? `Recovery ${escapeHtml(recovery.score)} · ${escapeHtml(recovery.status || '')}` : 'Your day is clear'}</div>`;
  };
  context.schedule(() => load().catch(() => { element.innerHTML = '<div class="focus-kicker">Focus</div><div class="focus-value">Ready when you are</div>'; }), (config.refreshSeconds || 60)*1000);
}
