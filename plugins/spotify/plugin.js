import path from 'node:path';
import { readJsonSource, validateProviderConfig } from '../../src/core/providers.js';
import { runCommand } from '../../src/core/command.js';

const ALLOWED_ACTIONS = new Map([
  ['previous', ['playback', 'previous']],
  ['toggle', ['playback', 'play-pause']],
  ['next', ['playback', 'next']],
  ['play', ['playback', 'play']],
  ['pause', ['playback', 'pause']],
]);

export function normalizeSpotifyPlayback(playback) {
  const item = playback?.item || playback?.track || null;
  const artists = item?.artists || item?.album?.artists || [];
  return {
    playing: playback?.is_playing === true,
    title: item?.name || 'Nothing playing',
    artist: artists.map(artist => artist?.name).filter(Boolean).join(', '),
    album: item?.album?.name || '',
    artworkUrl: item?.album?.images?.[0]?.url || item?.images?.[0]?.url || null,
    device: playback?.device?.name || 'Spotify',
    volume: playback?.device?.volume_percent ?? null,
    progressMs: playback?.progress_ms ?? null,
    durationMs: item?.duration_ms ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function cliArgs(config, context, args) {
  const prefix = [];
  if (config.configFolder) prefix.push('--config-folder', path.resolve(context.configDir, config.configFolder));
  if (config.cacheFolder) prefix.push('--cache-folder', path.resolve(context.configDir, config.cacheFolder));
  return [...prefix, ...args];
}

async function runSpotify(config, context, args) {
  const executable = process.env.SPOTIFY_PLAYER_BIN || config.executable || 'spotify_player';
  return runCommand(executable, cliArgs(config, context, args), {
    cwd: context.configDir,
    timeoutMs: config.timeoutMs || 15000,
    maxBytes: 1024 * 1024,
  });
}

export function createPlugin({ config, context }) {
  validateProviderConfig('spotify', config, ['demo', 'spotify-player', 'http-json', 'file-json']);
  const controllable = config.provider === 'demo' || config.provider === 'spotify-player';
  return {
    id: 'spotify',
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Spotify',
    publicConfig: () => ({ title: config.title || 'Spotify', controllable,showControls:config.showControls!==false }),
    async getData() {
      if (config.provider === 'demo') return normalizeSpotifyPlayback({
        is_playing: true,
        device: { name: config.deviceName || 'Local speakers', volume_percent: 34 },
        item: { name: 'A New Morning', artists: [{ name: 'The Castboard Ensemble' }], album: { name: 'Home Signals', images: [] }, duration_ms: 218000 },
        progress_ms: 74000,
      });
      if (config.provider === 'spotify-player') {
        const { stdout } = await runSpotify(config, context, ['get', 'key', 'playback']);
        let playback;
        try { playback = JSON.parse(stdout || 'null'); } catch { throw new Error('spotify_player returned invalid playback JSON'); }
        return normalizeSpotifyPlayback(playback);
      }
      return readJsonSource(config, context);
    },
    ...(controllable ? {
      async action(payload) {
        const args = ALLOWED_ACTIONS.get(String(payload?.action || ''));
        if (!args) throw new Error('Unsupported Spotify action');
        if (config.provider === 'spotify-player') await runSpotify(config, context, args);
        return { accepted: true, action: payload.action };
      },
    } : {}),
  };
}
