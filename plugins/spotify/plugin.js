import { demoTimestamp, fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

const ALLOWED_ACTIONS = new Set(['previous', 'toggle', 'next', 'play', 'pause']);

function normalizeSonos(data) {
  return {
    playing: data.playing ?? String(data.state || '').toLowerCase() === 'playing',
    title: data.title || data.track || data.currentTrack?.title || 'Nothing playing',
    artist: data.artist || data.currentTrack?.artist || '',
    album: data.album || data.currentTrack?.album || '',
    artworkUrl: data.artworkUrl || data.albumArtUrl || data.currentTrack?.albumArtUrl || null,
    device: data.speaker || data.room || data.device || 'Media',
    volume: data.volume ?? null,
    updatedAt: demoTimestamp(),
  };
}

export function createPlugin({ config, context }) {
  validateProviderConfig('spotify', config, ['demo', 'sonos-http', 'http-json', 'file-json']);
  if (config.provider === 'sonos-http' && !config.baseUrl) throw new Error('Plugin spotify sonos-http provider requires baseUrl');
  const controllable = config.provider === 'demo' || config.provider === 'sonos-http';
  const plugin = {
    id: 'spotify',
    name: 'Spotify / media',
    publicConfig: () => ({ title: config.title || 'Now playing', controllable }),
    async getData() {
      if (config.provider === 'demo') return { playing: true, title: 'A New Morning', artist: 'The Castboard Ensemble', album: 'Home Signals', artworkUrl: null, device: 'Living room', volume: 34, updatedAt: demoTimestamp() };
      if (config.provider === 'sonos-http') return normalizeSonos(await fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}${config.statusPath || '/api/sonos/status'}`, { headers: config.headers || {} }));
      return readJsonSource(config, context);
    },
  };
  if (controllable) plugin.action = async payload => {
    const action = String(payload?.action || '');
    if (!ALLOWED_ACTIONS.has(action)) throw new Error('Unsupported media action');
    if (config.provider === 'demo') return { accepted: true, action };
    const route = config.actions?.[action] || `/api/sonos/${action}`;
    const method = config.actionMethod || 'POST';
    return fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}${route}`, { method, headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...(config.headers || {}) }, body: method === 'GET' ? undefined : JSON.stringify({ action }) });
  };
  return plugin;
}
