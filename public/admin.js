import { validateInteraction } from '/interaction-model.js';
import { mergeDraft, resolveDraft } from '/draft-model.js';
import { screenPathError } from '/screen-path.js';
import { schemaFields } from '/schema-fields.js?v=0.11.0';
import { History, screenAddress, gridSlot, gridDelta, compatibleSource, schemaDefaults, trackLines, trackDelta, shuffleGrid, swapGrid, sharedEdges, resizeShared, resizeTracks, validPlacement } from '/studio-model.js?v=0.11.0';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));
const requestedPanelTarget = new URLSearchParams(location.search).get('screen');

const state = {
  revision: '',
  design: null,
  savedDesign: null,
  catalog: { plugins: [], screenTypes: [] },
  selectedScreenId: '',
  selectedPanelId: '',
  dirty: false,
  mode: 'design',
  viewport: { width: 1280, height: 800 },
  saving: false,
  runtime: null,
  history: null,
  previewReady: false,
  scale: 1,
  token: sessionStorage.getItem('castboard-admin-token') || '',
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

const draftKey = 'castboard-studio-draft';
function showNotice(message, actions = []) {
  const notice = $('#notice'); notice.replaceChildren(); notice.hidden = !message;
  if (!message) return;
  const text = document.createElement('span'); text.textContent = message; notice.append(text);
  for (const [label, action] of actions) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', action); notice.append(button); }
}
function invalidField() {
  return $$('input,textarea,select').find(input => !input.closest('dialog') && !input.validity.valid);
}
function canLeaveField() {
  const input = invalidField();
  if (!input) return true;
  if (input.closest('#panel-inspector')) setInspectorTab('panel');
  else if (input.closest('#screen-inspector')) setInspectorTab('screen');
  if (input.closest('.inspector-sidebar')) { $('.studio').dataset.tool = 'settings'; for (const button of $$('.mobile-tools [data-tool]')) button.setAttribute('aria-pressed',String(button.dataset.tool === 'settings')); }
  if (input.closest('.screens-sidebar')) { $('.studio').dataset.tool = 'screens'; for (const button of $$('.mobile-tools [data-tool]')) button.setAttribute('aria-pressed',String(button.dataset.tool === 'screens')); }
  for (let node = input.parentElement; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true; input.focus(); input.reportValidity();
  toast('Correct the highlighted setting, or use Undo to revert it.', true); return false;
}
function persistDraft() {
  if (state.pendingDraft) return;
  try {
    if (state.dirty) sessionStorage.setItem(draftKey, JSON.stringify({ revision: state.revision, base: state.savedDesign, design: state.design, selected: state.selectedScreenId }));
    else sessionStorage.removeItem(draftKey);
  } catch { /* Storage can be disabled; editing still works. */ }
}
function updateHistory() {
  $('#undo').disabled = (!state.history?.canUndo && !invalidField()) || state.saving;
  $('#redo').disabled = !state.history?.canRedo || state.saving;
  $('#discard').disabled = (!state.dirty && !invalidField()) || state.saving;
}
function markDirty() {
  const group = ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
  state.history?.record(state.design, group);
  state.dirty = JSON.stringify(state.design) !== JSON.stringify(state.savedDesign) || Boolean(invalidField());
  $('#save-design').disabled = !state.dirty || state.saving || Boolean(invalidField());
  setStatus(state.dirty ? 'Unsaved changes' : 'All changes saved', state.dirty ? 'dirty' : 'saved');
  updateHistory(); persistDraft(); updatePreview(); renderPanelList();
  if (currentPanel()) $('#selected-module-name').textContent = currentPanel().options?.title || currentPanel().options?.label || pluginName(currentPanel().plugin);
}
function restoreHistory(direction) {
  state.design = state.history[direction]();
  if (!state.design.screens[state.selectedScreenId]) state.selectedScreenId = state.design.defaultScreen;
  if (!currentPanel()) state.selectedPanelId = '';
  for (const input of $$('input,textarea,select')) input.setCustomValidity('');
  rememberScreen(); renderAll(); markDirty();
}
function discardDraft() {
  state.design = clone(state.savedDesign); state.history.record(state.design);
  state.selectedScreenId = state.design.screens[state.selectedScreenId] ? state.selectedScreenId : state.design.defaultScreen;
  state.selectedPanelId = ''; for (const input of $$('input,textarea,select')) input.setCustomValidity('');
  showNotice('Draft discarded. You can undo this change.', [['Undo discard', () => restoreHistory('undo')]]); renderAll(); markDirty();
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
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'Castboard took too long to reply. Try again.' : 'Could not reach Castboard. Check your connection, then try again.');
  } finally {
    clearTimeout(timer);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if(response.status===403){
      $('#token-error').textContent=state.token?'Access was denied. Check your token and the server’s admin access settings.':'';
      $('#admin-token').setAttribute('aria-invalid',String(Boolean(state.token)));
      if(!$('#token-dialog').open)$('#token-dialog').showModal();
      $('#admin-token').focus();$('#admin-token').select();
    }
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
    const runtime = await fetch('/api/runtime-config', {cache:'no-store'});
    if (!runtime.ok) throw new Error('Could not load the preview. Try loading again.');
    state.runtime = await runtime.json();
    state.history = new History(state.design);
    let draft; try { draft = JSON.parse(sessionStorage.getItem(draftKey)); } catch {}
    state.pendingDraft = draft?.design ? draft : null;
    $('.studio').inert = Boolean(state.pendingDraft);
    if (draft?.design) showNotice(draft.revision === state.revision ? 'You have an unsaved draft from this tab.' : 'An unsaved draft is available. The configuration has changed since it was started.', [
      ['Restore draft', () => restoreSavedDraft(draft)],
      ['Discard draft', () => { state.pendingDraft = null; $('.studio').inert = false; sessionStorage.removeItem(draftKey); showNotice(''); applyRequestedPanel(); }]
    ]);
    const requestedScreen=new URLSearchParams(location.search).get('screen');
    state.selectedScreenId = state.design.screens[requestedScreen] ? requestedScreen : state.design.screens[state.selectedScreenId] ? state.selectedScreenId : state.design.defaultScreen;
    state.selectedPanelId = '';
    state.dirty = false;
    const requestedPlugin=new URLSearchParams(location.search).get('plugin');
    if(state.catalog.plugins.some(plugin=>plugin.id===requestedPlugin)){$('#plugin-search').value=requestedPlugin;$('#library').hidden=false;}
    populateCatalogControls();
    setInspectorTab('screen');
    renderAll();
    setStatus('All changes saved', 'saved');
    updateHistory();
    $('#save-design').disabled = true;
    if (requestedPlugin) {if(innerWidth<1100)showTool('settings');$('#plugin-search').focus();}
    const requestedPanel=new URLSearchParams(location.search).get('panel');
    if(currentScreen()?.panels.some(panel=>panel.id===requestedPanel))selectPanel(requestedPanel);
    if (!draft?.design) applyRequestedPanel();
  } catch (error) {
    if (error.status === 403) {
      if (!$('#token-dialog').open) $('#token-dialog').showModal();
      setStatus('Admin authorization required', 'error');
      return;
    }
    setStatus('Could not load design', 'error');
    showNotice(error.message, [['Try again', loadDesign]]);
  }
}

