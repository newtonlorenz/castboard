import os from 'node:os';
import path from 'node:path';
import { runCommand } from './command.js';

const PROVIDERS = {
  calendar: {
    demo: ['demo', 'Demo data', 'Choose ICS for a real calendar.'],
    ics: ['ready', 'Built in', 'Reads a private or public ICS feed directly.'],
    'http-json': ['adapter', 'JSON adapter', 'Your endpoint must return Castboard calendar JSON.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard calendar JSON.'],
  },
  camera: {
    demo: ['demo', 'Demo image', 'Choose Stream for an HTTP camera feed.'],
    stream: ['ready', 'Built in', 'Proxies an HTTP image or browser-compatible stream. RTSP requires a bridge.'],
    'camera-service': ['adapter', 'Camera bridge', 'Requires an external camera discovery and streaming service.'],
  },
  clock: { local: ['ready', 'Built in', 'Uses the display clock and needs no provider.'] },
  focus: { local: ['ready', 'Built in', 'Combines Calendar and Recovery; gracefully falls back when either is unavailable.'] },
  news: {
    demo: ['demo', 'Demo stories', 'Choose RSS for live public headlines.'],
    rss: ['ready', 'Built in', 'Aggregates RSS or Atom feeds; BBC public news feeds are included by default.'],
    'markdown-directory': ['ready', 'Built in', 'Turns local Markdown headings into stories.'],
    'http-json': ['adapter', 'JSON adapter', 'Your endpoint must return Castboard news JSON.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard news JSON.'],
  },
  recovery: {
    demo: ['demo', 'Demo score', 'A real health source needs a Castboard JSON adapter.'],
    'http-json': ['adapter', 'JSON adapter', 'Your endpoint must return Castboard recovery JSON.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard recovery JSON.'],
  },
  solar: {
    demo: ['demo', 'Demo energy', 'Choose Fronius for a supported local inverter.'],
    fronius: ['ready', 'Built in', 'Reads the Fronius Solar API directly over your LAN.'],
    'http-json': ['adapter', 'JSON adapter', 'Other inverter brands need a Castboard JSON adapter.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard solar JSON.'],
  },
  sonos: {
    demo: ['demo', 'Demo playback', 'Choose Sonos HTTP when you have a compatible bridge.'],
    'sonos-http': ['adapter', 'Sonos bridge', 'Requires a separate Sonos HTTP service; it is not used by Spotify.'],
    'http-json': ['adapter', 'JSON adapter', 'Read-only playback metadata from your endpoint.'],
    'file-json': ['adapter', 'JSON file', 'Read-only playback metadata from a file.'],
  },
  spotify: {
    demo: ['demo', 'Demo playback', 'Install spotify_player for real playback and local speakers.'],
    'spotify-player': ['ready', 'Spotify CLI', 'Uses spotify_player for metadata, controls, Spotify Connect, and local audio.'],
    'http-json': ['adapter', 'JSON adapter', 'Read-only playback metadata from your endpoint.'],
    'file-json': ['adapter', 'JSON file', 'Read-only playback metadata from a file.'],
  },
  stocks: {
    demo: ['demo', 'Demo portfolio', 'Choose Alpha Vantage for a configurable market watchlist.'],
    'alpha-vantage': ['ready', 'Free API key', 'Reads configured ticker quotes from Alpha Vantage. Free quotes are generally end-of-day.'],
    'http-json': ['adapter', 'JSON adapter', 'Your endpoint must return Castboard portfolio JSON.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard portfolio JSON.'],
  },
  weather: {
    demo: ['demo', 'Demo weather', 'Choose Open-Meteo for live weather without an API key.'],
    'open-meteo': ['ready', 'Built in', 'Only latitude and longitude are required.'],
    'http-json': ['adapter', 'JSON adapter', 'Your endpoint must return Castboard weather JSON.'],
    'file-json': ['adapter', 'JSON file', 'Your file must contain Castboard weather JSON.'],
  },
};

function lanAddress() {
  const addresses = Object.values(os.networkInterfaces()).flat().filter(item => item?.family === 'IPv4' && !item.internal);
  return addresses.find(item => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(item.address))?.address || addresses[0]?.address || null;
}

export async function executableStatus(executable, args = ['--version']) {
  try {
    const result = await runCommand(executable, args, { timeoutMs: 4000, maxBytes: 32 * 1024 });
    return { installed: true, version: (result.stdout || result.stderr || 'Installed').split(/\r?\n/)[0].slice(0, 160) };
  } catch (error) {
    return { installed: false, message: error.code === 'ENOENT' ? 'Not installed' : error.message.slice(0, 160) };
  }
}

