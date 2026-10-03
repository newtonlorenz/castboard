import { demoTimestamp, fetchJson, proxyStream, validateProviderConfig } from '../../src/core/providers.js';

export function createPlugin({ config,context }) {
  validateProviderConfig('camera', config, ['demo', 'stream', 'camera-service']);
  if (config.provider === 'stream' && !config.streamUrl) throw new Error('Plugin camera stream provider requires streamUrl');
  if (config.provider === 'camera-service' && !config.baseUrl) throw new Error('Plugin camera camera-service provider requires baseUrl');
  let selectedCamera = null;
  async function resolveCamera() {
    if (config.provider !== 'camera-service') return null;
    const base = String(config.baseUrl).replace(/\/$/, '');
    const payload = await fetchJson(`${base}${config.listPath || '/api/cameras'}`, { headers: config.headers || {} }, config.timeoutMs || 8000);
    const cameras = payload.cameras || payload.data || payload;
    const list = Array.isArray(cameras) ? cameras : [];
    selectedCamera = list.find(item => String(item.id) === String(config.preferredId)) || list[0];
    if (!selectedCamera) throw new Error('Camera service returned no cameras');
    return selectedCamera;
  }
  return {
    id: 'camera',
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Camera',
    publicConfig: () => ({ title: config.title || 'Camera', name: config.name || 'Camera' }),
    async getData() {
      if (config.provider === 'demo') return { name: config.name || 'Front garden', status: 'Demo', streamUrl: null, updatedAt: demoTimestamp() };
      if (config.provider === 'stream') return { name: config.name || 'Camera', status: 'Live', streamUrl: `/api/plugins/${encodeURIComponent(context.instanceId||'camera')}/stream`, updatedAt: demoTimestamp() };
      const camera = await resolveCamera();
      return { name: camera.name || config.name || 'Camera', status: camera.status || 'Live', streamUrl: `/api/plugins/${encodeURIComponent(context.instanceId||'camera')}/stream`, updatedAt: demoTimestamp() };
    },
    async stream(req, res) {
      let streamUrl = config.streamUrl;
      if (config.provider === 'camera-service') {
        const camera = selectedCamera || await resolveCamera();
        const base = String(config.baseUrl).replace(/\/$/, '');
        streamUrl = camera.streamUrl || `${base}${(config.streamPath || '/api/cameras/{id}/mjpeg').replace('{id}', encodeURIComponent(camera.id))}`;
      }
      if (!streamUrl) throw new Error('Camera stream URL is not configured');
      return proxyStream(streamUrl, req, res, { headers: config.headers || {}, timeoutMs: config.timeoutMs || 15000 });
    },
  };
}
