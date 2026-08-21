import { demoTimestamp, readJsonSource } from '../../src/core/providers.js';

const CONDITIONS = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm',
};

export function createPlugin({ config, context }) {
  return {
    id: 'weather',
    name: 'Weather',
    publicConfig: () => ({ label: config.label || '' }),
    async getData() {
      if (config.provider === 'demo') return { temperatureC: 22, condition: 'Clear', code: 0, windKph: 11, label: config.label || 'Demo town', updatedAt: demoTimestamp() };
      if (config.provider === 'open-meteo') {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', config.latitude);
        url.searchParams.set('longitude', config.longitude);
        url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
        url.searchParams.set('timezone', 'auto');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
        const data = await response.json();
        return { temperatureC: data.current?.temperature_2m, condition: CONDITIONS[data.current?.weather_code] || 'Unknown', code: data.current?.weather_code, windKph: data.current?.wind_speed_10m, label: config.label || data.timezone_abbreviation || '', updatedAt: data.current?.time || demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
