import { escapeHtml, requestJson, schedule, createWidgetContext } from '/widget-kit.js?v=0.8.0';

const dashboard = document.getElementById('dashboard');
const cleanups = [];
window.addEventListener('pagehide', () => { for (const cleanup of cleanups.splice(0)) cleanup(); });

const FONT_STACKS = {
  sans: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"Avenir Next Rounded", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

const PANEL_SHADOWS = {
  none: 'none',
  soft: 'inset 0 1px rgba(255,255,255,.035), 0 8px 22px rgba(0,0,0,.14)',
  deep: 'inset 0 1px rgba(255,255,255,.05), 0 18px 42px rgba(0,0,0,.42)',
};

function applyScreenAppearance(appearance, branding) {
  const root = document.documentElement;
  root.style.fontSize = `${16 * ((appearance.fontScale || 100) / 100)}px`;
  root.style.setProperty('--font-family', FONT_STACKS[appearance.fontFamily] || FONT_STACKS.sans);
  root.style.setProperty('--heading-font-family', FONT_STACKS[appearance.headingFontFamily] || FONT_STACKS.serif);
  root.style.setProperty('--accent', appearance.accent || branding.accent || '#8ee6c2');
  root.style.setProperty('--text', appearance.textColor || '#f3faf7');
  root.style.setProperty('--muted', appearance.mutedColor || '#91a49e');
  root.style.setProperty('--good', appearance.positiveColor || '#7ce5a4');
  root.style.setProperty('--bad', appearance.negativeColor || '#ff8d8d');
  root.style.setProperty('--line', appearance.borderColor || 'rgba(229,255,246,.11)');
  root.style.setProperty('--panel-radius', `${appearance.radius ?? 16}px`);
  root.style.setProperty('--panel-padding', `${appearance.panelPadding ?? 12}px`);
  root.style.setProperty('--panel-border-width', `${appearance.borderWidth ?? 1}px`);
  root.style.setProperty('--panel-shadow', PANEL_SHADOWS[appearance.shadow] || PANEL_SHADOWS.soft);
  if (appearance.panelBackground) root.style.setProperty('--panel-background', appearance.panelBackground);
}

function applyPanelAppearance(element, appearance = {}, screenAppearance = {}) {
  if (appearance.fontFamily) element.style.setProperty('--font-family', FONT_STACKS[appearance.fontFamily]);
  if (appearance.headingFontFamily) element.style.setProperty('--heading-font-family', FONT_STACKS[appearance.headingFontFamily]);
  element.style.fontSize = `${16 * ((screenAppearance.fontScale || 100) / 100) * ((appearance.fontScale || 100) / 100)}px`;
  const properties = {
    accent: '--accent', textColor: '--text', mutedColor: '--muted', borderColor: '--line',
    positiveColor: '--good', negativeColor: '--bad', background: '--panel-background',
  };
  for (const [field, property] of Object.entries(properties)) if (appearance[field]) element.style.setProperty(property, appearance[field]);
  if (appearance.radius !== undefined) element.style.setProperty('--panel-radius', `${appearance.radius}px`);
  if (appearance.padding !== undefined) element.style.setProperty('--panel-padding', `${appearance.padding}px`);
  if (appearance.borderWidth !== undefined) element.style.setProperty('--panel-border-width', `${appearance.borderWidth}px`);
  if (appearance.shadow) element.style.setProperty('--panel-shadow', PANEL_SHADOWS[appearance.shadow]);
}

function enablePanelAutoFit(element) {
  const baseFontSize = Number.parseFloat(element.style.fontSize) || 16;
  const minimumScale = 0.55;
  let frame = 0;

  const overflows = () => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
  const fit = () => {
    frame = 0;
    if (!element.isConnected || !element.clientWidth || !element.clientHeight) return;
    element.style.fontSize = `${baseFontSize}px`;
    let scale = 1;
    if (overflows()) {
      let low = minimumScale;
      let high = 1;
      element.style.fontSize = `${baseFontSize * low}px`;
      if (overflows()) {
        scale = low;
      } else {
        for (let index = 0; index < 8; index += 1) {
          const candidate = (low + high) / 2;
          element.style.fontSize = `${baseFontSize * candidate}px`;
          if (overflows()) high = candidate;
          else low = candidate;
        }
        scale = low;
      }
    }
    element.style.fontSize = `${baseFontSize * scale}px`;
    element.dataset.fitScale = String(Math.round(scale * 100));
  };
  const scheduleFit = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  };

  element.dataset.fitContent = 'true';
  const resize = new ResizeObserver(scheduleFit);
  const mutation = new MutationObserver(scheduleFit);
  resize.observe(element);
  mutation.observe(element, { childList: true, characterData: true, subtree: true });
  cleanups.push(() => { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); });
  scheduleFit();
}

function visibleDesignSignature(config, screenId) {
  return JSON.stringify({ branding: config.branding, screen: config.screens[screenId] });
}

function watchDesign(config, screen) {
  const initialSignature = visibleDesignSignature(config, screen.id);
  const timer = schedule(async () => {
    try {
      const { response, payload: latest } = await requestJson('/api/runtime-config', { cache: 'no-store' });
      if (!response.ok) return;
      const nextScreen = latest.screens[screen.id];
      if (!nextScreen) {
        const fallback = latest.screens[latest.defaultScreen] || Object.values(latest.screens)[0];
        if (fallback) window.location.replace(fallback.path);
        return;
      }
      if (nextScreen.path !== screen.path) {
        window.location.replace(nextScreen.path);
        return;
      }
      if (visibleDesignSignature(latest, screen.id) !== initialSignature) window.location.reload();
    } catch {
      // A temporary network outage should not take an already-rendered display down.
    }
  }, 5000);
  cleanups.push(() => clearInterval(timer));
}

