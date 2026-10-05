import { displayKinds, displayKind, preferredDisplay, rememberDisplay } from '/display-guide.js';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let report;
let delivery;
let selectedScreen = new URL(location.href).searchParams.get('screen');
let deliveryBusy = false;
const deviceChoices = new Map();
const requestedDevice = new URL(location.href).searchParams.get('device');
if (selectedScreen && displayKinds.some(kind => kind.id === requestedDevice)) deviceChoices.set(selectedScreen, requestedDevice);
const displayDrafts = new Map();
let token = sessionStorage.getItem('castboard-admin-token') || '';

async function request(path, init = {}) {
  const headers = { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let response;
  try { response = await fetch(path, { ...init, headers, cache: 'no-store' }); }
  catch { throw new Error('Could not reach Castboard. Check your connection, then try again.'); }
  if (response.status === 403) {
    $('#token-error').textContent = token ? 'Access was denied. Check your token and the server’s admin access settings.' : '';
    $('#admin-token').setAttribute('aria-invalid', String(Boolean(token)));
    if (!$('#token-dialog').open) $('#token-dialog').showModal();
    $('#admin-token').focus(); $('#admin-token').select();
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
function render(nextReport) {
  report = nextReport;
  $('#overall').className = 'overall';
  $('#overall').innerHTML = `<strong>${report.screens.length} screen${report.screens.length === 1 ? '' : 's'}</strong><span>Configure each integration and test its service in Plugins.</span>`;
  $('#runtime-cards').innerHTML = [
    runtimeRow('Castboard', 'Running', report.urls.local, report.config.usingExample ? command('cp castboard.config.example.json castboard.config.json') : ''),
    runtimeRow('Google Cast', report.tools.catt.installed ? 'Installed' : 'Optional · missing', report.tools.catt.version || 'Install catt to discover and cast to Google Cast devices.', report.tools.catt.installed ? '' : command(report.tools.catt.install)),
  ].join('');
  bindDynamicActions();
}

function bindDynamicActions() {
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    await copyText(button.dataset.copy);
    toast('Copied');
  }));
}

async function load() {
  $('#overall').className = 'overall loading';
  $('#overall').innerHTML = '<strong>Checking configuration…</strong><span>Reading screens and delivery tools.</span>';
  $('#refresh').disabled = true;
  try { render(await request('/api/admin/setup')); }
  catch (error) { $('#overall').className = 'overall attention'; $('#overall').innerHTML = `<strong>Could not load display setup</strong><span>${escapeHtml(error.message)} Use Refresh checks to retry.</span>`; }
  finally { $('#refresh').disabled = false; }
}

