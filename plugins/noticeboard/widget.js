import { escapeHtml, title } from '/widget-kit.js?v=0.13.0';
import { activeNotices } from './assets/model.js';
export function mount({ element, config, context }) {
  let data = {notices:[]}, index = 0, error = '', paused = false;
  element.classList.add('noticeboard');
  const render = () => {
    const notices = activeNotices(data), notice = notices[index % Math.max(1,notices.length)];
    const old = element.querySelector('.notice-content'), scroll = old?.scrollTop || 0;
    element.innerHTML = `${title(config.title || 'Noticeboard', error ? 'Source unavailable' : data.demo ? 'Sample data' : '')}<article class="notice-content">${notice ? `<h2>${escapeHtml(notice.title)}</h2><div class="notice-body">${escapeHtml(notice.body)}</div>` : `<p>${escapeHtml(error || config.emptyText || 'No current notices')}</p>`}</article>${config.showControls !== false && notices.length > 1 ? `<nav aria-label="Notice controls" data-castboard-ui="local"><button type="button" data-step="-1" aria-label="Previous notice">Previous</button><span>${index % notices.length + 1} of ${notices.length}</span><button type="button" data-step="1" aria-label="Next notice">Next</button><button type="button" data-pause>${paused ? 'Resume' : 'Pause'}</button></nav>` : ''}`;
    element.querySelector('.notice-content').scrollTop = scroll;
    for (const button of element.querySelectorAll('[data-step]')) button.onclick = () => { index = (index + Number(button.dataset.step) + notices.length) % notices.length; render(); };
    element.querySelector('[data-pause]')?.addEventListener('click', () => { paused = !paused; render(); });
  };
  context.schedule(async () => { try { const next = await context.data(); activeNotices(next); data = next; error = ''; } catch { data = {notices:[]}; error = 'Notices unavailable. Check the source in Plugins; retrying automatically.'; } render(); }, (config.refreshSeconds || 60)*1000);
  // The scheduler calls immediately: use elapsed time to avoid skipping the first notice.
  let lastRotation = Date.now();
  context.schedule(() => { if (config.autoRotate !== false && !paused && Date.now() - lastRotation >= (config.rotationSeconds || 20)*1000) { index++; lastRotation = Date.now(); render(); } }, 1000);
}
