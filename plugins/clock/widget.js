import { escapeHtml, title } from '/widget-kit.js?v=0.14.0';
import { clockTimes } from './assets/model.js';
export function mount({ element, config, context }) {
  element.classList.toggle('clock-compact',config.compact===true);
  element.classList.toggle('clock-world',Boolean(config.additionalClocks?.length));
  const render = () => {
    const [primary, ...others] = clockTimes(config, context.app.branding);
    element.innerHTML = `${config.compact?'':title(config.title || context.app.branding.name, config.location || context.app.branding.location)}<div class="clock-primary"><div class="clock-time">${escapeHtml(primary.time)}</div>${config.showDate===false?'':`<div class="clock-date">${escapeHtml(primary.date)}</div>`}</div>${others.length ? `<div class="clock-zones">${others.map(zone=>`<section><strong>${escapeHtml(zone.label)}</strong><time>${escapeHtml(zone.time)}</time><span>${escapeHtml(zone.date)}</span></section>`).join('')}</div>` : ''}`;
  };
  render(); context.schedule(render, config.showSeconds ? 1000 : 15000);
}
