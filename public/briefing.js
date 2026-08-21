import { escapeHtml, getPluginData, markdownLite } from '/widget-kit.js';

const state = { all: [], visible: [], active: 0, category: 'All', playing: true, timer: null, seconds: 18 };
const byId = id => document.getElementById(id);

function current() { return state.visible[state.active] || null; }
function categories() { return ['All', ...new Set(state.all.map(story => story.category || 'News'))]; }

function applyCategory(category) {
  state.category = category;
  state.visible = category === 'All' ? state.all.slice() : state.all.filter(story => (story.category || 'News') === category);
  state.active = 0;
  render();
}

function render() {
  byId('briefing-categories').innerHTML = categories().map(category => `<button type="button" data-category="${escapeHtml(category)}" class="${category === state.category ? 'active' : ''}">${escapeHtml(category)} <small>${category === 'All' ? state.all.length : state.all.filter(story => (story.category || 'News') === category).length}</small></button>`).join('');
  byId('briefing-categories').querySelectorAll('button').forEach(button => button.onclick = () => applyCategory(button.dataset.category));
  const story = current();
  byId('briefing-count').textContent = `${state.visible.length} ${state.visible.length === 1 ? 'story' : 'stories'}`;
  byId('briefing-lead').innerHTML = story ? `<div class="lead-eyebrow"><span>${escapeHtml(story.source || 'Briefing desk')}</span><span>${escapeHtml(story.category || 'News')}</span></div><h1>${escapeHtml(story.title)}</h1><p>${escapeHtml(story.summary || story.body || '')}</p>` : '<div class="empty-state"><strong>No stories yet</strong><span>The configured news provider returned an empty desk.</span></div>';
  byId('briefing-list').innerHTML = state.visible.map((item, index) => `<button type="button" data-index="${index}" class="${index === state.active ? 'active' : ''}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.source || item.category || '')}</small></button>`).join('');
  byId('briefing-list').querySelectorAll('button').forEach(button => button.onclick = () => { state.active = Number(button.dataset.index); render(); });
  byId('briefing-ticker').innerHTML = state.all.map(item => `<span><b>${escapeHtml(item.source || 'Wire')}</b>${escapeHtml(item.title)}</span>`).join('') || 'Waiting for the briefing desk…';
  byId('briefing-play').textContent = state.playing ? 'Ⅱ' : '▶';
  schedule();
}

function step(delta) {
  if (!state.visible.length) return;
  state.active = (state.active + delta + state.visible.length) % state.visible.length;
  render();
}

function schedule() {
  clearTimeout(state.timer);
  const progress = byId('briefing-progress');
  progress.style.animation = 'none';
  void progress.offsetWidth;
  if (state.playing && state.visible.length > 1) {
    progress.style.animation = `briefing-progress ${state.seconds}s linear`;
    state.timer = setTimeout(() => step(1), state.seconds * 1000);
  }
}

function openReader() {
  const story = current();
  if (!story) return;
  byId('reader-source').textContent = `${story.source || 'Briefing desk'} · ${story.category || 'News'}`;
  byId('reader-title').textContent = story.title;
  byId('reader-body').innerHTML = markdownLite(story.body || story.summary || '');
  byId('reader-dialog').showModal();
}

async function boot() {
  const config = await (await fetch('/api/config')).json();
  const screen = config.screens.briefing || Object.values(config.screens).find(item => item.sourcePlugin);
  state.seconds = Number(screen?.rotationSeconds) || 18;
  byId('briefing-brand').textContent = config.branding.name || 'Castboard';
  document.documentElement.style.setProperty('--accent', config.branding.accent || '#8ee6c2');
  const updateClock = () => { byId('briefing-clock').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', weekday: 'short', timeZone: config.branding.timeZone }).format(new Date()); };
  updateClock(); setInterval(updateClock, 30000);
  const data = await getPluginData(screen?.sourcePlugin || 'news');
  state.all = Array.isArray(data.stories) ? data.stories : [];
  applyCategory('All');
  byId('briefing-prev').onclick = () => step(-1);
  byId('briefing-next').onclick = () => step(1);
  byId('briefing-play').onclick = () => { state.playing = !state.playing; render(); };
  byId('briefing-read').onclick = openReader;
  byId('reader-close').onclick = () => byId('reader-dialog').close();
  byId('reader-dialog').onclick = event => { if (event.target === byId('reader-dialog')) byId('reader-dialog').close(); };
}

boot().catch(error => { byId('briefing-lead').innerHTML = `<div class="empty-state"><strong>Briefing unavailable</strong><span>${escapeHtml(error.message)}</span></div>`; });
