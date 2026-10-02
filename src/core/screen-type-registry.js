import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionDirectories, validateSchema } from './extensions.js';

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export async function discoverScreenTypes({ screenTypesDir, config, configDir }) {
  const directories = await extensionDirectories(screenTypesDir, config, 'screenTypes', configDir);
  const types = [];
  for (const [id, directory] of directories) {
    const entry = { name: id };
    const modulePath = path.join(directory, 'type.js');
    const rendererPath = path.join(directory, 'renderer.js');
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
    validateSchema(screen.layout || {}, type.layoutSchema, `screens.${screenId}.layout`);
    for (const panel of screen.panels) {
      if (type.positionSchema) validateSchema(panel.position || {}, type.positionSchema, `Panel ${panel.id} position`);
      if (type.sizeSchema) validateSchema(panel.size || {}, type.sizeSchema, `Panel ${panel.id} size`);
    }
  }
  return types;
}
