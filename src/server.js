#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, publicAppConfig } from './core/config.js';
import { discoverPlugins, pluginMap } from './core/plugin-registry.js';
import { jsonResponse } from './core/providers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

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
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64 * 1024) throw new Error('Request body exceeds 64 KiB');
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON');
  }
}

export async function createApp(options = {}) {
  const loaded = options.loadedConfig || loadConfig({ cwd: options.cwd || ROOT, env: options.env || process.env, configPath: options.configPath });
  const context = { root: ROOT, configDir: loaded.configDir, logger: options.logger || console };
  const plugins = await discoverPlugins({ pluginsDir: PLUGINS_DIR, config: loaded.config, context });
  const byId = pluginMap(plugins);
  const publicConfig = publicAppConfig(loaded.config, plugins);

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse(res, 200, { ok: true, plugins: plugins.map(plugin => plugin.id), timestamp: new Date().toISOString() });
      }
      if (req.method === 'GET' && url.pathname === '/api/config') return jsonResponse(res, 200, publicConfig);

      const apiMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]*)\/(data|action|stream)$/);
      if (apiMatch) {
        const [, id, operation] = apiMatch;
        const plugin = byId.get(id);
        if (!plugin) return jsonResponse(res, 404, { error: { code: 'PLUGIN_NOT_FOUND', message: `Plugin not found: ${id}` } });
        if (operation === 'data' && req.method === 'GET' && plugin.getData) {
          return jsonResponse(res, 200, { ok: true, data: await plugin.getData({ url, req }) });
        }
        if (operation === 'action' && req.method === 'POST' && plugin.action) {
          return jsonResponse(res, 200, { ok: true, data: await plugin.action(await readBody(req), { url, req }) });
        }
        if (operation === 'stream' && req.method === 'GET' && plugin.stream) return plugin.stream(req, res, { url });
        return jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Operation is not supported by this plugin' } });
      }

      const widgetMatch = url.pathname.match(/^\/plugins\/([a-z][a-z0-9-]*)\/widget\.js$/);
      if (req.method === 'GET' && widgetMatch) {
        const plugin = byId.get(widgetMatch[1]);
        if (!plugin) return jsonResponse(res, 404, { error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' } });
        return sendFile(res, path.join(plugin.directory, 'widget.js'), true);
      }

      const page = url.pathname === '/' ? 'index.html' : url.pathname === '/briefing' ? 'briefing.html' : null;
      if (req.method === 'GET' && page) return sendFile(res, path.join(PUBLIC_DIR, page));
      if (req.method === 'GET' && /^\/(app|briefing|widget-kit)\.js$/.test(url.pathname)) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), true);
      if (req.method === 'GET' && url.pathname === '/styles.css') return sendFile(res, path.join(PUBLIC_DIR, 'styles.css'), true);
      return jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      context.logger.error(`[${req.method}] ${url.pathname}:`, error.message);
      if (!res.headersSent) jsonResponse(res, 502, { error: { code: 'PROVIDER_ERROR', message: error.message } });
      else res.destroy(error);
    }
  });

  return { server, config: loaded.config, plugins, publicConfig };
}

export async function start(options = {}) {
  const app = await createApp(options);
  const { host = '0.0.0.0', port = 8787 } = app.config.server;
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, host, resolve);
  });
  console.log(`Castboard is running at http://localhost:${port}`);
  console.log(`Briefing screen: http://localhost:${port}/briefing`);
  console.log(`Loaded plugins: ${app.plugins.map(plugin => plugin.id).join(', ')}`);
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
