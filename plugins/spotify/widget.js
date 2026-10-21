import { escapeHtml, getPluginData, postPluginAction, schedule, title, unavailable } from '/widget-kit.js?v=0.14.0';

export function mount({ element, config, context }) {
  let current = null;
  let savedTrack = null;
  let playbackUpdatedAt = 0;
  const updateProgress = () => {
    const bar = element.querySelector('.spotify-progress');
    if (!bar || !current) return;
    const elapsed = (current.progressMs || 0) + (current.playing ? Date.now() - playbackUpdatedAt : 0);
    const percent = current.durationMs > 0 ? Math.max(0, Math.min(100, elapsed / current.durationMs * 100)) : 0;
    bar.hidden = !(current.durationMs > 0);
    bar.setAttribute('aria-valuenow', String(Math.round(percent)));
    bar.firstElementChild.style.width = percent + '%';
  };
  const load = async () => {
    try {
      current = await context.data();
      playbackUpdatedAt = Date.now();
      const art = config.showArtwork!==false && current.artworkUrl ? `<img src="${escapeHtml(current.artworkUrl)}" alt="">` : '♪';
      element.innerHTML = `${title(config.title || 'Spotify', config.showDevice===false?'':current.device || '')}<div class="spotify-body"><div class="spotify-art">${art}</div><div class="spotify-copy"><strong>${escapeHtml(current.title || 'Nothing playing')}</strong><span>${escapeHtml([current.artist, current.album].filter(Boolean).join(' · ') || 'Spotify')}</span></div></div><div class="spotify-progress" role="progressbar" aria-label="Track progress" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="spotify-controls"><button data-action="like" aria-label="Add to liked songs" title="Add to liked songs">♡</button><button data-action="previous" aria-label="Previous track">‹</button><button class="primary" data-action="toggle" aria-label="${current.playing ? 'Pause' : 'Play'}">${current.playing ? 'Ⅱ' : '▶'}</button><button data-action="next" aria-label="Next track">›</button></div>`;
      if(config.showArtwork===false)element.querySelector('.spotify-art')?.remove();
      updateProgress();
      if (!config.controllable || config.showControls === false) element.querySelector('.spotify-controls')?.remove();
      const trackKey = JSON.stringify([current.title, current.artist, current.album]);
      const likeButton = element.querySelector('[data-action="like"]');
      if (likeButton && savedTrack === trackKey) {
        likeButton.textContent = '♥';
        likeButton.disabled = true;
        likeButton.setAttribute('aria-label', 'Added to liked songs');
        likeButton.title = 'Added to liked songs';
      }
      element.querySelectorAll('button[data-action]').forEach(button => button.onclick = async () => {
        button.disabled = true;
        try {
          await context.action(button.dataset.action);
          if (button.dataset.action === 'like') savedTrack = trackKey;
          await load();
        } catch (error) {
          button.title = error.message || 'Could not update Spotify';
          button.setAttribute('aria-label', button.title);
          button.disabled = false;
        }
      });
    } catch (error) { unavailable(element, config.title || 'Now playing', error); }
  };
  context.schedule(updateProgress, 1000);
  context.schedule(load, (config.refreshSeconds || 30)*1000);
}
