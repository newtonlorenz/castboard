import { demoTimestamp, fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

const ALLOWED_ACTIONS = new Set(['previous', 'toggle', 'next', 'play', 'pause']);

function normalizeSonos(data) {
  return {
    playing: data.playing ?? String(data.state || '').toLowerCase() === 'playing',
    title: data.title || data.track || data.currentTrack?.title || 'Nothing playing',
    artist: data.artist || data.currentTrack?.artist || '',
    album: data.album || data.currentTrack?.album || '',
    artworkUrl: data.artworkUrl || data.albumArtUrl || data.currentTrack?.albumArtUrl || null,
    device: data.speaker || data.room || data.device || 'Sonos',
    volume: data.volume ?? null,
    updatedAt: demoTimestamp(),
  };
}

export function createPlugin({ config, context }) {
  validateProviderConfig('sonos', config, ['demo', 'sonos-http', 'http-json', 'file-json']);
  if (config.provider === 'sonos-http' && !config.baseUrl) throw new Error('Plugin sonos sonos-http provider requires baseUrl');
  const controllable = config.provider === 'demo' || config.provider === 'sonos-http';
  return {
    id: 'sonos',
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Sonos',
    publicConfig: () => ({ title: config.title || 'Sonos', controllable }),
    async getData() {
      if (config.provider === 'demo') return normalizeSonos({ playing: true, title: 'Room Radio', artist: 'Castboard FM', album: 'Live', room: 'Kitchen', volume: 28 });
      if (config.provider === 'sonos-http') return normalizeSonos(await fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}${config.statusPath || '/api/sonos/status'}`, { headers: config.headers || {} }, config.timeoutMs || 8000));
      return readJsonSource(config, context);
    },
    ...(controllable ? {
      async action(payload) {
        const action = String(payload?.action || '');
        if (!ALLOWED_ACTIONS.has(action)) throw new Error('Unsupported Sonos action');
        if (config.provider === 'demo') return { accepted: true, action };
        const route = config.actions?.[action] || `/api/sonos/${action}`;
        const method = config.actionMethod || 'POST';
        return fetchJson(`${String(config.baseUrl).replace(/\/$/, '')}${route}`, { method, headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...(config.headers || {}) }, body: method === 'GET' ? undefined : JSON.stringify({ action }) });
      },
    } : {}),
  };
}
