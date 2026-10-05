import {EXTENSION_ID} from './extensions.js';

const capabilities = new Set(['data', 'action', 'stream']);
const hook = {data: 'getData', action: 'action', stream: 'stream'};
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

export function validateConnectionSchema(schema, label = 'Plugin') {
  if (schema === undefined) return;
  if (!plain(schema)) throw new Error(`${label} connectionSchema must be an object`);
  for (const [name, input] of Object.entries(schema)) {
    if (!EXTENSION_ID.test(name) || !plain(input)) throw new Error(`${label} has an invalid connection input`);
    if (input.contract !== undefined && (typeof input.contract !== 'string' || !input.contract.trim())) throw new Error(`${label} input ${name} needs a nonempty contract`);
    if (input.capabilities !== undefined && (!Array.isArray(input.capabilities) || !input.capabilities.length || input.capabilities.some(value => !capabilities.has(value)))) throw new Error(`${label} input ${name} has invalid capabilities`);
    if (input.required !== undefined && typeof input.required !== 'boolean') throw new Error(`${label} input ${name} required must be boolean`);
    if (input.showWhen !== undefined && (!plain(input.showWhen) || Object.values(input.showWhen).some(values => !Array.isArray(values)))) throw new Error(`${label} input ${name} has invalid showWhen conditions`);
  }
}

export function connectionEnabled(input, config) {
  return Object.entries(input.showWhen || {}).every(([key, values]) => values.includes(config[key]));
}

export function acceptsConnection(input, plugin) {
  if (!plugin) return false;
  if (input.contract && plugin.contract !== input.contract) return false;
  return (input.capabilities || ['data']).every(capability => typeof plugin[hook[capability]] === 'function');
}

export function connectionSettings(plugin, config) {
  return {...plugin.defaultConfig, ...config.plugins?.[plugin.id]};
}

export function validatePluginConnections(plugins, config) {
  const instances = new Map(plugins.map(plugin => [plugin.id, plugin]));
  for (const plugin of plugins) {
    const settings = connectionSettings(plugin, config);
    validateConnectionSchema(plugin.connectionSchema, `Plugin ${plugin.id}`);
    for (const [alias, input] of Object.entries(plugin.connectionSchema || {})) {
      if (!connectionEnabled(input, settings)) continue;
      const targetId = plugin.bindings[alias];
      if (!targetId) {
        if (input.required) throw new Error(`Plugin ${plugin.id} requires connection ${input.title || alias}`);
        continue;
      }
      if (!acceptsConnection(input, instances.get(targetId))) throw new Error(`Plugin ${plugin.id} connection ${alias} requires ${input.contract || (input.capabilities || ['data']).join(' and ')}`);
    }
  }
  const visited = new Set(), pending = new Set();
  function visit(id) {
    if (pending.has(id)) throw new Error(`Plugin connections contain a cycle at ${id}`);
    if (visited.has(id)) return;
    pending.add(id);
    const plugin = instances.get(id);
    for (const [alias, target] of Object.entries(plugin.bindings || {})) {
      const input = plugin.connectionSchema?.[alias];
      if (input && !connectionEnabled(input, connectionSettings(plugin, config))) continue;
      if (!instances.has(target)) throw new Error(`Plugin ${id} binding ${alias} references missing or disabled instance: ${target}`);
      visit(target);
    }
    pending.delete(id); visited.add(id);
  }
  for (const id of instances.keys()) visit(id);
}
