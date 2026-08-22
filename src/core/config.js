import fs from 'node:fs';
import path from 'node:path';

const ENV_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export function expandEnvironment(value, env = process.env) {
  if (Array.isArray(value)) return value.map(item => expandEnvironment(item, env));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnvironment(item, env)]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(ENV_PATTERN, (_, name) => {
    if (env[name] === undefined) throw new Error(`Missing environment variable: ${name}`);
    return env[name];
  });
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

const APPEARANCE_COLORS = ['accent', 'background', 'panelBackground', 'textColor', 'mutedColor', 'borderColor', 'positiveColor', 'negativeColor'];
const FONT_FAMILIES = new Set(['sans', 'rounded', 'serif', 'mono']);
const SHADOWS = new Set(['none', 'soft', 'deep']);

function validateAppearance(appearance, label, panel = false) {
  assertObject(appearance, label);
  for (const field of APPEARANCE_COLORS) {
    if (appearance[field] !== undefined && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(appearance[field])) throw new Error(`${label}.${field} must be a hex color`);
  }
  const bounded = (field, min, max) => {
    if (appearance[field] !== undefined && (!Number.isFinite(Number(appearance[field])) || Number(appearance[field]) < min || Number(appearance[field]) > max)) throw new Error(`${label}.${field} must be from ${min} to ${max}`);
  };
  bounded('radius', 0, 48);
  bounded(panel ? 'padding' : 'panelPadding', 0, 48);
  bounded('borderWidth', 0, 4);
  bounded('fontScale', 60, 180);
  for (const field of ['fontFamily', 'headingFontFamily']) {
    if (appearance[field] !== undefined && !FONT_FAMILIES.has(appearance[field])) throw new Error(`${label}.${field} must be sans, rounded, serif, or mono`);
  }
  if (appearance.shadow !== undefined && !SHADOWS.has(appearance.shadow)) throw new Error(`${label}.shadow must be none, soft, or deep`);
}

