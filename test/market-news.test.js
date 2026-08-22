import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/core/rss.js';
import { createPlugin as createNewsPlugin } from '../plugins/news/plugin.js';
import { createPlugin as createStocksPlugin } from '../plugins/stocks/plugin.js';

const rss = `<?xml version="1.0"?><rss><channel><item>
  <title><![CDATA[Markets &amp; weather improve]]></title>
  <link>https://example.test/story?a=1&amp;b=2</link>
  <description><![CDATA[<p>A <strong>short</strong> summary.</p>]]></description>
  <pubDate>Fri, 21 Aug 2026 08:30:00 GMT</pubDate>
  <guid>story-1</guid>
</item></channel></rss>`;

test('RSS parser normalizes publisher markup and safe links', () => {
  const [story] = parseFeed(rss, { name: 'Public News', category: 'Markets' });
  assert.deepEqual(story, {
    id: 'story-1',
    title: 'Markets & weather improve',
    summary: 'A short summary.',
    body: 'A short summary.',
    category: 'Markets',
    source: 'Public News',
    publishedAt: '2026-08-21T08:30:00.000Z',
    url: 'https://example.test/story?a=1&b=2',
  });
});

test('RSS provider keeps healthy feeds when another feed fails', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => String(url).includes('failed')
    ? new Response('unavailable', { status: 503 })
    : new Response(rss, { headers: { 'content-type': 'application/rss+xml' } });
  const plugin = createNewsPlugin({
    config: { provider: 'rss', feeds: ['https://failed.test/feed.xml', { name: 'Working', url: 'https://working.test/feed.xml' }] },
    context: { configDir: process.cwd() },
  });
  const data = await plugin.getData();
  const cached = await plugin.getData();
  assert.equal(data.stories.length, 1);
  assert.strictEqual(cached, data);
  assert.equal(data.stories[0].source, 'Working');
});

test('Alpha Vantage provider uses configured tickers and keeps the API key private', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requested = [];
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    requested.push(parsed);
    const symbol = parsed.searchParams.get('symbol');
    return new Response(JSON.stringify({ 'Global Quote': {
      '01. symbol': symbol,
      '05. price': symbol === 'AAPL' ? '220.50' : '510.25',
      '08. previous close': symbol === 'AAPL' ? '218.00' : '512.00',
      '09. change': symbol === 'AAPL' ? '2.50' : '-1.75',
      '10. change percent': symbol === 'AAPL' ? '1.1468%' : '-0.3418%',
    } }));
  };
  const plugin = createStocksPlugin({
    config: { provider: 'alpha-vantage', apiKey: 'private-key', tickers: ['aapl', 'msft'], currency: 'USD' },
    context: { configDir: process.cwd() },
  });
  assert.equal(JSON.stringify(plugin.publicConfig()).includes('private-key'), false);
  const data = await plugin.getData();
  const cached = await plugin.getData();
  assert.deepEqual(data.positions.map(item => item.symbol), ['AAPL', 'MSFT']);
  assert.equal(data.mode, 'watchlist');
  assert.equal(data.dailyChange, 0.75);
  assert.strictEqual(cached, data);
  assert.deepEqual(requested.map(url => url.searchParams.get('symbol')), ['AAPL', 'MSFT']);
  assert.ok(requested.every(url => url.searchParams.get('apikey') === 'private-key'));
});

test('market providers reject unsafe or incomplete configuration', () => {
  assert.throws(() => createStocksPlugin({ config: { provider: 'alpha-vantage', apiKey: 'key', tickers: [] }, context: {} }), /1 to 12/);
  assert.throws(() => createStocksPlugin({ config: { provider: 'alpha-vantage', tickers: ['AAPL'] }, context: {} }), /requires apiKey/);
  assert.throws(() => createNewsPlugin({ config: { provider: 'rss', feeds: ['file:///private/feed.xml'] }, context: {} }), /must use http or https/);
  assert.throws(() => createNewsPlugin({ config: { provider: 'rss', refreshMinutes: 0 }, context: {} }), /refreshMinutes must be positive/);
});
