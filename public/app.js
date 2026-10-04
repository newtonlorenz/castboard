import { createInteractionRuntime } from '/interaction-runtime.js';
import { escapeHtml, requestJson, schedule, createWidgetContext } from '/widget-kit.js?v=0.13.0';

const dashboard = document.getElementById('dashboard');
const cleanups = [];
window.addEventListener('pagehide', () => { for (const cleanup of cleanups.splice(0)) cleanup(); });

import {FONT_STACKS, PANEL_SHADOWS, panelStyle, previewStructure} from '/appearance-model.js?v=0.13.0';
let previewMounted;
let previewRenderer;
function applyScreenAppearance(appearance, branding, root = document.documentElement) {
  root.style.setProperty('--bg',appearance.background || '#07100f');
  root.style.removeProperty('--panel-background');
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

const panelStyleKeys = new WeakMap();
const panelFitters = new WeakMap();
function applyPanelAppearance(element, appearance = {}, screenAppearance = {}) {
  for(const key of panelStyleKeys.get(element)||[])element.style.removeProperty(key);
  const styles=panelStyle(appearance,screenAppearance);
  for(const [key,value] of Object.entries(styles))element.style.setProperty(key,value);
  for(const field of ['background','radius','padding','borderWidth','borderColor','shadow','fontFamily','headingFontFamily','textColor','mutedColor','accent','positiveColor','negativeColor'])element.toggleAttribute(`data-appearance-${field.toLowerCase()}`,styles[`--castboard-${field}`]!==undefined);
  panelStyleKeys.set(element,Object.keys(styles));element.dataset.baseFontSize=String(parseFloat(styles['font-size']));element.dataset.baseTextScale=styles['--castboard-text-scale'];
  panelFitters.get(element)?.();
}

function enablePanelAutoFit(element, releases = cleanups) {
  const minimumScale = 0.55;
  let frame = 0;

  const overflows = () => [element,...(element.shadowRoot?.querySelectorAll('.module-root,.card,.masthead,.lead-card,.side-card,.lead-content')||[])].some(node => node.clientWidth && node.clientHeight && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1));
  const fit = () => {
    frame = 0;
    if (!element.isConnected || !element.clientWidth || !element.clientHeight) return;
    const baseFontSize=Number(element.dataset.baseFontSize)||16;
    const baseTextScale=Number(element.dataset.baseTextScale)||1;
    const applyScale=value=>{element.style.fontSize=`${baseFontSize*value}px`;element.style.setProperty('--castboard-text-scale',String(baseTextScale*value));};
    applyScale(1);
    let scale = 1;
    if (overflows()) {
      let low = minimumScale;
      let high = 1;
      applyScale(low);
      if (overflows()) {
        scale = low;
      } else {
        for (let index = 0; index < 8; index += 1) {
          const candidate = (low + high) / 2;
          applyScale(candidate);
          if (overflows()) high = candidate;
          else low = candidate;
        }
        scale = low;
      }
    }
    applyScale(scale);
    element.dataset.fitScale = String(Math.round(scale * 100));
  };
  const scheduleFit = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  };

  element.dataset.fitContent = 'true';
  const resize = new ResizeObserver(scheduleFit);
  const mutation = new MutationObserver(scheduleFit);
  panelFitters.set(element,scheduleFit);
  resize.observe(element);
  mutation.observe(element, { childList: true, characterData: true, subtree: true });
  if(element.shadowRoot)mutation.observe(element.shadowRoot,{childList:true,characterData:true,subtree:true});
  releases.push(() => { panelFitters.delete(element);resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); });
  scheduleFit();
}

