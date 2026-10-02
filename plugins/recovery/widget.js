import { escapeHtml, getPluginData, schedule, title, unavailable } from '/widget-kit.js';

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const data = await context.data();
      const score = Number(data.score);
      const color = score >= 67 ? 'var(--good)' : score >= 34 ? '#ffd77a' : 'var(--bad)';
      element.innerHTML = `${title(config.title || 'Recovery', data.status || '')}<div class="recovery-score" style="color:${color}">${Number.isFinite(score) ? score : '—'}<small>/ 100</small></div><div class="recovery-detail">${escapeHtml(data.detail || 'No recovery detail')}</div>`;
    } catch (error) { unavailable(element, config.title || 'Recovery', error); }
  };
  context.schedule(load, 10 * 60000);
}
