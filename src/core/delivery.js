import os from 'node:os';
import { configRevision } from './admin-config.js';

const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode, code: 'INVALID_DELIVERY' });

export function displayBaseUrl(config, addresses = os.networkInterfaces()) {
  if (config.server.publicUrl) return config.server.publicUrl.replace(/\/$/, '');
  const host = config.server.host || '0.0.0.0';
  if (['localhost', '::1'].includes(host) || /^127\./.test(host)) return null;
  if (!['0.0.0.0', '::'].includes(host)) return `http://${host.includes(':') ? `[${host}]` : host}:${config.server.port}`;
  const candidates = Object.values(addresses).flat().filter(item => item?.family === 'IPv4' && !item.internal);
  const address = candidates.find(item => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)) || candidates[0];
  return address ? `http://${address.address}:${config.server.port}` : null;
}

export function screenDisplayUrl(config, screen, addresses) {
  const base = displayBaseUrl(config, addresses);
  if (!base) return null;
  const url = new URL(base);
  // Keep credentials and query parameters server-side when a deployment needs them.
  url.pathname = `${url.pathname.replace(/\/$/, '')}${screen.path}`;
  return url.href;
}

export function targetProtocol(config, screen, target) {
  return target.protocol || screen.castProtocol || config.casting?.defaultProtocol || 'google-cast';
}

export function deliveryReport(config, rawConfig, addresses) {
  return {
    ok: true,
    revision: configRevision(rawConfig),
    castEnabled: config.casting?.protocols?.['google-cast']?.enabled !== false,
    screens: Object.entries(config.screens).map(([id, screen]) => {
      const link = screenDisplayUrl(config, screen, addresses);
      const url = link && new URL(link);
      const safeLink = url && !url.username && !url.password && !url.search && !url.hash;
      return {
        id, title: screen.title || id, path: screen.path,
        displayUrl: safeLink ? link : null,
        linkMessage: !link ? 'This server is local-only. Set server.publicUrl to an address your display can reach.' : !safeLink ? 'This deployment uses a private display URL. Use a configured display to send it securely.' : '',
        targets: (screen.targets || []).map((entry, index) => {
          const target = typeof entry === 'string' ? { name: entry } : entry;
          const protocol = targetProtocol(config, screen, target);
          const configured = config.casting?.protocols?.[protocol];
          return { index, name: target.name || `Display ${index + 1}`, protocol, canSend: !!link && !!configured && configured.enabled !== false && protocol !== 'url' };
        }),
      };
    }),
  };
}

export function deliveryTarget(config, screenId, index) {
  if (typeof screenId !== 'string' || !Object.hasOwn(config.screens, screenId)) throw fail('This screen no longer exists. Refresh and choose another screen.', 404);
  const screen = config.screens[screenId];
  if (!Number.isInteger(index) || index < 0 || index >= (screen.targets || []).length) throw fail('This display no longer exists. Refresh and choose another display.', 404);
  const entry = screen.targets[index];
  const target = typeof entry === 'string' ? { name: entry, device: entry } : entry;
  return { screenId, screenType: screen.type, target, protocol: targetProtocol(config, screen, target), url: screenDisplayUrl(config, screen) };
}

export function changeDelivery(rawConfig, body) {
  const next = structuredClone(rawConfig);
  if (typeof body.screenId !== 'string' || !Object.hasOwn(next.screens, body.screenId)) throw fail('This screen no longer exists. Refresh and choose another screen.', 404);
  const screen = next.screens[body.screenId];
  if (body.action === 'add') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const device = typeof body.device === 'string' ? body.device.trim() : '';
    if (!name || name.length > 100) throw fail('Give the display a name of up to 100 characters.');
    if (!device || device.length > 200 || /[\x00-\x1f\x7f]/.test(device) || device.startsWith('-')) throw fail('Enter a Cast device name or IP address.');
    if (next.casting?.protocols?.['google-cast']?.enabled === false) throw fail('Google Cast is disabled in the server configuration. Enable it before adding a display.');
    if ((screen.targets || []).some(entry => {
      const target = typeof entry === 'string' ? { device: entry } : entry;
      return targetProtocol(next, screen, target) === 'google-cast' && (target.address || target.device || target.name) === device;
    })) throw fail('This display is already connected to this screen.');
    next.casting ||= {};
    next.casting.protocols ||= {};
    next.casting.protocols['google-cast'] ||= { enabled: true };
    screen.targets ||= [];
    screen.targets.push({ name, device, protocol: 'google-cast' });
  } else if (body.action === 'remove') {
    deliveryTarget(next, body.screenId, body.index);
    screen.targets.splice(body.index, 1);
  } else throw fail('Choose Add display or Remove display.');
  return next;
}
