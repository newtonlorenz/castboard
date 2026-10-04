export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function title(label, meta = '') {
  return `<header class="widget-head"><span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</header>`;
}

export async function requestJson(input, init = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await response.json();
    return { response, payload };
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}

export async function getPluginData(id, parameters = {}, signal) {
  const query = new URLSearchParams(parameters);
  const { response, payload } = await requestJson(`/api/plugins/${encodeURIComponent(id)}/data${query.size ? `?${query}` : ''}`, { cache: 'no-store', signal }, 30000);
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to load ${id}`);
  return payload.data;
}

export async function postPluginAction(id, action, extra = {}, signal) {
  if (window.location.pathname === '/admin-preview') throw new Error('Controls are disabled in the Studio preview');
  const { response, payload } = await requestJson(`/api/plugins/${encodeURIComponent(id)}/action`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
  }, 60000);
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to control ${id}`);
  return payload.data;
}

export function unavailable(element, label, error) {
  element.classList.add('widget-unavailable');
  element.innerHTML = `${title(label)}<div class="empty-state"><strong>Unavailable</strong><span>${escapeHtml(error?.message || 'Provider did not respond')}</span></div>`;
}

export function schedule(load, milliseconds) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await load(); } finally { running = false; }
  };
  void run();
  return setInterval(run, milliseconds);
}

