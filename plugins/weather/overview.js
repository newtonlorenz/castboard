import {escapeHtml} from '/widget-kit.js';

const value = input => input !== null && input !== undefined && input !== '' && Number.isFinite(Number(input)) ? Number(input) : null;

export function forecastOverview(data, {page, zone, dateLabel, weatherIcon, number, temperature}) {
  if (page === 1) {
    const days = (Array.isArray(data.daily) ? data.daily : []).slice(0, 7);
    if (!days.length) return '<p class="weather-empty">Seven-day forecast unavailable</p>';
    return `<div class="weather-week" aria-label="Seven-day forecast: high, low and chance of rain">${days.map(day => `<div class="weather-day" data-forecast-time="${escapeHtml(day.date)}"><time>${escapeHtml(dateLabel(`${day.date}T12:00:00Z`, {weekday:'short', timeZone:'UTC'}))}</time><span class="weather-day-icon" role="img" aria-label="${escapeHtml(day.condition || 'Conditions unavailable')}">${weatherIcon(day.code)}</span><strong aria-label="High ${escapeHtml(temperature(day.highC))}">${temperature(day.highC)}</strong><span class="weather-low" aria-label="Low ${escapeHtml(temperature(day.lowC))}">${temperature(day.lowC)}</span><small aria-label="Chance of rain ${escapeHtml(number(day.precipitationProbability))} percent">${number(day.precipitationProbability)}%</small></div>`).join('')}</div>`;
  }
  const hours = (Array.isArray(data.hourly) ? data.hourly : []).filter(hour => Date.parse(hour.time) + 3600000 > Date.now()).slice(0, 24);
  if (!hours.length) return '<p class="weather-empty">24-hour forecast unavailable</p>';
  const temperatures = hours.map(hour => value(hour.temperatureC)).filter(v => v !== null);
  const rain = hours.map(hour => value(hour.precipitationProbability)).filter(v => v !== null);
  const low = temperatures.length ? Math.min(...temperatures) : null, high = temperatures.length ? Math.max(...temperatures) : null;
  const span = Math.max(4, (high ?? 0) - (low ?? 0)), floor = ((high ?? 0) + (low ?? 0) - span) / 2;
  const x = index => 12 + index * 576 / Math.max(1, hours.length - 1);
  const y = temperature => 12 + (1 - (temperature - floor) / span) * 64;
  let path = '', connected = false;
  const marks = hours.map((hour, index) => {
    const temp = value(hour.temperatureC), chance = value(hour.precipitationProbability);
    if (temp !== null) { path += `${connected ? 'L' : 'M'}${x(index)},${y(temp)} `; connected = true; } else connected = false;
    const summary = `${dateLabel(hour.time,{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone})}: ${temperature(temp)}, ${hour.condition || 'conditions unavailable'}, rain ${number(chance)}%`;
    return `<g data-forecast-time="${escapeHtml(hour.time)}"><title>${escapeHtml(summary)}</title>${chance === null ? '' : `<rect class="weather-rain-bar" x="${x(index)-6}" y="${100-Math.max(0,Math.min(100,chance))*.2}" width="12" height="${Math.max(0,Math.min(100,chance))*.2}"/>`}${temp === null ? '' : `<circle cx="${x(index)}" cy="${y(temp)}" r="3"/>`}</g>`;
  }).join('');
  const indices = [...new Set([0, Math.round((hours.length-1)/4), Math.round((hours.length-1)/2), Math.round((hours.length-1)*3/4), hours.length-1])];
  return `<div class="weather-day-chart"><div class="weather-chart-summary"><span>Temp ${temperature(low)}–${temperature(high)}</span><span>Rain ${rain.length ? `≤ ${number(Math.max(...rain))}%` : '—'}</span></div><svg class="weather-hour-chart" viewBox="0 0 600 104" preserveAspectRatio="none" role="img" aria-label="${hours.length} hourly temperatures and rain chances"><path class="weather-chart-baseline" d="M0 100H600"/><path class="weather-temperature-line" d="${path}"/>${marks}</svg><div class="weather-hour-labels">${indices.map(index => `<time>${escapeHtml(dateLabel(hours[index].time,{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone}))}</time>`).join('')}</div></div>`;
}
