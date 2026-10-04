#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { validateSchema } from './core/extensions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')).version;
const LIMIT = 512 * 1024;
const string = { type: 'string' };
const revision = { type: 'string', description: 'Revision from the latest configuration, design, plugin or delivery read. Read again after each save.' };
const object = { type: 'object' };
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const definition = (name, description, inputSchema, annotations = read) => ({ name, description, inputSchema, annotations });
const hasEmbeddedDisplays = await fs.access(path.join(ROOT, 'src/core/devices.js')).then(() => true, () => false);

export const MCP_TOOLS = [
  definition('castboard_get_configuration', 'Read all raw configuration with literal credentials redacted, environment placeholders preserved, protected paths and a revision. Never save a redacted full copy; use targeted patches.', schema()),
  definition('castboard_patch_configuration', 'Configure any Castboard setting: server, admin, branding, screens, panels, plugins, bindings, targets, protocols and extension roots. Validates without writing by default. Set dryRun=false to save atomically and apply live. Listener host/port changes require a service restart. Use environment references for credentials. Arrays are replaced as a whole.', schema({ revision, operations: { type: 'array', minItems: 1, maxItems: 100, items: schema({ op: { type: 'string', enum: ['set', 'remove'] }, path: { type: 'string', description: 'JSON Pointer, e.g. /plugins/weather/latitude. Escape ~ as ~0 and / as ~1.' }, value: {} }, ['op', 'path']) }, dryRun: { type: 'boolean', default: true } }, ['revision', 'operations']), write),
  definition('castboard_get_design', 'Read editable screens, panels, appearance, branding and installed view/source/layout schemas.', schema()),
  definition('castboard_save_design', 'Save a complete design returned by get_design with an up-to-date revision. Validates and applies live; omitted screens are deleted. Provider and delivery settings are preserved for existing screens.', schema({ revision, design: object }, ['revision', 'design']), write),
  definition('castboard_get_plugins', 'List local packages, provider/settings/panel schemas, installed instances, protected fields, bindings and usage. Library installation means creating a configured instance, not downloading code.', schema()),
  definition('castboard_change_plugin', 'Install, configure, enable or remove a local plugin instance. Uses package defaults/dependencies, validation and live application. Credentials may be supplied as ${ENV_NAME}. Read plugin docs and schemas first.', schema({ revision, action: { type: 'string', enum: ['install', 'configure', 'enable', 'remove'] }, id: string, type: string, settings: object, clear: { type: 'array', items: string }, bindings: object, enabled: { type: 'boolean' } }, ['revision', 'action', 'id']), write),
  definition('castboard_get_delivery', 'Read screen URLs and configured display names/protocols without exposing private receiver details.', schema()),
  definition('castboard_change_delivery', 'Add a Google Cast display or remove a target. To configure URL, webhook or custom protocols use patch_configuration. Read delivery again after saving.', schema({ revision, action: { type: 'string', enum: ['add', 'remove'] }, screenId: string, name: string, device: string, index: { type: 'integer', minimum: 0 } }, ['revision', 'action', 'screenId']), write),
  definition('castboard_send_screen', 'Send a configured screen to one display now. This controls a real device; use only when requested. Use get_delivery for screenId, target index and revision.', schema({ revision, screenId: string, index: { type: 'integer', minimum: 0 } }, ['revision', 'screenId', 'index']), { ...write, openWorldHint: true }),
  definition('castboard_get_status', 'Read configuration diagnostics, integration readiness, runtime health and recently connected screen clients. Does not fetch provider data.', schema()),
  definition('castboard_test_plugin', 'Test a configured provider connection. May contact its external service or local backend; returns diagnostic status without provider payloads.', schema({ pluginId: string }, ['pluginId']), { ...read, openWorldHint: true, idempotentHint: false }),
  definition('castboard_discover_devices', 'Discover Google Cast receivers using the configured catt executable. Does not send screens.', schema(), { ...read, openWorldHint: true }),
  definition('castboard_read_documentation', 'Read bundled documentation, even while the Castboard app is offline. Use resources/list for topics. Examples: mcp, configuration, plugins, screen-types, cast-protocols, extensions, plugin/weather.', schema({ topic: string }, ['topic'])),
  ...(hasEmbeddedDisplays ? [
    definition('castboard_get_devices', 'Read embedded displays, assigned screens, image/native modes, touch settings, adapter schemas and health diagnostics. Connection keys remain protected.', schema()),
    definition('castboard_change_device', 'Create, update, remove or rotate an embedded display connection using validated adapter defaults. Creation/rotation returns a one-time connectionKey needed to provision the receiver; treat it as a secret. Rotation disconnects receivers until reprovisioned.', schema({ revision, action: { type: 'string', enum: ['create', 'update', 'remove', 'rotate'] }, id: string, device: schema({ name: string, screenId: string, mode: { type: 'string', enum: ['frame', 'native'] }, width: { type: 'integer', minimum: 16, maximum: 1920 }, height: { type: 'integer', minimum: 16, maximum: 1920 }, refreshMs: { type: 'integer', minimum: 1000, maximum: 3600000 }, format: string, enabled: { type: 'boolean' }, touch: { type: 'boolean' }, allowActions: { type: 'boolean' }, adapter: string, options: object }) }, ['revision', 'action', 'id']), write),
    definition('castboard_get_display_adapters', 'Read installed embedded display adapters, their formats, modes, defaults, options schemas, instructions and usage.', schema()),
  ] : []),
];

