#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandEnvironment, loadConfig, publicAppConfig, validateConfig } from './core/config.js';
import { discoverPlugins, pluginMap } from './core/plugin-registry.js';
import { discoverScreenTypes } from './core/screen-type-registry.js';
import { jsonResponse } from './core/providers.js';
import { authorizeAdmin, configRevision, extractDesign, isAllowedApplicationHost, mergeDesign, writableConfigPath, writeConfigAtomic } from './core/admin-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const SCREEN_TYPES_DIR = path.join(ROOT, 'screen-types');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; media-src 'self'; frame-ancestors 'self'");
}

async function sendFile(res, filePath, cache = false) {
  const data = await fs.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': cache ? 'public, max-age=300' : 'no-store',
  });
  res.end(data);
}

async function readBody(req) {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 512 * 1024) throw Object.assign(new Error('Request body exceeds 512 KiB'), { statusCode: 413, code: 'BODY_TOO_LARGE' });
    raw += chunk;
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { statusCode: 400, code: 'INVALID_JSON' });
  }
}

function acceptsJson(req) {
  return String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json');
}

export async function createApp(options = {}) {
  const runtimeEnv = options.env || process.env;
  const loaded = options.loadedConfig || loadConfig({ cwd: options.cwd || ROOT, env: runtimeEnv, configPath: options.configPath });
  const context = { root: ROOT, configDir: loaded.configDir, logger: options.logger || console };
  let runtimeConfig = loaded.config;
  let rawConfig = loaded.rawConfig || JSON.parse(JSON.stringify(loaded.config));
  let configPath = loaded.configPath;
  let screenTypes = await discoverScreenTypes({ screenTypesDir: SCREEN_TYPES_DIR, config: runtimeConfig });
  let screenTypesById = new Map(screenTypes.map(type => [type.id, type]));
  const plugins = await discoverPlugins({ pluginsDir: PLUGINS_DIR, config: loaded.config, context });
  const byId = pluginMap(plugins);
  let publicConfig = publicAppConfig(runtimeConfig, plugins, screenTypes);

  function adminPayload() {
    return {
      revision: configRevision(rawConfig),
      design: extractDesign(rawConfig),
      catalog: {
        plugins: plugins.map(plugin => ({ id: plugin.id, name: plugin.name })),
        screenTypes: screenTypes.map(type => ({ id: type.id, name: type.name })),
      },
    };
  }

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    let url;
    try {
      try {
        url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      } catch {
        return jsonResponse(res, 400, { error: { code: 'INVALID_REQUEST_TARGET', message: 'Request target is invalid' } });
      }
      const publicHostname = runtimeConfig.server.publicUrl ? new URL(runtimeConfig.server.publicUrl).hostname : null;
      const allowedHosts = [...(runtimeConfig.server.allowedHosts || []), ...(publicHostname ? [publicHostname] : [])];
      if (!isAllowedApplicationHost(req.headers.host, allowedHosts)) {
        return jsonResponse(res, 421, { error: { code: 'HOST_NOT_ALLOWED', message: 'Request host is not allowed' } });
      }
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse(res, 200, { ok: true, plugins: plugins.map(plugin => plugin.id), timestamp: new Date().toISOString() });
      }
      if (req.method === 'GET' && url.pathname === '/api/config') return jsonResponse(res, 200, publicConfig);
      if (url.pathname === '/api/admin/design') {
        if (!authorizeAdmin(req, runtimeConfig)) return jsonResponse(res, 403, { error: { code: 'ADMIN_FORBIDDEN', message: 'Admin access requires localhost or an authorized LAN token' } });
        if (req.method === 'GET') return jsonResponse(res, 200, { ok: true, ...adminPayload() });
        if (req.method !== 'PUT') return jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or PUT' } });
        if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { code: 'CONTENT_TYPE', message: 'Admin saves require application/json' } });
        const body = await readBody(req);
        const currentRevision = configRevision(rawConfig);
        if (body.revision !== currentRevision) return jsonResponse(res, 409, { error: { code: 'REVISION_CONFLICT', message: 'The configuration changed after this editor loaded. Reload before saving.' }, revision: currentRevision });
        try {
          const nextRaw = mergeDesign(rawConfig, body.design);
          const nextConfig = validateConfig(expandEnvironment(nextRaw, runtimeEnv));
          const nextScreenTypes = await discoverScreenTypes({ screenTypesDir: SCREEN_TYPES_DIR, config: nextConfig });
          await discoverPlugins({ pluginsDir: PLUGINS_DIR, config: nextConfig, context });
          const nextPath = writableConfigPath(configPath, path.dirname(configPath));
          await writeConfigAtomic(nextPath, nextRaw);
          rawConfig = nextRaw;
          runtimeConfig = nextConfig;
          configPath = nextPath;
          context.configDir = path.dirname(nextPath);
          screenTypes = nextScreenTypes;
          screenTypesById = new Map(screenTypes.map(type => [type.id, type]));
          publicConfig = publicAppConfig(runtimeConfig, plugins, screenTypes);
          return jsonResponse(res, 200, { ok: true, ...adminPayload(), applied: true });
        } catch (error) {
          return jsonResponse(res, 422, { error: { code: 'INVALID_DESIGN', message: error.message } });
        }
      }

      const apiMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]*)\/(data|action|stream)$/);
      if (apiMatch) {
        const [, id, operation] = apiMatch;
        const plugin = byId.get(id);
        if (!plugin) return jsonResponse(res, 404, { error: { code: 'PLUGIN_NOT_FOUND', message: `Plugin not found: ${id}` } });
        try {
          if (operation === 'data' && req.method === 'GET' && plugin.getData) {
            return jsonResponse(res, 200, { ok: true, data: await plugin.getData({ url, req }) });
          }
          if (operation === 'action' && req.method === 'POST' && plugin.action) {
            if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { code: 'CONTENT_TYPE', message: 'Plugin actions require application/json' } });
            return jsonResponse(res, 200, { ok: true, data: await plugin.action(await readBody(req), { url, req }) });
          }
          if (operation === 'stream' && req.method === 'GET' && plugin.stream) return await plugin.stream(req, res, { url });
        } catch (error) {
          if (error.statusCode) throw error;
          context.logger.error(`[${req.method}] ${url.pathname}:`, error.message);
          if (!res.headersSent) return jsonResponse(res, 502, { error: { code: 'PROVIDER_ERROR', message: `${plugin.name} provider is unavailable` } });
          return res.destroy(error);
        }
        return jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Operation is not supported by this plugin' } });
      }

      const widgetMatch = url.pathname.match(/^\/plugins\/([a-z][a-z0-9-]*)\/widget\.js$/);
      if (req.method === 'GET' && widgetMatch) {
        const plugin = byId.get(widgetMatch[1]);
        if (!plugin || !plugin.hasWidget) return jsonResponse(res, 404, { error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin widget not found' } });
        return sendFile(res, path.join(plugin.directory, 'widget.js'), true);
      }

      const screenTypeMatch = url.pathname.match(/^\/screen-types\/([a-z][a-z0-9-]*)\/renderer\.js$/);
      if (req.method === 'GET' && screenTypeMatch) {
        const screenType = screenTypesById.get(screenTypeMatch[1]);
        if (!screenType) return jsonResponse(res, 404, { error: { code: 'SCREEN_TYPE_NOT_FOUND', message: 'Screen type not found' } });
        return sendFile(res, path.join(screenType.directory, 'renderer.js'), true);
      }

      if (req.method === 'GET' && url.pathname === '/admin' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
      if (req.method === 'GET' && /^\/admin\.(js|css)$/.test(url.pathname) && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), false);
      const screenPaths = new Set(Object.values(publicConfig.screens).map(screen => screen.path));
      if (req.method === 'GET' && (url.pathname === '/' || screenPaths.has(url.pathname))) return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
      if (req.method === 'GET' && /^\/(app|widget-kit)\.js$/.test(url.pathname)) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), true);
      if (req.method === 'GET' && url.pathname === '/styles.css') return sendFile(res, path.join(PUBLIC_DIR, 'styles.css'), true);
      return jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      context.logger.error(`[${req.method}] ${url?.pathname || req.url || '/'}:`, error.message);
      const status = error.statusCode || 502;
      if (!res.headersSent) jsonResponse(res, status, { error: { code: error.code || 'PROVIDER_ERROR', message: error.message } });
      else res.destroy(error);
    }
  });

  return {
    server,
    get config() { return runtimeConfig; },
    get rawConfig() { return rawConfig; },
    get configPath() { return configPath; },
    plugins,
    get screenTypes() { return screenTypes; },
    get publicConfig() { return publicConfig; },
  };
}

export async function start(options = {}) {
  const app = await createApp(options);
  const { host = '0.0.0.0', port = 8787 } = app.config.server;
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, host, resolve);
  });
  console.log(`Castboard is running at http://localhost:${port}`);
  for (const [id, screen] of Object.entries(app.config.screens)) console.log(`${id}: http://localhost:${port}${screen.path}`);
  console.log(`Screen types: ${app.screenTypes.map(type => type.id).join(', ')}`);
  console.log(`Loaded plugins: ${app.plugins.map(plugin => plugin.id).join(', ')}`);
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
