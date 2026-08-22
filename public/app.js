const dashboard = document.getElementById('dashboard');

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

function visibleDesignSignature(config, screenId) {
  return JSON.stringify({ branding: config.branding, screen: config.screens[screenId] });
}

function watchDesign(config, screen) {
  const initialSignature = visibleDesignSignature(config, screen.id);
  window.setInterval(async () => {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) return;
      const latest = await response.json();
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
}

async function boot() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load Castboard configuration');
  const config = await response.json();
  const requested = Object.values(config.screens).find(screen => screen.path === window.location.pathname);
  const screen = requested || config.screens[config.defaultScreen] || Object.values(config.screens)[0];
  if (!screen) throw new Error('No screen is configured');
  const screenType = config.screenTypes.find(type => type.id === screen.type);
  if (!screenType) throw new Error(`Screen type is unavailable: ${screen.type}`);
  const renderer = await import(`/screen-types/${encodeURIComponent(screen.type)}/renderer.js?v=${encodeURIComponent(screenType.version)}`);
  if (typeof renderer.prepare !== 'function' || typeof renderer.place !== 'function') throw new Error(`Screen type ${screen.type} has an invalid renderer`);
  document.title = `${screen.title} · ${config.branding.name || 'Castboard'}`;
  const appearance = screen.appearance || {};
  applyScreenAppearance(appearance, config.branding);
  dashboard.style.backgroundColor = appearance.background || '';
  dashboard.dataset.screen = screen.id;
  dashboard.dataset.screenType = screen.type;
  dashboard.setAttribute('aria-label', `${screen.title} screen`);
  dashboard.innerHTML = '';
  await renderer.prepare({ container: dashboard, screen });
  const pluginConfigs = new Map(config.plugins.map(plugin => [plugin.id, plugin]));
  const context = { app: config, screen, getPlugin: id => pluginConfigs.get(id), announce(message) { dashboard.setAttribute('data-status', message); } };

  await Promise.all(screen.panels.map(async panel => {
    const plugin = pluginConfigs.get(panel.plugin);
    if (!plugin) return;
    const element = document.createElement('section');
    element.className = `widget widget-${plugin.id}`;
    element.dataset.plugin = plugin.id;
    element.dataset.panel = panel.id;
    applyPanelAppearance(element, panel.appearance, appearance);
    await renderer.place({ container: dashboard, element, panel, screen });
    element.innerHTML = '<div class="widget-loading">Loading…</div>';
    dashboard.append(element);
    try {
      const module = await import(`/plugins/${encodeURIComponent(plugin.id)}/widget.js`);
      if (typeof module.mount !== 'function') throw new Error('Widget does not export mount()');
      await module.mount({ element, config: { ...plugin.config, ...panel.options }, context, panel });
    } catch (error) {
      element.innerHTML = `<div class="empty-state"><strong>${plugin.name}</strong><span>${error.message}</span></div>`;
      element.classList.add('widget-unavailable');
    }
  }));
  watchDesign(config, screen);
}

boot().catch(error => {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Castboard could not start</strong><span>${error.message}</span></div>`;
});
