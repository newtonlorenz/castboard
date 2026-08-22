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

export function validateConfig(config) {
  assertObject(config, 'Configuration');
  assertObject(config.server, 'server');
  assertObject(config.screens, 'screens');
  assertObject(config.plugins, 'plugins');
  const port = Number(config.server.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('server.port must be an integer from 1 to 65535');
  const screenEntries = Object.entries(config.screens);
  if (!screenEntries.length) throw new Error('screens must contain at least one screen');
  const paths = new Set();
  for (const [screenId, screen] of Object.entries(config.screens)) {
    assertObject(screen, `screens.${screenId}`);
    if (!/^[a-z][a-z0-9-]*$/.test(screenId)) throw new Error(`Invalid screen ID: ${screenId}`);
    if (!screen.path || !String(screen.path).startsWith('/')) throw new Error(`screens.${screenId}.path must start with /`);
    if (paths.has(screen.path)) throw new Error(`Screen path must be unique: ${screen.path}`);
    paths.add(screen.path);
    assertObject(screen.grid, `screens.${screenId}.grid`);
    const columns = Number(screen.grid.columns);
    const rows = Number(screen.grid.rows);
    if (!Number.isInteger(columns) || columns < 1 || columns > 24) throw new Error(`screens.${screenId}.grid.columns must be an integer from 1 to 24`);
    if (!Number.isInteger(rows) || rows < 1 || rows > 24) throw new Error(`screens.${screenId}.grid.rows must be an integer from 1 to 24`);
    if (!Array.isArray(screen.panels)) throw new Error(`screens.${screenId}.panels must be an array`);
    const panelIds = new Set();
    for (const [index, panel] of screen.panels.entries()) {
      assertObject(panel, `screens.${screenId}.panels[${index}]`);
      if (!panel.id || panelIds.has(panel.id)) throw new Error(`screens.${screenId} panel IDs must be present and unique`);
      panelIds.add(panel.id);
      if (!panel.plugin) throw new Error(`screens.${screenId}.panels[${index}].plugin is required`);
      assertObject(panel.position, `screens.${screenId}.panels[${index}].position`);
      const { column, row, width, height } = panel.position;
      if (![column, row, width, height].every(value => Number.isInteger(Number(value)) && Number(value) > 0)) {
        throw new Error(`screens.${screenId}.panels[${index}].position values must be positive integers`);
      }
      if (Number(column) + Number(width) - 1 > columns || Number(row) + Number(height) - 1 > rows) {
        throw new Error(`screens.${screenId}.panels[${index}] exceeds its grid`);
      }
    }
    if (screen.targets !== undefined && !Array.isArray(screen.targets)) throw new Error(`screens.${screenId}.targets must be an array`);
    if ((screen.targets || []).some(target => typeof target !== 'string' || !target.trim())) throw new Error(`screens.${screenId}.targets must contain non-empty strings`);
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
  return { config, configPath: filePath, configDir: path.dirname(filePath) };
}

export function publicAppConfig(config, plugins) {
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
      grid: screen.grid,
      panels: screen.panels,
    }])),
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
