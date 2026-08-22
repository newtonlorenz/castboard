const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));

const state = {
  revision: '',
  design: null,
  savedDesign: null,
  catalog: { plugins: [], screenTypes: [] },
  selectedScreenId: '',
  selectedPanelId: '',
  dirty: false,
  mode: 'design',
  viewport: { width: 1024, height: 600 },
  token: sessionStorage.getItem('castboard-admin-token') || '',
};

const glyphs = {
  calendar: '31', camera: '◎', clock: '12', focus: '→', news: 'N', recovery: '♥',
  solar: '☀', sonos: '◉', spotify: '♪', stocks: '↗', weather: '☁',
};

const FONT_STACKS = {
  sans: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"Avenir Next Rounded", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

const DESIGN_SHADOWS = {
  none: 'none',
  soft: '0 6px 18px rgba(0,0,0,.18)',
  deep: '0 16px 36px rgba(0,0,0,.44)',
};

const THEMES = {
  castboard: {
    fontFamily: 'sans', headingFontFamily: 'serif', fontScale: 100,
    background: '#07100f', panelBackground: '#192926', accent: '#8ee6c2',
    textColor: '#f3faf7', mutedColor: '#91a49e', borderColor: '#35423e',
    positiveColor: '#7ce5a4', negativeColor: '#ff8d8d', radius: 16,
    panelPadding: 12, borderWidth: 1, shadow: 'soft',
  },
  midnight: {
    fontFamily: 'sans', headingFontFamily: 'sans', fontScale: 100,
    background: '#080b18', panelBackground: '#151a2e', accent: '#8aa7ff',
    textColor: '#f4f6ff', mutedColor: '#939bbd', borderColor: '#303858',
    positiveColor: '#76e2bf', negativeColor: '#ff8ca3', radius: 12,
    panelPadding: 12, borderWidth: 1, shadow: 'deep',
  },
  paper: {
    fontFamily: 'sans', headingFontFamily: 'serif', fontScale: 105,
    background: '#e8e1d3', panelBackground: '#f8f3e9', accent: '#a74636',
    textColor: '#25241f', mutedColor: '#746f63', borderColor: '#c7bead',
    positiveColor: '#287a50', negativeColor: '#b23c35', radius: 8,
    panelPadding: 14, borderWidth: 1, shadow: 'soft',
  },
  terminal: {
    fontFamily: 'mono', headingFontFamily: 'mono', fontScale: 95,
    background: '#0d0a05', panelBackground: '#171108', accent: '#ffbd5b',
    textColor: '#ffe2a8', mutedColor: '#a88451', borderColor: '#4d3618',
    positiveColor: '#a9d66f', negativeColor: '#ff746c', radius: 2,
    panelPadding: 10, borderWidth: 1, shadow: 'none',
  },
  ocean: {
    fontFamily: 'rounded', headingFontFamily: 'sans', fontScale: 100,
    background: '#06141b', panelBackground: '#0d2932', accent: '#59d8e6',
    textColor: '#eefcff', mutedColor: '#82aab3', borderColor: '#244b54',
    positiveColor: '#69e2ae', negativeColor: '#ff8b94', radius: 20,
    panelPadding: 13, borderWidth: 1, shadow: 'soft',
  },
};

function currentScreen() {
  return state.design?.screens?.[state.selectedScreenId] || null;
}

function currentPanel() {
  return currentScreen()?.panels.find(panel => panel.id === state.selectedPanelId) || null;
}

function pluginName(id) {
  return state.catalog.plugins.find(plugin => plugin.id === id)?.name || id;
}

function typeName(id) {
  return state.catalog.screenTypes.find(type => type.id === id)?.name || id;
}

function setStatus(message, kind = '') {
  $('#save-status').textContent = message;
  $('.status-dot').className = `status-dot ${kind}`.trim();
}

let toastTimer;
function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 3200);
}

function markDirty(message = 'Unsaved design changes') {
  state.dirty = JSON.stringify(state.design) !== JSON.stringify(state.savedDesign);
  $('#save-design').disabled = !state.dirty;
  if (state.dirty) setStatus(message, 'dirty');
  else setStatus('Design is up to date', 'saved');
}

async function requestDesign(method = 'GET', payload) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (payload) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch('/api/admin/design', {
      method,
      headers,
      cache: 'no-store',
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = result.error?.code;
    error.revision = result.revision;
    throw error;
  }
  return result;
}

async function loadDesign() {
  setStatus('Loading design…');
  try {
    const result = await requestDesign();
    state.revision = result.revision;
    state.design = result.design;
    state.savedDesign = clone(result.design);
    state.catalog = result.catalog;
    state.selectedScreenId = state.design.screens[state.selectedScreenId] ? state.selectedScreenId : state.design.defaultScreen;
    state.selectedPanelId = '';
    state.dirty = false;
    populateCatalogControls();
    renderAll();
    setStatus('Design is up to date', 'saved');
    $('#save-design').disabled = true;
  } catch (error) {
    if (error.status === 403) {
      $('#token-error').textContent = '';
      if (!$('#token-dialog').open) $('#token-dialog').showModal();
      setStatus('Admin authorization required', 'error');
      return;
    }
    setStatus('Could not load design', 'error');
    toast(error.message, true);
  }
}

