import { escapeHtml, markdownLite, title } from '/widget-kit.js?v=0.13.0';

export function mount({ element, config, context }) {
  let index = 0, stories = [], category = 'All', playing = config.autoRotate !== false;
  let rotationTimer = null, readerOpen = false, error = '', readerStory = null, freshness = '';
  const view = ['compact', 'list', 'wire'].includes(config.view) ? config.view : 'compact';
  element.classList.add(`news-view-${view}`);
  element.innerHTML = '<div class="news-content"></div><dialog class="reader-dialog" data-castboard-ui="local"><article><header><h2></h2><button type="button" data-control="close">Close</button></header><div class="reader-body"></div></article></dialog>';
  const content = element.querySelector('.news-content'), dialog = element.querySelector('dialog');
  const visibleStories = () => category === 'All' ? stories : stories.filter(story => (story.category || 'News') === category);
  const current = () => visibleStories()[index] || null;
  const openReader = story => {
    if (!story) return;
    readerStory = story;
    clearTimeout(rotationTimer); readerOpen = true;
    dialog.querySelector('h2').textContent = story.title || 'Story';
    dialog.querySelector('.reader-body').innerHTML = markdownLite(story.body || story.summary || 'No full text supplied.');
    dialog.showModal();
  };
  const scheduleRotation = () => {
    clearTimeout(rotationTimer);
    if (!playing || readerOpen || visibleStories().length < 2 || view === 'list') return;
    rotationTimer = setTimeout(() => { index = (index + 1) % visibleStories().length; render(); }, (config.rotationSeconds || 18)*1000);
  };
  function render() {
    const visible = visibleStories(); index %= Math.max(1,visible.length);
    const story = current(), status = error ? 'Source unavailable' : freshness || `${stories.length} stories`;
    const empty = error ? 'Stories unavailable. Check the source in Plugins; retrying automatically.' : 'No stories match these source and content settings.';
    if (view === 'compact') {
      content.innerHTML = `<div class="news-label"><strong>${escapeHtml(config.title || 'Headlines')}</strong><span>${escapeHtml(status)}</span></div><div class="news-story"><strong>${escapeHtml(story?.title || empty)}</strong><span>${escapeHtml(config.showSummary === false ? '' : story?.summary || '')}</span></div><div class="news-dots">${visible.slice(0,6).map((_,dot)=>`<i class="${dot === index % 6 ? 'active' : ''}"></i>`).join('')}</div>`;
    } else if (view === 'list') {
      content.innerHTML = `${title(config.title || 'News', status)}<div class="news-panel-list" data-castboard-ui="local">${stories.length ? stories.map((item,i)=>`<button type="button" data-read="${i}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.source || item.category || '')}</small></button>`).join('') : `<p>${escapeHtml(empty)}</p>`}</div>`;
    } else {
      const categories = ['All', ...new Set(stories.map(item=>item.category || 'News'))];
      content.innerHTML = `<main class="briefing-shell" data-castboard-ui="local"><header class="briefing-masthead"><div><strong>${escapeHtml(config.title || 'News Reader')}</strong></div><time>${new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date())}</time></header>
        <nav class="briefing-categories" aria-label="Story categories">${categories.map(item=>`<button type="button" data-category="${escapeHtml(item)}" class="${item === category ? 'active' : ''}">${escapeHtml(item)}</button>`).join('')}</nav>
        <section class="briefing-layout"><article class="briefing-lead" aria-live="polite">${story ? `<div class="lead-eyebrow">${escapeHtml([story.source,story.category].filter(Boolean).join(' · '))}</div><h1>${escapeHtml(story.title)}</h1>${config.showSummary === false ? '' : `<p>${escapeHtml(story.summary || '')}</p>`}` : `<div class="empty-state">${escapeHtml(empty)}</div>`}</article>
        <aside class="briefing-wire"><header><strong>Headlines</strong><span>${escapeHtml(status)}</span></header><div class="briefing-list">${visible.map((item,i)=>`<button type="button" data-index="${i}" class="${i === index ? 'active' : ''}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.source || '')}</small></button>`).join('')}</div></aside></section>
        <footer class="briefing-footer"><div class="briefing-controls"><button type="button" data-control="read" ${story ? '' : 'disabled'}>Read</button><button type="button" data-step="-1" ${visible.length < 2 ? 'disabled' : ''}>Previous</button><button type="button" data-control="play" aria-label="${playing ? 'Pause' : 'Resume'} rotation">${playing ? 'Pause' : 'Resume'}</button><button type="button" data-step="1" ${visible.length < 2 ? 'disabled' : ''}>Next</button></div>${config.showTicker === false ? '' : `<div class="ticker-window"><div class="ticker-track">${stories.map(item=>`<span><b>${escapeHtml(item.source || 'News')}</b>${escapeHtml(item.title)}</span>`).join('')}</div></div>`}<div class="briefing-progress"></div></footer></main>`;
      const progress = content.querySelector('.briefing-progress');
      if (progress && playing && !readerOpen && visible.length > 1) progress.style.animation = `briefing-progress ${config.rotationSeconds || 18}s linear`;
    }
    scheduleRotation();
  }
  context.listen(content,'click',event=>{
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.read !== undefined) return openReader(stories[Number(button.dataset.read)]);
    if (button.dataset.category !== undefined) {category = button.dataset.category; index = 0;}
    if (button.dataset.index !== undefined) index = Number(button.dataset.index);
    if (button.dataset.step && visibleStories().length) index = (index + Number(button.dataset.step) + visibleStories().length) % visibleStories().length;
    if (button.dataset.control === 'read') return openReader(current());
    if (button.dataset.control === 'play') playing = !playing;
    render();
  });
  context.listen(dialog.querySelector('[data-control="close"]'),'click',()=>dialog.close());
  context.listen(dialog,'close',()=>{readerOpen = false; readerStory = null; scheduleRotation();});
  context.schedule(async()=>{
    try {
      const data = await context.data();
      if (!Array.isArray(data.stories)) throw new Error('News source must return stories');
      const selected = current(); stories = data.stories.slice(0,config.maxStories || 40); error = ''; freshness = data.stale ? 'Previous update' : data.failedFeeds ? 'Some sources unavailable' : '';
      if (data.stale) element.dataset.freshness = 'stale';
      if (!stories.some(item=>(item.category || 'News') === category)) category = 'All';
      const nextIndex = visibleStories().findIndex(item=>item.id && item.id === selected?.id || item.url && item.url === selected?.url);
      index = nextIndex < 0 ? index : nextIndex;
    } catch { stories = []; error = 'Source unavailable'; }
    render();
    // Reader text stays stable while an upstream refresh is in progress.
    if (readerOpen && readerStory) dialog.querySelector('h2').textContent = readerStory.title || 'Story';
  }, (config.refreshSeconds || 60)*1000);
  context.onDispose(()=>{clearTimeout(rotationTimer);if(dialog.open)dialog.close();});
}
