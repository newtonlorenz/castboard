export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function title(label, meta = '') {
  return `<header class="widget-head"><span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</header>`;
}

export async function getPluginData(id) {
  const response = await fetch(`/api/plugins/${encodeURIComponent(id)}/data`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to load ${id}`);
  return payload.data;
}

export async function postPluginAction(id, action, extra = {}) {
  const response = await fetch(`/api/plugins/${encodeURIComponent(id)}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `Unable to control ${id}`);
  return payload.data;
}

export function unavailable(element, label, error) {
  element.classList.add('widget-unavailable');
  element.innerHTML = `${title(label)}<div class="empty-state"><strong>Unavailable</strong><span>${escapeHtml(error?.message || 'Provider did not respond')}</span></div>`;
}

export function schedule(load, milliseconds) {
  load();
  return setInterval(load, milliseconds);
}

export function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

export function markdownLite(value) {
  return String(value || '').split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}
