const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let report;
const checks = new Map();
let token = sessionStorage.getItem('castboard-admin-token') || '';

async function request(path, init = {}, retry = true) {
  const headers = { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
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
    return `<article class="connection-row"><div><h3>${escapeHtml(plugin.name)}</h3><span class="provider">${escapeHtml(plugin.id)} · ${escapeHtml(plugin.provider)} · ${plugin.usedBy ? `${plugin.usedBy} screen${plugin.usedBy === 1 ? '' : 's'}` : 'Not on a screen'}</span></div><div class="connection-description"><div class="connection-state"><span class="pill ${escapeHtml(plugin.status)}">${escapeHtml(labels[plugin.status] || plugin.label)}</span></div><p>${escapeHtml(plugin.detail)}</p></div><div class="card-actions"><a class="button" href="/admin/plugins?plugin=${encodeURIComponent(plugin.id)}">Configure</a><button type="button" data-test-plugin="${escapeHtml(plugin.id)}" aria-label="Test ${escapeHtml(plugin.name)} (${escapeHtml(plugin.id)})" ${check?.pending ? 'disabled' : ''}>${check?.pending ? 'Testing…' : 'Test'}</button></div><div class="test-result ${check ? check.ok ? 'ok' : check.pending ? '' : 'bad' : ''}" data-result="${escapeHtml(plugin.id)}">${escapeHtml(check?.message || '')}</div></article>`;
  }).join('') || '<p class="no-results">No plugins match this search.</p>';
  bindDynamicActions();
}
function render(nextReport) {
  report = nextReport;
  const blocked = report.plugins.filter(plugin => plugin.status === 'blocked').length;
  const demos = report.plugins.filter(plugin => plugin.status === 'demo').length;
  $('#overall').className = `overall ${blocked ? 'attention' : ''}`;
  $('#overall').innerHTML = `<strong>${report.plugins.length} plugins · ${report.screens.length} screen${report.screens.length === 1 ? '' : 's'}</strong><span>${blocked ? `${blocked} plugins need a server tool. ` : ''}${demos ? `${demos} use demo data. ` : ''}Connections have not been tested by this configuration check.</span>`;
  $('#runtime-cards').innerHTML = [
    runtimeRow('Castboard', 'Running', report.urls.local, report.config.usingExample ? command('cp castboard.config.example.json castboard.config.json') : ''),
    runtimeRow('Google Cast', report.tools.catt.installed ? 'Installed' : 'Optional · missing', report.tools.catt.version || 'Install catt to discover and cast to Google Cast devices.', report.tools.catt.installed ? '' : command(report.tools.catt.install)),
    runtimeRow('Spotify playback', report.tools.spotifyPlayer.installed ? 'Installed' : 'Optional · missing', report.tools.spotifyPlayer.installed ? report.tools.spotifyPlayer.version : 'Install spotify_player only if you use its playback plugin.', report.tools.spotifyPlayer.installed ? command(report.tools.spotifyPlayer.authenticate) : `${command('brew install spotify_player')}${command('cargo install spotify_player --locked')}`),
  ].join('');
  $('#screen-list').innerHTML = report.screens.map(screen => `<article class="delivery-row"><div><h3>${escapeHtml(screen.title)}</h3><div class="screen-meta"><span>${escapeHtml(screen.id)}</span><span>${escapeHtml(screen.protocol)}</span></div></div><p>${escapeHtml(screen.path)}</p><span class="pill ${screen.targetCount ? '' : 'demo'}">${screen.targetCount ? `${screen.targetCount} target${screen.targetCount === 1 ? '' : 's'}` : 'Browser only'}</span></article>`).join('');
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

$('#refresh').addEventListener('click', load);
$('#connection-search').addEventListener('input', () => {if (report) renderModules();});
$('#token-form').addEventListener('submit', async event => {event.preventDefault(); token = $('#admin-token').value; sessionStorage.setItem('castboard-admin-token',token); $('#token-dialog').close(); await load();});
$('#scan-cast').addEventListener('click', async () => {
  const output = $('#cast-results');
  output.hidden = false;
  output.textContent = 'Scanning the local network…';
  $('#scan-cast').disabled = true;
  try {
    const result = await request('/api/admin/setup/discover-cast', { method: 'POST' });
    output.innerHTML = `<p>${escapeHtml(result.message)}</p>${result.devices.map(device => `<div class="cast-device"><span><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml([device.manufacturer, device.model].filter(Boolean).join(' · '))}</small></span><button type="button" data-copy-target="${escapeHtml(device.name)}">Copy target</button></div>`).join('')}`;
    output.querySelectorAll('[data-copy-target]').forEach(button => button.addEventListener('click', async () => {
      await copyText(JSON.stringify({ name: button.dataset.copyTarget, device: button.dataset.copyTarget }));
      toast('Target JSON copied');
    }));
  } catch (error) { output.textContent = error.message; }
  finally { $('#scan-cast').disabled = false; }
});

load();
