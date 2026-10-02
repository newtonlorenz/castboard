import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionDirectories, validateSchema } from './extensions.js';

const VALID_ID = /^[a-z][a-z0-9-]*$/;
const OPTIONAL_HOOKS = ['publicConfig', 'getData', 'action', 'stream', 'handleRequest', 'dispose'];

function validateDescriptor(plugin, id) {
  if (!plugin || plugin.id !== id || !VALID_ID.test(plugin.id)) throw new Error(`Plugin ID mismatch in ${id}`);
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) throw new Error(`Plugin ${id} must provide a name`);
  for (const hook of OPTIONAL_HOOKS) {
    if (plugin[hook] !== undefined && typeof plugin[hook] !== 'function') throw new Error(`Plugin ${id}.${hook} must be a function`);
  }
}

export async function discoverPlugins({ pluginsDir, config, context }) {
  const directories = await extensionDirectories(pluginsDir, config, 'plugins', context.configDir);
  const plugins = [];
  for (const [instanceId, pluginConfig] of Object.entries(config.plugins || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!VALID_ID.test(instanceId)) throw new Error(`Invalid plugin instance ID: ${instanceId}`);
    if (pluginConfig.enabled === false) continue;
    const type = pluginConfig.type || instanceId;
    const directory = directories.get(type);
    if (!directory) throw new Error(`Plugin ${instanceId} references missing extension: ${type}`);
    const modulePath = path.join(directory, 'plugin.js');
    try {
      await fs.access(modulePath);
    } catch {
      throw new Error(`Plugin ${type} is missing plugin.js`);
    }
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createPlugin !== 'function') throw new Error(`Plugin ${type} must export createPlugin()`);
    const plugin = await module.createPlugin({ config: pluginConfig, context: { ...context, instanceId, bindings: pluginConfig.bindings || {} } });
    validateDescriptor(plugin, type);
    if (plugin.assets !== undefined && (!Array.isArray(plugin.assets) || plugin.assets.some(asset => typeof asset !== 'string' || asset.startsWith('/') || asset.split('/').includes('..')))) throw new Error(`Plugin ${type} assets must be relative package paths`);
    if (plugin.styles && (!Array.isArray(plugin.styles) || plugin.styles.some(asset => !plugin.assets?.includes(asset)))) throw new Error(`Plugin ${type} styles must be declared assets`);
    const widgetPath = path.join(directory, 'widget.js');
    let hasWidget = true;
    try { await fs.access(widgetPath); } catch { hasWidget = false; }
    plugins.push({ ...plugin, id: instanceId, type, bindings: pluginConfig.bindings || {}, directory: path.dirname(modulePath), hasWidget });
  }
  const instances = new Map(plugins.map(plugin => [plugin.id, plugin]));
  for (const plugin of plugins) for (const [alias, id] of Object.entries(plugin.bindings)) if (!instances.has(id)) throw new Error(`Plugin ${plugin.id} binding ${alias} references missing instance: ${id}`);
  validatePanels(config, plugins);
  return plugins;
}

export function pluginMap(plugins) {
  return new Map(plugins.map(plugin => [plugin.id, plugin]));
}

export function validatePanels(config, plugins) {
  const instances = new Map(plugins.map(plugin => [plugin.id, plugin]));
  const enabledIds = new Set(plugins.map(plugin => plugin.id));
  for (const [screenId, screen] of Object.entries(config.screens || {})) {
    for (const panel of screen.panels || []) {
      if (!enabledIds.has(panel.plugin)) throw new Error(`Screen ${screenId} references disabled or missing plugin: ${panel.plugin}`);
      if (!plugins.find(plugin => plugin.id === panel.plugin)?.hasWidget) throw new Error(`Screen ${screenId} references plugin without widget.js: ${panel.plugin}`);
      for (const [alias, id] of Object.entries(panel.bindings || {})) if (!instances.has(id)) throw new Error(`Panel ${panel.id} binding ${alias} references missing instance: ${id}`);
      if (panel.source && !instances.get(panel.source)?.getData) throw new Error(`Panel ${panel.id} references missing source: ${panel.source}`);
      const view = instances.get(panel.plugin);
      const source = instances.get(panel.source || panel.plugin);
      if (view.inputContract && view.inputContract !== source?.contract) throw new Error(`Panel ${panel.id} requires ${view.inputContract}, received ${source?.contract || 'untyped source'}`);
      validateSchema(panel.options || {}, instances.get(panel.plugin).optionSchema, `Panel ${panel.id} options`);
    }
  }
}
