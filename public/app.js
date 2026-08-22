const dashboard = document.getElementById('dashboard');

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
  document.documentElement.style.setProperty('--accent', config.branding.accent || '#8ee6c2');
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
}

boot().catch(error => {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Castboard could not start</strong><span>${error.message}</span></div>`;
});
