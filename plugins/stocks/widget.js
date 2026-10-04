import { escapeHtml, formatNumber, getPluginData, schedule, title, unavailable } from '/widget-kit.js?v=0.13.0';

function money(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(number);
}

export function mount({ element, config, context }) {
  const load = async () => {
    try {
      const data = await context.data();
      const positions = (data.positions || []).slice(0, config.maxRows || 6);
      const change = Number(data.dailyChange);
      const watchlist = config.mode==='watchlist' || config.mode!=='portfolio' && data.mode==='watchlist';
      const summary = watchlist
        ? `<div class="stocks-summary"><strong class="stocks-total">${positions.length} symbol${positions.length === 1 ? '' : 's'}</strong><span>${escapeHtml(data.source || 'Market data')}</span></div>`
        : `<div class="stocks-summary"><strong class="stocks-total">${money(data.totalValue, config.currency)}</strong><span class="change ${change < 0 ? 'negative' : ''}">${Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${money(change, config.currency)}` : ''}</span></div>`;
      element.innerHTML = `${title(config.title || (watchlist ? 'Markets' : 'Portfolio'), data.updatedAt ? 'Updated' : '')}${summary}<table class="stocks-table"><tbody>${positions.map(item => `<tr><td><strong>${escapeHtml(item.symbol)}</strong><small>${config.showCompanyName===false?'':escapeHtml(item.name || '')}</small></td><td>${formatNumber(item.price, 2)}</td>${watchlist ? '' : `<td>${money(item.value, item.currency || config.currency)}</td>`}<td class="change ${Number(item.changePct) < 0 ? 'negative' : ''}">${Number(item.changePct) >= 0 ? '+' : ''}${formatNumber(item.changePct, 1)}%</td></tr>`).join('')}</tbody></table>`;
      if(config.showTotal===false)element.querySelector('.stocks-summary')?.remove();
    } catch (error) { unavailable(element, config.title || 'Portfolio', error); }
  };
  context.schedule(load, (config.refreshSeconds || 30)*1000);
}
