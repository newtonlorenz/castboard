#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { environmentWithDotEnv, expandEnvironment, loadConfig, publicAppConfig, validateConfig } from './core/config.js';
import { discoverPlugins, pluginMap, validatePanels } from './core/plugin-registry.js';
import { discoverScreenTypes } from './core/screen-type-registry.js';
import { jsonResponse } from './core/providers.js';
import { authorizeAdmin, configRevision, extractDesign, isAllowedApplicationHost, mergeDesign, writableConfigPath, writeConfigAtomic } from './core/admin-config.js';
import { buildSetupReport, discoverCastDevices, testPluginConnection } from './core/setup.js';
import { publicAsset, extensionMetadata, validateSchema } from './core/extensions.js';
import { pluginLibrary, pluginInstances, changePluginConfig } from './core/plugin-admin.js';

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
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; media-src 'self'; frame-src 'self'; frame-ancestors 'self'");
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
  const cwd = options.cwd || ROOT;
  const runtimeEnv = options.env === undefined ? environmentWithDotEnv(cwd) : options.env;
  const loaded = options.loadedConfig || loadConfig({ cwd, env: runtimeEnv, configPath: options.configPath });
  const context = { root: ROOT, configDir: loaded.configDir, logger: options.logger || console };
  let runtimeConfig = loaded.config;
  let rawConfig = loaded.rawConfig || JSON.parse(JSON.stringify(loaded.config));
  let configPath = loaded.configPath;
  let screenTypes = await discoverScreenTypes({ screenTypesDir: SCREEN_TYPES_DIR, config: runtimeConfig, configDir: loaded.configDir });
  let screenTypesById = new Map(screenTypes.map(type => [type.id, type]));
  let byId = new Map();
  const reads = new Map();
  const screenRequests = Object.create(null);
  const clients = new Map();
  function clientAddress(req) {
    const socket=req.socket.remoteAddress?.replace(/^::ffff:/,'');
    const forwarded=req.headers['x-castboard-receiver'];
    return runtimeConfig.server.trustedProxyAddresses?.includes(socket) && typeof forwarded==='string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
  }
  context.getPlugin = id => byId.get(id);
  context.getBranding=()=>runtimeConfig.branding;
  context.read = async (id, request = {}) => {
    const plugin = byId.get(id);
    if (!plugin?.getData) throw new Error(`Source is unavailable: ${id}`);
    const key = `${id}:${request.url?.search || ''}`;
    const entry = reads.get(key) || {};
    if (entry.pending) return entry.pending;
    const cacheMs = runtimeConfig.plugins[id]?.cacheMs || 0;
    if (cacheMs && entry.expiresAt > Date.now()) return entry.value;
    entry.pending = Promise.resolve().then(() => plugin.getData(request)).then(value => {
      validateSchema(value, plugin.dataSchema, `Plugin ${id} data`);
      entry.value = value;
      entry.expiresAt = Date.now() + cacheMs;
      return value;
    }).finally(() => { entry.pending = null; });
    if (reads.size >= 256 && !reads.has(key)) reads.delete(reads.keys().next().value);
    reads.set(key, entry);
    return entry.pending;
  };
  let plugins = await discoverPlugins({ pluginsDir: PLUGINS_DIR, config: loaded.config, context });
  byId = pluginMap(plugins);
  let disposed = false;
  const dispose = async () => { if (disposed) return; disposed = true; reads.clear(); await Promise.allSettled(plugins.map(plugin => plugin.dispose?.())); };

  let publicConfig = publicAppConfig(runtimeConfig, plugins, screenTypes);

  function adminPayload() {
    return {
      revision: configRevision(rawConfig),
      design: extractDesign(rawConfig),
      catalog: {
        plugins: plugins.filter(plugin => plugin.hasWidget).map(plugin => ({ id: plugin.id, type: plugin.type, name: plugin.name, ...extensionMetadata(plugin) })),
        sources: plugins.filter(plugin => plugin.getData).map(plugin => ({ id: plugin.id, type: plugin.type, name: plugin.name, ...extensionMetadata(plugin) })),
        screenTypes: screenTypes.map(type => ({ id: type.id, name: type.name, ...extensionMetadata(type) })),
      },
    };
  }

  let pluginSaveInProgress=false;
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
      if (req.method === 'GET' && url.pathname === '/api/admin/health') {
        if (!authorizeAdmin(req, runtimeConfig)) return jsonResponse(res, 403, {error:{code:'ADMIN_FORBIDDEN',message:'Diagnostics require admin access'}});
        return jsonResponse(res,200,{ok:true,screenRequests,clients:[...clients.values()]});
      }
      if (url.pathname === '/api/client-status' && req.method === 'POST') {
        if (!acceptsJson(req)) return jsonResponse(res,415,{error:{code:'CONTENT_TYPE',message:'Status requires JSON'}});
        const body=await readBody(req);
        if(!Object.hasOwn(runtimeConfig.screens,body.screenId) || !Array.isArray(body.panels) || body.panels.length>100) return jsonResponse(res,422,{error:{code:'INVALID_STATUS',message:'Invalid screen status'}});
        const remoteAddress=clientAddress(req);
        const key=`${remoteAddress}:${body.screenId}`;
        if(clients.size>=128&&!clients.has(key))clients.delete(clients.keys().next().value);
        clients.set(key,{screenId:body.screenId,remoteAddress,lastSeenAt:new Date().toISOString(),panels:body.panels.map(panel=>({id:String(panel.id).slice(0,80),state:['live','stale','unavailable','loading'].includes(panel.state)?panel.state:'loading'}))});
        return jsonResponse(res,200,{ok:true});
      }
      if (req.method === 'GET' && ['/api/config','/api/runtime-config'].includes(url.pathname)) return jsonResponse(res, 200, publicConfig);
      if (url.pathname === '/api/admin/plugins') {
        if (!authorizeAdmin(req,runtimeConfig)) return jsonResponse(res,403,{error:{code:'ADMIN_FORBIDDEN',message:'Plugin management requires admin access'}});
        const packages=await pluginLibrary({pluginsDir:PLUGINS_DIR,config:runtimeConfig,configDir:context.configDir});
        const payload=()=>({ok:true,revision:configRevision(rawConfig),screens:Object.entries(runtimeConfig.screens).map(([id,screen])=>({id,title:screen.title||id,type:screen.type,panelCount:screen.panels.length})),packages,instances:pluginInstances(rawConfig,packages,plugins)});
        if(req.method==='GET')return jsonResponse(res,200,payload());
        if(req.method!=='POST')return jsonResponse(res,405,{error:{message:'Use GET or POST'}});
        if(!acceptsJson(req))return jsonResponse(res,415,{error:{message:'Plugin changes require JSON'}});
        const body=await readBody(req);
        if(pluginSaveInProgress || body.revision!==configRevision(rawConfig))return jsonResponse(res,409,{error:{code:'REVISION_CONFLICT',message:'Settings changed. Reload before saving.'}});
        pluginSaveInProgress=true;
        let staged;
        try {
          const nextRaw=changePluginConfig(rawConfig,packages,body);
          const nextConfig=validateConfig(expandEnvironment(nextRaw,runtimeEnv));
          for(const [id,settings] of Object.entries(nextConfig.plugins))validateSchema(settings,packages.find(pkg=>pkg.id===(settings.type||id))?.settingsSchema,`Plugin ${id} settings`);
          staged=await discoverPlugins({pluginsDir:PLUGINS_DIR,config:nextConfig,context,reuse:plugins});
          const nextPublic=publicAppConfig(nextConfig,staged,screenTypes);
          const nextPath=writableConfigPath(configPath,path.dirname(configPath));
          await writeConfigAtomic(nextPath,nextRaw);
          const previous=plugins;
          plugins=staged;byId=pluginMap(plugins);reads.clear();rawConfig=nextRaw;runtimeConfig=nextConfig;configPath=nextPath;context.configDir=path.dirname(nextPath);publicConfig=nextPublic;
          await Promise.allSettled(previous.filter(plugin=>!plugins.includes(plugin)).map(plugin=>plugin.dispose?.()));
          return jsonResponse(res,200,{...payload(),applied:true});
        }catch(error){
          if(staged)await Promise.allSettled(staged.filter(plugin=>!plugins.includes(plugin)).map(plugin=>plugin.dispose?.()));
          return jsonResponse(res,422,{error:{code:'INVALID_PLUGIN_SETTINGS',message:error.message}});
        }finally{pluginSaveInProgress=false;}
      }
      if (url.pathname.startsWith('/api/admin/setup')) {
        if (!authorizeAdmin(req, runtimeConfig)) return jsonResponse(res, 403, { error: { code: 'ADMIN_FORBIDDEN', message: 'Setup access requires localhost or an authorized LAN token' } });
        if (req.method === 'GET' && url.pathname === '/api/admin/setup') return jsonResponse(res, 200, { ok: true, ...(await buildSetupReport({ config: runtimeConfig, configPath, plugins })) });
        if (req.method === 'POST' && url.pathname === '/api/admin/setup/test-plugin') {
          if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { code: 'CONTENT_TYPE', message: 'Connection tests require application/json' } });
          const body = await readBody(req);
          return jsonResponse(res, 200, await testPluginConnection(plugins, String(body.pluginId || '')));
        }
        if (req.method === 'POST' && url.pathname === '/api/admin/setup/discover-cast') return jsonResponse(res, 200, await discoverCastDevices(runtimeConfig));
        return jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported setup operation' } });
      }
      if (url.pathname === '/api/admin/design') {
        if (!authorizeAdmin(req, runtimeConfig)) return jsonResponse(res, 403, { error: { code: 'ADMIN_FORBIDDEN', message: 'Admin access requires localhost or an authorized LAN token' } });
        if (req.method === 'GET') return jsonResponse(res, 200, { ok: true, ...adminPayload() });
        if (req.method !== 'PUT') return jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or PUT' } });
        if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { code: 'CONTENT_TYPE', message: 'Admin saves require application/json' } });
        const body = await readBody(req);
        const currentRevision = configRevision(rawConfig);
        if (pluginSaveInProgress || body.revision !== currentRevision) return jsonResponse(res, 409, { error: { code: 'REVISION_CONFLICT', message: 'The configuration changed after this editor loaded. Reload before saving.' }, revision: currentRevision });
        pluginSaveInProgress=true;
        try {
          const nextRaw = mergeDesign(rawConfig, body.design);
          const nextConfig = validateConfig(expandEnvironment(nextRaw, runtimeEnv));
          const nextScreenTypes = await discoverScreenTypes({ screenTypesDir: SCREEN_TYPES_DIR, config: nextConfig, configDir: context.configDir });
          // Design saves must not recreate integration clients or their state.
          validatePanels(nextConfig, plugins);
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
        }finally{pluginSaveInProgress=false;}
      }

      const apiMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]*)\/(data|action|stream)$/);
      if (apiMatch) {
        const [, id, operation] = apiMatch;
        const plugin = byId.get(id);
        if (!plugin) return jsonResponse(res, 404, { error: { code: 'PLUGIN_NOT_FOUND', message: `Plugin not found: ${id}` } });
        try {
          if (operation === 'data' && req.method === 'GET' && plugin.getData) {
            return jsonResponse(res, 200, { ok: true, data: await context.read(id, { url, req }) });
          }
          if (operation === 'action' && req.method === 'POST' && plugin.action) {
            if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { code: 'CONTENT_TYPE', message: 'Plugin actions require application/json' } });
            const body = await readBody(req);
            if (plugin.actionSchemas) {
              // Inherited object properties are not declared action names.
              if (!body || typeof body.action !== 'string' || !Object.hasOwn(plugin.actionSchemas, body.action)) throw Object.assign(new Error('Unsupported action'), { statusCode: 422 });
              const schema = plugin.actionSchemas[body.action];
              try { validateSchema(body, schema, `Action ${body.action}`); } catch (error) { error.statusCode = 422; throw error; }
            }
            const result = await plugin.action(body, { url, req });
            for (const key of reads.keys()) if (key.startsWith(`${id}:`)) reads.delete(key);
            return jsonResponse(res, 200, { ok: true, data: result });
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

      const assetMatch = url.pathname.match(/^\/(plugins|screen-types)\/([a-z][a-z0-9-]*)\/assets\/(.+)$/);
      if (req.method === 'GET' && assetMatch) {
        const extension = assetMatch[1] === 'plugins' ? byId.get(assetMatch[2]) : screenTypesById.get(assetMatch[2]);
        let file;
        try { file = extension && await publicAsset(extension, decodeURIComponent(assetMatch[3])); } catch {}
        if (!file) return jsonResponse(res, 404, { error: { code: 'ASSET_NOT_FOUND', message: 'Extension asset not found' } });
        return sendFile(res, file, true);
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

      if (req.method === 'GET' && url.pathname === '/appearance-model.js') return sendFile(res, path.join(PUBLIC_DIR, 'appearance-model.js'));
      if (req.method === 'GET' && url.pathname === '/admin-preview' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
      if (req.method === 'GET' && url.pathname === '/studio-model.js' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'studio-model.js'));
      if (req.method === 'GET' && url.pathname === '/admin' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
      if (req.method === 'GET' && /^\/admin\.(js|css)$/.test(url.pathname) && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), false);
      if(req.method==='GET'&&url.pathname==='/admin/plugins'&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,'plugins.html'));
      if(req.method==='GET'&&/^\/plugin-admin\.(js|css)$/.test(url.pathname)&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,url.pathname.slice(1)));
      if (req.method === 'GET' && url.pathname === '/setup' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'setup.html'));
      if (req.method === 'GET' && /^\/setup\.(js|css)$/.test(url.pathname) && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), false);
      const screenPaths = new Set(Object.values(publicConfig.screens).map(screen => screen.path));
      if (req.method === 'GET' && (url.pathname === '/' || screenPaths.has(url.pathname))) {
        const screen = Object.entries(publicConfig.screens).find(([,screen])=>screen.path===url.pathname)?.[0] || publicConfig.defaultScreen;
        const entry=screenRequests[screen] ||= {count:0}; entry.count += 1; entry.lastRequestAt=new Date().toISOString(); entry.remoteAddress=clientAddress(req);
        return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      if (req.method === 'GET' && /^\/(app|widget-kit)\.js$/.test(url.pathname)) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), true);
      if (req.method === 'GET' && url.pathname === '/schema-fields.js') return sendFile(res, path.join(PUBLIC_DIR, 'schema-fields.js'), true);
      if (req.method === 'GET' && url.pathname === '/styles.css') return sendFile(res, path.join(PUBLIC_DIR, 'styles.css'), true);
      if (req.method === 'GET' && url.pathname === '/assets/castboard-logo.png') return sendFile(res, path.join(PUBLIC_DIR, 'assets', 'castboard-logo.png'), true);
      if (req.method === 'GET' && url.pathname === '/assets/castboard-logo.svg') return sendFile(res, path.join(PUBLIC_DIR, 'assets', 'castboard-logo.svg'), true);
      // Trusted extension handlers cannot intercept core administration/code.
      for (const plugin of plugins) if (plugin.handleRequest && await plugin.handleRequest(req, res, { url })) return;
      return jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      context.logger.error(`[${req.method}] ${url?.pathname || req.url || '/'}:`, error.message);
      const status = error.statusCode || 502;
      if (!res.headersSent) jsonResponse(res, status, { error: { code: error.code || 'PROVIDER_ERROR', message: error.message } });
      else res.destroy(error);
    }
  });

  server.once('close', () => { void dispose(); });
  return {
    server,
    get config() { return runtimeConfig; },
    get rawConfig() { return rawConfig; },
    get configPath() { return configPath; },
    get plugins() { return plugins; },
    dispose,
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
  start().then(app => {
    const shutdown = () => { app.server.close(); app.server.closeAllConnections(); void app.dispose(); };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
