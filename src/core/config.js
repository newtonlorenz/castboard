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
  for (const [screenId, screen] of Object.entries(config.screens)) {
    assertObject(screen, `screens.${screenId}`);
    if (!screen.path || !String(screen.path).startsWith('/')) throw new Error(`screens.${screenId}.path must start with /`);
    if (screen.widgets && !Array.isArray(screen.widgets)) throw new Error(`screens.${screenId}.widgets must be an array`);
  }
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
    screens: config.screens,
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