function applyRequestedPanel() {
  const url = new URL(location.href), plugin = url.searchParams.get('addPlugin');
  if (!plugin) return;
  const screen = requestedPanelTarget;
  url.searchParams.delete('addPlugin'); history.replaceState(null, '', url);
  if (!state.catalog.plugins.some(item=>item.id===plugin)) return showNotice('This plugin is no longer available. Choose another from Plugins.');
  if (!state.design.screens[screen]) return showNotice('This screen is no longer available. Choose a screen before adding the plugin.');
  state.selectedScreenId = screen; state.selectedPanelId = ''; rememberScreen(); renderAll();
  addPanel(plugin);
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
  const screen=currentScreen();
  if (state.viewportScreenId!==state.selectedScreenId) {
    state.viewportScreenId=state.selectedScreenId;
    if(screen?.viewport) {
      state.viewport={...screen.viewport};
      const value=`${state.viewport.width}x${state.viewport.height}`;
      if(![...$('#viewport').options].some(option=>option.value===value))$('#viewport').add(new Option(`${state.viewport.width} × ${state.viewport.height} · Screen`,value));
      $('#viewport').value=value;
    }
  }
  renderScreens();
  renderPanelList();
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
    button.setAttribute('aria-label', `Edit ${screen.title || id}`);
    button.setAttribute('aria-pressed', String(id === state.selectedScreenId));

    const copy = document.createElement('span');
    copy.className = 'screen-copy';
    const title = document.createElement('strong');
    title.textContent = screen.title || id;
    const meta = document.createElement('small');
    meta.textContent = `${typeName(screen.type)} · ${screen.panels.length} panel${screen.panels.length === 1 ? '' : 's'}`;
    copy.append(title, meta);
    button.append(copy);
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
  const brandHex=$('#brand-accent').parentElement.querySelector('.hex-color');if(brandHex)brandHex.value=$('#brand-accent').value;
  $('#brand-accent-value').textContent = accent;

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
  schemaFields($('#extension-layout-fields'), state.catalog.screenTypes.find(type => type.id === screen.type)?.layoutSchema, screen.layout || {}, (key, value) => {
    screen.layout ||= {};
    screen.layout[key] = value;
    $('#custom-layout').value = JSON.stringify(screen.layout, null, 2);
    markDirty('Layout changed'); renderCanvas();
  });

  const layoutFields=$('#extension-layout-fields');
  const advancedFields=[...layoutFields.children].filter(field=>field.querySelector('textarea'));
  if(advancedFields.length){
    const advanced=document.createElement('details');advanced.className='advanced-layout';
    const summary=document.createElement('summary');summary.textContent='Advanced layout';advanced.append(summary,...advancedFields);layoutFields.append(advanced);
  }

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
    const hex = input.closest('.color-field')?.querySelector('.hex-color');if(hex){hex.value=input.value;hex.setCustomValidity('');}
    const output = input.closest('.color-field')?.querySelector('output');
    if (output) output.textContent = appearance[field] || `Inherited · ${input.value}`;
  }
  $('#theme-preset').value = matchingTheme(appearance);
  $('#screen-presentation').value=screen.presentation||'screen';
  $('#screen-width').value=screen.viewport?.width||'';
  $('#screen-height').value=screen.viewport?.height||'';
  $('#set-default').disabled = state.selectedScreenId === state.design.defaultScreen;

  renderPanelInspector();
}

function renderInteractionFields() {
  const panel=currentPanel(); if(!panel)return;
  const interaction=panel.interaction || {};
  $('#interaction-type').value=interaction.type || '';
  $('#interaction-destination').hidden=!['modal','screen'].includes(interaction.type);
  $('#interaction-action-fields').hidden=interaction.type!=='action';
  $('#interaction-label-field').hidden=!interaction.type;
  $('#interaction-screen').replaceChildren(...[{id:'',title:'Choose a destination'},...Object.entries(state.design.screens).map(([id,screen])=>({id,title:screen.title||id}))].map(item=>new Option(item.title,item.id)));
  $('#interaction-screen').value=interaction.screenId || '';
  $('#interaction-edit').disabled=!state.design.screens[interaction.screenId];
  $('#interaction-source').replaceChildren(new Option('Panel source',''),...(state.runtime?.plugins||[]).filter(source=>source.hasAction).map(source=>new Option(source.name+' ('+source.id+')',source.id)));
  for(const field of ['source','action','label','confirmation'])$('#interaction-'+field).value=interaction[field] || '';
  $('#interaction-payload').value=JSON.stringify(interaction.payload||{},null,2);
  $('#interaction-payload').setCustomValidity(''); $('#interaction-error').textContent='';
}
function saveInteractionFields() {
  const panel=currentPanel(); if(!panel)return;
  const type=$('#interaction-type').value;
  if(!type){delete panel.interaction;markDirty('Tap behaviour changed');renderInteractionFields();renderCanvas();return;}
  const next={type};
  if(['modal','screen'].includes(type))next.screenId=$('#interaction-screen').value;
  if(type==='action'){
    next.action=$('#interaction-action').value.trim();
    if($('#interaction-source').value)next.source=$('#interaction-source').value;
    if($('#interaction-confirmation').value.trim())next.confirmation=$('#interaction-confirmation').value.trim();
    try {next.payload=JSON.parse($('#interaction-payload').value||'{}');if(!next.payload||Array.isArray(next.payload)||typeof next.payload!=='object'||Object.hasOwn(next.payload,'action'))throw new Error('Use a JSON object without an action field.');$('#interaction-payload').setCustomValidity('');}
    catch(error){$('#interaction-payload').setCustomValidity(error.message);$('#interaction-error').textContent=error.message;markDirty();return;}
  }
  if($('#interaction-label').value.trim())next.label=$('#interaction-label').value.trim();
  panel.interaction=next;
  markDirty('Tap behaviour changed');renderCanvas();
}
function renderPanelInspector() {
  const screen = currentScreen();
  const panel = currentPanel();
  $('#panel-empty').hidden = Boolean(panel);
  $('#panel-fields').hidden = !panel;
  if (!panel || !screen) return;

  if($('#manage-plugin'))$('#manage-plugin').href=`/admin/plugins?plugin=${encodeURIComponent(panel.plugin)}`;
  $('#selected-module-name').textContent = panel.options?.title || panel.options?.label || pluginName(panel.plugin);
  const optionSchema=state.catalog.plugins.find(plugin=>plugin.id===panel.plugin)?.optionSchema;
  $('#panel-title').closest('label').hidden = Boolean(optionSchema?.properties?.title);
  setInput('#panel-id', panel.id);
  setInput('#panel-plugin', panel.plugin);
  const viewContract = state.catalog.plugins.find(plugin => plugin.id === panel.plugin)?.inputContract;
  const sources = (state.catalog.sources || []).filter(source => !viewContract || source.contract === viewContract);
  $(viewContract || panel.source ? '#panel-source-main' : '#panel-source-advanced').append($('#panel-source-field'));
  $('#panel-source').replaceChildren(...[{ id: '', name: 'Plugin default' }, ...sources].map(source => {
    const option = document.createElement('option'); option.value = source.id; option.textContent = source.id ? `${source.name} (${source.id})` : source.name; return option;
  }));
  setInput('#panel-source', panel.source || '');
  setInput('#panel-title', panel.options?.title || '');
  setInput('#panel-view', panel.options?.view || '');
  $('#panel-fit-content').checked = panel.options?.fitContent === true;
  $('#panel-options').value = JSON.stringify(panel.options || {}, null, 2);
  $('#options-error').textContent = '';
  const installedDefaults=state.runtime.plugins.find(plugin=>plugin.id===panel.plugin)?.config||{};
  schemaFields($('#extension-option-fields'), optionSchema, {...installedDefaults,...panel.options}, (key, value) => {
    panel.options ||= {};if(value===undefined||value==='')delete panel.options[key];else panel.options[key] = value;
    $('#panel-options').value = JSON.stringify(panel.options, null, 2);
    $('#reset-plugin-options').disabled = !Object.keys(optionSchema?.properties||{}).some(key=>panel.options?.[key] !== undefined);
    markDirty('Panel options changed'); renderCanvas();
  });

  $('#reset-plugin-options').disabled = !Object.keys(optionSchema?.properties||{}).some(key=>panel.options?.[key] !== undefined);
  $('#reset-plugin-options').onclick=()=>{panel.options||={};for(const key of Object.keys(optionSchema?.properties||{}))delete panel.options[key];markDirty('Plugin defaults restored');renderPanelInspector();renderCanvas();};

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
  const screenType = state.catalog.screenTypes.find(type => type.id === screen.type);
  for (const key of ['position', 'size']) schemaFields($(`#extension-${key}-fields`), screenType?.[`${key}Schema`], panel[key] || {}, (field, value) => {
    panel[key] ||= {}; panel[key][field] = value; $(`#custom-${key}`).value = JSON.stringify(panel[key], null, 2);
    markDirty('Panel placement changed'); renderCanvas();
  });
  renderPanelAppearance(panel, screen);
  renderInteractionFields();
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
      const hex=wrapper.querySelector('.hex-color');if(hex){hex.value=input.value;hex.setCustomValidity('');}
      wrapper.classList.toggle('inherited', appearance[field] === undefined);
      wrapper.querySelector('output').textContent = appearance[field] || `Inherit · ${input.value}`;
    } else {
      input.value = appearance[field] ?? '';
    }
  }
}

