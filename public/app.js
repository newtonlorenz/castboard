const dashboard = document.getElementById('dashboard');

async function boot() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load Castboard configuration');
  const config = await response.json();
  const home = config.screens.home || Object.values(config.screens).find(screen => Array.isArray(screen.widgets));
  if (!home) throw new Error('No widget screen is configured');
  document.title = config.branding.name || 'Castboard';
  document.documentElement.style.setProperty('--accent', config.branding.accent || '#8ee6c2');
  dashboard.innerHTML = '';
  const pluginConfigs = new Map(config.plugins.map(plugin => [plugin.id, plugin]));
  const context = { app: config, getPlugin: id => pluginConfigs.get(id), announce(message) { dashboard.setAttribute('data-status', message); } };

  await Promise.all(home.widgets.map(async descriptor => {
    const plugin = pluginConfigs.get(descriptor.plugin);
    if (!plugin) return;
    const element = document.createElement('section');
    element.className = `widget widget-${plugin.id}`;
    element.dataset.plugin = plugin.id;
    element.style.gridArea = descriptor.area || plugin.id;
    element.innerHTML = '<div class="widget-loading">Loading…</div>';
    dashboard.append(element);
    try {
      const module = await import(`/plugins/${encodeURIComponent(plugin.id)}/widget.js`);
      if (typeof module.mount !== 'function') throw new Error('Widget does not export mount()');
      await module.mount({ element, config: { ...plugin.config, ...descriptor.options }, context });
    } catch (error) {
      element.innerHTML = `<div class="empty-state"><strong>${plugin.name}</strong><span>${error.message}</span></div>`;
      element.classList.add('widget-unavailable');
    }
  }));
}

boot().catch(error => {
  dashboard.innerHTML = `<div class="boot-state error"><strong>Castboard could not start</strong><span>${error.message}</span></div>`;
});
