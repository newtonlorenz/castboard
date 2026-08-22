const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let token = sessionStorage.getItem('castboard-admin-token') || '';

const snippets = {
  weather: '"weather": { "enabled": true, "provider": "open-meteo", "latitude": 40.4, "longitude": -3.7, "label": "Home" }',
  calendar: '"calendar": { "enabled": true, "provider": "ics", "url": "${CALENDAR_ICS_URL}" }',
  solar: '"solar": { "enabled": true, "provider": "fronius", "baseUrl": "http://inverter.local" }',
  spotify: '"spotify": { "enabled": true, "provider": "spotify-player", "executable": "spotify_player" }',
  sonos: '"sonos": { "enabled": true, "provider": "sonos-http", "baseUrl": "${SONOS_BACKEND_URL}" }',
  camera: '"camera": { "enabled": true, "provider": "stream", "name": "Driveway", "streamUrl": "${CAMERA_STREAM_URL}" }',
  news: '"news": { "enabled": true, "provider": "markdown-directory", "path": "./briefings" }',
  recovery: '"recovery": { "enabled": true, "provider": "file-json", "path": "./data/recovery.json" }',
  stocks: '"stocks": { "enabled": true, "provider": "http-json", "url": "${STOCKS_JSON_URL}" }',
};

async function request(path, init = {}, retry = true) {
  const headers = { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (response.status === 403 && retry) {
    const next = window.prompt('Enter the Castboard LAN admin token');
    if (!next) throw new Error('Admin authorization is required');
    token = next;
    sessionStorage.setItem('castboard-admin-token', token);
    return request(path, init, false);
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

function runtimeCard(title, status, detail, extra = '') {
  return `<article class="card"><div class="card-head"><h3>${escapeHtml(title)}</h3><span class="pill ${status === 'Installed' || status === 'Reachable' ? '' : 'blocked'}">${escapeHtml(status)}</span></div><p>${escapeHtml(detail)}</p>${extra}</article>`;
}

function render(report) {
  const attention = report.config.usingExample || report.plugins.some(plugin => ['blocked', 'adapter'].includes(plugin.status)) || report.screens.some(screen => !screen.targetCount);
  $('#overall').className = `overall ${attention ? 'attention' : 'ready'}`;
  $('#overall').innerHTML = attention
    ? '<strong>Demo ready · connections need attention</strong><span>The dashboard works now. Complete the highlighted items before relying on live data or Cast delivery.</span>'
    : '<strong>Ready for live screens</strong><span>Core tools, providers, and screen targets are configured.</span>';
  $('#config-name').textContent = report.config.fileName;
  $('#runtime-cards').innerHTML = [
    runtimeCard('Castboard server', 'Reachable', `Local: ${report.urls.local}${report.urls.lan ? ` · LAN: ${report.urls.lan}` : ' · No LAN address detected'}`, report.config.usingExample ? command('cp castboard.config.example.json castboard.config.json') : ''),
    runtimeCard('Google Cast · catt', report.tools.catt.installed ? 'Installed' : 'Missing', report.tools.catt.version || report.tools.catt.message, report.tools.catt.installed ? '' : command(report.tools.catt.install)),
    runtimeCard('Spotify · spotify_player', report.tools.spotifyPlayer.installed ? 'Installed' : 'Missing', report.tools.spotifyPlayer.installed ? report.tools.spotifyPlayer.version : 'Required for independent Spotify playback through local speakers or Spotify Connect.', report.tools.spotifyPlayer.installed ? command(report.tools.spotifyPlayer.authenticate) : `${command('brew install spotify_player')}${command('cargo install spotify_player --locked')}${command(report.tools.spotifyPlayer.authenticate)}`),
  ].join('');
  $('#screen-list').innerHTML = report.screens.map(screen => `<article class="card"><div class="card-head"><h3>${escapeHtml(screen.title)}</h3><span class="pill ${screen.targetCount ? '' : 'demo'}">${screen.targetCount ? `${screen.targetCount} target${screen.targetCount === 1 ? '' : 's'}` : 'No targets'}</span></div><p>${escapeHtml(screen.path)}</p><div class="screen-meta"><span>${escapeHtml(screen.protocol)}</span><span>${escapeHtml(screen.id)}</span></div></article>`).join('');
  $('#plugin-list').innerHTML = report.plugins.map(plugin => `<article class="card plugin-card"><div><div class="card-head"><h3>${escapeHtml(plugin.name)}</h3><span class="pill ${escapeHtml(plugin.status)}">${escapeHtml(plugin.label)}</span></div><p>${escapeHtml(plugin.detail)}</p><footer><span class="provider">${escapeHtml(plugin.provider)}</span><span>${plugin.usedBy ? `${plugin.usedBy} screen${plugin.usedBy === 1 ? '' : 's'}` : 'Available'}</span></footer><div class="test-result" data-result="${escapeHtml(plugin.id)}"></div></div><div class="card-actions">${snippets[plugin.id] ? `<button type="button" data-copy="${escapeHtml(snippets[plugin.id])}">Copy config</button>` : ''}<button type="button" data-test-plugin="${escapeHtml(plugin.id)}">Test</button></div></article>`).join('');
  bindDynamicActions();
}

function bindDynamicActions() {
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    await copyText(button.dataset.copy);
    toast('Command copied');
  }));
  document.querySelectorAll('[data-test-plugin]').forEach(button => button.addEventListener('click', async () => {
    const result = $(`[data-result="${CSS.escape(button.dataset.testPlugin)}"]`);
    button.disabled = true;
    result.className = 'test-result';
    result.textContent = 'Testing…';
    try {
      const payload = await request('/api/admin/setup/test-plugin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: button.dataset.testPlugin }) });
      result.className = `test-result ${payload.ok ? 'ok' : 'bad'}`;
      result.textContent = `${payload.message}${payload.latencyMs !== undefined ? ` · ${payload.latencyMs} ms` : ''}`;
    } catch (error) {
      result.className = 'test-result bad';
      result.textContent = error.message;
    } finally { button.disabled = false; }
  }));
}

async function load() {
  $('#overall').className = 'overall loading';
  $('#overall').innerHTML = '<strong>Checking Castboard…</strong><span>Inspecting local tools and configuration.</span>';
  try { render(await request('/api/admin/setup')); }
  catch (error) { $('#overall').className = 'overall attention'; $('#overall').innerHTML = `<strong>Setup check failed</strong><span>${escapeHtml(error.message)}</span>`; }
}

$('#refresh').addEventListener('click', load);
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
