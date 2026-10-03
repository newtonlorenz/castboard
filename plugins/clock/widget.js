import { title } from '/widget-kit.js';

export function mount({ element, config, context }) {
  const render = () => {
    const now = new Date();
    const zone = config.timeZone || context.app.branding.timeZone;
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: config.showSeconds ? '2-digit' : undefined, hour12: config.hour12 === true, timeZone: zone }).format(now);
    const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone }).format(now);
    element.innerHTML = `${title(config.title || context.app.branding.name, context.app.branding.location)}<div class="clock-time">${time}</div><div class="clock-date">${date}</div>`;
  };
  render();
  context.schedule(render, config.showSeconds ? 1000 : 15000);
}
