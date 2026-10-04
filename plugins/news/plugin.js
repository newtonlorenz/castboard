import { nativeViews } from '../../src/core/native-views.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { demoTimestamp, fetchText, readJsonSource, readTextFile, validateProviderConfig } from '../../src/core/providers.js';
import { parseFeed } from '../../src/core/rss.js';
import { selectStories } from './selection.js';

export const DEFAULT_RSS_FEEDS = [
  { name: 'BBC News', category: 'Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'BBC News', category: 'World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC News', category: 'Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
];

function configuredFeeds(config) {
  const feeds = config.feeds?.length ? config.feeds : config.useDefaultFeeds===false ? [] : DEFAULT_RSS_FEEDS;
  if (!Array.isArray(feeds) || feeds.length > 20) throw new Error('Plugin news feeds must be an array with at most 20 entries');
  return feeds.filter(feed => typeof feed==='string' || feed?.enabled!==false).map((feed, index) => {
    const normalized = typeof feed === 'string' ? { url: feed } : feed;
    if (!normalized?.url) throw new Error(`Plugin news feeds[${index}] requires url`);
    let url;
    try { url = new URL(normalized.url); } catch { throw new Error(`Plugin news feeds[${index}].url must be valid`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`Plugin news feeds[${index}].url must use http or https`);
    return { url: url.href, name: normalized.name || '', category: normalized.category || '' };
  });
}

function parseMarkdown(markdown, source, prefix) {
  const sections = String(markdown).split(/^##\s+/m).slice(1);
  return sections.map((section, index) => {
    const [heading, ...bodyLines] = section.split('\n');
    const body = bodyLines.join('\n').trim();
    return { id: `${prefix}-${index}`, title: heading.replace(/^#+\s*/, '').trim(), summary: body.replace(/[#*`>\[\]()]/g, '').slice(0, 260), body, category: 'Briefing', source, publishedAt: demoTimestamp() };
  }).filter(item => item.title && item.body);
}

export function createPlugin({ config, context }) {
  validateProviderConfig('news', config, ['demo', 'rss', 'markdown-directory', 'http-json', 'file-json']);
  if (config.provider === 'markdown-directory' && !config.path) throw new Error('Plugin news markdown-directory provider requires path');
  const feeds = config.provider === 'rss' ? configuredFeeds(config) : [];
  const refreshMinutes = Number(config.refreshMinutes ?? 5);
  if (!Number.isFinite(refreshMinutes) || refreshMinutes <= 0) throw new Error('Plugin news refreshMinutes must be positive');
  const refreshMs = Math.max(60_000, refreshMinutes * 60_000);
  let rssCache = null;
  let rssExpiresAt = 0;
  let rssRequest = null;

  async function readFeeds() {
    const results = await Promise.allSettled(feeds.map(async feed => {
      const { response, text } = await fetchText(feed.url, { headers: { ...(config.headers || {}), Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } }, config.timeoutMs || 8000);
      if (!response.ok) throw new Error(`RSS feed returned HTTP ${response.status}`);
      return parseFeed(text, feed).slice(0,config.maxStoriesPerFeed || 200);
    }));
    const stories = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value);
    if (!stories.length && results.some(result => result.status === 'rejected')) throw new Error('No configured RSS feeds responded with stories');
    const unique = stories
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
    return { stories: unique, failedFeeds:results.filter(result=>result.status==='rejected').length, updatedAt: demoTimestamp() };
  }
  const plugin = {
    id: 'news',
    nativeView: nativeViews.news,
    assets: ['style.css', 'selection.js'],
    styles: ['style.css'],
    name: 'News and briefings',
    publicConfig: () => ({ title: config.title || 'News & Briefings', demo:config.provider==='demo', maxStories:config.maxStories || 40, view:config.view || 'compact', rotationSeconds:config.rotationSeconds || 18, refreshSeconds:config.refreshSeconds || 60, autoRotate:config.autoRotate!==false, showSummary:config.showSummary!==false, showTicker:config.showTicker!==false }),
    async getData() {
      if (config.provider === 'demo') return {
        stories: [
          { id: 'demo-1', title: 'A calm command centre for the whole home', summary: 'Castboard brings independent household services together without coupling the display to one backend.', body: 'Each tile is loaded as a plugin. Providers stay on the server, private configuration stays private, and the display receives a small canonical payload.', category: 'Top Stories', source: 'Castboard', publishedAt: demoTimestamp() },
          { id: 'demo-2', title: 'Weather, energy and schedule settle into one glance', summary: 'The home screen prioritizes legibility, touch targets, and failure isolation at smart-display distance.', body: 'Every integration refreshes on its own cadence. A provider failure becomes a quiet unavailable state rather than a broken screen.', category: 'Home', source: 'Design desk', publishedAt: demoTimestamp() },
          { id: 'demo-3', title: 'Bring any backend that speaks the contract', summary: 'Canonical JSON, ICS, Fronius, camera streams, and media-control backends can be configured independently.', body: 'Environment references keep sensitive settings out of source control. Plugin authors can add a backend hook, a browser widget, or both.', category: 'Projects', source: 'Engineering', publishedAt: demoTimestamp() },
          { id: 'demo-4', title: 'The briefing screen is built for ambient reading', summary: 'Categories, headline wire, automatic rotation and a full reader make longer updates usable from across the room.', body: 'Tap a category to filter the wire, pause rotation whenever you want, and open a story for the full body.', category: 'Products', source: 'News desk', publishedAt: demoTimestamp() }
        ], updatedAt: demoTimestamp(),
      };
      if (config.provider === 'markdown-directory') {
        if (!config.path) throw new Error('markdown-directory provider requires path');
        const directory = path.resolve(context.configDir, config.path);
        const files = (await fs.readdir(directory)).filter(file => file.endsWith('.md')).sort().reverse().slice(0, config.maxFiles || 10);
        const groups = await Promise.all(files.map(async file => parseMarkdown(await readTextFile(path.join(directory, file)), file.replace(/\.md$/, ''), file)));
        return { stories: groups.flat(), updatedAt: demoTimestamp() };
      }
      if (config.provider === 'rss') {
        if (rssCache && Date.now() < rssExpiresAt) return rssCache;
        if (!rssRequest) rssRequest = readFeeds()
          .then(data => { rssCache = data; rssExpiresAt = Date.now() + refreshMs; return data; })
          .catch(error => { if (rssCache) return { ...rssCache, stale: true }; throw error; })
          .finally(() => { rssRequest = null; });
        return rssRequest;
      }
      return readJsonSource(config, context);
    },
  };
  const getData=plugin.getData,selectedCache=new WeakMap();
  plugin.getData=async()=>{const data=await getData();if(!config.maxAgeHours&&selectedCache.has(data))return selectedCache.get(data);const selected={...data,stories:selectStories(data.stories,{sortOrder:config.provider==='rss'?'newest':'source-order',...config})};if(!config.maxAgeHours)selectedCache.set(data,selected);return selected;};
  return plugin;
}
