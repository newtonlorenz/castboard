// Optional, deliberately small views for microcontrollers. Browser widgets keep
// their richer charts, animation, video and arbitrary HTML in image mode.
const number = (value, unit = '') => Number.isFinite(Number(value)) && value !== null ? `${Number(value).toLocaleString('en', { maximumFractionDigits: 1 })}${unit}` : '—';
const line = (text, kind = 'body') => ({ text: String(text ?? '').slice(0, 240), kind });
const list = (items, format) => (Array.isArray(items) ? items : []).slice(0, 12).map(format);
const view = (title, lines) => ({ title, lines: lines.filter(item => item?.text) });
const media = (name, {data, options}) => ({...view(options.title || name, [line(data.title || 'Nothing playing'), line(data.artist), line(data.playing ? 'Playing' : 'Paused', 'muted')]),
  ...(options.controllable && options.showControls !== false ? {controls:[{label:'Previous',action:'previous'},{label:data.playing?'Pause':'Play',action:'toggle'},{label:'Next',action:'next'}]} : {}),
});
export const nativeViews = {
  clock({ options, branding, now = new Date() }) {
    const timeZone = options.timeZone || branding.timeZone || 'UTC';
    return view(options.title || 'Clock', [line(new Intl.DateTimeFormat('en', { timeZone, hour: '2-digit', minute: '2-digit', ...(options.showSeconds ? { second: '2-digit' } : {}), hour12: options.hour12 === true }).format(now), 'metric'), line(new Intl.DateTimeFormat('en', { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(now))]);
  },
  weather: ({ data, options }) => view(options.title || 'Weather', [line(number(data.temperatureC, '°C'), 'metric'), line(data.condition), line(data.label), line(`Wind ${number(data.windKph, ' km/h')}`, 'muted')]),
  calendar({data, options, branding, now = new Date()}) {
    const events=(data.events || []).filter(event=>!event.end || new Date(event.end)>now).slice(0,options.maxEvents || 5);
    const lines=list(events,event=>{
      const date=new Date(event.start);
      const time=!event.start || /^\d{4}-\d{2}-\d{2}$/.test(event.start) ? 'All day' : Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en',{hour:'2-digit',minute:'2-digit',timeZone:branding.timeZone || 'UTC'}).format(date);
      return line(`${time}  ${event.title || event.summary || ''}`);
    });
    return view(options.title || 'Calendar',lines.length?lines:[line('No upcoming events')]);
  },
  news: ({ data, options }) => view(options.title || 'News', list(data.stories, item => line(item.title))),
  stocks: ({ data, options }) => view(options.title || 'Stocks', list(data.positions, item => line(`${item.symbol || item.name || ''}  ${number(item.price)}  ${number(item.changePct, '%')}`))),
  solar: ({ data, options }) => view(options.title || 'Solar', [line(number(data.generatedKw, ' kW'), 'metric'), line(`Home ${number(data.loadKw, ' kW')}`), line(`Import ${number(data.gridImportKw, ' kW')}`), line(`Export ${number(data.gridExportKw, ' kW')}`)]),
  recovery: ({ data, options }) => view(options.title || 'Recovery', [line(number(data.score, ' / 100'), 'metric'), line(data.status), line(data.detail)]),
  async focus({ options, read }) {
    const calendar = await read('calendar');
    const current = (calendar.events || []).find(event => !event.end || new Date(event.end).getTime() > Date.now());
    const recovery = options.showRecovery === false ? null : await read('recovery').catch(() => null);
    return view(options.title || 'Focus', [line(current?.title || options.emptyText || 'Open focus time'), line(current?.start || 'No more events'), ...(recovery ? [line(`Recovery ${number(recovery.score)} · ${recovery.status || ''}`)] : [])]);
  },
  spotify: input => media('Spotify',input),
  sonos: input => media('Sonos',input),
};
