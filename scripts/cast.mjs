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

const screenId = process.argv[2] || 'home';
const { config } = loadConfig({ cwd: ROOT });
const screen = config.screens[screenId];
if (!screen) throw new Error(`Unknown screen "${screenId}". Available: ${Object.keys(config.screens).join(', ')}`);
const device = config.cast?.targets?.[screenId];
if (!device) throw new Error(`cast.targets.${screenId} is not configured`);
const address = localAddress();
if (!address) throw new Error('Unable to find a LAN IPv4 address');
const url = `http://${address}:${config.server.port}${screen.path || '/'}`;

console.log(`Casting ${screenId} to ${device}`);
console.log(url);
const child = spawn(process.env.CATT_BIN || 'catt', ['-d', device, 'cast_site', url], { stdio: 'inherit' });
child.on('error', error => {
  console.error(`Unable to start catt: ${error.message}`);
  console.error('Install it with: pipx install catt');
  process.exitCode = 1;
});
child.on('exit', code => { process.exitCode = code || 0; });
