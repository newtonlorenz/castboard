import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionDirectories, validateSchema } from './extensions.js';
import { readPluginManifest, privateField } from './plugin-admin.js';
import {validatePluginConnections} from './plugin-connections.js';

const VALID_ID = /^[a-z][a-z0-9-]*$/;
const OPTIONAL_HOOKS = ['publicConfig', 'getData', 'action', 'stream', 'handleRequest', 'dispose', 'nativeView'];

function validateDescriptor(plugin, id) {
  if (!plugin || plugin.id !== id || !VALID_ID.test(plugin.id)) throw new Error(`Plugin ID mismatch in ${id}`);
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) throw new Error(`Plugin ${id} must provide a name`);
  for (const hook of OPTIONAL_HOOKS) {
    if (plugin[hook] !== undefined && typeof plugin[hook] !== 'function') throw new Error(`Plugin ${id}.${hook} must be a function`);
  }
}

export async function discoverPlugins({ pluginsDir, config, context, reuse = [] }) {
  const directories = await extensionDirectories(pluginsDir, config, 'plugins', context.configDir);
  const plugins = [],created=[];
  try {
  for (const [instanceId, pluginConfig] of Object.entries(config.plugins || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!VALID_ID.test(instanceId)) throw new Error(`Invalid plugin instance ID: ${instanceId}`);
    if (pluginConfig.enabled === false) continue;
    const type = pluginConfig.type || instanceId;
    const directory = directories.get(type);
    if (!directory) throw new Error(`Plugin ${instanceId} references missing extension: ${type}`);
    const modulePath = path.join(directory, 'plugin.js');
    const previous=reuse.find(plugin=>plugin.id===instanceId&&plugin.directory===directory&&plugin._configSignature===JSON.stringify(pluginConfig));
    if(previous){plugins.push(previous);continue;}
    const metadata=await readPluginManifest(directory);
    try {
      await fs.access(modulePath);
    } catch {
      throw new Error(`Plugin ${type} is missing plugin.js`);
    }
    validateSchema(pluginConfig,metadata.settingsSchema,`Plugin ${instanceId} settings`);
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createPlugin !== 'function') throw new Error(`Plugin ${type} must export createPlugin()`);
    const plugin = await module.createPlugin({ config: pluginConfig, context: { ...context, instanceId, bindings: pluginConfig.bindings || {} } });
    created.push(plugin);
    validateDescriptor(plugin, type);
    if (plugin.assets !== undefined && (!Array.isArray(plugin.assets) || plugin.assets.some(asset => typeof asset !== 'string' || asset.startsWith('/') || asset.split('/').includes('..')))) throw new Error(`Plugin ${type} assets must be relative package paths`);
    if (plugin.styles && (!Array.isArray(plugin.styles) || plugin.styles.some(asset => !plugin.assets?.includes(asset)))) throw new Error(`Plugin ${type} styles must be declared assets`);
    if(pluginConfig.timeZone){try{new Intl.DateTimeFormat('en',{timeZone:pluginConfig.timeZone}).format();}catch{throw new Error('Enter an IANA time zone, such as Europe/Madrid or America/New_York');}}
    if(pluginConfig.locale){try{new Intl.DateTimeFormat(pluginConfig.locale).format();}catch{throw new Error('Enter a language locale such as en-GB, es-ES or de-DE');}}
    if((pluginConfig.goodThreshold!==undefined || pluginConfig.warningThreshold!==undefined) && (pluginConfig.goodThreshold ?? 67)<=(pluginConfig.warningThreshold ?? 34))throw new Error('The good score threshold must be higher than the medium score threshold');
    const appearance=metadata.optionSchema?.properties || {};
    const displayDefaults={},displayConfig={};
    for(const [key,field]of Object.entries(appearance)){
      if(privateField(key,field,pluginConfig[key]))continue;
      if(field.default!==undefined)displayDefaults[key]=field.default;
      if(pluginConfig[key]!==undefined)displayConfig[key]=pluginConfig[key];
    }
    const publicConfig=plugin.publicConfig;
    plugin.publicConfig=function(){
      const exposed=publicConfig ? publicConfig.call(this) : {};
      if(!exposed || typeof exposed!=='object' || Array.isArray(exposed) || typeof exposed.then==='function')throw new Error(`Plugin ${instanceId}.publicConfig() must return a synchronous object`);
      return {...displayDefaults,...exposed,...displayConfig};
    };
    const sourceAlias=plugin.publicConfig().sourceAlias;
    if(plugin.inputContract && sourceAlias && pluginConfig.bindings?.[sourceAlias])plugin.defaultSource=pluginConfig.bindings[sourceAlias];
    const widgetPath = path.join(directory, 'widget.js');
    let hasWidget = true;
    try { await fs.access(widgetPath); } catch { hasWidget = false; }
    plugins.push({ ...metadata, ...plugin, name:pluginConfig.displayName || metadata.name || plugin.name, optionSchema:metadata.optionSchema || plugin.optionSchema, _configSignature:JSON.stringify(pluginConfig), id: instanceId, type, bindings: pluginConfig.bindings || {}, directory: path.dirname(modulePath), hasWidget });
  }
  validatePluginConnections(plugins, config);
  validatePanels(config, plugins);
  return plugins;
  }catch(error){await Promise.allSettled(created.map(plugin=>plugin.dispose?.()));throw error;}
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
      const source = instances.get(panel.source || (panel.bindings?.[view.publicConfig?.().sourceAlias]) || view.defaultSource || panel.plugin);
      if (view.inputContract && view.inputContract !== source?.contract) throw new Error(`Panel ${panel.id} requires ${view.inputContract}, received ${source?.contract || 'untyped source'}`);
      if (panel.interaction?.type === 'action') {
        const source = instances.get(panel.interaction.source || panel.source || panel.plugin);
        if (!source?.action) throw new Error(`Panel ${panel.id} action requires a plugin that supports actions`);
        if (source.actionSchemas) {
          if (!Object.hasOwn(source.actionSchemas,panel.interaction.action)) throw new Error(`Panel ${panel.id} action is not supported`);
          validateSchema({...panel.interaction.payload,action:panel.interaction.action},source.actionSchemas[panel.interaction.action],`Panel ${panel.id} action`);
        }
      }
      validateSchema(panel.options || {}, instances.get(panel.plugin).optionSchema, `Panel ${panel.id} options`);
    }
  }
}
