import { escapeHtml, getPluginData, schedule, title, unavailable } from '/widget-kit.js?v=0.13.0';

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const data = await context.data();
      const score = Number(data.score);
      const color = score >= (config.goodThreshold ?? 67) ? 'var(--good)' : score >= (config.warningThreshold ?? 34) ? '#ffd77a' : 'var(--bad)';
      element.innerHTML = `${title(config.title || 'Recovery', data.status || '')}<div class="recovery-score" style="color:${color}">${Number.isFinite(score) ? score : '—'}<small>/ 100</small></div><div class="recovery-detail">${config.showDetail===false?'':escapeHtml(data.detail || 'No recovery detail')}</div>`;
    } catch (error) { unavailable(element, config.title || 'Recovery', error); }
  };
  context.schedule(load, (config.refreshSeconds || 600)*1000);
}
