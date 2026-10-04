import { privateField } from './plugin-admin.js';

export const REDACTED = '[REDACTED]';
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const pointerPart = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
const object = value => value !== null && typeof value === 'object';

// Keep raw placeholders useful to an assistant; never expand them in a read.
export function configurationView(raw, packages = []) {
  const protectedPaths = [];
  function visit(value, location = '', schema) {
    if (Array.isArray(value)) return value.map((item, i) => visit(item, `${location}/${i}`, schema?.items));
    if (!object(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const nextPath = `${location}/${pointerPart(key)}`;
      let childSchema = schema?.properties?.[key];
      if (location === '/plugins') childSchema = packages.find(pkg => pkg.id === (item.type || key))?.settingsSchema;
      if (privateField(key, childSchema, item) || /credential|authorization|cookie|privateKey/i.test(key)) {
        // A single placeholder (or Bearer placeholder) contains no credential.
        if (typeof item === 'string' && /^(?:Bearer )?\$\{[A-Z_][A-Z0-9_]*\}$/.test(item)) return [key, item];
        protectedPaths.push(nextPath);
        return [key, REDACTED];
      }
      return [key, visit(item, nextPath, childSchema)];
    }));
  }
  return { config: visit(raw), protectedPaths };
}

function assertValue(value) {
  if (value === REDACTED) throw new Error('Redacted values cannot be saved. Patch only the fields you intend to change.');
  if (object(value)) for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error('Unsafe configuration key');
    assertValue(child);
  }
}

// Deliberately small patch dialect: set replaces a field, remove deletes it.
// Arrays are replaced as a whole, preventing ambiguous index edits.
export function patchConfiguration(raw, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw new Error('Provide 1–100 configuration operations');
  const next = structuredClone(raw);
  for (const operation of operations) {
    if (!operation || !['set', 'remove'].includes(operation.op) || typeof operation.path !== 'string' || !operation.path.startsWith('/') || /~(?![01])/.test(operation.path)) throw new Error('Use set/remove with a JSON Pointer path');
    const parts = operation.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (parts.some(part => !part || forbidden.has(part))) throw new Error('Unsafe configuration path');
    let parent = next;
    for (const part of parts.slice(0, -1)) {
      if (!object(parent) || Array.isArray(parent)) throw new Error('Replace arrays as a whole');
      if (!Object.hasOwn(parent, part)) {
        if (operation.op === 'remove') throw new Error('Configuration path does not exist');
        parent[part] = {};
      }
      parent = parent[part];
    }
    if (!object(parent) || Array.isArray(parent)) throw new Error('Configuration parent must be an object; replace arrays as a whole');
    const key = parts.at(-1);
    if (operation.op === 'remove') {
      if (!Object.hasOwn(parent, key)) throw new Error('Configuration path does not exist');
      delete parent[key];
    } else {
      if (!Object.hasOwn(operation, 'value')) throw new Error('Set operations require a value');
      assertValue(operation.value);
      parent[key] = structuredClone(operation.value);
    }
  }
  return next;
}

export function safeConfigurationError(error, configs, packages = []) {
  let message = String(error.message || 'Configuration validation failed');
  for (const config of configs.filter(Boolean)) {
    const { protectedPaths } = configurationView(config, packages);
    for (const pointer of protectedPaths) {
      const value = pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')).reduce((item, key) => item?.[key], config);
      const strings = item => typeof item === 'string' ? [item] : object(item) ? Object.values(item).flatMap(strings) : [];
      for (const secret of strings(value)) if (secret) message = message.split(secret).join(REDACTED);
    }
  }
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, '[private URL]');
}
