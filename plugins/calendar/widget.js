import { escapeHtml, getPluginData, schedule, title, unavailable } from '/widget-kit.js';

export function mount({ element, config, context }) {
  element.classList.toggle('calendar-compact',config.compact===true);
  const formatTime = value => {
    if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'All day';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: context.app.branding.timeZone }).format(date);
  };
  const load = async () => {
    try {
      const data = await context.data();
      const events = (data.events || []).filter(event => !event.end || new Date(event.end).getTime() > Date.now()).slice(0, config.maxEvents || 5);
      element.innerHTML = `${title(config.title || 'Today',config.compact?(config.demo?'Sample':''):`${events.length} events`)}<div class="calendar-list">${events.length ? events.map(event => `<div class="calendar-event"><time>${formatTime(event.start)}</time><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.source || 'Calendar')}</span></div></div>`).join('') : '<div class="empty-state"><strong>Clear day</strong><span>No upcoming events</span></div>'}</div>`;
    } catch (error) { unavailable(element, config.title || 'Today', error); }
  };
  context.schedule(load, 60000);
}