export async function documentationResources() {
  const resources = [{ uri: 'castboard://docs/readme', name: 'readme', title: 'Castboard overview', mimeType: 'text/markdown' }];
  const documents = (await fs.readdir(path.join(ROOT, 'docs'))).filter(name => name.endsWith('.md')).sort();
  for (const document of documents) resources.push({ uri: `castboard://docs/${document.slice(0, -3).toLowerCase()}`, name: document.slice(0, -3).toLowerCase(), title: document.slice(0, -3), mimeType: 'text/markdown' });
  const directories = await fs.readdir(path.join(ROOT, 'plugins'), { withFileTypes: true });
  for (const directory of directories.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    try { await fs.access(path.join(ROOT, 'plugins', directory.name, 'README.md')); }
    catch { continue; }
    resources.push({ uri: `castboard://docs/plugin/${directory.name}`, name: `plugin/${directory.name}`, title: `${directory.name} plugin guide`, mimeType: 'text/markdown' });
  }
  return resources;
}

export async function readDocumentation(topic) {
  const resource = (await documentationResources()).find(item => item.name === topic);
  if (!resource) throw new Error('Unknown documentation topic. Use resources/list to discover available topics.');
  const file = topic === 'readme' ? path.join(ROOT, 'README.md') : topic.startsWith('plugin/') ? path.join(ROOT, 'plugins', topic.slice(7), 'README.md') : path.join(ROOT, 'docs', `${topic.toUpperCase()}.md`);
  // Some existing guides use lowercase filenames.
  const actual = topic.includes('/') || topic === 'readme' ? file : path.join(ROOT, 'docs', (await fs.readdir(path.join(ROOT, 'docs'))).find(name => name.toLowerCase() === `${topic}.md`));
  return { ...resource, text: await fs.readFile(actual, 'utf8') };
}

