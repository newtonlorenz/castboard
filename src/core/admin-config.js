import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const clone = value => JSON.parse(JSON.stringify(value));
const BRANDING_FIELDS = ['name', 'subtitle', 'location', 'accent', 'timeZone'];
const SCREEN_FIELDS = ['title', 'path', 'type', 'layout', 'appearance', 'panels'];

export function configRevision(rawConfig) {
  return createHash('sha256').update(JSON.stringify(rawConfig)).digest('hex').slice(0, 20);
}

export function extractDesign(rawConfig) {
  const branding = {};
  for (const field of BRANDING_FIELDS) if (rawConfig.branding?.[field] !== undefined) branding[field] = clone(rawConfig.branding[field]);
  const screens = {};
  for (const [id, source] of Object.entries(rawConfig.screens || {})) {
    screens[id] = { id };
    for (const field of SCREEN_FIELDS) if (source[field] !== undefined) screens[id][field] = clone(source[field]);
    screens[id].type ||= 'grid';
    screens[id].layout ||= {};
    screens[id].appearance ||= {};
    screens[id].panels ||= [];
  }
  return { branding, defaultScreen: rawConfig.defaultScreen || Object.keys(screens)[0], screens };
}

export function mergeDesign(rawConfig, design) {
  if (!design || typeof design !== 'object' || Array.isArray(design)) throw new Error('Design must be an object');
  if (!design.screens || typeof design.screens !== 'object' || Array.isArray(design.screens)) throw new Error('Design screens must be an object');
  const merged = clone(rawConfig);
  merged.branding = { ...(merged.branding || {}) };
  for (const field of BRANDING_FIELDS) {
    if (design.branding?.[field] === undefined) delete merged.branding[field];
    else merged.branding[field] = clone(design.branding[field]);
  }
  merged.defaultScreen = design.defaultScreen;
  merged.screens = {};
  for (const [id, source] of Object.entries(design.screens)) {
    const existing = rawConfig.screens?.[id] || {};
    const screen = { ...clone(existing) };
    for (const field of SCREEN_FIELDS) {
      if (source[field] === undefined) delete screen[field];
      else screen[field] = clone(source[field]);
    }
    screen.type ||= 'grid';
    screen.layout ||= {};
    screen.appearance ||= {};
    screen.panels ||= [];
    if (!Array.isArray(screen.targets)) screen.targets = [];
    merged.screens[id] = screen;
  }
  return merged;
}

export function isLoopbackAddress(address = '') {
  const normalized = String(address).replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1';
}

export function isLocalAdminHost(host = '') {
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function isAllowedApplicationHost(host = '', allowedHosts = []) {
  let hostname;
  try { hostname = new URL(`http://${host}`).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return false; }
  if (hostname === 'localhost' || isIP(hostname) || !hostname.includes('.') || hostname.endsWith('.local') || hostname.endsWith('.home.arpa')) return true;
  return allowedHosts.some(item => String(item).toLowerCase() === hostname);
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizeAdmin(req, config) {
  if (config.admin?.enabled === false) return false;
  // A loopback socket alone is not enough: a hostile DNS name can resolve to
  // 127.0.0.1 and otherwise inherit passwordless local-admin access.
  if (isLoopbackAddress(req.socket?.remoteAddress) && isLocalAdminHost(req.headers.host)) return true;
  if (config.admin?.allowLan !== true || !config.admin?.token) return false;
  const authorization = req.headers.authorization || '';
  return authorization.startsWith('Bearer ') && secureEqual(authorization.slice(7), config.admin.token);
}

export function writableConfigPath(currentPath, root) {
  return path.basename(currentPath) === 'castboard.config.example.json' ? path.join(root, 'castboard.config.json') : currentPath;
}

export async function writeConfigAtomic(filePath, rawConfig) {
  const directory = path.dirname(filePath);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(rawConfig, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}
