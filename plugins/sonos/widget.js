import { escapeHtml, getPluginData, postPluginAction, schedule, title, unavailable } from '/widget-kit.js?v=0.13.0';

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const current = await context.data();
      const art = config.showArtwork!==false && current.artworkUrl ? `<img src="${escapeHtml(current.artworkUrl)}" alt="">` : '◉';
      element.innerHTML = `${title(config.title || 'Sonos', config.showDevice===false?'':current.device || '')}<div class="spotify-body"><div class="spotify-art">${art}</div><div class="spotify-copy"><strong>${escapeHtml(current.title || 'Nothing playing')}</strong><span>${escapeHtml([current.artist, current.album].filter(Boolean).join(' · ') || 'Sonos')}</span></div></div><div class="spotify-controls"><button data-action="previous" aria-label="Previous track">‹</button><button class="primary" data-action="toggle" aria-label="${current.playing ? 'Pause' : 'Play'}">${current.playing ? 'Ⅱ' : '▶'}</button><button data-action="next" aria-label="Next track">›</button></div>`;
      if(config.showArtwork===false)element.querySelector('.spotify-art')?.remove();
      if (!config.controllable || config.showControls === false) element.querySelector('.spotify-controls')?.remove();
      element.querySelectorAll('button[data-action]').forEach(button => button.onclick = async () => { button.disabled = true; try { await context.action(button.dataset.action); await load(); } finally { button.disabled = false; } });
    } catch (error) { unavailable(element, config.title || 'Sonos', error); }
  };
  context.schedule(load, (config.refreshSeconds || 30)*1000);
}
