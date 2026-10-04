const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const conditions = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Showers',
  82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};
export const condition = code => conditions[code] || 'Unknown';
const iso = value => Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;

export function normalizeForecast(data, label = '', now = Date.now()) {
  const current = data.current || {}, hours = data.hourly || {}, days = data.daily || {};
  const allHours = (Array.isArray(hours.time) ? hours.time : []).map((time, i) => ({
    time: iso(time), temperatureC: finite(hours.temperature_2m?.[i]), code: finite(hours.weather_code?.[i]),
    condition: condition(hours.weather_code?.[i]), uvIndex: finite(hours.uv_index?.[i]),
    precipitationProbability: finite(hours.precipitation_probability?.[i]),
  })).filter(hour => hour.time);
  const currentHour = allHours.find(hour => Date.parse(hour.time) <= now && Date.parse(hour.time) + 3600000 > now);
  return {
    temperatureC: finite(current.temperature_2m), code: finite(current.weather_code), condition: condition(current.weather_code),
    windKph: finite(current.wind_speed_10m), humidityPercent: finite(current.relative_humidity_2m),
    uvIndex: finite(current.uv_index) ?? currentHour?.uvIndex ?? null, isDay: current.is_day === 1,
    label: label || data.timezone_abbreviation || '', timeZone: data.timezone || 'UTC', updatedAt: iso(current.time),
    hourly: allHours.filter(hour => Date.parse(hour.time) + 3600000 > now).slice(0, 24),
    daily: (Array.isArray(days.time) ? days.time : []).slice(0, 7).map((time, i) => ({
      date: Number.isFinite(time) ? new Date((time + (Number(data.utc_offset_seconds) || 0)) * 1000).toISOString().slice(0, 10) : null,
      highC: finite(days.temperature_2m_max?.[i]), lowC: finite(days.temperature_2m_min?.[i]),
      code: finite(days.weather_code?.[i]), condition: condition(days.weather_code?.[i]),
      uvIndex: finite(days.uv_index_max?.[i]), precipitationProbability: finite(days.precipitation_probability_max?.[i]),
    })).filter(day => day.date),
  };
}

export function forecastDemo(now = Date.now()) {
  const start = Math.floor(now / 3600000) * 3600000;
  return {
    temperatureC: 22, condition: 'Clear', code: 0, windKph: 11, humidityPercent: 54, uvIndex: 3.2, isDay: true,
    timeZone: 'UTC', updatedAt: new Date(now).toISOString(),
    hourly: Array.from({ length: 24 }, (_, i) => ({time: new Date(start + i * 3600000).toISOString(), temperatureC: 22 - i % 6, code: i % 4, condition: condition(i % 4), precipitationProbability: i % 3 * 10})),
    daily: Array.from({ length: 7 }, (_, i) => ({date: new Date(start + i * 86400000).toISOString().slice(0, 10), highC: 24 + i % 3, lowC: 16 + i % 2, code: i % 4, condition: condition(i % 4), precipitationProbability: i % 3 * 10})),
  };
}


// Small receivers can navigate with taps alone; retain every requested entry.
export function forecastPages(data, options = {}, height = 200, now = Date.now()) {
  const mode=['current','forecast','hourly','daily'].includes(options.view)?options.view:'current', pages=[];
  const count=Math.max(1,Math.min(12,Math.floor((height-78)/30)));
  if(mode==='current' || mode==='forecast')pages.push({kind:'current',label:'Now',items:[]});
  const add=(kind,values,limit,label)=>{
    const items=(Array.isArray(values)?values:[]).slice(0,limit);
    if(!items.length){pages.push({kind,label,items:[]});return;}
    for(let index=0;index<items.length;index+=count)pages.push({kind,label:`${label} ${index+1}–${Math.min(index+count,items.length)} / ${items.length}`,items:items.slice(index,index+count)});
  };
  if(mode==='hourly' || mode==='forecast')add('hourly',(Array.isArray(data.hourly)?data.hourly:[]).filter(hour=>Date.parse(hour.time)+3600000>now),Math.max(1,Math.min(24,options.hours || 12)),'Hours');
  if(mode==='daily' || mode==='forecast')add('daily',data.daily,Math.max(1,Math.min(7,options.days || 7)),'Days');
  return pages;
}