function showTool(tool) {
  $('.studio').dataset.tool = tool;
  for (const button of $$('.mobile-tools [data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  resizeCanvasFrame();
}
function openPanelLibrary() {
  if (!canLeaveField()) return;
  state.libraryReturnTool = $('.studio').dataset.tool || 'canvas';
  $('#plugin-search').value = '';
  $('#library').hidden = false;
  renderPluginLibrary();
  if (innerWidth < 1100) showTool('settings');
  $('#plugin-search').focus();
}
function closePanelLibrary() {
  $('#library').hidden = true;
  if (innerWidth < 1100) showTool(state.libraryReturnTool || 'canvas');
  [$('#show-library'),$('#add-first-panel'),...$$('.canvas-panel'),...$$('.inspector-pane input')].find(el=>el?.getClientRects().length&&!el.disabled)?.focus();
}
function renderPluginLibrary() {
  const list = $('#plugin-list');
  const screen = currentScreen();
  list.replaceChildren();
  for (const plugin of state.catalog.plugins.filter(item => `${item.name} ${item.id}`.toLowerCase().includes($('#plugin-search').value.toLowerCase()))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plugin-card';
    button.disabled = screen?.type === 'single' && screen.panels.length >= 1;
    button.title = button.disabled ? 'Single-panel screens can contain only one panel' : `Add ${plugin.name}`;
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = plugin.name;
    const action = document.createElement('small');
    action.textContent = `Add panel · ${plugin.id}`;
    copy.append(name, action);
    button.append(copy);
    button.addEventListener('click', () => addPanel(plugin.id));
    list.append(button);
  }
  if (!list.children.length) {const empty=document.createElement('p');empty.className='section-note';empty.textContent=state.catalog.plugins.length ? 'No plugins match. Try a different name.' : 'No display plugins installed yet. Browse the library to add one.';list.append(empty);}
}

function canvasLayout(screen) {
  if (screen.type === 'flow') return { minPanelWidth: 240, minPanelHeight: 140, gap: 8, padding: 8, ...screen.layout };
  if (screen.type === 'single') return { padding: 8, ...screen.layout };
  return { columns: 12, rows: 8, gap: 8, padding: 8, ...screen.layout };
}

function renderPanelList() {
  const list = $('#panel-list'); list.replaceChildren();
  const screen = currentScreen(); if (!screen) return;
  $('#panel-count').textContent=screen.panels.length;
  $('#canvas-title').textContent=screen.title||state.selectedScreenId;
  for (const [index, panel] of screen.panels.entries()) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `panel-row${panel.id === state.selectedPanelId ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(panel.id === state.selectedPanelId));
    const text = document.createElement('span'); text.textContent = panel.options?.title || panel.options?.label || pluginName(panel.plugin);
    const order = document.createElement('small'); order.textContent = String(index + 1);
    button.append(text, order); button.addEventListener('click', () => selectPanel(panel.id)); list.append(button);
  }
  if (!screen.panels.length) { const text = document.createElement('p'); text.className = 'section-note'; text.textContent = 'No panels yet. Add a plugin to start this screen.'; list.append(text); }
  $('#show-library').disabled = screen.type === 'single' && screen.panels.length >= 1;
}
let canvasGeneration = 0;
let releaseCanvas;
async function renderCanvas() {
  if (state.dragging) return;
  const generation = ++canvasGeneration;
  const screen = clone(currentScreen()); const surface = $('#design-surface');
  if (!screen) return;
  $('#empty-canvas').hidden = screen.panels.length > 0;
  const focused = surface.contains(document.activeElement) ? {panel:document.activeElement.dataset.panel,edge:document.activeElement.dataset.edge} : null;
  if (releaseCanvas) { releaseCanvas(); releaseCanvas = null; }
  surface.replaceChildren(); surface.className = 'design-surface'; surface.removeAttribute('style');
  surface.style.width = `${state.viewport.width}px`; surface.style.height = `${state.viewport.height}px`;
  surface.style.transform = `scale(${state.scale})`;
  const collisionIds = screen.type === 'grid' ? findCollisions(screen.panels) : new Set();
  try {
    const renderer = await import(`/screen-types/${encodeURIComponent(screen.type)}/renderer.js?v=${encodeURIComponent(state.catalog.screenTypes.find(type=>type.id===screen.type)?.version||'1')}`);
    if (generation !== canvasGeneration) return;
    const release = await renderer.prepare({ container: surface, screen });
    if (generation !== canvasGeneration) { if (typeof release === 'function') release(); return; }
    releaseCanvas = typeof release === 'function' ? release : null;
    state.editor = renderer.editor || null;
    const rawModel = typeof state.editor?.read === 'function' ? state.editor.read(screen) : null;
    state.editorModel = rawModel ? {gap:8,padding:8,...rawModel} : null;
    if (state.editorModel && !validPlacement(state.editorModel)) state.editorModel = null;
    for (const panel of screen.panels) {
      const element = document.createElement('div');
      element.className = `canvas-panel${panel.id === state.selectedPanelId ? ' selected' : ''}${collisionIds.has(panel.id) ? ' collision' : ''}`;
      element.tabIndex = 0; element.setAttribute('role', 'button');
      element.setAttribute('aria-label', `Edit ${panel.options?.title || panel.options?.label || pluginName(panel.plugin)} panel`); element.dataset.panel = panel.id;
      await renderer.place({container:surface, element, panel, screen});
      if (generation !== canvasGeneration) return;
      const label = document.createElement('span'); label.className = 'canvas-panel-copy'; label.textContent = panel.options?.title || panel.options?.label || pluginName(panel.plugin); element.append(label);
      if (state.editorModel || screen.type === 'flow') {
        const handle = document.createElement('span'); handle.className = 'resize-handle'; handle.setAttribute('aria-hidden','true'); element.append(handle);
        handle.hidden = Boolean(state.editorModel?.weightedResize);
        element.addEventListener('pointerdown', event => screen.type === 'flow' ? beginFlowDrag(event,panel.id,element) : beginPanelDrag(event,panel.id,element));
      }
      element.addEventListener('click', () => selectPanel(panel.id));
      element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();selectPanel(panel.id);} else if ((state.editorModel || screen.type === 'flow') && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {event.preventDefault(); screen.type === 'flow' ? keyboardFlowPanel(event,panel.id) : keyboardPanel(event,panel.id);} });
      surface.append(element);
    }
    renderSharedHandles(surface);
    if(focused?.panel) surface.querySelector(`[data-panel="${CSS.escape(focused.panel)}"]`)?.focus({preventScroll:true});
    else if(focused?.edge) surface.querySelector(`[data-edge="${CSS.escape(focused.edge)}"]`)?.focus({preventScroll:true});
    $('#canvas-message').textContent = !screen.panels.length ? 'Start with a panel, then arrange and style it here.' : collisionIds.size ? `${collisionIds.size} panels overlap. Adjust their placement before saving.` : state.editorModel ? 'Drag panels to rearrange them. Drag the edges between panels to resize. Arrow keys move; Shift + arrows resize.' : screen.type === 'flow' ? 'Drag panels to reorder them. Drag a corner to resize. Arrow keys reorder; Shift + arrows resize.' : 'Select a panel to edit its plugin options and appearance.';
  } catch (error) {
    if (generation !== canvasGeneration) return;
    $('#canvas-message').textContent = `Cannot preview this layout: ${error.message}`;
  }
  updatePreview();
}
function placeCanvasPanel(element, panel) {
  element.style.gridColumn = `${panel.position.column} / span ${panel.position.width}`;
  element.style.gridRow = `${panel.position.row} / span ${panel.position.height}`;
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


function applyEditorModel(model) {
  state.editor.write(currentScreen(), model);
  for (const node of $$('.canvas-panel')) {
    const p = model.positions[node.dataset.panel];
    node.style.gridArea = 'auto'; node.style.gridColumn = `${p.column} / span ${p.width}`; node.style.gridRow = `${p.row} / span ${p.height}`;
  }
  const surface = $('#design-surface');
  if (model.columnWeights) surface.style.gridTemplateColumns = model.columnWeights.map(value=>`minmax(0,${value}fr)`).join(' ');
  if (model.rowWeights) surface.style.gridTemplateRows = model.rowWeights.map(value=>`minmax(0,${value}fr)`).join(' ');
  surface.style.gridTemplateAreas = 'none';
  updatePreview();
}
function renderSharedHandles(surface) {
  const model=state.editorModel; if(!model) return;
  const xs=trackLines(model.columns,model.columnWeights,state.viewport.width,model.gap,model.padding);
  const ys=trackLines(model.rows,model.rowWeights,state.viewport.height,model.gap,model.padding);
  for(const edge of sharedEdges(model)) {
    const handle=document.createElement('div');handle.className=`shared-edge shared-edge-${edge.axis}`;
    handle.dataset.edge=`${edge.axis}:${edge.before}:${edge.after}`;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation',edge.axis==='x'?'vertical':'horizontal');
    const edgeName=id=>{const p=currentScreen().panels.find(p=>p.id===id);return p.options?.title||p.options?.label||pluginName(p.plugin);};
    handle.setAttribute('aria-label',`Resize between ${edgeName(edge.before)} and ${edgeName(edge.after)}`);
    handle.setAttribute('aria-valuenow',String(edge.line-1));
    if(edge.axis==='x') {handle.style.left=`${xs[edge.line-1]-model.gap/2}px`;handle.style.top=`${ys[edge.start-1]}px`;handle.style.height=`${ys[edge.end-1]-ys[edge.start-1]-model.gap}px`;}
    else {handle.style.top=`${ys[edge.line-1]-model.gap/2}px`;handle.style.left=`${xs[edge.start-1]}px`;handle.style.width=`${xs[edge.end-1]-xs[edge.start-1]-model.gap}px`;}
    handle.addEventListener('pointerdown',event=>beginSharedDrag(event,edge,handle));
    handle.addEventListener('keydown',event=>{
      const direction={ArrowLeft:-1,ArrowRight:1,ArrowUp:-1,ArrowDown:1}[event.key];
      if(!direction || (edge.axis==='x'&&!['ArrowLeft','ArrowRight'].includes(event.key)) || (edge.axis==='y'&&!['ArrowUp','ArrowDown'].includes(event.key)) || !canLeaveField()) return;
      event.preventDefault(); const next=model.weightedResize?resizeTracks(model,edge.axis,edge.line-1,direction*10,state.viewport):resizeShared(model,edge,direction);
      applyEditorModel(next);markDirty();renderCanvas();renderPanelInspector();
    });surface.append(handle);
  }
}
function gesture(event,element,move,finish,cancel) {
  state.dragging=true; $('.studio').classList.add('dragging'); element.setPointerCapture(event.pointerId);
  const start={x:event.clientX,y:event.clientY};let moved=false;
  const onMove=e=>{const dx=e.clientX-start.x,dy=e.clientY-start.y;moved ||= Math.hypot(dx,dy)>4;if(moved)move(e,dx,dy);};
  const end=e=>{element.removeEventListener('pointermove',onMove);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end);element.removeEventListener('lostpointercapture',lost);document.removeEventListener('keydown',escape);state.dragging=false;$('.studio').classList.remove('dragging');if(e.type==='pointercancel')cancel();else finish(moved);renderCanvas();renderPanelInspector();};
  const lost=()=>{if(state.dragging)end({type:'pointercancel'});};
  const escape=e=>{if(e.key==='Escape'){e.preventDefault();end({type:'pointercancel'});}};
  element.addEventListener('pointermove',onMove);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',lost);document.addEventListener('keydown',escape);
}
function beginPanelDrag(event,id,element) {
  if(event.button!==0 || !canLeaveField()) return;event.preventDefault();
  selectPanel(id,false);renderPanelInspector();for(const node of $$('.canvas-panel'))node.classList.toggle('selected',node.dataset.panel===id);
  const model=clone(state.editorModel),start=model.positions[id],before=clone(currentScreen());
  const resize=event.target.classList.contains('resize-handle');let accepted=model,blocked=false,lastTarget='';
  gesture(event,element,(e,dx,dy)=>{
    let next;
    if(model.swapOnDrop&&!resize) {
      const rect=$('#design-surface').getBoundingClientRect();
      const x=(e.clientX-rect.left)/state.scale,y=(e.clientY-rect.top)/state.scale;
      const xs=trackLines(model.columns,model.columnWeights,state.viewport.width,model.gap,model.padding),ys=trackLines(model.rows,model.rowWeights,state.viewport.height,model.gap,model.padding);
      const hit=Object.entries(model.positions).find(([key,p])=>key!==id&&x>=xs[p.column-1]&&x<xs[p.column+p.width-1]-model.gap&&y>=ys[p.row-1]&&y<ys[p.row+p.height-1]-model.gap);
      if(hit)next=swapGrid(model,id,hit[0]);else{const delta=trackDelta(model,state.viewport,state.scale,start,dx,dy);next=shuffleGrid(model,id,{...start,column:clamp(start.column+delta.x,1,model.columns-start.width+1),row:clamp(start.row+delta.y,1,model.rows-start.height+1)});}
    } else {
      const delta=trackDelta(model,state.viewport,state.scale,start,dx,dy);
      const target={...start};
      if(resize) {target.width=clamp(start.width+delta.x,1,model.columns-start.column+1);target.height=clamp(start.height+delta.y,1,model.rows-start.row+1);}
      else {target.column=clamp(start.column+delta.x,1,model.columns-start.width+1);target.row=clamp(start.row+delta.y,1,model.rows-start.height+1);}
      const key=JSON.stringify(target);if(key===lastTarget)return;lastTarget=key;next=shuffleGrid(model,id,target);
    }
    blocked=!next; element.classList.toggle('blocked',blocked);
    if(next&&JSON.stringify(next)!==JSON.stringify(accepted)){accepted=next;applyEditorModel(next);}
  },moved=>{
    if(!moved)selectPanel(id);
    if(blocked){state.design.screens[state.selectedScreenId]=before;toast('No room at that position. The layout was kept.',true);}
    else if(JSON.stringify(currentScreen())!==JSON.stringify(before))markDirty();
    if(blocked)updatePreview();
  },()=>{state.design.screens[state.selectedScreenId]=before;updatePreview();});
}
function beginSharedDrag(event,edge,handle) {
  if(event.button!==0 || !canLeaveField())return;event.preventDefault();event.stopPropagation();
  const model=clone(state.editorModel),before=clone(currentScreen());
  gesture(event,handle,(e,dx,dy)=>{
    let next;
    if(model.weightedResize) next=resizeTracks(model,edge.axis,edge.line-1,(edge.axis==='x'?dx:dy)/state.scale,state.viewport);
    else {const delta=gridDelta(model,state.viewport,state.scale,dx,dy);next=resizeShared(model,edge,edge.axis==='x'?delta.x:delta.y);}
    applyEditorModel(next);
    const lines=trackLines(edge.axis==='x'?model.columns:model.rows,edge.axis==='x'?next.columnWeights:next.rowWeights,state.viewport[edge.axis==='x'?'width':'height'],model.gap,model.padding);
    handle.style[edge.axis==='x'?'left':'top']=`${model.weightedResize?lines[edge.line-1]-model.gap/2:(edge.axis==='x'?trackLines(model.columns,null,state.viewport.width,model.gap,model.padding)[next.positions[edge.after].column-1]:trackLines(model.rows,null,state.viewport.height,model.gap,model.padding)[next.positions[edge.after].row-1])-model.gap/2}px`;
  },()=>{if(JSON.stringify(currentScreen())!==JSON.stringify(before))markDirty();},()=>{state.design.screens[state.selectedScreenId]=before;updatePreview();});
}
function keyboardPanel(event,id) {
  if(!canLeaveField())return;
  const model=state.editorModel,p=model.positions[id],target={...p};const direction={ArrowLeft:['column',-1],ArrowRight:['column',1],ArrowUp:['row',-1],ArrowDown:['row',1]}[event.key];
  const key=event.shiftKey?(direction[0]==='column'?'width':'height'):direction[0];target[key]+=direction[1];
  const next=shuffleGrid(model,id,target);
  if(!next)return toast('No room for that change.',true);
  applyEditorModel(next);markDirty();renderCanvas();renderPanelInspector();
}
function keyboardFlowPanel(event,id) {
  if(!canLeaveField())return;
  const screen=currentScreen(),index=screen.panels.findIndex(panel=>panel.id===id),panel=screen.panels[index];
  const forward=event.key==='ArrowRight'||event.key==='ArrowDown',delta=forward?1:-1;
  if(event.shiftKey){
    const key=event.key==='ArrowLeft'||event.key==='ArrowRight'?'columns':'rows';
    const limit=key==='columns'?getComputedStyle($('#design-surface')).gridTemplateColumns.split(' ').length:12;
    const before=panel.size?.[key]||1,next=clamp(before+delta,1,limit);
    if(next===before)return;panel.size={...panel.size,[key]:next};
  }else{
    const next=index+delta;if(next<0||next>=screen.panels.length)return;
    screen.panels.splice(index,1);screen.panels.splice(next,0,panel);
  }
  markDirty();renderPanelList();renderCanvas();renderPanelInspector();
}
function beginFlowDrag(event,id,element) {
  if(event.button!==0||!canLeaveField())return;event.preventDefault();selectPanel(id,false);renderPanelInspector();
  const before=clone(currentScreen()),resize=event.target.classList.contains('resize-handle');
  const rect=element.getBoundingClientRect(),flowColumns=getComputedStyle($('#design-surface')).gridTemplateColumns.split(' ').length;
  gesture(event,element,(e,dx,dy)=>{
    const screen=currentScreen(),panel=screen.panels.find(p=>p.id===id);
    if(resize){panel.size={columns:clamp((before.panels.find(p=>p.id===id).size?.columns||1)+Math.round(dx/(rect.width/(before.panels.find(p=>p.id===id).size?.columns||1))),1,flowColumns),rows:clamp((before.panels.find(p=>p.id===id).size?.rows||1)+Math.round(dy/(rect.height/(before.panels.find(p=>p.id===id).size?.rows||1))),1,12)};element.style.gridColumn=`span ${panel.size.columns}`;element.style.gridRow=`span ${panel.size.rows}`;}
    else {const hit=$$('.canvas-panel').find(node=>{const r=node.getBoundingClientRect();return node.dataset.panel!==id&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});if(hit){const source=screen.panels.indexOf(panel),target=screen.panels.findIndex(p=>p.id===hit.dataset.panel);screen.panels.splice(source,1);screen.panels.splice(target,0,panel);for(const p of screen.panels)$('#design-surface').append($$('.canvas-panel').find(node=>node.dataset.panel===p.id));}}
    updatePreview();
  },moved=>{if(!moved)selectPanel(id);if(JSON.stringify(currentScreen())!==JSON.stringify(before))markDirty();},()=>{state.design.screens[state.selectedScreenId]=before;updatePreview();});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function selectScreen(id) {
  if (!canLeaveField()) return;
  state.selectedScreenId = id;
  state.selectedPanelId = '';
  rememberScreen();
  setInspectorTab('screen');
  renderAll();
}

function selectPanel(id, rerender = true) {
  if (!canLeaveField()) return;
  state.selectedPanelId = id;
  if (rerender && window.innerWidth < 1100) {$('.studio').dataset.tool='settings';for(const button of $$('.mobile-tools [data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool==='settings'));}
  setInspectorTab('panel');
  renderPanelList();
  if (rerender) {
    renderCanvas();
    renderPanelInspector();
  }
}

function setInspectorTab(tab) {
  for (const button of $$('.inspector-tabs [data-inspector]')) {button.classList.toggle('active', button.dataset.inspector === tab); button.setAttribute('aria-selected', String(button.dataset.inspector === tab));}
  $('#screen-inspector').hidden = tab !== 'screen';
  $('#panel-inspector').hidden = tab !== 'panel';
}

function setMode(mode) {
  state.mode = mode;
  $('#reset-preview').hidden=mode!=='preview';
  for (const button of $$('[data-mode]')) {button.classList.toggle('active', button.dataset.mode === mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));}
  $('#canvas-frame').classList.toggle('preview', mode === 'preview');
  if (mode === 'preview') refreshPreview();
}

let previewTimer;
function updatePreview() {
  const iframe = $('#live-preview');
  if (!iframe.getAttribute('src')) iframe.src = '/admin-preview';
  clearTimeout(previewTimer); previewTimer = setTimeout(sendDraft, 160);
}
function sendDraft() {
  if (!state.previewReady || !state.runtime || !currentScreen()) return;
  const config = { ...state.runtime, branding: state.design.branding, defaultScreen:state.design.defaultScreen, screens:state.design.screens };
  $('#live-preview').contentWindow.postMessage({type:'castboard-draft', config, screenId:state.selectedScreenId,reset:state.previewReset||0}, window.location.origin);
}
function refreshPreview() { sendDraft(); }

function rememberScreen() {
  const url = new URL(location.href);
  url.searchParams.set('screen',state.selectedScreenId);
  url.searchParams.delete('panel');
  history.replaceState(null, '', url);
}
function updateOpenScreen() {
  $('#open-screen').disabled = !state.savedDesign?.screens?.[state.selectedScreenId]?.path;
  $('#set-up-display').disabled = $('#open-screen').disabled;
}

function resizeCanvasFrame() {
  const stage = $('#canvas-stage');
  const frame = $('#canvas-frame');
  if (!stage || !frame) return;
  const availableWidth = Math.max(100, stage.clientWidth - 40);
  const availableHeight = Math.max(80, stage.clientHeight - 40);
  const ratio = state.viewport.width / state.viewport.height;
  let width = Math.min(availableWidth, availableHeight * ratio);
  let height = width / ratio;
  if (height > availableHeight) { height = availableHeight; width = height * ratio; }
  frame.style.width = `${Math.round(width)}px`;
  frame.style.height = `${Math.round(height)}px`;
  frame.style.aspectRatio = `${state.viewport.width} / ${state.viewport.height}`;
  const scale = Math.min(frame.clientWidth / state.viewport.width, frame.clientHeight / state.viewport.height);
  state.scale = scale;
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

async function addPanel(plugin) {
  let screen = currentScreen();
  if (!canLeaveField()) return;
  if (!screen) return;
  if (screen.type === 'single' && screen.panels.length) return showNotice('This layout holds one panel. Choose another layout in Screen settings to add more.');
  const panel = { id: uniquePanelId(plugin, screen.panels), plugin };
  if (screen.type === 'grid') { panel.position = gridSlot(screen); if (!panel.position) return toast('The grid is full. Increase its rows or columns before adding a panel.', true); }
  const source = compatibleSource(plugin, state.catalog); if (source) panel.source = source;
  // Display defaults stay inherited from the installed copy until explicitly edited.
  const type = state.catalog.screenTypes.find(item => item.id === screen.type);
  let inserted=false;
  if (!['grid','flow','single'].includes(screen.type)) {
    const before=JSON.stringify(screen),screenId=state.selectedScreenId;
    try {
      const renderer=await import(`/screen-types/${encodeURIComponent(screen.type)}/renderer.js?v=${encodeURIComponent(type?.version||'1')}`);
      if(currentScreen()!==screen||JSON.stringify(screen)!==before)return toast('The screen changed. Choose the plugin again.',true);
      if(typeof renderer.editor?.add==='function'){
        const candidate=clone(screen);
        await renderer.editor.add(candidate,panel);
        if(currentScreen()!==screen||JSON.stringify(screen)!==before)return toast('The screen changed. Choose the plugin again.',true);
        if(!candidate.panels.some(item=>item.id===panel.id))throw new Error('This layout could not place the new panel.');
        screen=state.design.screens[screenId]=candidate;inserted=true;
      }else{panel.position=schemaDefaults(type?.positionSchema);panel.size=schemaDefaults(type?.sizeSchema);}
    }catch(error){return showNotice(`Could not add this panel: ${error.message}`);}
  }
  if (screen.type === 'flow') panel.size = { columns: 1, rows: 1 };
  if(!inserted)screen.panels.push(panel);
  $('#library').hidden = true;
  state.selectedPanelId = panel.id;
  markDirty(`${pluginName(plugin)} panel added · unsaved`);
  setInspectorTab('panel');
  renderAll();
  if (innerWidth < 1100) showTool('canvas');
  toast(`${pluginName(plugin)} added. Save changes when you’re ready.`);
  await renderCanvas();
  $('#design-surface').querySelector(`[data-panel="${CSS.escape(panel.id)}"]`)?.focus({preventScroll:true});
}

function removePanel() {
  if (!canLeaveField()) return;
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
  if (!canLeaveField()) return;
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
  return schemaDefaults(state.catalog.screenTypes.find(item => item.id === type)?.layoutSchema);
}

function applyTheme(themeId) {
  if (!canLeaveField()) return;
  if (!THEMES[themeId]) return;
  currentScreen().appearance = clone(THEMES[themeId]);
  markDirty(`${$('#theme-preset').selectedOptions[0].textContent} theme applied · unsaved`);
  renderInspector();
  renderCanvas();
}

function resetTheme() {
  if (!canLeaveField()) return;
  currentScreen().appearance = {};
  markDirty('Screen now inherits project defaults · unsaved');
  renderInspector();
  renderCanvas();
}

function changeScreenType(type) {
  if (!canLeaveField()) return;
  const screen = currentScreen();
  if (type === screen.type) return;
  if (type === 'single' && screen.panels.length > 1) {
    toast('A single screen can contain only one panel. Remove the others first.', true);
    $('#screen-type').value = screen.type;
    return;
  }
  const layout = defaultLayout(type);
  const panels = clone(screen.panels);
  if (type === 'grid') {
    const placed = [];
    for (const panel of panels) {
      panel.position = gridSlot({layout, panels:placed});
      if (!panel.position) return toast('There are too many panels for this grid. Remove a panel first.', true);
      placed.push(panel);
    }
  }
  if (type === 'flow') for (const panel of panels) panel.size = {columns:1,rows:1};
  screen.type = type; screen.layout = layout; screen.panels = panels;
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
  if (!canLeaveField()) return;
  state.generatedScreenFields = true;
  $('#screen-form').reset();
  $('#new-screen-advanced').open = false;
  $('#new-screen-error').textContent = '';
  $('#new-screen-title').value = '';
  const address = screenAddress('', state.design.screens);
  $('#new-screen-id').value = address.id;
  $('#new-screen-path').value = address.path;
  $('#new-screen-type').value = state.catalog.screenTypes.some(type => type.id === 'grid') ? 'grid' : state.catalog.screenTypes[0]?.id;
  describeNewLayout();
  $('#screen-dialog').showModal();
  $('#new-screen-title').select();
}

function describeNewLayout() {
  const type = $('#new-screen-type').value;
  $('#new-layout-help').textContent = ({grid:'Arrange and resize panels freely. Best for a fixed display.',flow:'Panels rearrange to fit the display. Best for tablets and different screen sizes.',single:'One panel fills the screen. Best for a news feed or camera.'})[type] || 'A custom layout supplied by an installed extension.';
}
function screenCreationError(message) {
  $('#new-screen-advanced').open = true;
  $('#new-screen-error').textContent = message;
}
function createScreenFromDialog() {
  const id = $('#new-screen-id').value.trim();
  const title = $('#new-screen-title').value.trim();
  const path = $('#new-screen-path').value.trim();
  const type = $('#new-screen-type').value;
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return screenCreationError('Use an ID starting with a letter, followed by lowercase letters, numbers or hyphens.');
  if (state.design.screens[id]) return screenCreationError(`Screen ID “${id}” is already in use. Choose another.`);
  const pathError = screenPathError(path);
  if (pathError) return screenCreationError(pathError);
  if (Object.values(state.design.screens).some(screen => screen.path === path)) return screenCreationError(`Web address “${path}” is already in use. Choose another.`);
  state.design.screens[id] = { id, title: title || id, path, type, layout: defaultLayout(type), appearance: {}, panels: [] };
  state.selectedScreenId = id;
  state.selectedPanelId = '';
  markDirty('Screen created · add a panel and save');
  $('#screen-dialog').close();
  rememberScreen();
  renderAll();
  openPanelLibrary();
}

function duplicateScreen() {
  if (!canLeaveField()) return;
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

function deleteScreen(confirmed = false) {
  if (!canLeaveField()) return;
  const ids = Object.keys(state.design.screens);
  if (ids.length <= 1) return toast('A Castboard project must keep at least one screen.', true);
  const screen = currentScreen();
  if (confirmed !== true) return showNotice(`Remove “${screen.title || state.selectedScreenId}”? Its delivery settings will be removed when you save.`, [['Remove screen', () => deleteScreen(true)], ['Cancel', () => showNotice('')]]);
  showNotice('');
  const deletedId = state.selectedScreenId;
  const references=Object.values(state.design.screens).flatMap(screen=>screen.panels).filter(panel=>['modal','screen'].includes(panel.interaction?.type)&&panel.interaction.screenId===deletedId);
  if(references.length)return toast('Change the '+references.length+' tap destination(s) using this screen before removing it.',true);
  delete state.design.screens[deletedId];
  if (state.design.defaultScreen === deletedId) state.design.defaultScreen = Object.keys(state.design.screens)[0];
  state.selectedScreenId = state.design.defaultScreen;
  state.selectedPanelId = '';
  markDirty('Screen deleted · unsaved');
  renderAll();
}

function validateDesign() {
  const errors = [];
  const invalid = invalidField(); if (invalid) errors.push('Correct the highlighted setting before saving.');
  const screens = Object.entries(state.design.screens);
  if (!screens.length) errors.push('At least one screen is required.');
  if (!state.design.screens[state.design.defaultScreen]) errors.push('The default screen does not exist.');
  const paths = new Set();
  const installed=Object.fromEntries((state.runtime?.plugins||[]).map(plugin=>[plugin.id,{enabled:true}]));
  for (const [id, screen] of screens) {
    for(const panel of screen.panels){try{validateInteraction(panel.interaction,state.design.screens,installed,`${screen.title||id}: ${panel.id}`);}catch(error){errors.push(error.message);}}
    if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`Screen ID “${id}” is invalid.`);
    const pathError = screenPathError(screen.path);
    if (pathError) errors.push(`${screen.title || id}: ${pathError}`);
    if (paths.has(screen.path)) errors.push(`Screen path “${screen.path}” is duplicated.`);
    paths.add(screen.path);
    if (screen.type === 'single' && screen.panels.length !== 1) errors.push(`${screen.title || id} is a single screen and needs exactly one panel.`);
    const panelIds = new Set();
    for (const panel of screen.panels) {
      if (!panel.id || panelIds.has(panel.id)) errors.push(`${screen.title || id} has missing or duplicate panel IDs.`);
      panelIds.add(panel.id);
      if (!state.catalog.plugins.some(plugin => plugin.id === panel.plugin)) errors.push(`${panel.id} references unavailable plugin “${panel.plugin}”.`);
      const module = state.catalog.plugins.find(item => item.id === panel.plugin);
      const source = (state.catalog.sources || []).find(item => item.id === (panel.source || panel.plugin));
      if (module?.inputContract && (!source || source.contract !== module.inputContract)) errors.push(`${panel.id} needs a compatible data source.`);
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
  if (state.saving) return;
  if (!canLeaveField()) return;
  const errors = validateDesign();
  if (errors.length) return toast(errors[0], true);
  $('#save-design').disabled = true;
  state.saving = true; updateHistory();
  const snapshot = clone(state.design);
  setStatus('Saving…');
  try {
    const result = await requestDesign('PUT', { revision: state.revision, design: snapshot });
    state.revision = result.revision;
    state.savedDesign = clone(result.design);
    if (JSON.stringify(state.design) === JSON.stringify(snapshot)) state.design = result.design;
    state.catalog = result.catalog;
    state.saving = false;
    showNotice('');
    if (!invalidField()) renderAll();
    else { renderScreens(); renderPanelList(); updateOpenScreen(); }
    markDirty(); refreshPreview();
    toast(state.dirty ? 'Saved. Newer edits are still unsaved.' : 'Changes saved. Running screens will update.');
  } catch (error) {
    state.saving = false; $('#save-design').disabled = false; updateHistory();
    if (error.code === 'REVISION_CONFLICT') {
      setStatus('Configuration changed elsewhere', 'error');
      showNotice('The configuration changed elsewhere. Your draft is still here.', [['Review latest changes', reconcileDesign], ['Download draft', downloadDraft]]);
    } else {
      setStatus('Save failed · changes are still local', 'error');
      toast(error.message, true);
    }
  }
}

let pendingDesignMerge;
function draftSummary(value, path) {
  if (value === undefined) return 'Removed';
  if (Array.isArray(value)) return path.at(-1) === 'panels' ? `${value.length} panels: ${value.map(panel => panel.options?.title || panel.options?.label || pluginName(panel.plugin) || panel.id).join(', ')}` : value.map(item=>typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
  if (value && typeof value === 'object') return value.title || Object.entries(value).map(([key,item])=>`${key.replace(/([A-Z])/g,' $1')}: ${typeof item === 'object' ? JSON.stringify(item) : item}`).join(' · ');
  return String(value);
}
function conflictLabel(path) {
  const words = value => String(value).replace(/([A-Z])/g, ' $1').replace(/[-_]/g,' ').toLowerCase();
  if (path[0] === 'screens') {
    const screen = state.design.screens[path[1]] || state.savedDesign.screens[path[1]];
    let parts = path.slice(2);
    if (parts[0] === 'panels' && typeof parts[1] === 'number') {
      const panel = screen?.panels[parts[1]];
      parts = [panel?.options?.title || panel?.options?.label || pluginName(panel?.plugin) || 'Panel', ...parts.slice(2)];
    }
    return `${screen?.title || path[1]} — ${parts.map(words).join(' / ') || 'screen'}`;
  }
  return path.map(words).join(' / ') || 'Whole design';
}
function applyDesignMerge(design, result) {
  state.pendingDraft = null; $('.studio').inert = false;
  if (result.selected) state.selectedScreenId = result.selected;
  state.design = design;
  state.savedDesign = clone(result.design);
  state.revision = result.revision;
  state.catalog = result.catalog;
  if (result.runtime) state.runtime = result.runtime;
  state.history = new History(result.design);
  state.history.record(design);
  if (!state.design.screens[state.selectedScreenId]) state.selectedScreenId = state.design.defaultScreen;
  if (!currentPanel()) state.selectedPanelId = '';
  populateCatalogControls(); rememberScreen(); renderAll(); markDirty();
  showNotice(state.dirty ? 'Your draft is ready with the latest saved changes. Review it, then save.' : 'The latest saved changes are loaded.');
  applyRequestedPanel();
}
function reviewDesignMerge(base, design, result) {
  const merged = base ? mergeDraft(base, design, result.design) : {value:result.design,conflicts:[{path:[],local:design,latest:result.design}]};
  if (!merged.conflicts.length) return applyDesignMerge(merged.value, result);
  pendingDesignMerge = {merged, result};
  $('#cancel-draft-review').textContent = result.restoring ? 'Back' : 'Keep editing';
  const list = $('#draft-conflicts'); list.replaceChildren();
  merged.conflicts.forEach((conflict, index) => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = conflictLabel(conflict.path); fieldset.append(legend);
    for (const [value, label] of [['local','Your draft'],['latest','Latest saved']]) {
      const option = document.createElement('label');
      const input = document.createElement('input'); input.type = 'radio'; input.name = `conflict-${index}`; input.value = value; input.required = true;
      const text = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = label;
      const summary = document.createElement('small'); summary.textContent = draftSummary(conflict[value], conflict.path);
      text.append(title, summary); option.append(input, text); fieldset.append(option);
    }
    list.append(fieldset);
  });
  $('#draft-conflict-dialog').showModal();
}
async function reconcileDesign() {
  if (state.saving) return;
  try {
    const latest = await requestDesign();
    const runtime = await fetch('/api/runtime-config', {cache:'no-store'});
    if (!runtime.ok) throw new Error('Could not load the latest preview settings.');
    latest.runtime = await runtime.json();
    reviewDesignMerge(state.savedDesign, state.design, latest);
  }
  catch (error) { showNotice(`${error.message} Your draft is still here.`, [['Try again', reconcileDesign]]); }
}
function restoreSavedDraft(draft) {
  if (draft.revision === state.revision) return applyDesignMerge(draft.design, {design:state.savedDesign,revision:state.revision,catalog:state.catalog,selected:draft.selected,restoring:true});
  reviewDesignMerge(draft.base, draft.design, {design:state.savedDesign,revision:state.revision,catalog:state.catalog,selected:draft.selected,restoring:true});
}

function downloadDraft() {
  const blob = new Blob([JSON.stringify(state.design, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'castboard-design-draft.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bindEvents() {
  $('#cancel-draft-review').onclick = () => $('#draft-conflict-dialog').close();
  $('#draft-conflict-form').onsubmit = event => {
    event.preventDefault();
    const fields = new FormData(event.target);
    const {merged,result} = pendingDesignMerge;
    const resolved = resolveDraft(merged, merged.conflicts.map((_,index)=>fields.get(`conflict-${index}`)));
    $('#draft-conflict-dialog').close(); applyDesignMerge(resolved,result);
  };
  for(const swatch of $$('input[type=color]')) {
    const input=document.createElement('input');input.type='text';input.className='hex-color';input.pattern='#[0-9a-fA-F]{6}';input.maxLength=7;input.required=true;
    const field=swatch.closest('label').querySelector('span').textContent;
    input.setAttribute('aria-label',`${swatch.dataset.panelAppearance?'Panel':'Screen'} ${field} hex colour`);
    input.value=swatch.value;swatch.after(input);
    input.addEventListener('input',()=>{if(input.validity.valid){swatch.value=input.value;swatch.dispatchEvent(new Event('input',{bubbles:true}));}else markDirty();});
    swatch.addEventListener('input',()=>{input.value=swatch.value;});
  }

  document.addEventListener('input', event => {if (event.target.closest('#screen-inspector,#panel-inspector,.branding-section')) queueMicrotask(() => markDirty());});
  window.addEventListener('message', event => { if (event.origin === window.location.origin && event.source === $('#live-preview').contentWindow && event.data?.type === 'castboard-preview-ready') {state.previewReady = true; sendDraft();} });
  $('#undo').addEventListener('click', () => restoreHistory('undo'));
  $('#redo').addEventListener('click', () => restoreHistory('redo'));
  $('#discard').addEventListener('click', discardDraft);
  $('#show-library').addEventListener('click', openPanelLibrary);
  $('#add-first-panel').addEventListener('click', openPanelLibrary);
  $('#close-library').addEventListener('click', closePanelLibrary);
  $('#library').addEventListener('keydown', event => {if(event.key === 'Escape'){event.preventDefault();closePanelLibrary();}});
  $('#plugin-search').addEventListener('input', renderPluginLibrary);
  for (const button of $$('.mobile-tools [data-tool]')) button.addEventListener('click', () => {if (!canLeaveField()) return; $('.studio').dataset.tool = button.dataset.tool; for (const item of $$('.mobile-tools [data-tool]')) item.setAttribute('aria-pressed',String(item === button)); resizeCanvasFrame();});
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (state.dirty) saveDesign(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)) {event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo');}
  });
  $('#save-design').addEventListener('click', saveDesign);
  $('#set-up-display').addEventListener('click', () => window.open(`/setup?screen=${encodeURIComponent(state.selectedScreenId)}`, '_blank', 'noopener'));
  $('#open-screen').addEventListener('click', () => window.open(state.savedDesign.screens[state.selectedScreenId].path, '_blank', 'noopener'));
  $('#add-screen').addEventListener('click', showNewScreenDialog);
  $('#duplicate-screen').addEventListener('click', duplicateScreen);
  $('#delete-screen').addEventListener('click', () => deleteScreen());
  $('#reset-preview').onclick=()=>{state.previewReset=(state.previewReset||0)+1;sendDraft();};
  $('#screen-presentation').onchange=()=>{currentScreen().presentation=$('#screen-presentation').value;markDirty('Presentation changed');renderCanvas();};
  for(const field of ['width','height'])$('#screen-'+field).onchange=()=>{
    const width=Number($('#screen-width').value),height=Number($('#screen-height').value);
    if(!width&&!height)delete currentScreen().viewport;
    else currentScreen().viewport={width:width||800,height:height||480};
    markDirty('Preferred size changed');renderInspector();renderCanvas();
  };
  $('#interaction-type').onchange=()=>{
    const panel=currentPanel(),type=$('#interaction-type').value;
    if(type)panel.interaction={type,...(['modal','screen'].includes(type)?{screenId:currentPanel().interaction?.screenId||''}:{}),...(type==='action'?{action:''}:{})};
    else delete panel.interaction;
    markDirty('Tap behaviour changed');renderInteractionFields();renderCanvas();
  };
  for(const field of ['screen','source','action','payload','label','confirmation'])$('#interaction-'+field).addEventListener('change',()=>{saveInteractionFields();if(field==='screen')$('#interaction-edit').disabled=!state.design.screens[$('#interaction-screen').value];});
  $('#interaction-edit').onclick=()=>{if(!canLeaveField())return;state.selectedScreenId=currentPanel().interaction.screenId;state.selectedPanelId='';rememberScreen();renderAll();setInspectorTab('screen');};
  $('#interaction-create').onclick=()=>{
    if(!canLeaveField())return;
    const panel=currentPanel(),id=uniqueScreenId((panel.options?.title||pluginName(panel.plugin))+' details');
    state.design.screens[id]={id,title:(panel.options?.title||pluginName(panel.plugin))+' details',path:'/screens/'+id,type:'grid',layout:defaultLayout('grid'),appearance:{},presentation:'modal',viewport:{width:800,height:480},panels:[]};
    panel.interaction={type:'modal',screenId:id};
    state.selectedScreenId=id;state.selectedPanelId='';markDirty('Modal created · add panels and save');rememberScreen();renderAll();setInspectorTab('screen');openPanelLibrary();
  };

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
    if(!canLeaveField())return;
    delete currentPanel().appearance;
    markDirty('Panel style overrides cleared · unsaved');
    renderPanelInspector();
    renderCanvas();
  });
  $('#panel-earlier').addEventListener('click', () => movePanel(-1));
  $('#panel-later').addEventListener('click', () => movePanel(1));
  for (const button of $$('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
  for (const button of $$('.inspector-tabs [data-inspector]')) button.addEventListener('click', () => {if (canLeaveField()) setInspectorTab(button.dataset.inspector);});

  for (const input of $$('[data-branding]')) input.addEventListener('input', () => {
    state.design.branding ||= {};
    state.design.branding[input.dataset.branding] = input.value;
    if (input.dataset.branding === 'accent') {
      $('#brand-accent-value').textContent = input.value;

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
    if (!input.validity.valid || !Number.isFinite(value)) return;
    currentScreen().layout ||= {};
    currentScreen().layout[input.dataset.layout] = value;
    markDirty('Layout changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-appearance]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (!input.validity.valid) return;
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

  for (const input of $$('[data-panel-appearance]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (!input.validity.valid) return;
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
    if(!canLeaveField())return;
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
    if(!canLeaveField())return;
    panel[input.dataset.panel] = input.value;
    if (input.dataset.panel === 'id') state.selectedPanelId = input.value;
    if (input.dataset.panel === 'plugin') {delete panel.source; delete panel.options; const source = compatibleSource(panel.plugin, state.catalog); if (source) panel.source = source; renderPanelInspector();}
    markDirty();
    if (input.dataset.panel === 'plugin' || oldId !== panel.id) {renderPanelList();renderCanvas();}
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
    if (!input.validity.valid || !Number.isInteger(value)) return;
    currentPanel().position ||= {};
    currentPanel().position[input.dataset.position] = value;
    markDirty('Panel placement changed · unsaved');
    renderCanvas();
  });

  for (const input of $$('[data-size]')) input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!input.validity.valid || !Number.isInteger(value)) return;
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
      $('#options-error').textContent = ''; $('#panel-options').setCustomValidity('');
      markDirty('Advanced panel options changed · unsaved');
      renderCanvas();
    } catch (error) {
      $('#options-error').textContent = error.message; $('#panel-options').setCustomValidity('Enter a valid JSON object'); markDirty();
    }
  });
  $('#panel-source').addEventListener('change', () => {
    if ($('#panel-source').value) currentPanel().source = $('#panel-source').value;
    else delete currentPanel().source;
    markDirty('Data source changed');
  });

  $('#custom-layout').addEventListener('input', () => {
    try {
      const layout = JSON.parse($('#custom-layout').value || '{}');
      if (!layout || typeof layout !== 'object' || Array.isArray(layout)) throw new Error('Layout must be a JSON object');
      currentScreen().layout = layout;
      $('#custom-layout-error').textContent = ''; $('#custom-layout').setCustomValidity('');
      markDirty('Custom layout changed · unsaved'); renderCanvas();
    } catch (error) {
      $('#custom-layout-error').textContent = error.message; $('#custom-layout').setCustomValidity('Enter a valid JSON object'); markDirty();
    }
  });

  for (const [selector, field] of [['#custom-position', 'position'], ['#custom-size', 'size']]) {
    $(selector).addEventListener('input', () => {
      try {
        const value = JSON.parse($(selector).value || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be a JSON object`);
        currentPanel()[field] = value;
        $('#custom-panel-error').textContent = ''; $(selector).setCustomValidity('');
        markDirty(`Custom panel ${field} changed · unsaved`); renderCanvas();
      } catch (error) {
        $('#custom-panel-error').textContent = error.message; $(selector).setCustomValidity('Enter a valid JSON object'); markDirty();
      }
    });
  }

  $('#viewport').addEventListener('change', () => {
    const [width, height] = $('#viewport').value.split('x').map(Number);
    state.viewport = { width, height };
    resizeCanvasFrame();
  });

  $('#new-screen-type').addEventListener('change', describeNewLayout);
  for (const selector of ['#new-screen-id','#new-screen-path']) $(selector).addEventListener('input', () => { state.generatedScreenFields = false; });
  $('#screen-form').addEventListener('invalid',()=>{$('#new-screen-advanced').open=true;},true);
  $('#new-screen-title').addEventListener('input', () => {
    if (!state.generatedScreenFields) return;
    const address = screenAddress($('#new-screen-title').value,state.design.screens);
    $('#new-screen-id').value = address.id;
    $('#new-screen-path').value = address.path;
  });
  $('#screen-form').addEventListener('submit', event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') return $('#screen-dialog').close();
    createScreenFromDialog();
    state.generatedScreenFields = true;
  });

  $('#token-form').addEventListener('submit', async event => {
    event.preventDefault();
    state.token = $('#admin-token').value.trim();
    $('#token-error').textContent = ''; $('#admin-token').removeAttribute('aria-invalid');
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
  new ResizeObserver(() => document.documentElement.style.setProperty('--notice-height',`${$('#notice').getBoundingClientRect().height}px`)).observe($('#notice'));
}

bindEvents();
loadDesign();