const studioPreview = window.location.pathname === '/admin-preview';
async function boot(draft, screenId) {
  const result = draft ? { response: { ok: true }, payload: draft } : await requestJson('/api/runtime-config', { cache: 'no-store' });
  const { response, payload: config } = result;
  if (!response.ok) throw new Error('Unable to load Castboard configuration');
  const requested = screenId ? config.screens[screenId] : Object.values(config.screens).find(screen => screen.path === window.location.pathname);
  const screen = requested || config.screens[config.defaultScreen] || Object.values(config.screens)[0];
  if (!screen) throw new Error('No screen is configured');
  const screenType = config.screenTypes.find(type => type.id === screen.type);
  if (!screenType) throw new Error(`Screen type is unavailable: ${screen.type}`);
  const renderer = await import(`/screen-types/${encodeURIComponent(screen.type)}/renderer.js?v=${encodeURIComponent(screenType.version)}`);
  if (typeof renderer.prepare !== 'function' || typeof renderer.place !== 'function') throw new Error(`Screen type ${screen.type} has an invalid renderer`);
  document.title = `${screen.title || screen.id} · ${config.branding.name || 'Castboard'}`;
  const appearance = screen.appearance || {};
  applyScreenAppearance(appearance, config.branding);
  dashboard.style.backgroundColor = appearance.background || '';
  dashboard.dataset.screen = screen.id;
  dashboard.dataset.screenType = screen.type;
  dashboard.setAttribute('aria-label', `${screen.title || screen.id} screen`);
  dashboard.innerHTML = '';
  const releaseRenderer = await renderer.prepare({ container: dashboard, screen });
  if (typeof releaseRenderer === 'function') cleanups.push(releaseRenderer);
  for (const plugin of config.plugins.filter(plugin => screen.panels.some(panel => panel.plugin === plugin.id))) {
    for (const asset of plugin.styles || []) {
      const link = document.createElement('link'); link.rel = 'stylesheet';
      link.href = `/plugins/${encodeURIComponent(plugin.id)}/assets/${asset}?v=${encodeURIComponent(plugin.version)}`;
      document.head.append(link); cleanups.push(() => link.remove());
    }
  }
  const pluginConfigs = new Map(config.plugins.map(plugin => [plugin.id, plugin]));

  await Promise.all(screen.panels.map(async panel => {
    const plugin = pluginConfigs.get(panel.plugin);
    if (!plugin) return;
    const element = document.createElement('section');
    element.className = `widget widget-${plugin.type || plugin.id}`;
    element.dataset.plugin = plugin.id;
    element.dataset.panel = panel.id;
    applyPanelAppearance(element, panel.appearance, appearance);
    await renderer.place({ container: dashboard, element, panel, screen });
    element.innerHTML = '<div class="widget-loading">Loading…</div>';
    dashboard.append(element);
    const context = createWidgetContext({ app: config, screen, plugin, panel, element, announce(message) { dashboard.setAttribute('data-status', message); } });
    cleanups.push(() => context.dispose());
    try {
      const module = await import(`/plugins/${encodeURIComponent(plugin.id)}/widget.js?v=${encodeURIComponent(plugin.version || '1')}`);
      if (typeof module.mount !== 'function') throw new Error('Widget does not export mount()');
      const unmount = await module.mount({ element, config: { ...plugin.config, ...panel.options }, context, panel });
      context.onDispose(unmount);
      element.dataset.mounted = 'true';
      if (panel.options?.fitContent === true) enablePanelAutoFit(element);
    } catch (error) {
      element.innerHTML = `<div class="empty-state"><strong>${escapeHtml(plugin.name)}</strong><span>${escapeHtml(error.message)}</span></div>`;
      element.classList.add('widget-unavailable');
    }
  }));
  if (studioPreview) return;
  const statusTimer = schedule(async () => {
    try { await requestJson('/api/client-status', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screenId:screen.id,panels:[...dashboard.querySelectorAll('[data-panel]')].map(element=>({id:element.dataset.panel,state:element.dataset.freshness || (element.dataset.mounted ? 'live' : 'loading')}))})}); } catch {}
  }, 15000);
  cleanups.push(()=>clearInterval(statusTimer));
  watchDesign(config, screen);
}

function showError(error) {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Screen preview unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
}
if (studioPreview) {
  // The parent sends only public runtime configuration and design fields.
  // Serial renders dispose all previous widgets before the next draft mounts.
  let pending;
  let rendering = false;
  let signature = '';
  const renderDraft = async () => {
    if (rendering) return;
    rendering = true;
    while (pending) {
      const next = pending; pending = null;
      for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup(); } catch {} }
      dashboard.className = 'dashboard-grid';
      dashboard.removeAttribute('style');
      document.documentElement.removeAttribute('style');
      try { await boot(next.config, next.screenId); } catch (error) { showError(error); }
    }
    rendering = false;
  };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== 'castboard-draft') return;
    const nextSignature = JSON.stringify(event.data);
    if (nextSignature === signature) return;
    signature = nextSignature;
    pending = event.data;
    renderDraft();
  });
  // A preview never operates controls belonging to a live provider.
  for (const name of ['click', 'submit', 'keydown']) document.addEventListener(name, event => {
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  window.parent.postMessage({ type: 'castboard-preview-ready' }, window.location.origin);
} else boot().catch(error => {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Castboard could not start</strong><span>${escapeHtml(error.message)}</span></div>`;
});