export function formatNumber(value, digits = 1) {
  const number = value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

export function markdownLite(value) {
  return String(value || '').split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}

export function createWidgetContext({ app, screen, plugin, panel, element, announce }) {
  const controller = new AbortController();
  const cleanups = [];
  const bindings = { ...(plugin.bindings || {}), ...(panel.bindings || {}) };
  const id = panel.source || bindings[plugin.config?.sourceAlias] || plugin.defaultSource || plugin.id;
  const lastGood = new Map();
  const source = sourceId => {
    const resolved = bindings[sourceId] || sourceId || id;
    if (!app.plugins.some(item => item.id === resolved)) throw new Error(`Source is unavailable: ${resolved}`);
    return {
      id: resolved,
      data: async (parameters = {}) => {
        const key = `${resolved}:${new URLSearchParams(parameters)}`;
        try {
          const data = await getPluginData(resolved, parameters, controller.signal);
          lastGood.set(key, data);
          element.dataset.freshness = 'live';
          element.classList.remove('widget-unavailable', 'widget-stale');
          element.removeAttribute('data-provider-error');
          return data;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          element.dataset.freshness = 'unavailable';
          element.dataset.providerError = error.message;
          // Explicitly opt in; errors otherwise preserve the widget's own
          // unavailable state rather than pretending old measurements are live.
          if (panel.options?.keepLastGood && lastGood.has(key)) {
            element.dataset.freshness = 'stale';
            element.classList.add('widget-stale');
            return lastGood.get(key);
          }
          throw error;
        }
      },
      action: (action, extra = {}) => postPluginAction(resolved, action, extra, controller.signal),
      resource: parameters => `/api/plugins/${encodeURIComponent(resolved)}/stream?${new URLSearchParams(parameters || {})}`,
      asset: asset => `/plugins/${encodeURIComponent(resolved)}/assets/${asset.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(app.plugins.find(item => item.id === resolved)?.version || '1')}`,
    };
  };
  const api = source(id);
  return {
    app, screen, panel, plugin, id, signal: controller.signal, bindings, announce,
    getPlugin: target => app.plugins.find(item => item.id === (bindings[target] || target)),
    source, data: api.data, action: api.action, resource: api.resource,
    asset: asset => `/plugins/${encodeURIComponent(plugin.id)}/assets/${asset.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(plugin.version || '1')}`,
    onDispose: cleanup => { if (typeof cleanup === 'function') cleanups.push(cleanup); },
    listen(target, event, callback, options = {}) {
      target.addEventListener(event, callback, { ...options, signal: controller.signal });
    },
    schedule(load, milliseconds) {
      const timer = schedule(() => controller.signal.aborted ? undefined : load(), milliseconds);
      cleanups.push(() => clearInterval(timer));
      return timer;
    },
    dispose() {
      controller.abort();
      for (const cleanup of cleanups.splice(0).reverse()) {
        try { cleanup(); } catch { /* Release the remaining resources too. */ }
      }
      lastGood.clear();
    },
  };
}

export function weatherSymbol(code) {
  const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const cloud='<path d="M5 17h13a4 4 0 0 0 .3-8 6.5 6.5 0 0 0-12-1A4.5 4.5 0 0 0 5 17Z"/>';
  let shape=code===0?sun:cloud;
  if(code===null || code===undefined)shape='<path d="M7 12h10"/>';
  else if(code>=95)shape=cloud+'<path d="m13 15-3 5h4l-2 3"/>';
  else if(code>=71 && code<=77 || code>=85 && code<=86)shape=cloud+'<path d="M8 20h.01M12 22h.01M17 20h.01"/>';
  else if(code>=51)shape=cloud+'<path d="m8 20-1 2m6-2-1 2m6-2-1 2"/>';
  return `<svg class="weather-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}

// Rotation belongs to a display, not a fetch cycle. Refreshing data never resets
// this timer. A person reading, navigating or scrolling gets a full new interval.
export function displayRotation({ element, context, enabled, seconds, advance, ready = () => true }) {
  let last = Date.now(), hovered = false;
  const reset = () => { last = Date.now(); };
  const interacting = () => document.hidden || hovered || element.matches(':focus-within');
  context.listen(element, 'pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; });
  context.listen(element, 'pointerleave', () => { hovered = false; reset(); });
  for (const event of ['pointerdown', 'keydown', 'wheel', 'focusin', 'focusout']) context.listen(element, event, reset);
  context.listen(document, 'visibilitychange', reset);
  context.schedule(() => {
    if (!enabled() || interacting() || !ready()) return reset();
    if (Date.now() - last < Math.max(1, Number(seconds()) || 20) * 1000) return;
    reset(); advance();
  }, 250);
  return { reset, interacting };
}

// Data panels share page behavior while owning their content and typography.
export function mountPagedRecords({element,config,context,field,name,rowHeight,renderItem,select=items=>items}) {
  let items=[],index=0,count=1,error='',demo=false,size='';
  element.classList.add('record-display');
  const render=()=>{
    const active=element.querySelector('button:focus')?.dataset.step;
    const visible=select(items);
    const padding=parseFloat(getComputedStyle(element).paddingTop)+parseFloat(getComputedStyle(element).paddingBottom);
    const capacity=config.pageSize || Math.max(1,Math.floor((element.clientHeight-padding-82)/rowHeight));
    count=Math.max(1,Math.ceil(visible.length/capacity));index=Math.min(index,count-1);
    element.innerHTML=`${title(config.title || name,error?'Source unavailable':demo?'Sample data':'')}<div class="record-content">${visible.length?visible.slice(index*capacity,(index+1)*capacity).map(renderItem).join(''):`<p>${escapeHtml(error || 'No items to display')}</p>`}</div>${config.showControls!==false && count>1?`<nav class="display-pages" aria-label="${escapeHtml(name)} pages" data-castboard-ui="local"><button type="button" data-step="-1" ${index===0?'disabled':''}>Previous</button><span>${index+1} / ${count}</span><button type="button" data-step="1" ${index===count-1?'disabled':''}>Next</button></nav>`:''}`;
    if(active)element.querySelector(`[data-step="${active}"]`)?.focus({preventScroll:true});
  };
  context.listen(element,'click',event=>{const button=event.target.closest('[data-step]');if(!button || button.disabled)return;index+=Number(button.dataset.step);render();});
  displayRotation({element,context,enabled:()=>config.autoRotate!==false,seconds:()=>config.rotationSeconds || 20,ready:()=>count>1,advance:()=>{index=(index+1)%count;render();}});
  const observer=new ResizeObserver(()=>{const next=`${element.clientWidth}:${element.clientHeight}`;if(size!==next){size=next;render();}});observer.observe(element);context.onDispose(()=>observer.disconnect());
  context.schedule(async()=>{try{const data=await context.data();if(!Array.isArray(data[field]))throw new Error('Invalid record source');items=data[field];demo=data.demo===true;error='';}catch{items=[];error='Content unavailable. Check the source in Plugins; retrying automatically.';}render();},(config.refreshSeconds || 60)*1000);
}
