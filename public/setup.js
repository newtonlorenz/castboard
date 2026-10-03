const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let report;
let delivery;
let selectedScreen = new URL(location.href).searchParams.get('screen');
let deliveryBusy = false;
const displayDrafts = new Map();
const checks = new Map();
let token = sessionStorage.getItem('castboard-admin-token') || '';

async function request(path, init = {}, retry = true) {
  const headers = { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let response;
  try { response = await fetch(path, { ...init, headers, cache: 'no-store' }); }
  catch { throw new Error('Could not reach Castboard. Check your connection, then try again.'); }
  if (response.status === 403) {
    if (!$('#token-dialog').open) $('#token-dialog').showModal();
    throw new Error('Enter your admin token to continue.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status})`);
  return payload;
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  setTimeout(() => $('#toast').classList.remove('visible'), 2200);
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function command(value) {
  return `<div class="command"><span>${escapeHtml(value)}</span><button type="button" data-copy="${escapeHtml(value)}">Copy</button></div>`;
}

function runtimeRow(title, status, detail, extra = '') {
  return `<article class="runtime-row"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p><span class="pill ${status === 'Installed' || status === 'Running' ? '' : 'demo'}">${escapeHtml(status)}</span><div class="runtime-extra">${extra}</div></article>`;
}
function renderModules() {
  const search = $('#connection-search').value.toLowerCase();
  const plugins = report.plugins.filter(plugin => `${plugin.name} ${plugin.id} ${plugin.provider}`.toLowerCase().includes(search));
  $('#plugin-list').innerHTML = plugins.map(plugin => {
    const check = checks.get(plugin.id);
    const labels = {ready:'Configured', custom:'Plugin settings', adapter:'Adapter', demo:'Demo data', blocked:'Tool missing'};
    return `<article class="connection-row"><div><h3>${escapeHtml(plugin.name)}</h3><span class="provider">${escapeHtml(plugin.id)} · ${escapeHtml(plugin.provider)} · ${plugin.usedBy ? `${plugin.usedBy} screen${plugin.usedBy === 1 ? '' : 's'}` : 'Not on a screen'}</span></div><div class="connection-description"><div class="connection-state"><span class="pill ${escapeHtml(plugin.status)}">${escapeHtml(labels[plugin.status] || plugin.label)}</span></div><p>${escapeHtml(plugin.detail)}</p></div><div class="card-actions"><a class="button" href="/admin/plugins?plugin=${encodeURIComponent(plugin.id)}">Configure</a>${plugin.canTest ? `<button type="button" data-test-plugin="${escapeHtml(plugin.id)}" aria-label="Test ${escapeHtml(plugin.name)} (${escapeHtml(plugin.id)})" ${check?.pending ? 'disabled' : ''}>${check?.pending ? 'Testing…' : 'Test'}</button>` : ''}</div><div role="status" class="test-result ${check ? check.ok ? 'ok' : check.pending ? '' : 'bad' : ''}" data-result="${escapeHtml(plugin.id)}">${escapeHtml(check?.message || '')}</div></article>`;
  }).join('') || '<p class="no-results">No plugins match this search.</p>';
  bindDynamicActions();
}
function render(nextReport) {
  report = nextReport;
  const blocked = report.plugins.filter(plugin => plugin.status === 'blocked').length;
  const demos = report.plugins.filter(plugin => plugin.status === 'demo').length;
  $('#overall').className = `overall ${blocked ? 'attention' : ''}`;
  $('#overall').innerHTML = `<strong>${report.plugins.length} plugins · ${report.screens.length} screen${report.screens.length === 1 ? '' : 's'}</strong><span>${blocked ? `${blocked} plugins need a server tool. ` : ''}${demos ? `${demos} ${demos === 1 ? 'uses' : 'use'} demo data. ` : ''}Connections have not been tested by this configuration check.</span>`;
  $('#runtime-cards').innerHTML = [
    runtimeRow('Castboard', 'Running', report.urls.local, report.config.usingExample ? command('cp castboard.config.example.json castboard.config.json') : ''),
    runtimeRow('Google Cast', report.tools.catt.installed ? 'Installed' : 'Optional · missing', report.tools.catt.version || 'Install catt to discover and cast to Google Cast devices.', report.tools.catt.installed ? '' : command(report.tools.catt.install)),
    runtimeRow('Spotify playback', report.tools.spotifyPlayer.installed ? 'Installed' : 'Optional · missing', report.tools.spotifyPlayer.installed ? report.tools.spotifyPlayer.version : 'Install spotify_player only if you use its playback plugin.', report.tools.spotifyPlayer.installed ? command(report.tools.spotifyPlayer.authenticate) : `${command('brew install spotify_player')}${command('cargo install spotify_player --locked')}`),
  ].join('');
  renderModules();
}

function bindDynamicActions() {
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    await copyText(button.dataset.copy);
    toast('Copied');
  }));
  document.querySelectorAll('[data-test-plugin]').forEach(button => button.addEventListener('click', async () => {
    const result = $(`[data-result="${CSS.escape(button.dataset.testPlugin)}"]`);
    button.disabled = true; button.textContent = 'Testing…'; checks.set(button.dataset.testPlugin,{pending:true,message:'Testing…'});
    result.className = 'test-result';
    result.textContent = 'Testing…';
    try {
      const payload = await request('/api/admin/setup/test-plugin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: button.dataset.testPlugin }) });
      result.className = `test-result ${payload.ok ? 'ok' : 'bad'}`;
      const message = `${payload.message}${payload.latencyMs !== undefined ? ` · ${payload.latencyMs} ms` : ''}`;
      checks.set(button.dataset.testPlugin, {ok:payload.ok, message}); result.textContent = message;
    } catch (error) {
      result.className = 'test-result bad';
      result.textContent = error.message; checks.set(button.dataset.testPlugin,{ok:false,message:error.message});
    } finally { button.disabled = false; button.textContent = 'Test'; }
  }));
}

async function load() {
  $('#overall').className = 'overall loading';
  $('#overall').innerHTML = '<strong>Checking configuration…</strong><span>Reading plugins, screens and server tools.</span>';
  $('#refresh').disabled = true;
  try { render(await request('/api/admin/setup')); }
  catch (error) { $('#overall').className = 'overall attention'; $('#overall').innerHTML = `<strong>Could not load connections</strong><span>${escapeHtml(error.message)} Use Refresh checks to retry.</span>`; }
  finally { $('#refresh').disabled = false; }
}

$('#refresh').addEventListener('click', () => { load(); if (!deliveryBusy) loadDelivery(); });
$('#connection-search').addEventListener('input', () => {if (report) renderModules();});
$('#token-form').addEventListener('submit', async event => {event.preventDefault(); token = $('#admin-token').value; sessionStorage.setItem('castboard-admin-token',token); $('#token-dialog').close(); await Promise.all([load(), loadDelivery()]);});
function rememberDisplayDrafts() {
  document.querySelectorAll('.delivery-screen').forEach(article => {
    const form = article.querySelector('.display-form');
    if (form) displayDrafts.set(article.dataset.screen, {name: form.elements.name.value, device: form.elements.device.value, open: article.querySelector('.add-display').open});
  });
}

function renderDelivery() {
  if (!delivery) return;
  $('#screen-list').innerHTML = delivery.screens.map(screen => {
    const expanded = selectedScreen === screen.id;
    const browserLink = screen.displayUrl ? `<div class="display-link"><span>${escapeHtml(screen.displayUrl)}</span><button class="button secondary" type="button" data-display-copy="${escapeHtml(screen.id)}">Copy link</button></div><p class="field-help">Open this link in the browser on your tablet, TV or kiosk.</p>` : `<p class="delivery-note">${escapeHtml(screen.linkMessage)}</p>`;
    const targets = screen.targets.map(target => `<li class="display-target"><div><strong>${escapeHtml(target.name)}</strong><small>${escapeHtml(target.protocol === 'google-cast' ? 'Google Cast' : target.protocol === 'url' ? 'Browser display' : target.protocol)}</small></div><div class="display-actions"><button class="button secondary" type="button" data-send="${target.index}" ${target.canSend ? '' : 'disabled'}>Send screen</button><button class="button quiet" type="button" data-remove="${target.index}" aria-label="Remove ${escapeHtml(target.name)}">Remove</button></div><div class="remove-confirm" data-confirm="${target.index}" hidden><p>Remove this display from ${escapeHtml(screen.title)}? It will keep showing its current screen.</p><button class="button danger" type="button" data-confirm-remove="${target.index}">Remove display</button><button class="button secondary" type="button" data-keep="${target.index}">Keep display</button></div>${!target.canSend ? `<p class="target-note">${target.protocol === 'url' ? 'Use the browser link above on this display.' : !screen.displayUrl && screen.linkMessage.startsWith('This server') ? 'Set a reachable display URL before sending.' : 'Enable this delivery method in the server configuration.'}</p>` : ''}</li>`).join('');
    return `<article class="delivery-screen" data-screen="${escapeHtml(screen.id)}"><div class="delivery-summary"><div><h3>${escapeHtml(screen.title)}</h3><p>${screen.targets.length ? `${screen.targets.length} saved display${screen.targets.length === 1 ? '' : 's'}` : 'No displays saved'}</p></div><div class="display-actions"><a class="button secondary" href="${escapeHtml(screen.path)}" target="_blank" rel="noopener">Open screen</a><button type="button" class="button ${expanded ? 'secondary' : 'primary'}" data-delivery-select="${escapeHtml(screen.id)}" aria-expanded="${expanded}" aria-controls="delivery-${escapeHtml(screen.id)}">${expanded ? 'Close settings' : 'Set up display'}</button></div></div><div id="delivery-${escapeHtml(screen.id)}" class="delivery-editor" ${expanded ? '' : 'hidden'}><h4>Browser link</h4>${browserLink}<h4>Saved displays</h4>${targets ? `<ul class="display-targets">${targets}</ul>` : '<p class="delivery-empty">Connect a Google Cast display below, or use the browser link above.</p>'}<details class="add-display"><summary>Add a Cast display</summary><p>Find a display on your network, or enter its device name or IP address. Adding it saves the connection; Send screen starts casting.</p><button class="button secondary" type="button" data-discover>Find displays</button><div class="discovery-results" role="status" aria-live="polite"></div><form class="display-form"><label class="field"><span>Display name</span><input name="name" required maxlength="100" placeholder="e.g. Reception" autocomplete="off"></label><label class="field"><span>Device name or IP address</span><input name="device" required maxlength="200" placeholder="e.g. Reception TV" autocomplete="off"></label><button type="submit" class="button primary" ${delivery.castEnabled ? '' : 'disabled'}>Add display</button>${delivery.castEnabled ? '' : '<p class="field-error">Google Cast is disabled in the server configuration.</p>'}</form></details><p class="delivery-feedback" role="status" aria-live="polite"></p></div></article>`;
  }).join('') || '<p class="no-results">Create a screen in <a href="/admin">Screens</a> to connect a display.</p>';
  document.querySelectorAll('.delivery-screen').forEach(article => {
    const draft = displayDrafts.get(article.dataset.screen);
    if (!draft) return;
    const form = article.querySelector('.display-form');
    form.elements.name.value = draft.name; form.elements.device.value = draft.device;
    article.querySelector('.add-display').open = draft.open;
  });
}

async function loadDelivery() {
  const focusedControl = document.activeElement;
  rememberDisplayDrafts();
  $('#refresh-displays').disabled = true;
  try {
    delivery = await request('/api/admin/delivery');
    if (!delivery.screens.some(screen => screen.id === selectedScreen)) selectedScreen = null;
    renderDelivery();
    $('#delivery-status').textContent = '';
  } catch (error) { $('#delivery-status').textContent = `${error.message} Use Refresh displays to retry.`; }
  finally { $('#refresh-displays').disabled = false; if (focusedControl?.isConnected && !focusedControl.disabled) focusedControl.focus(); }
}

async function updateDelivery(body, article) {
  if (deliveryBusy) return;
  deliveryBusy = true;
  const feedback = article.querySelector('.delivery-feedback');
  feedback.classList.remove('bad');
  feedback.textContent = body.action === 'send' ? 'Sending screen… This may take a moment.' : 'Saving display…';
  const buttons = [...$('#screen-list').querySelectorAll('button, input')];
  const previous = buttons.map(control => control.disabled);
  const focusedControl = document.activeElement;
  buttons.forEach(control => { control.disabled = true; });
  $('#refresh-displays').disabled = true;
  try {
    const result = await request('/api/admin/delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, screenId: article.dataset.screen, revision: delivery.revision }) });
    if (body.action === 'send') feedback.textContent = result.message;
    else {
      rememberDisplayDrafts();
      if (body.action === 'add') displayDrafts.delete(article.dataset.screen);
      delivery = result;
      renderDelivery();
      const editor = document.getElementById(`delivery-${body.screenId || article.dataset.screen}`);
      editor.querySelector('.delivery-feedback').textContent = body.action === 'add' ? 'Display added. Choose Send screen when you are ready.' : 'Display removed.';
      (body.action === 'add' ? editor.querySelector('.display-target:last-child [data-send]:not(:disabled)') || editor.querySelector('summary') : editor.querySelector('summary'))?.focus();
    }
  } catch (error) { feedback.classList.add('bad'); feedback.textContent = error.message; }
  finally {
    deliveryBusy = false;
    buttons.forEach((control, index) => { control.disabled = previous[index]; });
    $('#refresh-displays').disabled = false;
    if (focusedControl?.isConnected && !focusedControl.disabled) focusedControl.focus();
  }
}

$('#refresh-displays').addEventListener('click', loadDelivery);
$('#screen-list').addEventListener('submit', event => {
  if (!event.target.matches('.display-form')) return;
  event.preventDefault();
  const fields = new FormData(event.target);
  updateDelivery({action:'add',name:fields.get('name'),device:fields.get('device')}, event.target.closest('[data-screen]'));
});
$('#screen-list').addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || deliveryBusy) return;
  const article = button.closest('[data-screen]');
  if (button.hasAttribute('data-delivery-select')) {
    rememberDisplayDrafts();
    selectedScreen = selectedScreen === button.dataset.deliverySelect ? null : button.dataset.deliverySelect;
    const url = new URL(location.href);
    selectedScreen ? url.searchParams.set('screen', selectedScreen) : url.searchParams.delete('screen');
    history.replaceState(null, '', url);
    renderDelivery();
    document.querySelector(`[data-delivery-select="${CSS.escape(button.dataset.deliverySelect)}"]`)?.focus();
  } else if (button.hasAttribute('data-display-copy')) {
    await copyText(delivery.screens.find(screen => screen.id === button.dataset.displayCopy).displayUrl);
    toast('Screen link copied');
  } else if (button.hasAttribute('data-send')) {
    await updateDelivery({action:'send',index:Number(button.dataset.send)}, article);
  } else if (button.hasAttribute('data-remove') || button.hasAttribute('data-keep')) {
    const index = button.dataset.remove ?? button.dataset.keep;
    const confirm = article.querySelector(`[data-confirm="${index}"]`);
    confirm.hidden = button.hasAttribute('data-keep');
    (confirm.hidden ? article.querySelector(`[data-remove="${index}"]`) : confirm.querySelector('[data-keep]')).focus();
  } else if (button.hasAttribute('data-confirm-remove')) {
    await updateDelivery({action:'remove',index:Number(button.dataset.confirmRemove)}, article);
  } else if (button.hasAttribute('data-discover')) {
    const output = article.querySelector('.discovery-results');
    output.textContent = 'Looking for displays on your network…';
    button.disabled = true;
    try {
      const result = await request('/api/admin/setup/discover-cast', { method: 'POST' });
      output.innerHTML = `<p>${escapeHtml(result.message)}</p>${result.devices.map(device => `<div class="cast-device"><span><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml([device.manufacturer,device.model].filter(Boolean).join(' · '))}</small></span><button class="button secondary" type="button" data-use-device="${escapeHtml(device.name)}">Use display</button></div>`).join('')}`;
    } catch (error) { output.textContent = error.message; }
    finally { button.disabled = false; }
  } else if (button.hasAttribute('data-use-device')) {
    article.querySelector('[name="name"]').value = button.dataset.useDevice;
    article.querySelector('[name="device"]').value = button.dataset.useDevice;
    article.querySelector('[type="submit"]').focus();
  }
});

load();
loadDelivery();
