import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export async function discoverScreenTypes({ screenTypesDir, config }) {
  const entries = await fs.readdir(screenTypesDir, { withFileTypes: true });
  const types = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !VALID_ID.test(entry.name)) continue;
    const modulePath = path.join(screenTypesDir, entry.name, 'type.js');
    const rendererPath = path.join(screenTypesDir, entry.name, 'renderer.js');
    try { await fs.access(modulePath); } catch { continue; }
    try { await fs.access(rendererPath); } catch { throw new Error(`Screen type ${entry.name} is missing renderer.js`); }
    const module = await import(pathToFileURL(modulePath));
    if (typeof module.createScreenType !== 'function') throw new Error(`Screen type ${entry.name} must export createScreenType()`);
    const type = await module.createScreenType();
    if (!type || type.id !== entry.name || !VALID_ID.test(type.id)) throw new Error(`Screen type ID mismatch in ${entry.name}`);
    if (typeof type.name !== 'string' || !type.name.trim()) throw new Error(`Screen type ${entry.name} must provide a name`);
    if (type.validateScreen !== undefined && typeof type.validateScreen !== 'function') throw new Error(`Screen type ${entry.name}.validateScreen must be a function`);
    types.push({ ...type, directory: path.dirname(modulePath) });
  }
  const byId = new Map(types.map(type => [type.id, type]));
  for (const [screenId, screen] of Object.entries(config.screens)) {
    const typeId = screen.type || 'grid';
    const type = byId.get(typeId);
    if (!type) throw new Error(`Screen ${screenId} references missing screen type: ${typeId}`);
    if (typeof type.validateScreen === 'function') type.validateScreen(screen, screenId);
  }
  return types;
}
