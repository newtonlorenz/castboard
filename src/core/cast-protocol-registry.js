import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionDirectories } from './extensions.js';

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export async function discoverCastProtocols({ protocolsDir, config, context = {} }) {
  const configured = config.casting?.protocols || {};
  const directories = await extensionDirectories(protocolsDir, config, 'protocols', context.configDir);
  const protocols = [];
  for (const [id, directory] of directories) {
    const entry = { name: id };
    const protocolConfig = configured[entry.name];
    if (!protocolConfig || protocolConfig.enabled === false) continue;
    const modulePath = path.join(directory, 'protocol.js');
    try { await fs.access(modulePath); } catch { continue; }
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createProtocol !== 'function') throw new Error(`Cast protocol ${entry.name} must export createProtocol()`);
    const protocol = await module.createProtocol({ config: protocolConfig, context });
    if (!protocol || protocol.id !== entry.name || !VALID_ID.test(protocol.id) || typeof protocol.cast !== 'function') {
      throw new Error(`Invalid cast protocol: ${entry.name}`);
    }
    if (typeof protocol.name !== 'string' || !protocol.name.trim()) throw new Error(`Cast protocol ${entry.name} must provide a name`);
    protocols.push(protocol);
  }
  const enabled = new Set(protocols.map(protocol => protocol.id));
  const references = [];
  if (config.casting?.defaultProtocol) references.push(['casting.defaultProtocol', config.casting.defaultProtocol]);
  for (const [screenId, screen] of Object.entries(config.screens || {})) {
    if (screen.castProtocol) references.push([`screens.${screenId}.castProtocol`, screen.castProtocol]);
    for (const [index, target] of (screen.targets || []).entries()) {
      if (typeof target === 'object' && target.protocol) references.push([`screens.${screenId}.targets[${index}].protocol`, target.protocol]);
    }
  }
  for (const [location, protocolId] of references) {
    if (!enabled.has(protocolId)) throw new Error(`${location} references disabled or missing cast protocol: ${protocolId}`);
  }
  return protocols;
}