export async function buildSetupReport({ config, configPath, plugins }) {
  const address = lanAddress();
  const port = config.server.port;
  const cattExecutable = process.env.CATT_BIN || config.casting?.protocols?.['google-cast']?.executable || 'catt';
  const spotifyExecutable = process.env.SPOTIFY_PLAYER_BIN || config.plugins?.spotify?.executable || 'spotify_player';
  const [catt, spotifyPlayer] = await Promise.all([
    executableStatus(cattExecutable),
    executableStatus(spotifyExecutable),
  ]);
  const installed = new Map(plugins.map(plugin => [plugin.id, plugin]));
  const pluginReports = Object.entries(config.plugins || {}).filter(([, value]) => value?.enabled !== false).map(([id, value]) => {
    const provider = value.provider || 'local';
    const [status, label, detail] = PROVIDERS[id]?.[provider] || ['custom', 'Custom plugin', 'Review this plugin’s documentation for setup details.'];
    const blockedByTool = id === 'spotify' && provider === 'spotify-player' && !spotifyPlayer.installed;
    return {
      id,
      name: installed.get(id)?.name || id,
      provider,
      status: blockedByTool ? 'blocked' : status,
      label: blockedByTool ? 'CLI missing' : label,
      detail: blockedByTool ? 'Install and authenticate spotify_player before testing this connection.' : detail,
      usedBy: Object.values(config.screens).filter(screen => screen.panels?.some(panel => panel.plugin === id)).length,
    };
  });
  const screens = Object.entries(config.screens).map(([id, screen]) => ({
    id,
    title: screen.title || id,
    path: screen.path,
    protocol: screen.castProtocol || config.casting?.defaultProtocol || 'google-cast',
    targetCount: screen.targets?.length || 0,
  }));
  return {
    config: {
      usingExample: path.basename(configPath) === 'castboard.config.example.json',
      sourceFileName: path.basename(configPath),
      fileName: path.basename(configPath) === 'castboard.config.example.json' ? 'castboard.config.json' : path.basename(configPath),
    },
    urls: { local: `http://localhost:${port}`, lan: config.server.publicUrl || (address ? `http://${address}:${port}` : null) },
    tools: {
      catt: { executable: cattExecutable, ...catt, install: 'pipx install catt' },
      spotifyPlayer: { executable: spotifyExecutable, ...spotifyPlayer, install: 'brew install spotify_player  # macOS\ncargo install spotify_player --locked  # cross-platform', authenticate: 'spotify_player authenticate', requiresPremium: true },
    },
    plugins: pluginReports,
    screens,
  };
}

export async function testPluginConnection(plugins, pluginId) {
  const plugin = plugins.find(item => item.id === pluginId);
  if (!plugin) throw Object.assign(new Error(`Plugin not found: ${pluginId}`), { statusCode: 404, code: 'PLUGIN_NOT_FOUND' });
  if (!plugin.getData) return { ok: true, pluginId, message: 'This plugin runs entirely in the browser.' };
  const started = Date.now();
  try {
    await plugin.getData();
    return { ok: true, pluginId, latencyMs: Date.now() - started, message: 'Provider responded successfully.' };
  } catch (error) {
    return { ok: false, pluginId, latencyMs: Date.now() - started, message: error.code === 'ENOENT' ? 'Required executable is not installed.' : String(error.message || 'Provider failed').slice(0, 200) };
  }
}

export async function discoverCastDevices(config) {
  const executable = process.env.CATT_BIN || config.casting?.protocols?.['google-cast']?.executable || 'catt';
  try {
    const { stdout } = await runCommand(executable, ['scan', '--json-output'], { timeoutMs: 12000, maxBytes: 128 * 1024 });
    let devices;
    try {
      devices = Object.values(JSON.parse(stdout || '{}')).map(device => ({
        name: device.friendly_name || 'Cast device',
        manufacturer: device.manufacturer || '',
        model: device.model_name || '',
      })).slice(0, 50);
    } catch {
      devices = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 50).map(name => ({ name, manufacturer: '', model: '' }));
    }
    return { ok: true, devices, message: devices.length ? `Found ${devices.length} Cast device${devices.length === 1 ? '' : 's'}.` : 'No Cast devices were found.' };
  } catch (error) {
    return { ok: false, devices: [], message: error.code === 'ENOENT' ? 'catt is not installed. Run: pipx install catt' : String(error.message).slice(0, 200) };
  }
}
