import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_ID = /^[a-z][a-z0-9-]*$/;
const OPTIONAL_HOOKS = ['publicConfig', 'getData', 'action', 'stream'];

function validateDescriptor(plugin, id) {
  if (!plugin || plugin.id !== id || !VALID_ID.test(plugin.id)) throw new Error(`Plugin ID mismatch in ${id}`);
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) throw new Error(`Plugin ${id} must provide a name`);
  for (const hook of OPTIONAL_HOOKS) {
    if (plugin[hook] !== undefined && typeof plugin[hook] !== 'function') throw new Error(`Plugin ${id}.${hook} must be a function`);
  }
}

export async function discoverPlugins({ pluginsDir, config, context }) {
  const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
  const plugins = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !VALID_ID.test(entry.name)) continue;
    const pluginConfig = config.plugins?.[entry.name];
    if (!pluginConfig || pluginConfig.enabled === false) continue;
    const modulePath = path.join(pluginsDir, entry.name, 'plugin.js');
    try {
      await fs.access(modulePath);
    } catch {
      continue;
    }
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createPlugin !== 'function') throw new Error(`Plugin ${entry.name} must export createPlugin()`);
    const plugin = await module.createPlugin({ config: pluginConfig, context });
    validateDescriptor(plugin, entry.name);
    const widgetPath = path.join(pluginsDir, entry.name, 'widget.js');
    let hasWidget = true;
    try { await fs.access(widgetPath); } catch { hasWidget = false; }
    plugins.push({ ...plugin, directory: path.dirname(modulePath), hasWidget });
  }
  const enabledIds = new Set(plugins.map(plugin => plugin.id));
  for (const [screenId, screen] of Object.entries(config.screens || {})) {
    for (const panel of screen.panels || []) {
      if (!enabledIds.has(panel.plugin)) throw new Error(`Screen ${screenId} references disabled or missing plugin: ${panel.plugin}`);
      if (!plugins.find(plugin => plugin.id === panel.plugin)?.hasWidget) throw new Error(`Screen ${screenId} references plugin without widget.js: ${panel.plugin}`);
    }
  }
  return plugins;
}

export function pluginMap(plugins) {
  return new Map(plugins.map(plugin => [plugin.id, plugin]));
}
