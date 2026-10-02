import { escapeHtml, getPluginData, schedule, unavailable } from '/widget-kit.js';

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const data = await context.data();
      element.innerHTML = `<div class="camera-head"><span>${escapeHtml(data.name || config.name || 'Camera')}</span><span>${escapeHtml(data.status || 'Live')}</span></div>${data.streamUrl ? `<img class="camera-frame" src="${escapeHtml(data.streamUrl)}?v=${Date.now()}" alt="${escapeHtml(data.name || 'Camera')} live feed">` : '<div class="camera-demo" aria-label="Camera demo placeholder"></div>'}`;
    } catch (error) { unavailable(element, config.title || 'Camera', error); }
  };
  context.schedule(load, 90000);
}
