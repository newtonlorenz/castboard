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
import { deliveryReport, changeDelivery, deliveryTarget } from './core/delivery.js';
import { discoverCastProtocols } from './core/cast-protocol-registry.js';
import { authenticateDevice, changeDeviceConfig, devicePublicConfig, deviceReport, deviceScope } from './core/devices.js';
import { createNativeScenes } from './core/native-scene.js';
import { adapterCatalog, adapterFor, adapterOptions, discoverDisplayAdapters, encodeAdapterResult, safeAdapterContext, validateAdapterDevices } from './core/display-adapters.js';
import { installDisplayPackage, MAX_PACKAGE_BYTES, removeDisplayPackage, unpackDisplayPackage, zipFiles } from './core/display-packages.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const SCREEN_TYPES_DIR = path.join(ROOT, 'screen-types');
const DISPLAY_ADAPTERS_DIR = path.join(ROOT, 'display-adapters');

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

async function readBytes(req, limit) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Upload exceeds its size limit'),{statusCode:413});chunks.push(chunk);}
  return Buffer.concat(chunks,size);
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
  let displayAdapters = await discoverDisplayAdapters({builtin:DISPLAY_ADAPTERS_DIR,config:runtimeConfig,configDir:context.configDir});
  validateAdapterDevices(runtimeConfig,displayAdapters);
  const removedAdapterIds=new Set();
  let adapterInstallInProgress=false;
  let screenTypes = await discoverScreenTypes({ screenTypesDir: SCREEN_TYPES_DIR, config: runtimeConfig, configDir: loaded.configDir });
  let screenTypesById = new Map(screenTypes.map(type => [type.id, type]));
  let byId = new Map();
  const reads = new Map();
  const screenRequests = Object.create(null);
  const clients = new Map();
  const deviceDiagnostics = new Map();
  const deviceRequests = new Map();
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
  const dispose = async () => { if (disposed) return; disposed = true; reads.clear(); nativeScenes.dispose(); await Promise.allSettled(plugins.map(plugin => plugin.dispose?.())); };

  let publicConfig = publicAppConfig(runtimeConfig, plugins, screenTypes);

  async function runAction(id, body, request = {}) {
    const plugin = byId.get(id);
    if (!plugin?.action) throw Object.assign(new Error('This plugin does not support actions'), {statusCode:422});
    if (plugin.actionSchemas) {
      if (!body || typeof body.action !== 'string' || !Object.hasOwn(plugin.actionSchemas, body.action)) throw Object.assign(new Error('Unsupported action'), {statusCode:422});
      try { validateSchema(body, plugin.actionSchemas[body.action], `Action ${body.action}`); }
      catch (error) { error.statusCode=422; throw error; }
    }
    const result = await plugin.action(body, request);
    for (const key of reads.keys()) if (key.startsWith(`${id}:`)) reads.delete(key);
    return result;
  }
  const nativeScenes = createNativeScenes({getConfig:()=>runtimeConfig,getPlugin:id=>byId.get(id),getScreenType:id=>screenTypesById.get(id),read:id=>context.read(id),action:runAction});

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
  const deliveriesInProgress = new Set();
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
      if(url.pathname==='/api/admin/display-adapters/example' && req.method==='GET') {
        if(!authorizeAdmin(req,runtimeConfig))return jsonResponse(res,403,{error:{message:'Display plugins require admin access'}});
        const dir=path.join(DISPLAY_ADAPTERS_DIR,'.examples/monochrome'),files=new Map();
        for(const name of ['adapter.json','adapter.mjs','README.md','LICENSE'])files.set(name,await fs.readFile(path.join(dir,name)));
        const zip=zipFiles(files);res.writeHead(200,{'Content-Type':'application/zip','Content-Length':zip.length,'Content-Disposition':'attachment; filename="castboard-monochrome-example.zip"'});res.end(zip);return;
      }
      if (url.pathname === '/api/admin/display-adapters') {
        if(!authorizeAdmin(req,runtimeConfig))return jsonResponse(res,403,{error:{message:'Display plugin management requires admin access'}});
        const payload=()=>({ok:true,adapters:adapterCatalog(displayAdapters,runtimeConfig)});
        if(req.method==='GET')return jsonResponse(res,200,payload());
        if(req.method!=='POST')return jsonResponse(res,405,{error:{message:'Use GET or POST'}});
        const adminOrigin=runtimeConfig.server.publicUrl?new URL(runtimeConfig.server.publicUrl).origin:url.origin;
        if(req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && ![url.origin,adminOrigin].includes(req.headers.origin))return jsonResponse(res,403,{error:{message:'Open display plugins from your Castboard admin page before making changes'}});
        if(adapterInstallInProgress || pluginSaveInProgress)return jsonResponse(res,409,{error:{message:'Another change is being saved. Try again shortly.'}});
        adapterInstallInProgress=true;
        try {
          let installed;
          if(String(req.headers['content-type'] || '').split(';')[0]==='application/zip') {
            if(req.headers['x-castboard-trust-package']!=='yes')return jsonResponse(res,422,{error:{message:'Confirm that you trust this package before installing it'}});
            const zip=await readBytes(req,MAX_PACKAGE_BYTES),{manifest}=unpackDisplayPackage(zip);
            if(removedAdapterIds.has(manifest.id))return jsonResponse(res,409,{error:{message:'Restart Castboard before reinstalling a removed plugin so its previous code is unloaded'}});
            try{installed=await installDisplayPackage({zip,configDir:context.configDir,existing:displayAdapters});}
            catch(error){if(error.requiresRestart)removedAdapterIds.add(manifest.id);throw error;}
          } else if(acceptsJson(req)) {
            const body=await readBody(req);
            if(body.action!=='remove')return jsonResponse(res,422,{error:{message:'Unknown display plugin operation'}});
            await removeDisplayPackage({id:body.id,adapters:displayAdapters,config:runtimeConfig,configDir:context.configDir});
            removedAdapterIds.add(body.id);
          } else return jsonResponse(res,415,{error:{message:'Upload a ZIP display plugin'}});
          displayAdapters=await discoverDisplayAdapters({builtin:DISPLAY_ADAPTERS_DIR,config:runtimeConfig,configDir:context.configDir});
          return jsonResponse(res,200,{...payload(),...(installed?{installed}:{})});
        } finally {adapterInstallInProgress=false;}
      }
      if (url.pathname === '/api/admin/devices') {
        if (!authorizeAdmin(req,runtimeConfig)) return jsonResponse(res,403,{error:{message:'Display management requires admin access'}});
        const payload = () => ({ok:true,revision:configRevision(rawConfig),rendererConfigured:Boolean(runtimeConfig.embedded?.rendererUrl),devices:deviceReport(runtimeConfig,plugins,screenTypes,deviceDiagnostics),adapters:adapterCatalog(displayAdapters,runtimeConfig),screens:Object.entries(runtimeConfig.screens).map(([id,screen])=>({id,title:screen.title||id})),publicUrl:runtimeConfig.server.publicUrl || ''});
        if (req.method === 'GET') return jsonResponse(res,200,payload());
        if (req.method !== 'POST') return jsonResponse(res,405,{error:{message:'Use GET or POST'}});
        if (!acceptsJson(req)) return jsonResponse(res,415,{error:{message:'Display changes require JSON'}});
        const body = await readBody(req);
        if (pluginSaveInProgress || adapterInstallInProgress || body.revision !== configRevision(rawConfig)) return jsonResponse(res,409,{error:{message:'Settings changed. Refresh displays before saving.'}});
        pluginSaveInProgress=true;
        try {
          const requestedAdapter=adapterFor(displayAdapters,body.device || rawConfig.devices?.[body.id] || {});
          const adapterChanged=body.action==='create' || body.device?.adapter && body.device.adapter!==(rawConfig.devices?.[body.id]?.adapter || 'standard');
          const defaults=adapterChanged?{...requestedAdapter.defaults,options:requestedAdapter.defaultOptions || {}}:{};
          const changed=changeDeviceConfig(rawConfig,body,defaults);
          const nextConfig=validateConfig(expandEnvironment(changed.config,runtimeEnv));
          validateAdapterDevices(nextConfig,displayAdapters);
          const nextPath=writableConfigPath(configPath,path.dirname(configPath));
          await writeConfigAtomic(nextPath,changed.config);
          rawConfig=changed.config;runtimeConfig=nextConfig;configPath=nextPath;context.configDir=path.dirname(nextPath);
          nativeScenes.reset(body.id);deviceDiagnostics.delete(body.id);
          return jsonResponse(res,200,{...payload(),...(changed.token?{connectionKey:changed.token}:{}),applied:true});
        } finally { pluginSaveInProgress=false; }
      }
      const deviceMatch=url.pathname.match(/^\/api\/devices\/([a-z][a-z0-9-]{0,63})\/(config|bootstrap|scene|events|frame|touch|plugins\/([a-z][a-z0-9-]*)\/(data|action|stream))$/);
      if (deviceMatch) {
        const [,id,operation,pluginId]=deviceMatch;
        const device=authenticateDevice(runtimeConfig,id,req.headers.authorization);
        const adapter=adapterFor(displayAdapters,device),adapterContext=safeAdapterContext(adapter,device,id);
        const input=async()=>{
          if(!device.touch)throw Object.assign(new Error('Touch is disabled for this display'),{statusCode:403});
          if(!adapter.hooks.decodeInput){if(!acceptsJson(req))throw Object.assign(new Error('Touch events require JSON'),{statusCode:415});return readBody(req);}
          const bytes=await readBytes(req,512*1024);
          try {
            const event=await adapter.hooks.decodeInput(bytes,{...adapterContext,contentType:String(req.headers['content-type'] || '')});
            if(!event || typeof event!=='object' || Array.isArray(event) || Object.getPrototypeOf(event)!==Object.prototype || Buffer.byteLength(JSON.stringify(event))>16384)throw new Error('Invalid event');
            return event;
          }
          catch{throw Object.assign(new Error('The display plugin could not read this input event'),{statusCode:422});}
        };
        const sendScene=async scene=>{
          const encoded=await encodeAdapterResult(adapter,'encodeScene',scene,adapterContext,{data:Buffer.from(JSON.stringify(scene)),contentType:'application/json; charset=utf-8'});
          res.writeHead(200,{'Content-Type':encoded.contentType,'Content-Length':encoded.data.length,'Cache-Control':'no-store','X-Scene-Id':scene.sceneId});res.end(encoded.data);
        };
        const rate=deviceRequests.get(id) || {at:Date.now(),count:0};
        if (Date.now()-rate.at>60000) {rate.at=Date.now();rate.count=0;}
        deviceRequests.set(id,rate);
        if (++rate.count>600) return jsonResponse(res,429,{error:{message:'Display request limit exceeded. Retry in a minute.'}});
        deviceDiagnostics.set(id,{lastSeenAt:new Date().toISOString(),remoteAddress:clientAddress(req),operation:operation.startsWith('plugins/')?'data':operation});
        if (req.method==='GET' && operation==='config') {
          let configuration={};
          if(adapter.hooks.configure){try{configuration=await adapter.hooks.configure(adapterContext);}catch{throw Object.assign(new Error('The display plugin could not prepare its settings'),{statusCode:502});}}
          if(!configuration || typeof configuration!=='object' || Array.isArray(configuration) || Buffer.byteLength(JSON.stringify(configuration))>16384)throw Object.assign(new Error('The display plugin returned invalid settings'),{statusCode:502});
          return jsonResponse(res,200,{protocol:'castboard-device/1',id,name:device.name,mode:device.mode,width:device.width,height:device.height,format:device.format,refreshMs:device.refreshMs,touch:device.touch,allowActions:device.allowActions,adapter:{id:adapter.id,version:adapter.version,options:adapterOptions(adapter,device),configuration}});
        }
        if (req.method==='GET' && operation==='bootstrap') return jsonResponse(res,200,devicePublicConfig(runtimeConfig,publicConfig,device));
        if (operation==='scene' && req.method==='GET' && device.mode==='native') return sendScene(await nativeScenes.scene(id,device));
        if (operation==='events' && req.method==='POST' && device.mode==='native') {
          return sendScene(await nativeScenes.event(id,device,await input()));
        }
        if (device.mode==='frame' && ((operation==='frame' && req.method==='GET') || (operation==='touch' && req.method==='POST'))) {
          if (!runtimeConfig.embedded?.rendererUrl) return jsonResponse(res,503,{error:{message:'Image mode needs the optional frame renderer. Set it up before connecting this display.'}});
          let event;
          if (operation==='touch') {
            event=await input();
          }
          let frame;
          try {
            frame=await fetch(new URL('/render',runtimeConfig.embedded.rendererUrl),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${runtimeConfig.embedded.rendererToken}`},body:JSON.stringify({id,token:req.headers.authorization.slice(7),width:device.width,height:device.height,format:adapter.hooks.encodeFrame?(adapter.sourceFormat || 'rgb565'):device.format,revision:configRevision(rawConfig),...(event?{event}: {})}),signal:AbortSignal.timeout(40000)});
          } catch { return jsonResponse(res,503,{error:{message:'The image renderer is unavailable. The display can keep its last frame and retry.'}}); }
          if (!frame.ok) {const error=await frame.json().catch(()=>({}));return jsonResponse(res,frame.status,{error:{message:error.error?.message || 'The image renderer could not update this display'}});}
          const length=Number(frame.headers.get('content-length'));
          if (!length || length>8*1024*1024) {await frame.body?.cancel();return jsonResponse(res,502,{error:{message:'Invalid frame size'}});}
          const buffer=Buffer.from(await frame.arrayBuffer());
          if (buffer.length!==length) return jsonResponse(res,502,{error:{message:'Incomplete frame'}});
          const frameId=frame.headers.get('x-frame-id');
          const etag=adapter.hooks.encodeFrame?configRevision({frameId,adapter:adapter.id,version:adapter.version,device}):frameId;
          res.setHeader('ETag',`"${etag}"`);
          res.setHeader('Cache-Control','private, no-cache');
          for(const field of ['id','width','height','format']) res.setHeader(`X-Frame-${field}`,frame.headers.get(`x-frame-${field}`)||'');
          res.setHeader('X-Frame-Format',device.format);
          if (!event && req.headers['if-none-match']===`"${etag}"`) {res.writeHead(304);res.end();return;}
          const encoded=await encodeAdapterResult(adapter,'encodeFrame',{data:buffer,format:frame.headers.get('x-frame-format'),width:device.width,height:device.height,frameId},adapterContext,{data:buffer,contentType:device.format==='jpeg'?'image/jpeg':'application/octet-stream'});
          res.writeHead(200,{'Content-Type':encoded.contentType,'Content-Length':encoded.data.length});res.end(encoded.data);return;
        }
        if (operation.startsWith('plugins/')) {
          const actionDisabled = operation.endsWith('/action') && (!device.allowActions || !device.touch);
          if (!deviceScope(runtimeConfig,device).plugins.has(pluginId) || actionDisabled) return jsonResponse(res,403,{error:{message:'This plugin operation is not assigned to this display'}});
          url.pathname=`/api/${operation}`;
        } else return jsonResponse(res,405,{error:{message:'Operation is unavailable in this display mode'}});
      }
      const deviceView=url.pathname.match(/^\/device-view\/([a-z][a-z0-9-]{0,63})$/);
      if (deviceView && req.method==='GET') {
        authenticateDevice(runtimeConfig,deviceView[1],req.headers.authorization);
        return sendFile(res,path.join(PUBLIC_DIR,'index.html'));
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
      if (url.pathname === '/api/admin/delivery') {
        if (!authorizeAdmin(req, runtimeConfig)) return jsonResponse(res, 403, { error: { code: 'ADMIN_FORBIDDEN', message: 'Display setup requires admin access.' } });
        const payload = () => deliveryReport(runtimeConfig, rawConfig);
        if (req.method === 'GET') return jsonResponse(res, 200, payload());
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: { message: 'Use GET or POST' } });
        if (!acceptsJson(req)) return jsonResponse(res, 415, { error: { message: 'Display changes require JSON.' } });
        const body = await readBody(req);
        if (pluginSaveInProgress || body.revision !== configRevision(rawConfig)) return jsonResponse(res, 409, { error: { code: 'REVISION_CONFLICT', message: 'Settings changed in another window. Refresh displays and try again.' } });
        if (body.action === 'send') {
          const item = deliveryTarget(runtimeConfig, body.screenId, body.index);
          if (!item.url) return jsonResponse(res, 422, { error: { message: 'Set server.publicUrl to an address your display can reach before sending.' } });
          if (item.protocol === 'url') return jsonResponse(res, 422, { error: { message: 'Open the screen link in the browser on this display.' } });
          // A receiver may be shared by multiple screens; serialize sends to that receiver.
          const key = JSON.stringify([item.protocol, item.target.address || item.target.device || item.target.endpoint || item.target.name]);
          if (deliveriesInProgress.has(key)) return jsonResponse(res, 409, { error: { message: 'A screen is already being sent to this display. Wait a moment and try again.' } });
          deliveriesInProgress.add(key);
          try {
            const protocols = await discoverCastProtocols({ protocolsDir: path.join(ROOT, 'cast-protocols'), config: runtimeConfig, context });
            const protocol = protocols.find(entry => entry.id === item.protocol);
            if (!protocol) return jsonResponse(res, 422, { error: { message: 'This delivery method is disabled or missing. Check the server configuration.' } });
            await protocol.cast(item);
            return jsonResponse(res, 200, { ok: true, message: 'Screen sent. Check the display to confirm it opened.' });
          } catch (error) {
            // Adapter errors can include private URLs, headers or executable arguments.
            return jsonResponse(res, 502, { error: { code: 'DELIVERY_FAILED', message: error.code === 'ENOENT' ? 'The delivery tool is not installed. Check Server tools below, then try again.' : 'Could not send the screen. Check that the display is online and can reach this server, then try again.' } });
          } finally { deliveriesInProgress.delete(key); }
        }
        pluginSaveInProgress = true;
        try {
          const nextRaw = changeDelivery(rawConfig, body);
          const nextConfig = validateConfig(expandEnvironment(nextRaw, runtimeEnv));
          const nextPath = writableConfigPath(configPath, path.dirname(configPath));
          await writeConfigAtomic(nextPath, nextRaw);
          rawConfig = nextRaw; runtimeConfig = nextConfig; configPath = nextPath;
          context.configDir = path.dirname(nextPath);
          return jsonResponse(res, 200, { ...payload(), applied: true });
        } catch (error) {
          return jsonResponse(res, error.statusCode || 500, { error: { code: error.code || 'DELIVERY_SAVE_FAILED', message: error.statusCode ? error.message : 'Could not save the display settings. Check that the server configuration file is writable, then try again.' } });
        } finally { pluginSaveInProgress = false; }
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
            const result = await runAction(id,body,{url,req});
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
      if (req.method === 'GET' && url.pathname === '/draft-model.js' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'draft-model.js'));
      if (req.method === 'GET' && url.pathname === '/record-list-field.js' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'record-list-field.js'));
      if (req.method === 'GET' && url.pathname === '/screen-path.js' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(ROOT, 'src/core/screen-path.js'));
      if (req.method === 'GET' && url.pathname === '/studio-model.js' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'studio-model.js'));
      if (req.method === 'GET' && url.pathname === '/admin' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
      if (req.method === 'GET' && /^\/admin\.(js|css)$/.test(url.pathname) && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), false);
      if(req.method==='GET'&&url.pathname==='/admin/plugins'&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,'plugins.html'));
      if(req.method==='GET'&&url.pathname==='/admin/devices'&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,'devices.html'));
      if(req.method==='GET'&&/^\/devices\.(js|css)$/.test(url.pathname)&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,url.pathname.slice(1)));
      if(req.method==='GET'&&/^\/plugin-admin\.(js|css)$/.test(url.pathname)&&runtimeConfig.admin?.enabled!==false)return sendFile(res,path.join(PUBLIC_DIR,url.pathname.slice(1)));
      if (req.method === 'GET' && url.pathname === '/setup' && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, 'setup.html'));
      if (req.method === 'GET' && /^\/setup\.(js|css)$/.test(url.pathname) && runtimeConfig.admin?.enabled !== false) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), false);
      const screenPaths = new Set(Object.values(publicConfig.screens).map(screen => screen.path));
      if (req.method === 'GET' && (url.pathname === '/' || screenPaths.has(url.pathname))) {
        const screen = Object.entries(publicConfig.screens).find(([,screen])=>screen.path===url.pathname)?.[0] || publicConfig.defaultScreen;
        const entry=screenRequests[screen] ||= {count:0}; entry.count += 1; entry.lastRequestAt=new Date().toISOString(); entry.remoteAddress=clientAddress(req);
        return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      if (req.method === 'GET' && /^\/(app|widget-kit|interaction-model|interaction-runtime)\.js$/.test(url.pathname)) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)), true);
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