export function validateConfig(config) {
  assertObject(config, 'Configuration');
  assertObject(config.server, 'server');
  assertObject(config.screens, 'screens');
  assertObject(config.plugins, 'plugins');
  if (config.admin !== undefined) {
    assertObject(config.admin, 'admin');
    if (config.admin.allowLan === true && !config.admin.token) throw new Error('admin.token is required when admin.allowLan is true');
  }
  if (config.casting !== undefined) assertObject(config.casting, 'casting');
  if (config.casting?.protocols !== undefined) assertObject(config.casting.protocols, 'casting.protocols');
  if (config.casting?.defaultProtocol !== undefined && !/^[a-z][a-z0-9-]*$/.test(config.casting.defaultProtocol)) throw new Error('casting.defaultProtocol must be a valid protocol ID');
  for (const [protocolId, protocolConfig] of Object.entries(config.casting?.protocols || {})) {
    if (!/^[a-z][a-z0-9-]*$/.test(protocolId)) throw new Error(`Invalid cast protocol ID: ${protocolId}`);
    assertObject(protocolConfig, `casting.protocols.${protocolId}`);
  }
  const port = Number(config.server.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('server.port must be an integer from 1 to 65535');
  const screenEntries = Object.entries(config.screens);
  if (!screenEntries.length) throw new Error('screens must contain at least one screen');
  const paths = new Set();
  for (const [screenId, screen] of Object.entries(config.screens)) {
    assertObject(screen, `screens.${screenId}`);
    if (!/^[a-z][a-z0-9-]*$/.test(screenId)) throw new Error(`Invalid screen ID: ${screenId}`);
    if (screen.type !== undefined && !/^[a-z][a-z0-9-]*$/.test(screen.type)) throw new Error(`Invalid screen type: ${screen.type}`);
    if (screen.castProtocol !== undefined && !/^[a-z][a-z0-9-]*$/.test(screen.castProtocol)) throw new Error(`Invalid screen cast protocol: ${screen.castProtocol}`);
    if (!screen.path || !String(screen.path).startsWith('/')) throw new Error(`screens.${screenId}.path must start with /`);
    if (paths.has(screen.path)) throw new Error(`Screen path must be unique: ${screen.path}`);
    paths.add(screen.path);
    if (screen.layout !== undefined) assertObject(screen.layout, `screens.${screenId}.layout`);
    if (screen.appearance !== undefined) validateAppearance(screen.appearance, `screens.${screenId}.appearance`);
    if (!Array.isArray(screen.panels)) throw new Error(`screens.${screenId}.panels must be an array`);
    const panelIds = new Set();
    for (const [index, panel] of screen.panels.entries()) {
      assertObject(panel, `screens.${screenId}.panels[${index}]`);
      if (!panel.id || panelIds.has(panel.id)) throw new Error(`screens.${screenId} panel IDs must be present and unique`);
      panelIds.add(panel.id);
      if (!panel.plugin) throw new Error(`screens.${screenId}.panels[${index}].plugin is required`);
      if (panel.position !== undefined) assertObject(panel.position, `screens.${screenId}.panels[${index}].position`);
      if (panel.size !== undefined) assertObject(panel.size, `screens.${screenId}.panels[${index}].size`);
      if (panel.options !== undefined) assertObject(panel.options, `screens.${screenId}.panels[${index}].options`);
      if (panel.appearance !== undefined) validateAppearance(panel.appearance, `screens.${screenId}.panels[${index}].appearance`, true);
    }
    if (screen.targets !== undefined && !Array.isArray(screen.targets)) throw new Error(`screens.${screenId}.targets must be an array`);
    for (const [index, target] of (screen.targets || []).entries()) {
      if (typeof target === 'string' && target.trim()) continue;
      if (!target || typeof target !== 'object' || Array.isArray(target)) throw new Error(`screens.${screenId}.targets[${index}] must be a string or object`);
      if (!target.name && !target.device && !target.endpoint) throw new Error(`screens.${screenId}.targets[${index}] requires name, device, or endpoint`);
      if (target.protocol !== undefined && !/^[a-z][a-z0-9-]*$/.test(target.protocol)) throw new Error(`Invalid target protocol: ${target.protocol}`);
    }
  }
  if (config.defaultScreen && !config.screens[config.defaultScreen]) throw new Error(`defaultScreen references an unknown screen: ${config.defaultScreen}`);
  return config;
}

export function resolveConfigPath(cwd = process.cwd(), env = process.env) {
  const explicit = env.CASTBOARD_CONFIG;
  if (explicit) return path.resolve(cwd, explicit);
  const local = path.resolve(cwd, 'castboard.config.json');
  if (fs.existsSync(local)) return local;
  return path.resolve(cwd, 'castboard.config.example.json');
}

export function loadConfig({ cwd = process.cwd(), env = process.env, configPath } = {}) {
  const filePath = configPath ? path.resolve(cwd, configPath) : resolveConfigPath(cwd, env);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to load configuration at ${filePath}: ${error.message}`);
  }
  const config = validateConfig(expandEnvironment(raw, env));
  return { config, rawConfig: raw, configPath: filePath, configDir: path.dirname(filePath) };
}

export function publicAppConfig(config, plugins, screenTypes = []) {
  const branding = {
    name: config.branding?.name || 'Castboard',
    subtitle: config.branding?.subtitle || '',
    location: config.branding?.location || '',
    accent: config.branding?.accent || '#8ee6c2',
    timeZone: config.branding?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  return {
    branding,
    defaultScreen: config.defaultScreen || Object.keys(config.screens)[0],
    screens: Object.fromEntries(Object.entries(config.screens).map(([id, screen]) => [id, {
      id,
      title: screen.title || id,
      path: screen.path,
      type: screen.type || 'grid',
      layout: screen.layout || {},
      appearance: screen.appearance || {},
      panels: screen.panels,
    }])),
    screenTypes: screenTypes.map(type => ({ id: type.id, name: type.name, version: type.version || '1.0.0' })),
    plugins: plugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '1.0.0',
      hasData: typeof plugin.getData === 'function',
      hasAction: typeof plugin.action === 'function',
      hasStream: typeof plugin.stream === 'function',
      config: typeof plugin.publicConfig === 'function' ? plugin.publicConfig() : {},
    })),
  };
}