function populateCatalogControls() {
  for (const select of [$('#screen-type'), $('#new-screen-type')]) {
    select.replaceChildren(...state.catalog.screenTypes.map(type => {
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = type.name;
      return option;
    }));
  }
  $('#panel-plugin').replaceChildren(...state.catalog.plugins.map(plugin => {
    const option = document.createElement('option');
    option.value = plugin.id;
    option.textContent = plugin.name;
    return option;
  }));
}

function renderAll() {
  renderScreens();
  renderBranding();
  renderInspector();
  renderPluginLibrary();
  renderCanvas();
  updateOpenScreen();
}

function renderScreens() {
  const list = $('#screen-list');
  list.replaceChildren();
  for (const [id, screen] of Object.entries(state.design.screens)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `screen-item${id === state.selectedScreenId ? ' active' : ''}`;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-pressed', String(id === state.selectedScreenId));

    const icon = document.createElement('span');
    icon.className = 'screen-icon';
    icon.textContent = screen.type === 'single' ? '▣' : screen.type === 'flow' ? '▦' : '▥';
    const copy = document.createElement('span');
    copy.className = 'screen-copy';
    const title = document.createElement('strong');
    title.textContent = screen.title || id;
    const meta = document.createElement('small');
    meta.textContent = `${typeName(screen.type)} · ${screen.panels.length} panel${screen.panels.length === 1 ? '' : 's'}`;
    copy.append(title, meta);
    button.append(icon, copy);
    if (id === state.design.defaultScreen) {
      const badge = document.createElement('span');
      badge.className = 'default-pill';
      badge.textContent = 'Default';
      button.append(badge);
    }
    button.addEventListener('click', () => selectScreen(id));
    list.append(button);
  }
}

function renderBranding() {
  const branding = state.design.branding || {};
  for (const input of $$('[data-branding]')) input.value = branding[input.dataset.branding] || '';
  const accent = branding.accent || '#8ee6c2';
  $('#brand-accent').value = normalizeColor(accent, '#8ee6c2');
  $('#brand-accent-value').textContent = accent;
  document.documentElement.style.setProperty('--accent', accent);
}

function normalizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function setInput(selector, value) {
  const input = $(selector);
  if (input) input.value = value ?? '';
}

function renderInspector() {
  const screen = currentScreen();
  if (!screen) return;
  setInput('#screen-title', screen.title);
  setInput('#screen-path', screen.path);
  setInput('#screen-type', screen.type);

  $('#grid-layout-fields').hidden = screen.type !== 'grid';
  $('#flow-layout-fields').hidden = screen.type !== 'flow';
  $('#single-layout-fields').hidden = screen.type !== 'single';
  $('#custom-layout-fields').hidden = ['grid', 'flow', 'single'].includes(screen.type);
  for (const input of $$('[data-layout]')) input.value = screen.layout?.[input.dataset.layout] ?? '';
  $('#custom-layout').value = JSON.stringify(screen.layout || {}, null, 2);
  $('#custom-layout-error').textContent = '';

  const appearance = screen.appearance || {};
  const fallbacks = {
    background: '#07100f',
    accent: normalizeColor(state.design.branding?.accent, '#8ee6c2'),
    panelBackground: '#192926',
    textColor: '#f3faf7',
    mutedColor: '#91a49e',
    positiveColor: '#7ce5a4',
    negativeColor: '#ff8d8d',
    borderColor: '#35423e',
  };
  for (const input of $$('[data-appearance]')) {
    const field = input.dataset.appearance;
    input.value = input.type === 'color' ? normalizeColor(appearance[field], fallbacks[field]) : appearance[field] ?? '';
    const output = input.closest('.color-field')?.querySelector('output');
    if (output) output.textContent = appearance[field] || `Inherited · ${input.value}`;
  }
  $('#theme-preset').value = matchingTheme(appearance);
  $('#set-default').disabled = state.selectedScreenId === state.design.defaultScreen;

  renderPanelInspector();
}

function renderPanelInspector() {
  const screen = currentScreen();
  const panel = currentPanel();
  $('#panel-empty').hidden = Boolean(panel);
  $('#panel-fields').hidden = !panel;
  if (!panel || !screen) return;

  setInput('#panel-id', panel.id);
  setInput('#panel-plugin', panel.plugin);
  setInput('#panel-title', panel.options?.title || '');
  setInput('#panel-view', panel.options?.view || '');
  $('#panel-fit-content').checked = panel.options?.fitContent === true;
  $('#panel-options').value = JSON.stringify(panel.options || {}, null, 2);
  $('#options-error').textContent = '';

  $('#panel-geometry').hidden = screen.type === 'single';
  $('#grid-panel-fields').hidden = screen.type !== 'grid';
  $('#flow-panel-fields').hidden = screen.type !== 'flow';
  $('#flow-order').hidden = screen.type !== 'flow';
  $('#custom-panel-fields').hidden = ['grid', 'flow', 'single'].includes(screen.type);
  for (const input of $$('[data-position]')) input.value = panel.position?.[input.dataset.position] ?? '';
  for (const input of $$('[data-size]')) input.value = panel.size?.[input.dataset.size] ?? 1;
  $('#custom-position').value = JSON.stringify(panel.position || {}, null, 2);
  $('#custom-size').value = JSON.stringify(panel.size || {}, null, 2);
  $('#custom-panel-error').textContent = '';
  renderPanelAppearance(panel, screen);
  const index = screen.panels.indexOf(panel);
  $('#panel-earlier').disabled = index <= 0;
  $('#panel-later').disabled = index === screen.panels.length - 1;
}

