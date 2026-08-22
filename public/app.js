const dashboard = document.getElementById('dashboard');

async function boot() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load Castboard configuration');
  const config = await response.json();
  const requested = Object.values(config.screens).find(screen => screen.path === window.location.pathname);
  const screen = requested || config.screens[config.defaultScreen] || Object.values(config.screens)[0];
  if (!screen) throw new Error('No screen is configured');
  document.title = `${screen.title} · ${config.branding.name || 'Castboard'}`;
  document.documentElement.style.setProperty('--accent', config.branding.accent || '#8ee6c2');
  dashboard.style.setProperty('--grid-columns', screen.grid.columns);
  dashboard.style.setProperty('--grid-rows', screen.grid.rows);
  dashboard.style.setProperty('--grid-gap', `${screen.grid.gap ?? 8}px`);
  dashboard.style.setProperty('--screen-padding', `${screen.grid.padding ?? 8}px`);
  dashboard.dataset.screen = screen.id;
  dashboard.setAttribute('aria-label', `${screen.title} screen`);
  dashboard.innerHTML = '';
  const pluginConfigs = new Map(config.plugins.map(plugin => [plugin.id, plugin]));
  const context = { app: config, screen, getPlugin: id => pluginConfigs.get(id), announce(message) { dashboard.setAttribute('data-status', message); } };

  await Promise.all(screen.panels.map(async panel => {
    const plugin = pluginConfigs.get(panel.plugin);
    if (!plugin) return;
    const element = document.createElement('section');
    element.className = `widget widget-${plugin.id}`;
    element.dataset.plugin = plugin.id;
    element.dataset.panel = panel.id;
    element.style.gridColumn = `${panel.position.column} / span ${panel.position.width}`;
    element.style.gridRow = `${panel.position.row} / span ${panel.position.height}`;
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
