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