function matchingTheme(appearance) {
  if (!Object.keys(appearance).length) return 'inherit';
  for (const [id, theme] of Object.entries(THEMES)) {
    if (Object.keys(theme).every(field => appearance[field] === theme[field])) return id;
  }
  return 'custom';
}

function effectiveScreenAppearance(screen) {
  return { ...THEMES.castboard, accent: state.design.branding?.accent || THEMES.castboard.accent, ...(screen.appearance || {}) };
}

function renderPanelAppearance(panel, screen) {
  const appearance = panel.appearance || {};
  const inherited = effectiveScreenAppearance(screen);
  const colorFallbacks = {
    background: inherited.panelBackground,
    accent: inherited.accent,
    textColor: inherited.textColor,
    mutedColor: inherited.mutedColor,
    borderColor: inherited.borderColor,
    positiveColor: inherited.positiveColor,
    negativeColor: inherited.negativeColor,
  };
  for (const input of $$('[data-panel-appearance]')) {
    const field = input.dataset.panelAppearance;
    if (input.type === 'color') {
      input.value = normalizeColor(appearance[field], colorFallbacks[field]);
      const wrapper = input.closest('.color-field');
      wrapper.classList.toggle('inherited', appearance[field] === undefined);
      wrapper.querySelector('output').textContent = appearance[field] || `Inherit · ${input.value}`;
    } else {
      input.value = appearance[field] ?? '';
    }
  }
}

function renderPluginLibrary() {
  const list = $('#plugin-list');
  const screen = currentScreen();
  list.replaceChildren();
  for (const plugin of state.catalog.plugins) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plugin-card';
    button.disabled = screen?.type === 'single' && screen.panels.length >= 1;
    button.title = button.disabled ? 'Single-panel screens can contain only one panel' : `Add ${plugin.name}`;
    const glyph = document.createElement('span');
    glyph.textContent = glyphs[plugin.id] || plugin.id.slice(0, 2);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = plugin.name;
    const action = document.createElement('small');
    action.textContent = '+ Add panel';
    copy.append(name, action);
    button.append(glyph, copy);
    button.addEventListener('click', () => addPanel(plugin.id));
    list.append(button);
  }
}

function canvasLayout(screen) {
  if (screen.type === 'flow') return { minPanelWidth: 240, minPanelHeight: 140, gap: 8, padding: 8, ...screen.layout };
  if (screen.type === 'single') return { padding: 8, ...screen.layout };
  return { columns: 12, rows: 8, gap: 8, padding: 8, ...screen.layout };
}

