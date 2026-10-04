import { nativeViews } from '../../src/core/native-views.js';
import { fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

import { normalizeForecast, forecastDemo } from './forecast.js';

export function createPlugin({ config, context }) {
  validateProviderConfig('weather', config, ['demo', 'open-meteo', 'http-json', 'file-json']);
  const coordinate = (value,limit) => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
  if (config.provider === 'open-meteo' && (!coordinate(config.latitude,90) || !coordinate(config.longitude,180))) throw new Error('Plugin weather open-meteo provider requires valid latitude and longitude');
  return {
    id: 'weather',
    nativeView: nativeViews.weather,
    assets: ['style.css', 'forecast.js'],
    styles: ['style.css'],
    name: 'Weather',
    publicConfig: () => ({ demo: config.provider==='demo', label: config.label || '', title: config.title || 'Weather', view: config.view || 'current', forecastLayout: config.forecastLayout || 'auto', hours: config.hours || 12, days: config.days || 7, refreshSeconds: config.refreshSeconds || 300 }),
    async getData() {
      if (config.provider === 'demo') return { ...forecastDemo(), label: config.label || 'Demo town' };
      if (config.provider === 'open-meteo') {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', config.latitude);
        url.searchParams.set('longitude', config.longitude);
        url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,is_day');
        url.searchParams.set('hourly', 'temperature_2m,weather_code,uv_index,precipitation_probability');
        url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,uv_index_max,precipitation_probability_max');
        url.searchParams.set('forecast_days', '7');
        url.searchParams.set('timeformat', 'unixtime');
        url.searchParams.set('timezone', 'auto');
        const data = await fetchJson(url, {}, config.timeoutMs || 10000);
        return normalizeForecast(data, config.label);
      }
      return readJsonSource(config, context);
    },
  };
}
