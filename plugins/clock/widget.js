import { title } from '/widget-kit.js?v=0.13.0';

export function mount({ element, config, context }) {
  element.classList.toggle('clock-compact',config.compact===true);
  const render = () => {
    const now = new Date();
    const zone = config.timeZone || context.app.branding.timeZone;
    const time = new Intl.DateTimeFormat(config.locale || undefined, { hour: '2-digit', minute: '2-digit', second: config.showSeconds ? '2-digit' : undefined, hour12: config.hour12 === true, timeZone: zone }).format(now);
    const date = new Intl.DateTimeFormat(config.locale || undefined, { weekday:config.dateStyle==='numeric'?undefined:config.compact || config.dateStyle==='short'?'short':'long',day:'numeric',month:config.dateStyle==='numeric'?'2-digit':config.compact || config.dateStyle==='short'?'short':'long', timeZone: zone }).format(now);
    element.innerHTML = `${config.compact?'':title(config.title || context.app.branding.name, config.location || context.app.branding.location)}<div class="clock-time">${time}</div>${config.showDate===false?'':`<div class="clock-date">${date}</div>`}`;
  };
  render();
  context.schedule(render, config.showSeconds ? 1000 : 15000);
}