function renderCanvas() {
  const screen = currentScreen();
  const surface = $('#design-surface');
  if (!screen) {
    surface.replaceChildren();
    return;
  }
  const layout = canvasLayout(screen);
  const screenAppearance = effectiveScreenAppearance(screen);
  surface.className = `design-surface ${screen.type}`;
  surface.replaceChildren();
  surface.style.setProperty('--design-padding', `${layout.padding ?? 8}px`);
  surface.style.setProperty('--design-gap', `${layout.gap ?? 8}px`);
  surface.style.setProperty('--design-background', screenAppearance.background);
  surface.style.setProperty('--design-accent', screenAppearance.accent);
  surface.style.setProperty('--design-text', screenAppearance.textColor);
  surface.style.setProperty('--design-muted', screenAppearance.mutedColor);
  surface.style.setProperty('--design-border', screenAppearance.borderColor);
  surface.style.setProperty('--design-panel', screenAppearance.panelBackground);
  surface.style.setProperty('--design-radius', `${screenAppearance.radius}px`);
  surface.style.setProperty('--design-panel-padding', `${screenAppearance.panelPadding}px`);
  surface.style.setProperty('--design-border-width', `${screenAppearance.borderWidth}px`);
  surface.style.setProperty('--design-shadow', DESIGN_SHADOWS[screenAppearance.shadow]);
  surface.style.setProperty('--design-font-family', FONT_STACKS[screenAppearance.fontFamily] || FONT_STACKS.sans);

  if (screen.type === 'grid') {
    surface.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
    surface.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0, 1fr))`;
    surface.style.gridAutoRows = '';
  } else if (screen.type === 'flow') {
    const scaledMinWidth = Math.max(80, (layout.minPanelWidth / state.viewport.width) * $('#canvas-frame').clientWidth);
    const scaledMinHeight = Math.max(55, (layout.minPanelHeight / state.viewport.height) * $('#canvas-frame').clientHeight);
    surface.style.gridTemplateColumns = `repeat(auto-fit, minmax(min(100%, ${scaledMinWidth}px), 1fr))`;
    surface.style.gridTemplateRows = 'none';
    surface.style.gridAutoRows = `minmax(${scaledMinHeight}px, 1fr)`;
  } else if (screen.type === 'single') {
    surface.style.gridTemplateColumns = '';
    surface.style.gridTemplateRows = '';
    surface.style.gridAutoRows = '';
  } else {
    surface.style.gridTemplateColumns = '1fr';
    surface.style.gridTemplateRows = 'none';
    surface.style.gridAutoRows = 'minmax(64px, 1fr)';
  }

  const collisionIds = screen.type === 'grid' ? findCollisions(screen.panels) : new Set();
  for (const panel of screen.panels) {
    const element = document.createElement('div');
    element.className = `canvas-panel${panel.id === state.selectedPanelId ? ' selected' : ''}${collisionIds.has(panel.id) ? ' collision' : ''}`;
    element.tabIndex = 0;
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `${pluginName(panel.plugin)} panel ${panel.id}`);
    element.dataset.panel = panel.id;
    applyCanvasPanelAppearance(element, panel, screenAppearance);
    placeCanvasPanel(element, panel, screen);

    const copy = document.createElement('span');
    copy.className = 'canvas-panel-copy';
    const title = document.createElement('strong');
    title.textContent = panel.options?.title || pluginName(panel.plugin);
    const meta = document.createElement('span');
    meta.textContent = panel.id;
    copy.append(title, meta);
    const glyph = document.createElement('span');
    glyph.className = 'panel-glyph';
    glyph.textContent = glyphs[panel.plugin] || panel.plugin.slice(0, 2).toUpperCase();
    element.append(copy, glyph);
    if (screen.type === 'grid') {
      const handle = document.createElement('span');
      handle.className = 'resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      element.append(handle);
      element.addEventListener('pointerdown', event => beginPanelDrag(event, panel, element));
    }
    element.addEventListener('click', () => selectPanel(panel.id));
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPanel(panel.id); }
    });
    surface.append(element);
  }
  $('#canvas-message').textContent = collisionIds.size
    ? `${collisionIds.size} overlapping panels are outlined in red. Adjust them before deployment.`
    : screen.type === 'grid'
      ? 'Select a panel to edit it. Drag panels or their lower-right handle to resize.'
      : screen.type === 'flow'
        ? 'Flow panels reflow automatically. Select a panel to change its span or order.'
        : screen.type === 'single'
          ? 'Single screens give the selected plugin the entire viewport.'
          : 'Custom screen type · edit its layout and panel JSON, then use Live preview for the renderer output.';
  updatePreview();
}

function applyCanvasPanelAppearance(element, panel, screenAppearance) {
  const appearance = panel.appearance || {};
  element.style.setProperty('--design-font-size', `${16 * (screenAppearance.fontScale / 100) * ((appearance.fontScale || 100) / 100)}px`);
  element.style.setProperty('--design-font-family', FONT_STACKS[appearance.fontFamily] || FONT_STACKS[screenAppearance.fontFamily] || FONT_STACKS.sans);
  if (appearance.background) element.style.setProperty('--design-panel', appearance.background);
  if (appearance.accent) element.style.setProperty('--design-accent', appearance.accent);
  if (appearance.textColor) element.style.setProperty('--design-text', appearance.textColor);
  if (appearance.mutedColor) element.style.setProperty('--design-muted', appearance.mutedColor);
  if (appearance.borderColor) element.style.setProperty('--design-border', appearance.borderColor);
  if (appearance.radius !== undefined) element.style.setProperty('--design-radius', `${appearance.radius}px`);
  if (appearance.padding !== undefined) element.style.setProperty('--design-panel-padding', `${appearance.padding}px`);
  if (appearance.borderWidth !== undefined) element.style.setProperty('--design-border-width', `${appearance.borderWidth}px`);
  if (appearance.shadow) element.style.setProperty('--design-shadow', DESIGN_SHADOWS[appearance.shadow]);
}

function placeCanvasPanel(element, panel, screen) {
  if (screen.type === 'grid') {
    const position = panel.position || { column: 1, row: 1, width: 1, height: 1 };
    element.style.gridColumn = `${position.column} / span ${position.width}`;
    element.style.gridRow = `${position.row} / span ${position.height}`;
  } else if (screen.type === 'flow') {
    element.style.gridColumn = `span ${panel.size?.columns || 1}`;
    element.style.gridRow = `span ${panel.size?.rows || 1}`;
  } else if (screen.type === 'single') {
    element.style.width = '100%';
    element.style.height = '100%';
  }
}

function findCollisions(panels) {
  const hits = new Set();
  for (let a = 0; a < panels.length; a += 1) {
    const left = panels[a].position;
    if (!left) continue;
    for (let b = a + 1; b < panels.length; b += 1) {
      const right = panels[b].position;
      if (!right) continue;
      const overlaps = left.column < right.column + right.width && left.column + left.width > right.column
        && left.row < right.row + right.height && left.row + left.height > right.row;
      if (overlaps) { hits.add(panels[a].id); hits.add(panels[b].id); }
    }
  }
  return hits;
}

function beginPanelDrag(event, panel, element) {
  if (event.button !== 0) return;
  event.preventDefault();
  selectPanel(panel.id, false);
  const screen = currentScreen();
  const layout = canvasLayout(screen);
  const surface = $('#design-surface');
  const rect = surface.getBoundingClientRect();
  const position = panel.position || { column: 1, row: 1, width: 1, height: 1 };
  panel.position = { ...position };
  const start = { x: event.clientX, y: event.clientY, position: { ...panel.position } };
  const resize = event.target.classList.contains('resize-handle');
  const usableWidth = rect.width - (layout.padding * 2) - (layout.gap * (layout.columns - 1));
  const usableHeight = rect.height - (layout.padding * 2) - (layout.gap * (layout.rows - 1));
  const cellWidth = usableWidth / layout.columns + layout.gap;
  const cellHeight = usableHeight / layout.rows + layout.gap;
  let changed = false;
  element.setPointerCapture(event.pointerId);

  const move = moveEvent => {
    const dx = Math.round((moveEvent.clientX - start.x) / cellWidth);
    const dy = Math.round((moveEvent.clientY - start.y) / cellHeight);
    if (resize) {
      panel.position.width = clamp(start.position.width + dx, 1, layout.columns - start.position.column + 1);
      panel.position.height = clamp(start.position.height + dy, 1, layout.rows - start.position.row + 1);
    } else {
      panel.position.column = clamp(start.position.column + dx, 1, layout.columns - start.position.width + 1);
      panel.position.row = clamp(start.position.row + dy, 1, layout.rows - start.position.height + 1);
    }
    changed ||= dx !== 0 || dy !== 0;
    placeCanvasPanel(element, panel, screen);
  };
  const end = () => {
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', end);
    element.removeEventListener('pointercancel', end);
    if (changed) {
      markDirty(resize ? 'Panel resized · unsaved' : 'Panel moved · unsaved');
      renderCanvas();
      renderPanelInspector();
    }
  };
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function selectScreen(id) {
  state.selectedScreenId = id;
  state.selectedPanelId = '';
  setInspectorTab('screen');
  renderAll();
}

function selectPanel(id, rerender = true) {
  state.selectedPanelId = id;
  setInspectorTab('panel');
  if (rerender) {
    renderCanvas();
    renderPanelInspector();
  }
}

function setInspectorTab(tab) {
  for (const button of $$('.inspector-tabs [data-inspector]')) button.classList.toggle('active', button.dataset.inspector === tab);
  $('#screen-inspector').hidden = tab !== 'screen';
  $('#panel-inspector').hidden = tab !== 'panel';
}

function setMode(mode) {
  state.mode = mode;
  for (const button of $$('[data-mode]')) button.classList.toggle('active', button.dataset.mode === mode);
  $('#canvas-frame').classList.toggle('preview', mode === 'preview');
  if (mode === 'preview') refreshPreview();
}

function updatePreview() {
  const screen = state.savedDesign?.screens?.[state.selectedScreenId];
  const iframe = $('#live-preview');
  if (!screen) {
    iframe.dataset.path = '';
    iframe.removeAttribute('src');
    return;
  }
  if (iframe.dataset.path !== screen.path) {
    iframe.dataset.path = screen.path;
    iframe.src = screen.path;
  }
}

function refreshPreview() {
  const screen = state.savedDesign?.screens?.[state.selectedScreenId];
  if (!screen) return;
  const path = screen.path || '/';
  $('#live-preview').dataset.path = path;
  $('#live-preview').src = `${path}${path.includes('?') ? '&' : '?'}studio=${Date.now()}`;
}

function updateOpenScreen() {
  $('#open-screen').disabled = !state.savedDesign?.screens?.[state.selectedScreenId]?.path;
}

function resizeCanvasFrame() {
  const stage = $('#canvas-stage');
  const frame = $('#canvas-frame');
  if (!stage || !frame) return;
  const availableWidth = Math.max(100, stage.clientWidth - 60);
  const availableHeight = Math.max(80, stage.clientHeight - 52);
  const ratio = state.viewport.width / state.viewport.height;
  let width = Math.min(availableWidth, availableHeight * ratio);
  let height = width / ratio;
  if (height > availableHeight) { height = availableHeight; width = height * ratio; }
  frame.style.width = `${Math.round(width)}px`;
  frame.style.height = `${Math.round(height)}px`;
  frame.style.aspectRatio = `${state.viewport.width} / ${state.viewport.height}`;
  const scale = Math.min(frame.clientWidth / state.viewport.width, frame.clientHeight / state.viewport.height);
  const iframe = $('#live-preview');
  iframe.style.width = `${state.viewport.width}px`;
  iframe.style.height = `${state.viewport.height}px`;
  iframe.style.transform = `scale(${scale})`;
  $('#canvas-scale').textContent = `${Math.round(scale * 100)}%`;
  if (state.design) renderCanvas();
}

function uniquePanelId(plugin, panels) {
  const ids = new Set(panels.map(panel => panel.id));
  if (!ids.has(plugin)) return plugin;
  let index = 2;
  while (ids.has(`${plugin}-${index}`)) index += 1;
  return `${plugin}-${index}`;
}

function findGridSlot(screen, width = 3, height = 2) {
  const layout = canvasLayout(screen);
  width = Math.min(width, layout.columns);
  height = Math.min(height, layout.rows);
  for (let row = 1; row <= layout.rows - height + 1; row += 1) {
    for (let column = 1; column <= layout.columns - width + 1; column += 1) {
      const candidate = { column, row, width, height };
      const collision = screen.panels.some(panel => {
        const other = panel.position;
        return other && candidate.column < other.column + other.width && candidate.column + candidate.width > other.column
          && candidate.row < other.row + other.height && candidate.row + candidate.height > other.row;
      });
      if (!collision) return candidate;
    }
  }
  return { column: 1, row: 1, width, height };
}

function addPanel(plugin) {
  const screen = currentScreen();
  if (!screen || (screen.type === 'single' && screen.panels.length)) return;
  const panel = { id: uniquePanelId(plugin, screen.panels), plugin };
  if (screen.type === 'grid') panel.position = findGridSlot(screen);
  if (screen.type === 'flow') panel.size = { columns: 1, rows: 1 };
  screen.panels.push(panel);
  state.selectedPanelId = panel.id;
  markDirty(`${pluginName(plugin)} panel added · unsaved`);
  setInspectorTab('panel');
  renderAll();
}

function removePanel() {
  const screen = currentScreen();
  const index = screen?.panels.findIndex(panel => panel.id === state.selectedPanelId) ?? -1;
  if (index < 0) return;
  screen.panels.splice(index, 1);
  state.selectedPanelId = '';
  markDirty('Panel removed · unsaved');
  setInspectorTab('screen');
  renderAll();
}

function movePanel(offset) {
  const screen = currentScreen();
  const index = screen.panels.findIndex(panel => panel.id === state.selectedPanelId);
  const destination = clamp(index + offset, 0, screen.panels.length - 1);
  if (index < 0 || destination === index) return;
  const [panel] = screen.panels.splice(index, 1);
  screen.panels.splice(destination, 0, panel);
  markDirty('Panel order changed · unsaved');
  renderCanvas();
  renderPanelInspector();
}

function defaultLayout(type) {
  if (type === 'flow') return { minPanelWidth: 240, minPanelHeight: 140, gap: 8, padding: 8 };
  if (type === 'single') return { padding: 8 };
  if (type === 'grid') return { columns: 12, rows: 8, gap: 8, padding: 8 };
  return {};
}

function applyTheme(themeId) {
  if (!THEMES[themeId]) return;
  currentScreen().appearance = clone(THEMES[themeId]);
  markDirty(`${$('#theme-preset').selectedOptions[0].textContent} theme applied · unsaved`);
  renderInspector();
  renderCanvas();
}

function resetTheme() {
  currentScreen().appearance = {};
  markDirty('Screen now inherits project defaults · unsaved');
  renderInspector();
  renderCanvas();
}

function changeScreenType(type) {
  const screen = currentScreen();
  if (type === screen.type) return;
  if (type === 'single' && screen.panels.length > 1) {
    toast('A single screen can contain only one panel. Remove the others first.', true);
    $('#screen-type').value = screen.type;
    return;
  }
  screen.type = type;
  screen.layout = defaultLayout(type);
  if (type === 'grid') {
    for (const panel of screen.panels) panel.position ||= findGridSlot(screen);
  }
  if (type === 'flow') {
    for (const panel of screen.panels) panel.size ||= { columns: 1, rows: 1 };
  }
  markDirty('Screen type changed · unsaved');
  renderAll();
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'screen';
}

function uniqueScreenId(seed) {
  let id = slugify(seed);
  let index = 2;
  while (state.design.screens[id]) { id = `${slugify(seed)}-${index}`; index += 1; }
  return id;
}

function showNewScreenDialog() {
  state.generatedScreenFields = true;
  $('#screen-form').reset();
  $('#new-screen-title').value = 'New screen';
  $('#new-screen-id').value = uniqueScreenId('new-screen');
  $('#new-screen-path').value = `/${$('#new-screen-id').value}`;
  $('#new-screen-type').value = state.catalog.screenTypes.some(type => type.id === 'grid') ? 'grid' : state.catalog.screenTypes[0]?.id;
  $('#screen-dialog').showModal();
  $('#new-screen-title').select();
}

function createScreenFromDialog() {
  const id = $('#new-screen-id').value.trim();
  const title = $('#new-screen-title').value.trim();
  const path = $('#new-screen-path').value.trim();
  const type = $('#new-screen-type').value;
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return toast('Screen ID must use lowercase letters, numbers, and hyphens.', true);
  if (state.design.screens[id]) return toast(`Screen ID “${id}” already exists.`, true);
  if (!path.startsWith('/')) return toast('Screen path must start with /.', true);
  if (Object.values(state.design.screens).some(screen => screen.path === path)) return toast(`Screen path “${path}” is already in use.`, true);
  state.design.screens[id] = { id, title: title || id, path, type, layout: defaultLayout(type), appearance: {}, panels: [] };
  state.selectedScreenId = id;
  state.selectedPanelId = '';
  markDirty('Screen created · add a panel and save');
  $('#screen-dialog').close();
  renderAll();
}

function duplicateScreen() {
  const source = currentScreen();
  if (!source) return;
  const id = uniqueScreenId(`${state.selectedScreenId}-copy`);
  const copy = clone(source);
  copy.id = id;
  copy.title = `${source.title || state.selectedScreenId} copy`;
  copy.path = source.path === '/' ? `/${id}` : `${source.path}-${id.split('-').at(-1)}`;
  while (Object.values(state.design.screens).some(screen => screen.path === copy.path)) copy.path += '-copy';
  state.design.screens[id] = copy;
  state.selectedScreenId = id;
  state.selectedPanelId = '';
  markDirty('Screen duplicated without delivery targets · unsaved');
  renderAll();
}

function deleteScreen() {
  const ids = Object.keys(state.design.screens);
  if (ids.length <= 1) return toast('A Castboard project must keep at least one screen.', true);
  const screen = currentScreen();
  if (!confirm(`Delete “${screen.title || state.selectedScreenId}”? Its private delivery settings will also be removed when you save.`)) return;
  const deletedId = state.selectedScreenId;
  delete state.design.screens[deletedId];
  if (state.design.defaultScreen === deletedId) state.design.defaultScreen = Object.keys(state.design.screens)[0];
  state.selectedScreenId = state.design.defaultScreen;
  state.selectedPanelId = '';
  markDirty('Screen deleted · unsaved');
  renderAll();
}

function validateDesign() {
  const errors = [];
  const screens = Object.entries(state.design.screens);
  if (!screens.length) errors.push('At least one screen is required.');
  if (!state.design.screens[state.design.defaultScreen]) errors.push('The default screen does not exist.');
  const paths = new Set();
  for (const [id, screen] of screens) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`Screen ID “${id}” is invalid.`);
    if (!screen.path?.startsWith('/')) errors.push(`${screen.title || id} needs a path beginning with /.`);
    if (screen.path === '/admin' || screen.path?.startsWith('/api/') || screen.path?.startsWith('/plugins/') || screen.path?.startsWith('/screen-types/')) errors.push(`${screen.path} is reserved by Castboard.`);
    if (paths.has(screen.path)) errors.push(`Screen path “${screen.path}” is duplicated.`);
    paths.add(screen.path);
    if (screen.type === 'single' && screen.panels.length !== 1) errors.push(`${screen.title || id} is a single screen and needs exactly one panel.`);
    const panelIds = new Set();
    for (const panel of screen.panels) {
      if (!panel.id || panelIds.has(panel.id)) errors.push(`${screen.title || id} has missing or duplicate panel IDs.`);
      panelIds.add(panel.id);
      if (!state.catalog.plugins.some(plugin => plugin.id === panel.plugin)) errors.push(`${panel.id} references unavailable plugin “${panel.plugin}”.`);
      if (screen.type === 'grid') {
        const layout = canvasLayout(screen);
        const p = panel.position;
        if (!p || [p.column, p.row, p.width, p.height].some(value => !Number.isInteger(Number(value)))) errors.push(`${panel.id} needs an integer grid position.`);
        else if (p.column < 1 || p.row < 1 || p.width < 1 || p.height < 1 || p.column + p.width - 1 > layout.columns || p.row + p.height - 1 > layout.rows) errors.push(`${panel.id} extends outside the grid.`);
      }
    }
  }
  return errors;
}

async function saveDesign() {
  const errors = validateDesign();
  if (errors.length) return toast(errors[0], true);
  $('#save-design').disabled = true;
  setStatus('Saving and applying…');
  try {
    const result = await requestDesign('PUT', { revision: state.revision, design: state.design });
    state.revision = result.revision;
    state.design = result.design;
    state.savedDesign = clone(result.design);
    state.catalog = result.catalog;
    state.dirty = false;
    renderAll();
    refreshPreview();
    setStatus('Saved · running screens updated', 'saved');
    toast('Design saved and applied without a restart.');
  } catch (error) {
    $('#save-design').disabled = false;
    if (error.code === 'REVISION_CONFLICT') {
      setStatus('Configuration changed elsewhere', 'error');
      toast('The config changed elsewhere. Reload the studio before saving.', true);
    } else {
      setStatus('Save failed · changes are still local', 'error');
      toast(error.message, true);
    }
  }
}

function bindEvents() {
  $('#save-design').addEventListener('click', saveDesign);
  $('#open-screen').addEventListener('click', () => window.open(state.savedDesign.screens[state.selectedScreenId].path, '_blank', 'noopener'));
  $('#add-screen').addEventListener('click', showNewScreenDialog);
  $('#duplicate-screen').addEventListener('click', duplicateScreen);
  $('#delete-screen').addEventListener('click', deleteScreen);
  $('#set-default').addEventListener('click', () => {
    state.design.defaultScreen = state.selectedScreenId;
    markDirty('Default screen changed · unsaved');
    renderScreens();
    renderInspector();
  });
  $('#remove-panel').addEventListener('click', removePanel);
  $('#theme-preset').addEventListener('change', () => $('#theme-preset').value === 'inherit' ? resetTheme() : applyTheme($('#theme-preset').value));
  $('#reset-theme').addEventListener('click', resetTheme);
  $('#reset-panel-style').addEventListener('click', () => {
    delete currentPanel().appearance;
    markDirty('Panel style overrides cleared · unsaved');
    renderPanelInspector();
    renderCanvas();
  });
  $('#panel-earlier').addEventListener('click', () => movePanel(-1));
  $('#panel-later').addEventListener('click', () => movePanel(1));
  for (const button of $$('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
  for (const button of $$('.inspector-tabs [data-inspector]')) button.addEventListener('click', () => setInspectorTab(button.dataset.inspector));

  for (const input of $$('[data-branding]')) input.addEventListener('input', () => {
    state.design.branding ||= {};
    state.design.branding[input.dataset.branding] = input.value;
    if (input.dataset.branding === 'accent') {
      $('#brand-accent-value').textContent = input.value;
      document.documentElement.style.setProperty('--accent', input.value);
      renderCanvas();
    }
    markDirty('Branding changed · unsaved');
  });

  for (const input of $$('[data-screen]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (input.dataset.screen === 'type') return changeScreenType(input.value);
    currentScreen()[input.dataset.screen] = input.value;
    markDirty('Screen settings changed · unsaved');
    if (input.dataset.screen === 'title') renderScreens();
    if (input.dataset.screen === 'path') updatePreview();
  });

  for (const input of $$('[data-layout]')) input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    currentScreen().layout ||= {};
    currentScreen().layout[input.dataset.layout] = value;
    markDirty('Layout changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-appearance]')) input.addEventListener('input', () => {
    const screen = currentScreen();
    screen.appearance ||= {};
    const field = input.dataset.appearance;
    if (input.value === '') delete screen.appearance[field];
    else screen.appearance[field] = input.type === 'number' ? Number(input.value) : input.value;
    const output = input.closest('.color-field')?.querySelector('output');
    if (output) output.textContent = input.value;
    $('#theme-preset').value = 'custom';
    markDirty('Appearance changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-panel-appearance]')) input.addEventListener('input', () => {
    const panel = currentPanel();
    panel.appearance ||= {};
    const field = input.dataset.panelAppearance;
    if (input.value === '') delete panel.appearance[field];
    else panel.appearance[field] = input.type === 'number' ? Number(input.value) : input.value;
    if (!Object.keys(panel.appearance).length) delete panel.appearance;
    const wrapper = input.closest('.color-field');
    if (wrapper) {
      wrapper.classList.remove('inherited');
      wrapper.querySelector('output').textContent = input.value;
    }
    markDirty('Panel style changed · unsaved');
    renderCanvas();
  });

  for (const button of $$('[data-clear-panel-appearance]')) button.addEventListener('click', () => {
    const panel = currentPanel();
    if (panel.appearance) delete panel.appearance[button.dataset.clearPanelAppearance];
    if (panel.appearance && !Object.keys(panel.appearance).length) delete panel.appearance;
    markDirty('Panel color now inherits the screen theme · unsaved');
    renderPanelInspector();
    renderCanvas();
  });

  for (const input of $$('[data-panel]')) input.addEventListener('change', () => {
    const panel = currentPanel();
    const oldId = panel.id;
    panel[input.dataset.panel] = input.value;
    if (input.dataset.panel === 'id') state.selectedPanelId = input.value;
    markDirty('Panel settings changed · unsaved');
    if (input.dataset.panel === 'plugin' || oldId !== panel.id) renderCanvas();
  });

  for (const input of $$('[data-option]')) input.addEventListener('input', () => {
    const panel = currentPanel();
    panel.options ||= {};
    if (input.value) panel.options[input.dataset.option] = input.value;
    else delete panel.options[input.dataset.option];
    $('#panel-options').value = JSON.stringify(panel.options, null, 2);
    markDirty('Panel options changed · unsaved');
    renderCanvas();
  });

  $('#panel-fit-content').addEventListener('change', () => {
    const panel = currentPanel();
    panel.options ||= {};
    if ($('#panel-fit-content').checked) panel.options.fitContent = true;
    else delete panel.options.fitContent;
    if (!Object.keys(panel.options).length) delete panel.options;
    $('#panel-options').value = JSON.stringify(panel.options || {}, null, 2);
    markDirty('Panel content sizing changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-position]')) input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!Number.isInteger(value)) return;
    currentPanel().position ||= {};
    currentPanel().position[input.dataset.position] = value;
    markDirty('Panel placement changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-size]')) input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!Number.isInteger(value)) return;
    currentPanel().size ||= {};
    currentPanel().size[input.dataset.size] = value;
    markDirty('Panel size changed · unsaved');
    renderCanvas();
  });

  $('#panel-options').addEventListener('input', () => {
    try {
      const options = JSON.parse($('#panel-options').value || '{}');
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Options must be a JSON object');
      currentPanel().options = options;
      $('#panel-title').value = options.title || '';
      $('#panel-view').value = options.view || '';
      $('#panel-fit-content').checked = options.fitContent === true;
      $('#options-error').textContent = '';
      markDirty('Advanced panel options changed · unsaved');
      renderCanvas();
    } catch (error) {
      $('#options-error').textContent = error.message;
    }
  });

  $('#custom-layout').addEventListener('input', () => {
    try {
      const layout = JSON.parse($('#custom-layout').value || '{}');
      if (!layout || typeof layout !== 'object' || Array.isArray(layout)) throw new Error('Layout must be a JSON object');
      currentScreen().layout = layout;
      $('#custom-layout-error').textContent = '';
      markDirty('Custom layout changed · unsaved');
    } catch (error) {
      $('#custom-layout-error').textContent = error.message;
    }
  });

  for (const [selector, field] of [['#custom-position', 'position'], ['#custom-size', 'size']]) {
    $(selector).addEventListener('input', () => {
      try {
        const value = JSON.parse($(selector).value || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be a JSON object`);
        currentPanel()[field] = value;
        $('#custom-panel-error').textContent = '';
        markDirty(`Custom panel ${field} changed · unsaved`);
      } catch (error) {
        $('#custom-panel-error').textContent = error.message;
      }
    });
  }

  $('#viewport').addEventListener('change', () => {
    const [width, height] = $('#viewport').value.split('x').map(Number);
    state.viewport = { width, height };
    resizeCanvasFrame();
  });

  $('#new-screen-id').addEventListener('input', () => { state.generatedScreenFields = false; });
  $('#new-screen-title').addEventListener('input', () => {
    if (!state.generatedScreenFields) return;
    const id = uniqueScreenId($('#new-screen-title').value);
    $('#new-screen-id').value = id;
    $('#new-screen-path').value = `/${id}`;
  });
  $('#screen-form').addEventListener('submit', event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') return $('#screen-dialog').close();
    createScreenFromDialog();
    state.generatedScreenFields = true;
  });

  $('#token-form').addEventListener('submit', async event => {
    event.preventDefault();
    state.token = $('#admin-token').value;
    sessionStorage.setItem('castboard-admin-token', state.token);
    $('#token-dialog').close();
    await loadDesign();
  });

  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  new ResizeObserver(() => resizeCanvasFrame()).observe($('#canvas-stage'));
}

bindEvents();
loadDesign();
