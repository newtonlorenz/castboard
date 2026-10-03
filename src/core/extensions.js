import fs from 'node:fs/promises';
import path from 'node:path';

export const EXTENSION_ID = /^[a-z][a-z0-9-]*$/;

// External packages are trusted server code. Public asset access is separately
// constrained to a manifest allowlist and the package's real directory.
export async function extensionDirectories(builtin, config, kind, configDir = process.cwd()) {
  const local=path.resolve(configDir,'extensions',kind);
  let localExists=false;try{localExists=(await fs.stat(local)).isDirectory();}catch{}
  const roots = [builtin,...(localExists?[local]:[]), ...(config.extensions?.[kind] || []).map(root => path.resolve(configDir, root))];
  const result = new Map();
  for (const root of [...new Set(roots)]) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || !EXTENSION_ID.test(entry.name)) continue;
      if (result.has(entry.name)) throw new Error(`Duplicate ${kind} extension: ${entry.name}`);
      result.set(entry.name, path.join(root, entry.name));
    }
  }
  return result;
}

export function validateSchema(value, schema, label = 'options') {
  if (!schema) return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
    for (const key of schema.required || []) if (!Object.hasOwn(value, key) || value[key] === undefined) throw new Error(`${label}.${key} is required`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (value[key] !== undefined) validateSchema(value[key], child, `${label}.${key}`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) throw new Error(`${label}.${key} is not supported`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${label}[${index}]`));
  } else if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) throw new Error(`${label} must be a ${schema.type}`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${label} is below its minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new Error(`${label} exceeds its maximum`);
  } else if (schema.type && typeof value !== schema.type) throw new Error(`${label} must be ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${label} must be one of ${schema.enum.join(', ')}`);
}

export function extensionMetadata(extension) {
  const metadata = {};
  for (const key of ['version', 'optionSchema', 'layoutSchema', 'positionSchema', 'sizeSchema', 'contract', 'inputContract', 'capabilities']) {
    if (extension[key] !== undefined) metadata[key] = JSON.parse(JSON.stringify(extension[key]));
  }
  return metadata;
}

export async function publicAsset(extension, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split('/').includes('..')) return null;
  if (!Array.isArray(extension.assets) || !extension.assets.includes(relative)) return null;
  const root = await fs.realpath(extension.directory);
  const target = await fs.realpath(path.resolve(root, relative));
  if (!target.startsWith(root + path.sep)) return null;
  return target;
}
