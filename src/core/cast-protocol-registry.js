import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export async function discoverCastProtocols({ protocolsDir, config, context = {} }) {
  const configured = config.casting?.protocols || {};
  const entries = await fs.readdir(protocolsDir, { withFileTypes: true });
  const protocols = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !VALID_ID.test(entry.name)) continue;
    const protocolConfig = configured[entry.name];
    if (!protocolConfig || protocolConfig.enabled === false) continue;
    const modulePath = path.join(protocolsDir, entry.name, 'protocol.js');
    try { await fs.access(modulePath); } catch { continue; }
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createProtocol !== 'function') throw new Error(`Cast protocol ${entry.name} must export createProtocol()`);
    const protocol = await module.createProtocol({ config: protocolConfig, context });
    if (!protocol || protocol.id !== entry.name || !VALID_ID.test(protocol.id) || typeof protocol.cast !== 'function') {
      throw new Error(`Invalid cast protocol: ${entry.name}`);
    }
    protocols.push(protocol);
  }
  return protocols;
}