export function createMcp({ baseUrl = process.env.CASTBOARD_URL || 'http://127.0.0.1:8787', token = process.env.CASTBOARD_ADMIN_TOKEN || '', fetchImpl = fetch } = {}) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('CASTBOARD_URL must be an http(s) origin without credentials, path, query or fragment');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if (token && !local && base.protocol !== 'https:') throw new Error('Use HTTPS when sending an admin token to a non-loopback server');
  async function api(route, method = 'GET', body) {
    let response;
    try { response = await fetchImpl(new URL(route, base), { method, redirect: 'error', signal: AbortSignal.timeout(45000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new Error('Cannot reach Castboard. Start the app, check CASTBOARD_URL and network access, then try again.'); }
    let bytes = 0, chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) throw new Error('Castboard response exceeds 4 MiB');
      chunks.push(chunk);
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Castboard returned an invalid response'); }
    if (!response.ok) {
      if (response.status === 403) throw new Error('Admin access denied. Use the loopback app URL or configure LAN admin access and CASTBOARD_ADMIN_TOKEN.');
      if (response.status === 404) throw new Error('Endpoint unavailable. Restart Castboard using the version that includes MCP support.');
      throw new Error(`Castboard ${response.status}: ${data.error?.message || 'Request failed'}`);
    }
    return data;
  }
  async function callTool(name, args = {}) {
    const tool = MCP_TOOLS.find(item => item.name === name);
    if (!tool) throw Object.assign(new Error('Unknown tool'), { rpcCode: -32602 });
    validateSchema(args, tool.inputSchema, 'arguments');
    switch (name) {
      case 'castboard_get_configuration': return api('/api/admin/configuration');
      case 'castboard_patch_configuration': return api('/api/admin/configuration', 'PATCH', args);
      case 'castboard_get_design': return api('/api/admin/design');
      case 'castboard_save_design': return api('/api/admin/design', 'PUT', args);
      case 'castboard_get_plugins': return api('/api/admin/plugins');
      case 'castboard_change_plugin': return api('/api/admin/plugins', 'POST', args);
      case 'castboard_get_delivery': return api('/api/admin/delivery');
      case 'castboard_change_delivery': return api('/api/admin/delivery', 'POST', args);
      case 'castboard_send_screen': return api('/api/admin/delivery', 'POST', { ...args, action: 'send' });
      case 'castboard_get_status': {
        const [setup, health] = await Promise.all([api('/api/admin/setup'), api('/api/admin/health')]);
        return { setup, health };
      }
      case 'castboard_test_plugin': return api('/api/admin/setup/test-plugin', 'POST', args);
      case 'castboard_discover_devices': return api('/api/admin/setup/discover-cast', 'POST', {});
      case 'castboard_read_documentation': return readDocumentation(args.topic);
      case 'castboard_get_devices': return api('/api/admin/devices');
      case 'castboard_change_device': return api('/api/admin/devices', 'POST', args);
      case 'castboard_get_display_adapters': return api('/api/admin/display-adapters');
    }
  }
  return { async handle(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (Object.hasOwn(message, 'id') && typeof message.id !== 'string' && typeof message.id !== 'number')) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    if (!Object.hasOwn(message, 'id')) return null;
    const response = result => ({ jsonrpc: '2.0', id: message.id, result });
    try {
      switch (message.method) {
        case 'initialize': return response({ protocolVersion: ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2025-11-25', capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: 'castboard', version: VERSION }, instructions: 'Read castboard://docs/mcp first. Inspect configuration and schemas before editing. Use targeted patches to preserve credentials; dry-run before saving. Revisions are shared across all editors. Sending a screen controls a real device.' });
        case 'ping': return response({});
        case 'tools/list': return response({ tools: MCP_TOOLS });
        case 'tools/call': {
          try {
            const result = await callTool(message.params?.name, message.params?.arguments ?? {});
            return response({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result });
          } catch (error) {
            if (error.rpcCode) throw error;
            return response({ isError: true, content: [{ type: 'text', text: error.message }] });
          }
        }
        case 'resources/list': return response({ resources: await documentationResources() });
        case 'resources/templates/list': return response({ resourceTemplates: [] });
        case 'resources/read': {
          const resource = (await documentationResources()).find(item => item.uri === message.params?.uri);
          if (!resource) throw Object.assign(new Error('Unknown resource'), { rpcCode: -32602 });
          const { text, uri, mimeType } = await readDocumentation(resource.name);
          return response({ contents: [{ uri, mimeType, text }] });
        }
        case 'prompts/list': return response({ prompts: [{ name: 'configure-castboard', description: 'Inspect, configure, validate and verify a Castboard dashboard', arguments: [{ name: 'goal', description: 'Desired configuration change', required: true }] }] });
        case 'prompts/get': {
          if (message.params?.name !== 'configure-castboard' || typeof message.params?.arguments?.goal !== 'string') throw Object.assign(new Error('Use configure-castboard with a goal'), { rpcCode: -32602 });
          return response({ messages: [{ role: 'user', content: { type: 'text', text: `Configure Castboard for this goal: ${message.params.arguments.goal}\nRead the MCP guide and relevant plugin documentation. Inspect current configuration, revision and schemas. Preserve protected values with targeted patches and use environment references for secrets. Validate a dry run, save the requested change, re-read the result and test the affected connections. Report any restart needed. Send screens only if requested.` } }] });
        }
        default: throw Object.assign(new Error('Method not found'), { rpcCode: -32601 });
      }
    } catch (error) { return { jsonrpc: '2.0', id: message.id, error: { code: error.rpcCode || -32603, message: error.message } }; }
  } };
}

export async function serveStdio(input = process.stdin, output = process.stdout, mcp = createMcp()) {
  let pending = Buffer.alloc(0);
  async function send(result) {
    if (result && !output.write(JSON.stringify(result) + '\n')) await once(output, 'drain');
  }
  for await (const chunk of input) {
    pending = Buffer.concat([pending, Buffer.from(chunk)]);
    let end;
    while ((end = pending.indexOf(10)) >= 0) {
      const line = pending.subarray(0, end); pending = pending.subarray(end + 1);
      if (line.length > LIMIT) throw new Error('MCP message exceeds 512 KiB');
      if (!line.toString('utf8').trim()) continue;
      let message;
      try { message = JSON.parse(line.toString('utf8')); }
      catch { await send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
      await send(await mcp.handle(message));
    }
    if (pending.length > LIMIT) throw new Error('MCP message exceeds 512 KiB');
  }
  if (pending.length) await send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Messages must end with a newline' } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await serveStdio(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
