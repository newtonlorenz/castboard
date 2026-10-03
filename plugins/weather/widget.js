import { escapeHtml, formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js';

function weatherIcon(code) {
  if (code === 0) return '☀';
  if ([1, 2].includes(code)) return '◑';
  if ([3, 45, 48].includes(code)) return '☁';
  if (Number(code) >= 71 && Number(code) <= 77) return '❄';
  if (Number(code) >= 95) return 'ϟ';
  return '☂';
}

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const data = await context.data();
      element.classList.remove('widget-unavailable');
      element.innerHTML = `${title(config.title || 'Weather', data.label || config.label)}<div class="weather-main"><span class="weather-icon">${weatherIcon(data.code)}</span><strong class="weather-temp">${formatNumber(data.temperatureC, 0)}°</strong></div><div class="weather-detail">${escapeHtml(data.condition || 'Conditions unavailable')} · Wind ${formatNumber(data.windKph, 0)} km/h</div>`;
    } catch (error) { unavailable(element, 'Weather', error); }
  };
  context.schedule(load, 10 * 60000);
}
