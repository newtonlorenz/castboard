export async function scope(element, context, markup, skin) {
  element.dataset.chrome='internal';
  const root = element.attachShadow({ mode: 'open' });
  const link = globalThis.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = context.source('theme').asset(skin);
  root.append(link);
  const shell = globalThis.document.createElement('div');
  shell.className = 'module-root';
  shell.innerHTML = markup;
  root.append(shell);
  const style=globalThis.document.createElement('style');
  style.textContent=`[hidden]{display:none!important}

  :host([data-appearance-fontfamily]) :is(h1,h2,h3,.card-label,.lead-title,.identity-title,.time-clock,.weather-temp,.whoop-recovery,.solar-value),
  :host([data-appearance-headingfontfamily]) :is(h1,h2,h3,.card-label,.lead-title,.identity-title,.time-clock,.weather-temp,.whoop-recovery,.solar-value){font-family:var(--castboard-headingFontFamily,var(--castboard-fontFamily,inherit))}
  :host([data-appearance-background]) :is(.card,.masthead,.lead-card,.side-card){background:var(--castboard-background)}
  :host([data-appearance-radius]) :is(.card,.masthead,.lead-card,.side-card){border-radius:var(--castboard-radius)}
  :host([data-appearance-padding]) :is(.card,.masthead,.lead-card,.side-card){padding:var(--castboard-padding)}
  :host([data-appearance-bordercolor]) :is(.card,.masthead,.lead-card,.side-card){border-color:var(--castboard-borderColor)}
  :host([data-appearance-borderwidth]) :is(.card,.masthead,.lead-card,.side-card){border-width:var(--castboard-borderWidth)}
  :host([data-appearance-shadow]) :is(.card,.masthead,.lead-card,.side-card){box-shadow:var(--castboard-shadow)}`;
  root.append(style);
  const displayTitle=context.panel.options?.title??context.plugin.config.title;
  let title=shell.querySelector('.card-label,.wire-title');
  if(displayTitle && !title){title=globalThis.document.createElement('div');title.className='card-label';shell.prepend(title);}
  if(title && displayTitle)title.textContent=displayTitle;
  const demoLabel=globalThis.document.createElement('span');demoLabel.textContent='Demo data';demoLabel.hidden=true;demoLabel.style.cssText='position:absolute;right:8px;top:8px;font:11px sans-serif;padding:3px 6px;background:#222;color:#eee;z-index:3;pointer-events:none';shell.append(demoLabel);
  const markData=data=>{demoLabel.hidden=data?.demo!==true;return data;};
  const document = {
    getElementById: id => root.querySelector(`#${CSS.escape(id)}`),
    querySelector: selector => root.querySelector(selector),
    querySelectorAll: selector => root.querySelectorAll(selector),
    createElement: tag => globalThis.document.createElement(tag),
    contains: target => root.contains(target),
    get hidden() { return globalThis.document.hidden; },
    addEventListener(event, callback, options) { context.listen(event === 'visibilitychange' ? globalThis.document : root, event, callback, options); },
  };
  const timers = new Set();
  const setTimeout = (callback, delay) => {
    const id = globalThis.setTimeout(() => { timers.delete(id); if (!context.signal.aborted) callback(); }, delay);
    timers.add(id); return id;
  };
  const setInterval = (callback, delay) => context.schedule(callback, delay);
  const clearTimeout = id => { timers.delete(id); globalThis.clearTimeout(id); };
  const clearInterval = id => globalThis.clearInterval(id);
  context.onDispose(() => {
    for (const id of timers) globalThis.clearTimeout(id);
    for (const media of root.querySelectorAll('img,video,iframe')) { media.removeAttribute('src'); media.pause?.(); }
    for (const dialog of root.querySelectorAll('dialog')) dialog.close();
    root.replaceChildren();
  });
  function resourceUrl(path) { return context.source('resources').resource({ path }); }
  async function request(input, options = {}) {
    const url = new URL(input, globalThis.location.origin);
    const method = options.method || 'GET';
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {};
    if (url.pathname.startsWith('/api/sonos/')) {
      const action = url.pathname.split('/').at(-1);
      const media=context.panel.source && context.plugin.config.sourceAlias==='media' ? context : context.source('media');
      return markData(await (method === 'GET' ? media.data({ view: action }) : media.action(action, { ...Object.fromEntries(url.searchParams), ...body })));
    }
    if (/^\/api\/briefings\/[a-z0-9-]+$/.test(url.pathname) && context.plugin.config.briefingQueries===true) return markData(await context.data({briefing:url.pathname.split('/').at(-1)}));
    if (url.pathname === '/api/link/launch') return context.source('launch').action('launch', { url: url.searchParams.get('url') });
    if (url.pathname === '/clearcam/health' || url.pathname === '/camera/api/cameras') return context.source('resources').data({ path: url.pathname });
    const aliases = { '/api/camera-alerts': 'alerts', '/api/config': 'config', '/api/calendar': 'calendar', '/api/dashboard/portfolio': 'portfolio', '/api/weather': 'weather', '/api/solar': 'solar', '/api/whoop': 'recovery' };
    if (aliases[url.pathname] && (aliases[url.pathname]!=='alerts' || context.bindings.alerts || context.plugin.config.sourceAlias==='alerts')) { const alias=aliases[url.pathname]; return markData(await (context.panel.source && context.plugin.config.sourceAlias===alias ? context.data() : context.source(alias).data())); }
    if(method==='POST')return context.source('services').action('request',{route:url.pathname+url.search,body});
    return markData(await context.source('services').data({ route: url.pathname + url.search }));
  }
  return { root, document, request, resourceUrl, setTimeout, setInterval, clearTimeout, clearInterval };
}