$('#refresh').addEventListener('click', () => { load(); if (!deliveryBusy) loadDelivery(); });
$('#token-form').addEventListener('submit', async event => {event.preventDefault(); token = $('#admin-token').value.trim(); $('#token-error').textContent=''; $('#admin-token').removeAttribute('aria-invalid'); sessionStorage.setItem('castboard-admin-token',token); $('#token-dialog').close(); await Promise.all([load(), loadDelivery()]);});
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
    const kind = deviceChoices.get(screen.id) || (screen.targets.some(target => target.protocol === 'google-cast') ? 'cast' : preferredDisplay(screen.id));
    const guide = displayKind(kind);
    const devicePicker = `<label class="field device-picker"><span>What kind of device?</span><select data-device-kind aria-describedby="device-help-${escapeHtml(screen.id)}">${displayKinds.map(item => `<option value="${item.id}" ${item.id === kind ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><p id="device-help-${escapeHtml(screen.id)}" class="device-guidance">${escapeHtml(guide.detail)}</p>`;
    const browserLink = screen.displayUrl ? `<div class="display-link"><span>${escapeHtml(screen.displayUrl)}</span><button class="button secondary" type="button" data-display-copy="${escapeHtml(screen.id)}">Copy link</button></div><p class="field-help">Open this link on the device, using a browser that can reach this server.</p>` : `<p class="delivery-note">${escapeHtml(screen.linkMessage)}</p>`;
    const targets = screen.targets.map(target => `<li class="display-target"><div><strong>${escapeHtml(target.name)}</strong><small>${escapeHtml(target.protocol === 'google-cast' ? 'Google Cast' : target.protocol === 'url' ? 'Browser display' : target.protocol)}</small></div><div class="display-actions"><button class="button secondary" type="button" data-send="${target.index}" ${target.canSend ? '' : 'disabled'}>Send screen</button><button class="button quiet" type="button" data-remove="${target.index}" aria-label="Remove ${escapeHtml(target.name)}">Remove</button></div><div class="remove-confirm" data-confirm="${target.index}" hidden><p>Remove this display from ${escapeHtml(screen.title)}? It will keep showing its current screen.</p><button class="button danger" type="button" data-confirm-remove="${target.index}">Remove display</button><button class="button secondary" type="button" data-keep="${target.index}">Keep display</button></div>${!target.canSend ? `<p class="target-note">${target.protocol === 'url' ? 'Choose Tablet, TV or computer with a browser above to get the screen link.' : !screen.displayUrl && screen.linkMessage.startsWith('This server') ? 'Set a reachable display URL before sending.' : 'Enable this delivery method in the server configuration.'}</p>` : ''}</li>`).join('');
    return `<article class="delivery-screen" data-screen="${escapeHtml(screen.id)}"><div class="delivery-summary"><div><h3>${escapeHtml(screen.title)}</h3><p>${screen.targets.length ? `${screen.targets.length} saved display${screen.targets.length === 1 ? '' : 's'}` : 'No saved connections'}</p></div><div class="display-actions"><a class="button secondary" href="${escapeHtml(screen.path)}" target="_blank" rel="noopener">Open screen</a><button type="button" class="button ${expanded ? 'secondary' : 'primary'}" data-delivery-select="${escapeHtml(screen.id)}" aria-expanded="${expanded}" aria-controls="delivery-${escapeHtml(screen.id)}">${expanded ? 'Close settings' : 'Set up display'}</button></div></div><div id="delivery-${escapeHtml(screen.id)}" class="delivery-editor" ${expanded ? '' : 'hidden'}>${devicePicker}<section class="device-browser" ${kind === 'cast' || kind === 'embedded' ? 'hidden' : ''}><h4>${kind === 'echo' ? 'Open in Silk on your Echo Show' : 'Open on your device'}</h4>${browserLink}${kind === 'echo' ? '<p class="field-help">Ask Alexa to open Silk, then enter this link. Browser availability and behaviour depend on your model. This does not set Castboard as the device’s home screen.</p>' : ''}</section><section class="device-embedded" ${kind === 'embedded' ? '' : 'hidden'}><h4>Connect your embedded display</h4><p class="delivery-note">Open Displays to assign this screen to an existing receiver, or add one with its hardware, resolution and connection settings.</p><a class="button primary" href="/admin/devices">Manage displays</a><p class="delivery-note">New hardware needs compatible firmware and a display adapter. Existing receivers keep their connection keys when you change their assigned screen.</p></section><details class="add-display" ${kind === 'cast' ? 'open' : 'hidden'}><summary>Connect a Google Cast display</summary>${!screen.displayUrl ? `<p class="delivery-note">${escapeHtml(screen.linkMessage)}</p>` : ''}<p>Find a display on your network, or enter its device name or IP address. Adding it saves the connection; Send screen starts casting.</p><button class="button secondary" type="button" data-discover>Find displays</button><div class="discovery-results" role="status" aria-live="polite"></div><form class="display-form"><label class="field"><span>Display name</span><input name="name" required maxlength="100" placeholder="e.g. Reception" autocomplete="off"></label><label class="field"><span>Device name or IP address</span><input name="device" required maxlength="200" placeholder="e.g. Reception TV" autocomplete="off"></label><button type="submit" class="button primary" ${delivery.castEnabled ? '' : 'disabled'}>Add display</button>${delivery.castEnabled ? '' : '<p class="field-error">Google Cast is disabled in the server configuration.</p>'}</form></details><h4>Saved connections</h4>${targets ? `<ul class="display-targets">${targets}</ul>` : '<p class="delivery-empty">No saved connections. Browser displays only need the link; they do not need to be added here.</p>'}<p class="delivery-feedback" role="status" aria-live="polite"></p></div></article>`;
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
  const buttons = [...$('#screen-list').querySelectorAll('button, input, select')];
  const previous = buttons.map(control => control.disabled);
  const focusedControl = document.activeElement;
  buttons.forEach(control => { control.disabled = true; });
  $('#refresh-displays').disabled = true;
  try {
    const result = await request('/api/admin/delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, screenId: article.dataset.screen, revision: delivery.revision }) });
    if (body.action === 'send') feedback.textContent = result.message;
    else {
      deviceChoices.set(article.dataset.screen, article.querySelector('[data-device-kind]').value);
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
$('#screen-list').addEventListener('change', event => {
  if (!event.target.matches('[data-device-kind]') || deliveryBusy) return;
  const id = event.target.closest('[data-screen]').dataset.screen;
  rememberDisplayDrafts();
  deviceChoices.set(id, event.target.value);
  rememberDisplay(id, event.target.value);
  const url = new URL(location.href);
  url.searchParams.set('device', event.target.value);
  history.replaceState(null, '', url);
  // Reopening the Cast guide should expose its next action.
  if (event.target.value === 'cast' && displayDrafts.has(id)) displayDrafts.get(id).open = true;
  renderDelivery();
  document.querySelector(`[data-screen="${CSS.escape(id)}"] [data-device-kind]`)?.focus();
});

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
    url.searchParams.delete('device');
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
