#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/core/config.js';
import { discoverPlugins } from '../src/core/plugin-registry.js';
import { buildSetupReport } from '../src/core/setup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const loaded = loadConfig({ cwd: ROOT });
  const plugins = await discoverPlugins({ pluginsDir: path.join(ROOT, 'plugins'), config: loaded.config, context: { root: ROOT, configDir: loaded.configDir, logger: console } });
  const report = await buildSetupReport({ config: loaded.config, configPath: loaded.configPath, plugins });
  console.log(`Castboard doctor · ${report.config.sourceFileName}${report.config.usingExample ? ' (starter configuration)' : ''}`);
  console.log(`Local: ${report.urls.local}`);
  console.log(`LAN:   ${report.urls.lan || 'not detected'}`);
  console.log(`catt: ${report.tools.catt.installed ? report.tools.catt.version : `missing · ${report.tools.catt.install}`}`);
  console.log(`spotify_player: ${report.tools.spotifyPlayer.installed ? report.tools.spotifyPlayer.version : 'missing · install it for real Spotify playback'}`);
  console.log('\nScreens');
  for (const screen of report.screens) console.log(`  ${screen.id}: ${screen.targetCount} target(s) · ${screen.protocol} · ${screen.path}`);
  console.log('\nPlugins');
  for (const plugin of report.plugins) console.log(`  ${plugin.id}: ${plugin.label} · ${plugin.provider}${plugin.usedBy ? ` · used by ${plugin.usedBy} screen(s)` : ''}`);
  console.log(`\nInteractive setup: ${report.urls.local}/setup`);
}

main().catch(error => {
  console.error(`Castboard doctor failed: ${error.message}`);
  process.exitCode = 1;
});
