import {displayForecast} from '../../plugins/weather/forecast.js';
import {calendarEvents} from '../../plugins/calendar/events.js';
// Optional, deliberately small views for microcontrollers. Browser widgets keep
// their richer charts, animation, video and arbitrary HTML in image mode.
const number = (value, unit = '') => Number.isFinite(Number(value)) && value !== null && value !== '' ? `${Number(value).toLocaleString('en', { maximumFractionDigits: 1 })}${unit}` : '—';
const line = (text, kind = 'body') => ({ text: String(text ?? '').slice(0, 240), kind });
const list = (items, format) => (Array.isArray(items) ? items : []).slice(0, 12).map(format);
const view = (title, lines) => ({ title, lines: lines.filter(item => item?.text) });
const media = (name, {data, options}) => ({...view(options.title || name, [line(data.title || 'Nothing playing'), line(data.artist), line(data.playing ? 'Playing' : 'Paused', 'muted')]),
  ...(options.controllable && options.showControls !== false ? {controls:[{label:'Previous',action:'previous'},{label:data.playing?'Pause':'Play',action:'toggle'},{label:'Next',action:'next'}]} : {}),
});
export const nativeViews = {
  clock({ options, branding, now = new Date() }) {
    const timeZone = options.timeZone || branding.timeZone || 'UTC';
    return view(options.compact?'':options.title || 'Clock', [line(new Intl.DateTimeFormat(options.locale || 'en', { timeZone, hour: '2-digit', minute: '2-digit', ...(options.showSeconds ? { second: '2-digit' } : {}), hour12: options.hour12 === true }).format(now), options.compact?'small':'metric'), ...(options.showDate===false?[]:[line(new Intl.DateTimeFormat(options.locale || 'en', options.dateStyle==='numeric'?{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}:{timeZone,weekday:options.compact||options.dateStyle==='short'?'short':'long',month:'short',day:'numeric'}).format(now),options.compact?'small':'body')]),...(options.location?[line(options.location,'muted')]:[])]);
  },
  weather({ data, options, branding = {}, now = new Date() }) {
    data=displayForecast(data,options);
    const temperatureUnit=options.temperatureUnit==='fahrenheit'?'°F':'°C', windUnit=options.windUnit==='mph'?' mph':options.windUnit==='ms'?' m/s':' km/h',wind=data.windKph===null||data.windKph===undefined?null:options.windUnit==='mph'?data.windKph/1.609344:options.windUnit==='ms'?data.windKph/3.6:data.windKph;
    const mode = options.view || 'current', zone = data.timeZone || branding.timeZone || 'UTC', lines = [];
    const dateLabel = (value, format) => {
      const date = new Date(value);
      if (!value || Number.isNaN(date.getTime())) return '—';
      try { return new Intl.DateTimeFormat('en', format).format(date); } catch { return new Intl.DateTimeFormat('en', {...format,timeZone:'UTC'}).format(date); }
    };
    if(options.compact && mode==='current')return view('',[line(`${number(data.temperatureC,temperatureUnit)} · UV ${number(data.uvIndex)}`,'small'),line((data.condition || 'Conditions unavailable')+(options.demo?' · Sample':''),'small')]);
    if (mode === 'current' || mode === 'forecast') lines.push(line(number(data.temperatureC, temperatureUnit), 'metric'), line(data.condition), line(`Wind ${number(wind,windUnit)} · UV ${number(data.uvIndex)}`, 'muted'));
    if (mode === 'hourly' || mode === 'forecast') {
      lines.push(line('Next hours', 'muted'));
      const hours = (Array.isArray(data.hourly) ? data.hourly : []).filter(hour => Date.parse(hour.time) + 3600000 > now.getTime()).slice(0, Math.min(24, options.hours || 12));
      lines.push(...(hours.length ? hours.map(hour => line(`${dateLabel(hour.time, {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone})}  ${number(hour.temperatureC, temperatureUnit)}  ${hour.condition || ''}`)) : [line('Hourly forecast unavailable')]));
    }
    if (mode === 'daily' || mode === 'forecast') {
      lines.push(line('Coming days', 'muted'));
      const days = (Array.isArray(data.daily) ? data.daily : []).slice(0, Math.min(7, options.days || 7));
      lines.push(...(days.length ? days.map(day => line(`${dateLabel(`${day.date}T12:00:00Z`, {weekday:'short',timeZone:'UTC'})}  ${number(day.highC, '°')} / ${number(day.lowC, '°')}  ${day.condition || ''}`)) : [line('Daily forecast unavailable')]));
    }
    return view(options.title || 'Weather', lines);
  },
  calendar({data, options, branding, now = new Date()}) {
    const events=calendarEvents(data,options,now.getTime());
    const lines=list(events,event=>{
      const date=new Date(event.start);
      const time=!event.start || /^\d{4}-\d{2}-\d{2}$/.test(event.start) ? 'All day' : Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en',{hour:'2-digit',minute:'2-digit',timeZone:options.timeZone || branding.timeZone || 'UTC'}).format(date);
      return line(`${time}  ${event.title || event.summary || ''}${options.showSource!==false&&event.source?' · '+event.source:''}${options.showLocation&&event.location?' · '+event.location:''}`,options.compact?'small':'body');
    });
    return view((options.title || 'Calendar')+(options.demo?' · Sample':''),lines.length?lines:[line('No upcoming events')]);
  },
  news: ({ data, options }) => view(options.title || 'News', list(data.stories, item => line(item.title))),
  stocks: ({ data, options }) => view(options.title || 'Stocks', list((Array.isArray(data.positions)?data.positions:[]).slice(0,options.maxRows || 6), item => line(`${item.symbol || item.name || ''}  ${number(item.price)}  ${number(item.changePct, '%')}`))),
  solar({data,options}) {
    const unit=options.powerUnit==='W'?' W':' kW',format=value=>value===null || value===undefined || value==='' || !Number.isFinite(Number(value))?'—':`${(Number(value)*(options.powerUnit==='W'?1000:1)).toLocaleString('en',{maximumFractionDigits:options.precision ?? 1})}${unit}`,kind=options.compact?'small':'body';
    return view((options.title || 'Energy')+(options.demo?' · Sample':''),[line(format(data.generatedKw),options.compact?'small':'metric'),line(`${options.loadLabel || 'Home load'} ${format(data.loadKw)}`,kind),...(options.showGrid===false?[]:[line(`Import ${format(data.gridImportKw)}`,kind),line(`Export ${format(data.gridExportKw)}`,kind)])]);
  },
  recovery: ({ data, options }) => view(options.title || 'Recovery', [line(number(data.score, ' / 100'), 'metric'), line(data.status), ...(options.showDetail===false?[]:[line(data.detail)])]),
  async focus({ options, read }) {
    const calendar = await read('calendar');
    const current = calendarEvents(calendar, options, Date.now())[0];
    const recovery = options.showRecovery === false ? null : await read('recovery').catch(() => null);
    return view(options.title || 'Focus', [line(current?.title || options.emptyText || 'Open focus time'), line(current?.start || 'No more events'), ...(recovery ? [line(`Recovery ${number(recovery.score)} · ${recovery.status || ''}`)] : [])]);
  },
  spotify: input => media('Spotify',input),
  sonos: input => media('Sonos',input),
};
