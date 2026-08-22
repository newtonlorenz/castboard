#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/core/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function localAddress() {
  const candidates = Object.values(os.networkInterfaces()).flat().filter(address => address && address.family === 'IPv4' && !address.internal);
  return candidates.find(address => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address.address))?.address || candidates[0]?.address;
}

function cast(device, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CATT_BIN || 'catt', ['-d', device, 'cast_site', url], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`catt exited with code ${code}`)));
  });
}

export function buildCastPlan(config, address, requested = config.defaultScreen || Object.keys(config.screens)[0]) {
  const screenIds = requested === '--all' ? Object.keys(config.screens) : [requested];
  for (const id of screenIds) {
    if (!config.screens[id]) throw new Error(`Unknown screen "${id}". Available: ${Object.keys(config.screens).join(', ')}`);
  }
  return screenIds.flatMap(screenId => {
    const screen = config.screens[screenId];
    const devices = screen.targets || [];
    if (!devices.length) throw new Error(`screens.${screenId}.targets has no Cast devices`);
    const url = `http://${address}:${config.server.port}${screen.path}`;
    return devices.map(device => ({ screenId, device, url }));
  });
}

async function main() {
  const { config } = loadConfig({ cwd: ROOT });
  const address = localAddress();
  if (!address) throw new Error('Unable to find a LAN IPv4 address');
  const requested = process.argv[2] || config.defaultScreen || Object.keys(config.screens)[0];
  const plan = buildCastPlan(config, address, requested);
  await Promise.all(plan.map(async item => {
    console.log(`Casting ${item.screenId} to ${item.device}`);
    console.log(item.url);
    await cast(item.device, item.url);
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    if (error.code === 'ENOENT') console.error('Install catt with: pipx install catt');
    process.exitCode = 1;
  });
}
