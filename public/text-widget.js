import { textDisplay } from './appearance-model.js?v=20261125';

const number = (value, digits = 1) => value !== null && value !== undefined && Number.isFinite(Number(value))
  ? Number(value).toLocaleString(undefined, {maximumFractionDigits: digits}) : '--';
const list = value => Array.isArray(value) ? value : [];
const weatherConditions = {0:'Clear', 1:'Mostly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Fog', 48:'Freezing fog', 51:'Drizzle', 53:'Drizzle', 55:'Heavy drizzle', 61:'Rain', 63:'Rain', 65:'Heavy rain', 71:'Snow', 73:'Snow', 75:'Heavy snow', 80:'Showers', 81:'Showers', 82:'Heavy showers', 95:'Thunderstorm', 96:'Hail', 99:'Hail'};

export function plainText(value) {
  return String(value ?? '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/[*`]/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
}

// Wrap by Unicode code points so cropping cannot split a surrogate pair.
// These are character counts, not terminal display-cell widths for CJK/emoji.
export function characterGrid(value, columns, rows) {
  const lines = [];
  for (const line of plainText(value).split('\n')) {
    const characters = Array.from(line.replace(/\t/g, ' '));
    if (!columns || !characters.length) lines.push(characters.join(''));
    else for (let offset = 0; offset < characters.length; offset += columns) lines.push(characters.slice(offset, offset + columns).join(''));
  }
  if (rows) {
    lines.splice(rows);
    while (lines.length < rows) lines.push('');
  }
  return lines.map(line => columns ? line + ' '.repeat(Math.max(0, columns - Array.from(line).length)) : line).join('\n');
}

function time(value, timeZone) {
  if (!value || value === 'all-day' || /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'All day';
  if (/^\d{1,2}:\d{2}/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, {hour:'2-digit', minute:'2-digit', timeZone}).format(date) : '--';
}

function genericLines(data, prefix = '', depth = 0, lines = []) {
  if (depth > 5 || data == null || lines.length >= 100) return lines;
  if (typeof data !== 'object') {
    lines.push(`${prefix}${String(data)}`);
    return lines;
  }
  for (const [key, value] of Object.entries(data).slice(0, 100)) {
    if (!/(url|token|password|secret|headers|raw)/i.test(key)) genericLines(value, `${prefix}${key}: `, depth + 1, lines);
    if (lines.length >= 100) break;
  }
  return lines;
}

export function formatPluginText(type, data = {}, config = {}, branding = {}, now = new Date()) {
  const kind = type.replace(/^ambient-/, '');
  const zone = config.timeZone || branding.timeZone || 'UTC';
  let lines;
  switch (kind) {
    case 'clock':
      lines = [new Intl.DateTimeFormat(undefined, {hour:'2-digit', minute:'2-digit', second:config.showSeconds ? '2-digit' : undefined, hour12:config.hour12 === true, timeZone:zone}).format(now)];
      if (config.showDate !== false) lines.push(new Intl.DateTimeFormat(undefined, {weekday:'short', day:'numeric', month:'short', timeZone:zone}).format(now));
      if (config.location || branding.location) lines.push(config.location || branding.location);
      break;
    case 'weather': {
      const temperature = data.temperatureC ?? data.temp;
      const fahrenheit = config.temperatureUnit === 'fahrenheit';
      lines = [`${number(fahrenheit && temperature != null ? temperature * 9 / 5 + 32 : temperature, 0)} ${fahrenheit ? 'F' : 'C'} ${data.condition || weatherConditions[data.code] || 'Conditions unavailable'}`,
        `Wind ${number(data.windKph ?? data.windspeed, 0)} km/h`];
      if (data.label) lines.push(data.label);
      break;
    }
    case 'solar':
      lines = [`Solar ${number(data.generatedKw, config.precision)} kW`, `Load ${number(data.loadKw ?? (data.usedSolarKw != null && data.usedGridKw != null ? data.usedSolarKw + data.usedGridKw : undefined), config.precision)} kW`, `Grid in ${number(data.gridImportKw ?? data.usedGridKw)} kW`, `Grid out ${number(data.gridExportKw)} kW`];
      break;
    case 'recovery':
      lines = [`Recovery ${number(data.score ?? data.recovery?.score, 0)}/100`, data.status, data.detail];
      if (config.showSleep !== false && data.sleep?.hours != null) lines.push(`Sleep ${number(data.sleep.hours)} h`);
      if (config.showStrain !== false && data.strain?.score != null) lines.push(`Strain ${number(data.strain.score)}`);
      break;
    case 'focus':
    case 'calendar': {
      const events = list(data.events).filter(event => {
        if (!event.end || event.allDay || event.end === 'all-day') return true;
        if (/^\d{1,2}:\d{2}$/.test(event.end)) return event.end > time(now.toISOString(), zone);
        return new Date(event.end).getTime() > now.getTime();
      }).slice(0, kind === 'focus' ? 1 : config.maxEvents || 5);
      lines = events.length ? events.map(event => `${event.allDay ? 'All day' : time(event.start, zone)} ${event.title || 'Event'}`) : [config.emptyText || config.emptyCurrent || 'No upcoming events'];
      if (kind === 'focus' && config.showRecovery !== false && data.focusRecovery) lines.push(`Recovery ${number(data.focusRecovery.score, 0)}/100 ${data.focusRecovery.status || ''}`);
      break;
    }
    case 'stocks':
    case 'portfolio':
      lines = data.mode === 'watchlist' || config.mode === 'watchlist' ? [] : [`Total ${number(data.totalValue ?? data.summary?.netLiquidation, 0)} ${config.currency || data.summary?.baseCurrency || data.positions?.[0]?.currency || ''}`, `Day ${number(data.dailyChange ?? data.summary?.dailyPnl)}`];
      lines.push(...list(data.positions).slice(0, config.maxRows || 6).map(item => `${item.symbol} ${number(item.price, 2)} ${number(item.changePct)}%`));
      break;
    case 'spotify':
    case 'sonos':
    case 'media':
      lines = [data.playing || data.state === 'PLAYING' ? 'Playing' : 'Paused', data.title || 'Nothing playing', [data.artist, data.album].filter(Boolean).join(' - '), data.device || data.speaker];
      break;
    case 'news':
      lines = data.content ? [plainText(data.content)] : list(data.stories).slice(0, config.maxStories || 5).flatMap(story => [story.title, story.summary]);
      if (!lines.length) lines = ['No stories'];
      break;
    case 'camera':
      lines = data.cameras ? list(data.cameras).map(camera => `${camera.name || camera.id} ${camera.status || 'Configured'}`) : [data.name || config.cameraName || config.name || 'Camera', data.status || 'No cameras'];
      if (!lines.length) lines = ['No cameras'];
      break;
    case 'alerts':
      lines = list(data.alerts).slice(0, config.maxAlerts || 5).map(alert => alert.title || alert.label || alert.description || alert.type || 'Detection');
      if (!lines.length) lines = ['No alerts'];
      break;
    default:
      lines = genericLines(data);
      if (!lines.length) lines = ['No text data'];
  }
  const label = config.title || type.replace(/^ambient-/, '').replace(/-/g, ' ');
  // Keep the demo marker at the beginning so row cropping cannot hide it.
  return [data.demo || config.demo ? `Demo: ${label}` : label, ...lines].filter(value => value !== null && value !== undefined && value !== '').join('\n');
}

async function readTextData(context, config, type) {
  if (type === 'clock' || type === 'ambient-clock') return {};
  if (type === 'focus') {
    const [calendar, recovery] = await Promise.all([context.source('calendar').data(),
      config.showRecovery === false ? null : context.source('recovery').data().catch(() => null)]);
    return {...calendar, focusRecovery:recovery};
  }
  if (context.panel.source) return context.data();
  if (config.sourceAlias) return context.source(config.sourceAlias).data();
  if (type === 'ambient-camera') return context.source('resources').data({path:'/camera/api/cameras'});
  if (type === 'ambient-alerts') return context.source('services').data({route:'/api/camera-alerts'});
  if (context.plugin.hasData) return context.data();
  if (type === 'ambient-news') {
    const settings = config.briefings ? config : await context.source('config').data();
    const payloads = await Promise.all(list(settings.briefings).map(brief => context.source('services').data({route:`/api/briefings/${encodeURIComponent(brief.key)}`})));
    return {content:payloads.map(data => data.content || '').join('\n'), demo:payloads.some(data => data.demo)};
  }
  return {};
}

export async function mount({element, config, context}) {
  const type = context.plugin.type || context.plugin.id;
  const display = textDisplay(context.panel.appearance, context.screen.appearance);
  const output = element.ownerDocument.createElement('pre');
  output.className = 'text-output';
  if (display.columns) {output.style.setProperty('--text-columns', display.columns); output.dataset.columns = display.columns;}
  if (display.rows) {output.style.setProperty('--text-rows', display.rows); output.dataset.rows = display.rows;}
  element.replaceChildren(output);
  const write = value => { if (!context.signal.aborted) output.textContent = characterGrid(value, display.columns, display.rows); };
  const builtins = new Set(['clock','focus','weather','solar','recovery','calendar','stocks','portfolio','camera','alerts','spotify','sonos','media','news']);
  if (!builtins.has(type.replace(/^ambient-/, ''))) {
    const widget = await import(`/plugins/${encodeURIComponent(context.plugin.id)}/widget.js?v=${encodeURIComponent(context.plugin.version || '1')}`);
    if (context.signal.aborted) return;
    if (typeof widget.mountText === 'function') {
      // Custom renderers write strings through this callback; core owns the DOM.
      return widget.mountText({config, context, panel:context.panel, write});
    }
  }
  const load = async () => {
    try {
      const data = await readTextData(context, config, type);
      if (context.signal.aborted) return;
      if (element.dataset.freshness !== 'stale') element.dataset.freshness = 'live';
      element.classList.remove('widget-unavailable');
      write(formatPluginText(type, data, config, context.app.branding));
    } catch {
      if (context.signal.aborted) return;
      element.dataset.freshness = 'unavailable';
      element.classList.add('widget-unavailable');
      write(`${config.title || type}\nUnavailable`);
    }
  };
  context.schedule(load, type.endsWith('clock') && config.showSeconds ? 1000 : (config.refreshSeconds || (type.endsWith('clock') ? 15 : 60)) * 1000);
}
