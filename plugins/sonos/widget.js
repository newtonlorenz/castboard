import { escapeHtml, getPluginData, postPluginAction, schedule, title, unavailable } from '/widget-kit.js';

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const current = await context.data();
      const art = current.artworkUrl ? `<img src="${escapeHtml(current.artworkUrl)}" alt="">` : '◉';
      element.innerHTML = `${title(config.title || 'Sonos', current.device || '')}<div class="spotify-body"><div class="spotify-art">${art}</div><div class="spotify-copy"><strong>${escapeHtml(current.title || 'Nothing playing')}</strong><span>${escapeHtml([current.artist, current.album].filter(Boolean).join(' · ') || 'Sonos')}</span></div></div><div class="spotify-controls"><button data-action="previous" aria-label="Previous track">‹</button><button class="primary" data-action="toggle" aria-label="${current.playing ? 'Pause' : 'Play'}">${current.playing ? 'Ⅱ' : '▶'}</button><button data-action="next" aria-label="Next track">›</button></div>`;
      if (!config.controllable) element.querySelector('.spotify-controls')?.remove();
      element.querySelectorAll('button[data-action]').forEach(button => button.onclick = async () => { button.disabled = true; try { await context.action(button.dataset.action); await load(); } finally { button.disabled = false; } });
    } catch (error) { unavailable(element, config.title || 'Sonos', error); }
  };
  context.schedule(load, 30000);
}
