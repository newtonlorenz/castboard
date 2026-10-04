import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionDirectories, validateSchema } from './extensions.js';
import { deviceError } from './devices.js';

const ID = /^[a-z][a-z0-9-]{0,63}$/;
const hooks = ['configure', 'encodeFrame', 'encodeScene', 'decodeInput'];
export function validateAdapterManifest(value, id = value?.id) {
  if (!value || typeof value !== 'object' || !ID.test(id || '') || value.id !== id) throw deviceError('The display plugin needs a valid, matching ID');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw deviceError('The display plugin needs a name of at most 80 characters');
  if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value.version)) throw deviceError('The display plugin needs a version such as 1.0.0');
  if (!Array.isArray(value.modes) || !value.modes.length || value.modes.some(mode => !['frame','native'].includes(mode))) throw deviceError('A display plugin must support image or native mode');
  if (!Array.isArray(value.formats) || !value.formats.length || value.formats.some(format => !ID.test(format))) throw deviceError('The display plugin needs supported image formats');
  if (value.sourceFormat && !['rgb565','jpeg'].includes(value.sourceFormat)) throw deviceError('The renderer source format must be rgb565 or jpeg');
  if (value.entry !== undefined && value.entry !== 'adapter.mjs') throw deviceError('The display plugin entry must be adapter.mjs');
  for (const field of ['description','instructions']) if (value[field] !== undefined && (typeof value[field] !== 'string' || value[field].length > 4000)) throw deviceError(`Invalid display plugin ${field}`);
  for (const field of ['defaults','defaultOptions','optionSchema']) if (value[field] !== undefined && (!value[field] || typeof value[field] !== 'object' || Array.isArray(value[field]))) throw deviceError(`Invalid display plugin ${field}`);
  if (value.defaults && Object.keys(value.defaults).some(key => !['width','height','refreshMs','mode','format','touch'].includes(key))) throw deviceError('Unsupported display plugin defaults');
  if (value.optionSchema && value.optionSchema.type !== 'object') throw deviceError('Display plugin settings must use an object schema');
  const defaults=value.defaults || {};
  for(const field of ['width','height'])if(defaults[field]!==undefined && (!Number.isInteger(defaults[field]) || defaults[field]<16 || defaults[field]>1920))throw deviceError('Display plugin dimensions must be from 16 to 1920 pixels');
  if((defaults.width || 800)*(defaults.height || 480)>1920*1080)throw deviceError('Display plugin dimensions exceed the two megapixel limit');
  if(defaults.refreshMs!==undefined && (!Number.isInteger(defaults.refreshMs) || defaults.refreshMs<1000 || defaults.refreshMs>3600000))throw deviceError('Display plugin refresh must be from 1 second to 1 hour');
  if(defaults.mode!==undefined && !value.modes.includes(defaults.mode) || defaults.format!==undefined && !value.formats.includes(defaults.format))throw deviceError('Display plugin defaults must use a supported mode and format');
  if(defaults.touch!==undefined && typeof defaults.touch!=='boolean')throw deviceError('Display plugin touch default must be true or false');
  validateSchema(value.defaultOptions || {},value.optionSchema?{...value.optionSchema,required:[]}:undefined,'Display plugin default settings');
  // Receiver preferences are sent to the receiver. Credentials belong to the
  // scoped connection key, never an adapter's public settings schema.
  return structuredClone(value);
}

export async function loadDisplayAdapter(directory, id, origin = 'Local package') {
  const manifest = validateAdapterManifest(JSON.parse(await fs.readFile(path.join(directory,'adapter.json'),'utf8')), id);
  const module = manifest.entry ? await import(pathToFileURL(path.join(directory,manifest.entry))) : {};
  for (const hook of hooks) if (module[hook] !== undefined && typeof module[hook] !== 'function') throw deviceError(`Display plugin ${id}.${hook} must be a function`);
  for (const format of manifest.formats) if (!['rgb565','jpeg'].includes(format) && !module.encodeFrame) throw deviceError(`Display plugin ${id} needs encodeFrame for ${format}`);
  return {...manifest, directory, origin, hooks:Object.fromEntries(hooks.filter(hook=>module[hook]).map(hook=>[hook,module[hook]]))};
}

export async function discoverDisplayAdapters({builtin,config,configDir}) {
  const dirs = await extensionDirectories(builtin,config,'displayAdapters',configDir);
  const uploadRoot=path.resolve(configDir,'extensions/displayAdapters');
  const entries = await Promise.all([...dirs].map(([id,dir])=>loadDisplayAdapter(dir,id,path.resolve(dir).startsWith(path.resolve(builtin)+path.sep)?'Bundled':path.dirname(path.resolve(dir))===uploadRoot?'Uploaded package':'Local package')));
  return new Map(entries.map(adapter=>[adapter.id,adapter]));
}
export function adapterFor(adapters,device) {
  const adapter=adapters.get(device.adapter || 'standard');
  if(!adapter) throw deviceError('The selected display plugin is missing');
  return adapter;
}
export function validateAdapterDevices(config,adapters) {
  for(const device of Object.values(config.devices || {})) {
    const adapter=adapterFor(adapters,device);
    if(!adapter.modes.includes(device.mode)) throw deviceError(`${adapter.name} does not support this drawing mode`);
    if(!adapter.formats.includes(device.format)) throw deviceError(`${adapter.name} does not support this image format`);
    validateSchema(adapterOptions(adapter,device),adapter.optionSchema,`${adapter.name} settings`);
  }
}
export function adapterCatalog(adapters,config) {
  return [...adapters.values()].map(({directory,hooks,...adapter})=>({...adapter,usedBy:Object.entries(config.devices || {}).filter(([,device])=>(device.adapter || 'standard')===adapter.id).map(([id])=>id)}));
}
export function adapterOptions(adapter,device) { return {...adapter.defaultOptions,...device.options}; }
export function safeAdapterContext(adapter,device,id) {
  // Never pass the hashed connection key or unrelated configuration to hooks.
  const {tokenHash,...settings}=device;
  return {id,device:settings,options:adapterOptions(adapter,device)};
}
export async function encodeAdapterResult(adapter,hook,input,context,fallback) {
  let result;
  try { result=adapter.hooks[hook]?await adapter.hooks[hook](input,context):fallback; }
  catch { throw deviceError('The display plugin could not encode this update',502); }
  if(!result || !Buffer.isBuffer(result.data) && !(result.data instanceof Uint8Array) || result.data.length>8*1024*1024 || !result.data.length || typeof result.contentType!=='string' || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:; charset=utf-8)?$/i.test(result.contentType)) throw deviceError('The display plugin returned an invalid update',502);
  return {data:Buffer.from(result.data),contentType:result.contentType};
}
