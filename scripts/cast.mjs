#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/core/config.js';
import { discoverCastProtocols } from '../src/core/cast-protocol-registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROTOCOLS_DIR = path.join(ROOT, 'cast-protocols');

function localAddress() {
  const candidates = Object.values(os.networkInterfaces()).flat().filter(address => address && address.family === 'IPv4' && !address.internal);
  return candidates.find(address => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address.address))?.address || candidates[0]?.address;
}

export function buildCastPlan(config, address, requested = config.defaultScreen || Object.keys(config.screens)[0], protocolOverride = null) {
  const screenIds = requested === '--all' ? Object.keys(config.screens) : [requested];
  for (const id of screenIds) {
    if (!config.screens[id]) throw new Error(`Unknown screen "${id}". Available: ${Object.keys(config.screens).join(', ')}`);
  }
  return screenIds.flatMap(screenId => {
    const screen = config.screens[screenId];
    const targets = screen.targets || [];
    if (!targets.length) throw new Error(`screens.${screenId}.targets has no display targets`);
    const url = `http://${address}:${config.server.port}${screen.path}`;
    return targets.map(rawTarget => {
      const target = typeof rawTarget === 'string' ? { name: rawTarget, device: rawTarget } : rawTarget;
      const protocol = protocolOverride || target.protocol || screen.castProtocol || config.casting?.defaultProtocol || 'google-cast';
      return { screenId, screenType: screen.type || 'grid', protocol, target, url };
    });
  });
}

async function main() {
  const { config } = loadConfig({ cwd: ROOT });
  const address = localAddress();
  if (!address) throw new Error('Unable to find a LAN IPv4 address');
  const requested = process.argv[2] || config.defaultScreen || Object.keys(config.screens)[0];
  const overrideIndex = process.argv.indexOf('--protocol');
  const protocolOverride = overrideIndex >= 0 ? process.argv[overrideIndex + 1] : null;
  if (overrideIndex >= 0 && !protocolOverride) throw new Error('--protocol requires a protocol ID');
  const protocols = await discoverCastProtocols({ protocolsDir: PROTOCOLS_DIR, config });
  const protocolsById = new Map(protocols.map(protocol => [protocol.id, protocol]));
  const plan = buildCastPlan(config, address, requested, protocolOverride);
  await Promise.all(plan.map(async item => {
    const protocol = protocolsById.get(item.protocol);
    if (!protocol) throw new Error(`Cast protocol is not installed or enabled: ${item.protocol}`);
    console.log(`Casting ${item.screenId} to ${item.target.name || item.target.device || item.target.endpoint} via ${item.protocol}`);
    console.log(item.url);
    const result = await protocol.cast(item);
    if (result?.message) console.log(result.message);
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    if (error.code === 'ENOENT') console.error('Install catt with: pipx install catt');
    process.exitCode = 1;
  });
}
