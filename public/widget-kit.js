export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function title(label, meta = '') {
  return `<header class="widget-head"><span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</header>`;
}

export async function requestJson(input, init = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await response.json();
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

export async function getPluginData(id) {
  const { response, payload } = await requestJson(`/api/plugins/${encodeURIComponent(id)}/data`, { cache: 'no-store' });
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to load ${id}`);
  return payload.data;
}

export async function postPluginAction(id, action, extra = {}) {
  const { response, payload } = await requestJson(`/api/plugins/${encodeURIComponent(id)}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
  });
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to control ${id}`);
  return payload.data;
}

export function unavailable(element, label, error) {
  element.classList.add('widget-unavailable');
  element.innerHTML = `${title(label)}<div class="empty-state"><strong>Unavailable</strong><span>${escapeHtml(error?.message || 'Provider did not respond')}</span></div>`;
}

export function schedule(load, milliseconds) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await load(); } finally { running = false; }
  };
  void run();
  return setInterval(run, milliseconds);
}

export function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

export function markdownLite(value) {
  return String(value || '').split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}
