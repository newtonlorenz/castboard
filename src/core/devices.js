import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { reachableScreens } from '../../public/interaction-model.js';

const ID = /^[a-z][a-z0-9-]{0,63}$/;
export const deviceTokenHash = token => createHash('sha256').update(String(token)).digest('hex');
export const deviceError = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });

export function validateDevices(config) {
  const devices = config.devices || {};
  if (!devices || typeof devices !== 'object' || Array.isArray(devices) || Object.keys(devices).length > 64) throw deviceError('devices must contain at most 64 displays');
  for (const [id, device] of Object.entries(devices)) {
    if (!ID.test(id) || !device || typeof device !== 'object' || Array.isArray(device)) throw deviceError('Invalid display configuration');
    if (typeof device.name !== 'string' || !device.name.trim() || device.name.length > 80) throw deviceError(`Display ${id} needs a name of at most 80 characters`);
    if (!Object.hasOwn(config.screens, device.screenId)) throw deviceError(`Display ${id} references a missing screen`);
    if (!['frame', 'native'].includes(device.mode)) throw deviceError(`Display ${id} mode must be frame or native`);
    for (const field of ['width', 'height']) if (!Number.isInteger(device[field]) || device[field] < 16 || device[field] > 1920) throw deviceError(`Display ${id} ${field} must be from 16 to 1920 pixels`);
    if (device.width * device.height > 1920 * 1080) throw deviceError(`Display ${id} exceeds the two megapixel limit`);
    if (!Number.isInteger(device.refreshMs) || device.refreshMs < 1000 || device.refreshMs > 3600000) throw deviceError(`Display ${id} refresh must be from 1 second to 1 hour`);
    if (!ID.test(device.format || '')) throw deviceError(`Display ${id} needs a valid image format`);
    if (device.adapter !== undefined && !ID.test(device.adapter)) throw deviceError(`Display ${id} needs a valid display plugin`);
    if (device.options !== undefined && (!device.options || typeof device.options !== 'object' || Array.isArray(device.options) || Buffer.byteLength(JSON.stringify(device.options)) > 16384)) throw deviceError(`Display ${id} settings must be an object of at most 16 KiB`);
    if (!/^[a-f0-9]{64}$/.test(device.tokenHash)) throw deviceError(`Display ${id} needs a connection key`);
    for (const field of ['enabled', 'touch', 'allowActions']) if (typeof device[field] !== 'boolean') throw deviceError(`Display ${id} ${field} must be true or false`);
  }
  if (config.embedded?.publicUrl) {
    const url = new URL(config.embedded.publicUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw deviceError('embedded.publicUrl must be an http(s) origin');
  }
  if (config.embedded?.rendererUrl) {
    const url = new URL(config.embedded.rendererUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw deviceError('embedded.rendererUrl must be an http(s) origin');
    if (typeof config.embedded.rendererToken !== 'string' || config.embedded.rendererToken.length < 32) throw deviceError('The image renderer needs a token of at least 32 characters');
  }
}

export function authenticateDevice(config, id, authorization) {
  const device = Object.hasOwn(config.devices || {}, id) && config.devices[id];
  const token = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(authorization || '')?.[1];
  if (!device?.enabled || !token || !timingSafeEqual(Buffer.from(device.tokenHash, 'hex'), Buffer.from(deviceTokenHash(token), 'hex'))) throw deviceError('Display access denied', 401);
  return device;
}

export function deviceScope(config, device) {
  const screens = reachableScreens(config.screens, device.screenId);
  const plugins = new Set();
  const add = id => {
    if (!id || plugins.has(id)) return;
    plugins.add(id);
    for (const source of Object.values(config.plugins[id]?.bindings || {})) add(source);
  };
  for (const id of screens) for (const panel of config.screens[id].panels) {
    add(panel.plugin); add(panel.source); add(panel.interaction?.source);
    Object.values(panel.bindings || {}).forEach(add);
  }
  return { screens, plugins };
}

export function devicePublicConfig(config, publicConfig, device) {
  const scope = deviceScope(config, device);
  return { ...publicConfig, defaultScreen: device.screenId,
    screens: Object.fromEntries(Object.entries(publicConfig.screens).filter(([id]) => scope.screens.has(id))),
    plugins: publicConfig.plugins.filter(plugin => scope.plugins.has(plugin.id)).map(plugin => ({...plugin,config:{...plugin.config,...(!device.allowActions || !device.touch ? {controllable:false}: {})}})),
    device: { width: device.width, height: device.height, touch: device.touch, allowActions: device.allowActions },
  };
}

export function changeDeviceConfig(raw, body, defaults = {}) {
  const next = structuredClone(raw);
  next.devices ||= {};
  if (!ID.test(body.id || '')) throw deviceError('Use a display ID beginning with a letter, followed by letters, numbers or hyphens');
  const exists = Object.hasOwn(next.devices, body.id);
  let token;
  if (body.action === 'remove') {
    if (!exists) throw deviceError('Display no longer exists', 404);
    delete next.devices[body.id];
  } else if (body.action === 'rotate') {
    if (!exists) throw deviceError('Display no longer exists', 404);
    token = randomBytes(32).toString('base64url');
    next.devices[body.id].tokenHash = deviceTokenHash(token);
  } else if (['create', 'update'].includes(body.action)) {
    if ((body.action === 'create') === exists) throw deviceError(exists ? 'This display ID already exists' : 'Display no longer exists', 409);
    const fields = ['name', 'screenId', 'mode', 'width', 'height', 'refreshMs', 'format', 'enabled', 'touch', 'allowActions', 'adapter', 'options'];
    const input = body.device;
    if (!input || typeof input !== 'object' || Object.keys(input).some(key => !fields.includes(key))) throw deviceError('Invalid display settings');
    const settings = Object.fromEntries(fields.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
    if (!exists) token = randomBytes(32).toString('base64url');
    next.devices[body.id] = { width: 800, height: 480, refreshMs: 5000, mode: 'frame', format: 'rgb565', touch: true, allowActions: false, enabled: true, ...next.devices[body.id], ...defaults, ...settings,
      ...(token ? { tokenHash: deviceTokenHash(token) } : {}),
    };
  } else throw deviceError('Unknown display operation');
  // Renderer credentials can be environment references in the raw document.
  // The server validates those after expansion, before writing the change.
  validateDevices({...next,embedded:undefined});
  return { config: next, token };
}

export function deviceReport(config, plugins, screenTypes, diagnostics = new Map()) {
  return Object.entries(config.devices || {}).map(([id, device]) => {
    const { tokenHash, ...settings } = device;
    const scope = deviceScope(config, device);
    const issues = [];
    for (const screenId of scope.screens) {
      const screen = config.screens[screenId];
      if (!screenTypes.find(type => type.id === (screen.type || 'grid'))?.nativeLayout) issues.push(`${screen.title || screenId}: layout needs an image renderer`);
      for (const panel of screen.panels) {
        const plugin=plugins.find(plugin=>plugin.id===panel.plugin);
        if(!plugin?.nativeView)issues.push(`${screen.title || screenId} / ${panel.id}: plugin needs an image renderer`);
        else if(plugin.nativeImages && !config.embedded?.rendererUrl)issues.push(`${screen.title || screenId} / ${panel.id}: native images need the optional image renderer`);
      }
    }
    return { id, ...settings, nativeIssues: issues, status: diagnostics.get(id) || null };
  });
}
