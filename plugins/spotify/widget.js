import { escapeHtml, getPluginData, postPluginAction, schedule, title, unavailable } from '/widget-kit.js';

export function mount({ element, config }) {
  let current = null;
  const load = async () => {
    try {
      current = await getPluginData('spotify');
      const art = current.artworkUrl ? `<img src="${escapeHtml(current.artworkUrl)}" alt="">` : '♪';
      element.innerHTML = `${title(config.title || 'Now playing', current.device || '')}<div class="spotify-body"><div class="spotify-art">${art}</div><div class="spotify-copy"><strong>${escapeHtml(current.title || 'Nothing playing')}</strong><span>${escapeHtml([current.artist, current.album].filter(Boolean).join(' · ') || 'Spotify / media')}</span></div></div><div class="spotify-controls"><button data-action="previous" aria-label="Previous track">‹</button><button class="primary" data-action="toggle" aria-label="${current.playing ? 'Pause' : 'Play'}">${current.playing ? 'Ⅱ' : '▶'}</button><button data-action="next" aria-label="Next track">›</button></div>`;
      element.querySelectorAll('button[data-action]').forEach(button => button.onclick = async () => { button.disabled = true; try { await postPluginAction('spotify', button.dataset.action); await load(); } finally { button.disabled = false; } });
    } catch (error) { unavailable(element, config.title || 'Now playing', error); }
  };
  schedule(load, 30000);
}
