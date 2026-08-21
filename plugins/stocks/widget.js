import { escapeHtml, formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js';

function money(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(number);
}

export function mount({ element, config }) {
  const load = async () => {
    try {
      const data = await getPluginData('stocks');
      const positions = (data.positions || []).slice(0, config.maxRows || 6);
      const change = Number(data.dailyChange);
      element.innerHTML = `${title(config.title || 'Portfolio', data.updatedAt ? 'Live' : '')}<div class="stocks-summary"><strong class="stocks-total">${money(data.totalValue, config.currency)}</strong><span class="change ${change < 0 ? 'negative' : ''}">${Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${money(change, config.currency)}` : ''}</span></div><table class="stocks-table"><tbody>${positions.map(item => `<tr><td><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.name || '')}</small></td><td>${formatNumber(item.price, 2)}</td><td>${money(item.value, item.currency || config.currency)}</td><td class="change ${Number(item.changePct) < 0 ? 'negative' : ''}">${Number(item.changePct) >= 0 ? '+' : ''}${formatNumber(item.changePct, 1)}%</td></tr>`).join('')}</tbody></table>`;
    } catch (error) { unavailable(element, config.title || 'Portfolio', error); }
  };
  schedule(load, 30000);
}