function visibleDesignSignature(config, screenId) {
  return JSON.stringify({ branding: config.branding, plugins:config.plugins, screens: config.screens });
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

function mountComposition(config, screen, container, register, scoped) {
  const releases = [];
  let disposed = false;
  const release = fn => {if (typeof fn === 'function') {if (disposed) fn(); else releases.push(fn);}};
  const ready = (async () => {
  const appearance = screen.appearance || {};
  applyScreenAppearance(appearance, config.branding, scoped ? container : document.documentElement);
  container.style.backgroundColor = appearance.background || '';
  container.dataset.screen = screen.id;
  container.dataset.screenType = screen.type;
  container.setAttribute('aria-label', `${screen.title || screen.id} screen`);
  container.innerHTML = '';
  const renderer = await import(`/screen-types/${encodeURIComponent(screen.type)}/renderer.js?v=${encodeURIComponent(config.screenTypes.find(type=>type.id===screen.type)?.version || 1)}`);
  if (disposed) return;
  const releaseRenderer = await renderer.prepare({ container: container, screen });
  if (typeof releaseRenderer === 'function') release(releaseRenderer);
  if (disposed) return;
  for (const plugin of config.plugins.filter(plugin => screen.panels.some(panel => panel.plugin === plugin.id))) {
    for (const asset of plugin.styles || []) {
      const link = document.createElement('link'); link.rel = 'stylesheet';
      link.href = `/plugins/${encodeURIComponent(plugin.id)}/assets/${asset}?v=${encodeURIComponent(plugin.version)}`;
      document.head.append(link); release(() => link.remove());
    }
  }
  const pluginConfigs = new Map(config.plugins.map(plugin => [plugin.id, plugin]));

  await Promise.all(screen.panels.map(async panel => {
    if (disposed) return;
    const plugin = pluginConfigs.get(panel.plugin);
    if (!plugin) return;
    const element = document.createElement('section');
    element.className = `widget widget-${plugin.type || plugin.id}`;
    element.dataset.plugin = plugin.id;
    element.dataset.panel = panel.id;
    applyPanelAppearance(element, panel.appearance, appearance);
    await renderer.place({ container: container, element, panel, screen });
    if (disposed) return;
    element.innerHTML = '<div class="widget-loading">Loading…</div>';
    container.append(element);
    const context = createWidgetContext({ app: config, screen, plugin, panel, element, announce(message) { container.setAttribute('data-status', message); } });
    release(() => context.dispose());
    try {
      const module = await import(`/plugins/${encodeURIComponent(plugin.id)}/widget.js?v=${encodeURIComponent(plugin.version || '1')}`);
      if (typeof module.mount !== 'function') throw new Error('Widget does not export mount()');
      if (disposed) return;
      const unmount = await module.mount({ element, config: { ...plugin.config, ...panel.options }, context, panel });
      if (disposed) { if (typeof unmount === 'function') unmount(); return; }
      context.onDispose(unmount);
      element.dataset.mounted = 'true';
      if (panel.options?.fitContent === true) enablePanelAutoFit(element, releases);
      register(element, context, panel, screen);
    } catch (error) {
      if (disposed) return;
      element.innerHTML = `<div class="empty-state"><strong>${escapeHtml(plugin.name)}</strong><span>${escapeHtml(error.message)}</span></div>`;
      element.classList.add('widget-unavailable');
    }
  }));
  })();
  return {ready, dispose() {
    disposed = true;
    for (const fn of releases.splice(0).reverse()) {try {fn();} catch {}}
    container.replaceChildren();
  }};
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
  const runtime = createInteractionRuntime({config,screenId:screen.id,host:dashboard,preview:studioPreview,
    mount:(target,container,register,scoped)=>mountComposition(config,target,container,register,scoped)});
  cleanups.push(()=>runtime.dispose());
  await runtime.start();
  if (studioPreview) {previewMounted={config,screenId:screen.id};previewRenderer=renderer;return;}
  if (location.pathname.startsWith('/device-view/')) return;
  const statusTimer = schedule(async () => {
    try { await requestJson('/api/client-status', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screenId:runtime.navigation.screenId,panels:[...dashboard.querySelectorAll('[data-panel]')].map(element=>({id:element.dataset.panel,state:element.dataset.freshness || (element.dataset.mounted ? 'live' : 'loading')}))})}); } catch {}
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
      const nextScreen=next.config.screens[next.screenId];
      if(!Object.values(next.config.screens).some(item=>item.panels.some(panel=>panel.interaction)) && !next.reset && previewMounted && previewMounted.screenId===next.screenId && previewStructure(previewMounted.config,next.screenId)===previewStructure(next.config,next.screenId) && previewRenderer.editor?.incremental === true) {
        try {
          applyScreenAppearance(nextScreen.appearance||{},next.config.branding);
          dashboard.style.backgroundColor=nextScreen.appearance?.background||'';
          await previewRenderer.prepare({container:dashboard,screen:nextScreen});
          for(const panel of nextScreen.panels) {
            const element=[...dashboard.children].find(node=>node.dataset.panel===panel.id);
            if(element){applyPanelAppearance(element,panel.appearance,nextScreen.appearance);await previewRenderer.place({container:dashboard,element,panel,screen:nextScreen});}
          }
          previewMounted={config:next.config,screenId:next.screenId};continue;
        } catch { /* A failed incremental update falls back to a complete mount. */ }
      }
      previewMounted=null;
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
  // The interaction runtime allows draft navigation and blocks live controls.
  window.parent.postMessage({ type: 'castboard-preview-ready' }, window.location.origin);
} else boot().catch(error => {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Castboard could not start</strong><span>${escapeHtml(error.message)}</span></div>`;
});
