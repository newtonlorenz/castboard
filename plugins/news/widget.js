import { escapeHtml, getPluginData, markdownLite, schedule, title } from '/widget-kit.js';

export function mount({ element, config, context }) {
  let index = 0;
  let stories = [];
  let category = 'All';
  let playing = true;
  let rotationTimer = null;
  const view = ['compact', 'list', 'wire'].includes(config.view) ? config.view : 'compact';
  element.classList.add(`news-view-${view}`);

  const visibleStories = () => category === 'All' ? stories : stories.filter(story => (story.category || 'News') === category);
  const current = () => visibleStories()[index] || null;

  const scheduleRotation = () => {
    clearTimeout(rotationTimer);
    if (!playing || visibleStories().length < 2) return;
    rotationTimer = setTimeout(() => {
      index = (index + 1) % visibleStories().length;
      render();
    }, (Number(config.rotationSeconds) || 18) * 1000);
  };

  const renderCompact = () => {
    const story = stories[index] || null;
    const dotCount = Math.min(stories.length, 6);
    element.innerHTML = `<div class="news-label"><strong>${escapeHtml(config.title || 'Headlines')}</strong><span>${stories.length} stories ready</span></div><div class="news-story"><strong>${escapeHtml(story?.title || 'Waiting for the news desk')}</strong><span>${escapeHtml(story?.summary || 'No current story.')}</span></div><div class="news-dots">${stories.slice(0, dotCount).map((_, dot) => `<i class="${dotCount && dot === index % dotCount ? 'active' : ''}"></i>`).join('')}</div>`;
  };

  const renderList = () => {
    element.innerHTML = `${title(config.title || 'News', `${stories.length} stories`)}<div class="news-panel-list">${stories.map((story, storyIndex) => `<button type="button" data-index="${storyIndex}"><span>${escapeHtml(story.title)}</span><small>${escapeHtml(story.source || story.category || '')}</small></button>`).join('')}</div>`;
  };

  const renderWire = () => {
    const visible = visibleStories();
    index %= Math.max(1, visible.length);
    const story = current();
    const categories = ['All', ...new Set(stories.map(item => item.category || 'News'))];
    element.innerHTML = `<main class="briefing-shell">
      <header class="briefing-masthead"><div><span>${escapeHtml(config.title || 'News')}</span><strong>Wire</strong></div><time>${new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date())}</time></header>
      <nav class="briefing-categories" aria-label="Story categories">${categories.map(item => `<button type="button" data-category="${escapeHtml(item)}" class="${item === category ? 'active' : ''}">${escapeHtml(item)} <small>${item === 'All' ? stories.length : stories.filter(story => (story.category || 'News') === item).length}</small></button>`).join('')}</nav>
      <section class="briefing-layout"><article class="briefing-lead" aria-live="polite">${story ? `<div class="lead-eyebrow"><span>${escapeHtml(story.source || 'News desk')}</span><span>${escapeHtml(story.category || 'News')}</span></div><h1>${escapeHtml(story.title)}</h1><p>${escapeHtml(story.summary || story.body || '')}</p>` : '<div class="empty-state"><strong>No stories yet</strong><span>The news provider returned an empty desk.</span></div>'}</article>
      <aside class="briefing-wire"><header><strong>Headlines</strong><span>${visible.length} stories</span></header><div class="briefing-list">${visible.map((item, storyIndex) => `<button type="button" data-index="${storyIndex}" class="${storyIndex === index ? 'active' : ''}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.source || item.category || '')}</small></button>`).join('')}</div></aside></section>
      <footer class="briefing-footer"><div class="briefing-controls"><button type="button" data-control="read">Read</button><button type="button" data-control="previous" aria-label="Previous story">‹</button><button type="button" data-control="play" aria-label="${playing ? 'Pause' : 'Resume'} rotation">${playing ? 'Ⅱ' : '▶'}</button><button type="button" data-control="next" aria-label="Next story">›</button></div><div class="ticker-window"><div class="ticker-track">${stories.map(item => `<span><b>${escapeHtml(item.source || 'Wire')}</b>${escapeHtml(item.title)}</span>`).join('')}</div></div><div class="briefing-progress"></div></footer>
      <dialog class="reader-dialog"><article><header><div><span>${escapeHtml([story?.source, story?.category].filter(Boolean).join(' · '))}</span><h2>${escapeHtml(story?.title || '')}</h2></div><button type="button" data-control="close">Close</button></header><div class="reader-body">${markdownLite(story?.body || story?.summary || '')}</div></article></dialog>
    </main>`;
    element.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { category = button.dataset.category; index = 0; renderWire(); });
    element.querySelectorAll('[data-index]').forEach(button => button.onclick = () => { index = Number(button.dataset.index); renderWire(); });
    const step = delta => { if (visible.length) { index = (index + delta + visible.length) % visible.length; renderWire(); } };
    element.querySelector('[data-control="previous"]')?.addEventListener('click', () => step(-1));
    element.querySelector('[data-control="next"]')?.addEventListener('click', () => step(1));
    element.querySelector('[data-control="play"]')?.addEventListener('click', () => { playing = !playing; renderWire(); });
    const dialog = element.querySelector('dialog');
    element.querySelector('[data-control="read"]')?.addEventListener('click', () => dialog?.showModal());
    element.querySelector('[data-control="close"]')?.addEventListener('click', () => dialog?.close());
    const progress = element.querySelector('.briefing-progress');
    if (progress && playing && visible.length > 1) progress.style.animation = `briefing-progress ${Number(config.rotationSeconds) || 18}s linear`;
    scheduleRotation();
  };

  function render() {
    if (view === 'wire') renderWire();
    else if (view === 'list') renderList();
    else renderCompact();
  };
  const load = async () => {
    const data = await context.data();
    stories = (data.stories || []).slice(0, config.maxStories || 40);
    index %= Math.max(1, stories.length);
    render();
  };
  context.schedule(() => load().catch(render), 60000);
  context.onDispose(() => clearTimeout(rotationTimer));
  if (view === 'compact') context.schedule(() => { if (stories.length) { index = (index + 1) % stories.length; render(); } }, (Number(config.rotationSeconds) || 12) * 1000);
}
