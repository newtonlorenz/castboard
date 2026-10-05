// Admin metadata only: provider credentials never enter this model.
export function connectionVisible(input, settings) {
  return Object.entries(input.showWhen || {}).every(([key, values]) => values.includes(settings[key]));
}

export function compatibleSource(input, source) {
  if (!source.enabled) return false;
  if (input.contract && input.contract !== source.contract) return false;
  const flags = {data: 'hasData', action: 'hasAction', stream: 'hasStream'};
  return (input.capabilities || ['data']).every(capability => source[flags[capability]]);
}

export function editableConnections(instance, pkg = {}) {
  const schema = instance.connectionSchema || pkg.connectionSchema || {};
  const internal = new Set(instance.internalBindings || pkg.internalBindings || []);
  const aliases = new Set([...Object.keys(schema), ...Object.keys(pkg.defaultBindings || {}), ...Object.keys(instance.bindings || {})]);
  return [...aliases].filter(alias => !internal.has(alias)).map(alias => ({
    alias,
    input: schema[alias] || {title: alias.replace(/[-_]/g, ' ').replace(/^./, char => char.toUpperCase()), legacy: true},
    declared: Object.hasOwn(schema, alias)
  }));
}
