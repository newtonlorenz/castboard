import { nativeViews } from '../../src/core/native-views.js';
import { demoTimestamp, fetchJson, readJsonSource, validateProviderConfig } from '../../src/core/providers.js';

function configuredTickers(config) {
  if (!Array.isArray(config.tickers) || !config.tickers.length || config.tickers.length > 12) throw new Error('Plugin stocks tickers must contain 1 to 12 symbols');
  return config.tickers.map((ticker, index) => {
    const symbol = String(ticker).trim().toUpperCase();
    if (!/^[A-Z0-9.^:-]{1,20}$/.test(symbol)) throw new Error(`Plugin stocks tickers[${index}] is invalid`);
    return symbol;
  });
}

function alphaVantagePosition(quote, currency) {
  const symbol = quote?.['01. symbol'];
  const price = Number(quote?.['05. price']);
  const previousClose = Number(quote?.['08. previous close']);
  const change = Number(quote?.['09. change']);
  const changePct = Number.parseFloat(quote?.['10. change percent']);
  if (!symbol || !Number.isFinite(price)) throw new Error('Alpha Vantage returned no quote data; check the symbol, API key, and free-plan limit');
  return { symbol, name: '', quantity: 1, price, value: price, change: Number.isFinite(change) ? change : price - previousClose, changePct, currency };
}

export function createPlugin({ config, context }) {
  validateProviderConfig('stocks', config, ['demo', 'alpha-vantage', 'http-json', 'file-json']);
  const tickers = config.provider === 'alpha-vantage' ? configuredTickers(config) : [];
  if (config.provider === 'alpha-vantage' && !config.apiKey) throw new Error('Plugin stocks alpha-vantage provider requires apiKey');
  const refreshMinutes = Number(config.refreshMinutes ?? 240);
  if (!Number.isFinite(refreshMinutes) || refreshMinutes <= 0) throw new Error('Plugin stocks refreshMinutes must be positive');
  const refreshMs = Math.max(15 * 60_000, refreshMinutes * 60_000);
  let quoteCache = null;
  let quoteExpiresAt = 0;
  let quoteRequest = null;

  async function readAlphaVantage() {
    const baseUrl = config.baseUrl || 'https://www.alphavantage.co/query';
    const positions = [];
    for (const symbol of tickers) {
      const url = new URL(baseUrl);
      url.searchParams.set('function', 'GLOBAL_QUOTE');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('apikey', config.apiKey);
      const payload = await fetchJson(url, {}, config.timeoutMs || 8000);
      if (payload?.Note || payload?.Information) throw new Error('Alpha Vantage rate limit reached; reduce tickers or retry later');
      positions.push(alphaVantagePosition(payload?.['Global Quote'], config.currency || 'USD'));
    }
    return {
      mode: 'watchlist',
      source: 'Alpha Vantage',
      positions,
      totalValue: positions.reduce((sum, item) => sum + item.price, 0),
      dailyChange: positions.reduce((sum, item) => sum + (Number(item.change) || 0), 0),
      updatedAt: demoTimestamp(),
    };
  }
  return {
    id: 'stocks',
    nativeView: nativeViews.stocks,
    assets: ['style.css'],
    styles: ['style.css'],
    name: 'Stocks',
    publicConfig: () => ({ demo: config.provider==='demo', title: config.title || (config.provider === 'alpha-vantage' ? 'Markets' : 'Portfolio'), currency: config.currency || 'USD', maxRows: config.maxRows || 6, mode: config.provider === 'alpha-vantage' ? 'watchlist' : 'portfolio' }),
    async getData() {
      if (config.provider === 'demo') {
        const positions = [
          { symbol: 'ACME', name: 'Acme Systems', quantity: 12, price: 128.4, value: 1540.8, changePct: 1.8, currency: config.currency || 'EUR' },
          { symbol: 'NOVA', name: 'Nova Energy', quantity: 20, price: 48.1, value: 962, changePct: -0.7, currency: config.currency || 'EUR' },
          { symbol: 'BTC', name: 'Bitcoin', quantity: 0.02, price: 81240, value: 1624.8, changePct: 2.4, currency: config.currency || 'EUR' },
        ];
        return { positions, totalValue: positions.reduce((sum, item) => sum + item.value, 0), dailyChange: 54.2, updatedAt: demoTimestamp() };
      }
      if (config.provider === 'alpha-vantage') {
        if (quoteCache && Date.now() < quoteExpiresAt) return quoteCache;
        if (!quoteRequest) quoteRequest = readAlphaVantage()
          .then(data => { quoteCache = data; quoteExpiresAt = Date.now() + refreshMs; return data; })
          .catch(error => { if (quoteCache) return { ...quoteCache, stale: true }; throw error; })
          .finally(() => { quoteRequest = null; });
        return quoteRequest;
      }
      return readJsonSource(config, context);
    },
  };
}
