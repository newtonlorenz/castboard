import fs from 'node:fs/promises';
import path from 'node:path';
import { extensionDirectories, EXTENSION_ID } from './extensions.js';

const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'enabled', 'type', 'bindings']);

export async function readPluginManifest(directory) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(directory, 'plugin.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error(`Invalid plugin.json in ${path.basename(directory)}`); }
  if (!object(manifest) || (manifest.settingsSchema && !object(manifest.settingsSchema))) throw new Error(`Invalid plugin manifest: ${path.basename(directory)}`);
  return manifest;
}

// Enumerating a package never calls its factory or executes its server code.
export async function pluginLibrary({ pluginsDir, config, configDir }) {
  const directories = await extensionDirectories(pluginsDir, config, 'plugins', configDir);
  const packages = [];
  for (const [id, directory] of directories) {
    try { await fs.access(path.join(directory, 'plugin.js')); } catch { continue; }
    let manifest;try{manifest=await readPluginManifest(directory);}catch(error){manifest={name:id,description:error.message,manifestError:true};}
    let hasWidget = true;
    try { await fs.access(path.join(directory, 'widget.js')); } catch { hasWidget = false; }
    packages.push({ ...manifest, id, name: manifest.name || id, description: manifest.description || 'A locally installed extension.', hasWidget, managed: Boolean(manifest.settingsSchema)&&!manifest.manifestError, origin: path.resolve(directory).startsWith(path.resolve(pluginsDir) + path.sep) ? 'Bundled' : 'Local package' });
  }
  return packages;
}

export function pluginUsage(config, id) {
  const usage = [];
  for (const [screenId, screen] of Object.entries(config.screens || {})) for (const panel of screen.panels || []) {
    if (panel.plugin === id || panel.source === id || Object.values(panel.bindings || {}).includes(id)) usage.push({ kind: 'panel', screenId, screenTitle: screen.title || screenId, panelId: panel.id, title: panel.options?.title || panel.options?.label || panel.id });
  }
  for (const [instanceId, settings] of Object.entries(config.plugins || {})) if (settings.enabled !== false && Object.values(settings.bindings || {}).includes(id)) usage.push({kind:'plugin',id:instanceId,title:instanceId});
  return usage;
}

export function privateField(key, schema, value) {
  return Boolean(schema?.sensitive || /token|password|secret|apiKey|headers/i.test(key) || (typeof value === 'string' && /:\/\/[^/]+@|[?&](token|key|auth|signature|password)=/i.test(value)));
}

export function pluginInstances(rawConfig, packages, plugins) {
  return Object.entries(rawConfig.plugins || {}).map(([id, config]) => {
    const type = config.type || id, pkg = packages.find(item => item.id === type), active = plugins.find(item => item.id === id);
    const settings = {}, protectedFields = [];
    for (const [key, schema] of Object.entries(pkg?.settingsSchema?.properties || {})) {
      if (!Object.hasOwn(config, key)) continue;
      if (privateField(key, schema, config[key])) protectedFields.push(key);
      else settings[key] = clone(config[key]);
    }
    return { id, type, name: active?.name || pkg?.name || id, enabled: config.enabled !== false, hasData:Boolean(active?.getData),hasAction:Boolean(active?.action),contract:active?.contract, hasWidget: pkg?.hasWidget || active?.hasWidget || false, settings, protectedFields, bindings: clone(config.bindings || {}), usedBy: pluginUsage(rawConfig, id), managed: Boolean(pkg?.settingsSchema), settingsSchema: pkg?.settingsSchema || {type:'object',properties:{}}, version: active?.version || pkg?.version || '1.0.0' };
  });
}

export function changePluginConfig(rawConfig, packages, operation) {
  if (!object(operation)) throw new Error('Plugin change must be an object');
  const next = clone(rawConfig), id = operation.id;
  if (!EXTENSION_ID.test(id || '')) throw new Error('Use a lowercase plugin ID with letters, numbers and hyphens');
  next.plugins ||= {};
  if (operation.action === 'install') {
    if (Object.hasOwn(next.plugins, id)) throw new Error('That plugin ID is already installed');
    const installing = new Set();
    const install = (type, instanceId) => {
      const pkg = packages.find(item => item.id === type);
      if (!pkg) throw new Error(`Package is not in the library: ${type}`);
      if (installing.has(type)) throw new Error('Plugin dependencies contain a cycle');
      if (!pkg.managed) throw new Error('This package needs a plugin.json manifest before it can be installed in admin');
      installing.add(type);
      const bindings = {};
      for (const dependency of [...new Set([...(pkg.dependencies || []), ...Object.values(pkg.defaultBindings || {})])]) {
        const existing = Object.entries(next.plugins).find(([key, settings]) => settings.enabled !== false && (settings.type || key) === dependency);
        const dependencyId = existing?.[0] || dependency;
        if (!existing) {
          if (Object.hasOwn(next.plugins, dependencyId)) throw new Error(`Enable ${dependencyId} before installing this plugin`);
          install(dependency, dependencyId);
        }
        for (const [alias, target] of Object.entries(pkg.defaultBindings || {})) if (target === dependency) bindings[alias] = dependencyId;
      }
      next.plugins[instanceId] = { ...(pkg.defaultConfig || {}), type, enabled: true, ...(Object.keys(bindings).length ? {bindings} : {}) };
      installing.delete(type);
    };
    install(operation.type, id);
  } else {
    if (!Object.hasOwn(next.plugins, id)) throw new Error('Plugin is not installed');
    const settings = next.plugins[id], pkg = packages.find(item => item.id === (settings.type || id));
    if (operation.action === 'remove' || (operation.action === 'enable' && operation.enabled === false)) {
      if (pluginUsage(next, id).length) throw new Error('This plugin is in use. Remove its panels and source connections first.');
    }
    if (operation.action === 'remove') delete next.plugins[id];
    else if (operation.action === 'enable') {
      if (typeof operation.enabled !== 'boolean') throw new Error('Enabled must be true or false');
      settings.enabled = operation.enabled;
    } else if (operation.action === 'configure') {
      if (!object(operation.settings || {})) throw new Error('Settings must be an object');
      for (const [key, value] of Object.entries(operation.settings || {})) {
        if (forbidden.has(key) || !Object.hasOwn(pkg?.settingsSchema?.properties || {}, key)) throw new Error(`Setting is not editable: ${key}`);
        settings[key] = clone(value);
      }
      if(operation.clear!==undefined&&!Array.isArray(operation.clear))throw new Error('Cleared settings must be a list');
      for (const key of operation.clear || []) {
        if (forbidden.has(key) || !Object.hasOwn(pkg?.settingsSchema?.properties || {}, key)) throw new Error(`Setting is not editable: ${key}`);
        delete settings[key];
      }
      if (operation.bindings !== undefined) {
        if (!object(operation.bindings)) throw new Error('Source connections must be an object');
        for (const [alias, target] of Object.entries(operation.bindings)) if (!EXTENSION_ID.test(alias) || !EXTENSION_ID.test(target)) throw new Error('Invalid source connection');
        settings.bindings = clone(operation.bindings);
      }
    } else throw new Error('Unsupported plugin operation');
  }
  return next;
}
