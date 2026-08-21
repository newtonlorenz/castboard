import { escapeHtml, getPluginData, schedule } from '/widget-kit.js';

export function mount({ element, config }) {
  let index = 0;
  let stories = [];
  const render = () => {
    const story = stories[index] || null;
    element.innerHTML = `<div class="news-label"><strong>${escapeHtml(config.title || 'Briefings')}</strong><span>${stories.length} stories ready</span></div><div class="news-story"><strong>${escapeHtml(story?.title || 'Waiting for the briefing desk')}</strong><span>${escapeHtml(story?.summary || 'Open the briefing screen for the full wire.')}</span></div><div class="news-dots">${stories.slice(0, 6).map((_, dot) => `<i class="${dot === index % Math.min(stories.length, 6) ? 'active' : ''}"></i>`).join('')}</div>`;
  };
  const load = async () => {
    const data = await getPluginData('news');
    stories = (data.stories || []).slice(0, config.maxStories || 40);
    index %= Math.max(1, stories.length);
    render();
  };
  schedule(() => load().catch(render), 60000);
  setInterval(() => { if (stories.length) { index = (index + 1) % stories.length; render(); } }, 12000);
}
