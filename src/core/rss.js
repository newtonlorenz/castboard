function decodeEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function cleanText(value, maxLength = 4000) {
  return decodeEntities(String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function element(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return cleanText(match[1]);
  }
  return '';
}

function linkFor(block) {
  const atom = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  const value = atom?.[1] || element(block, ['link']);
  try {
    const url = new URL(decodeEntities(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function parseFeed(xml, feed = {}) {
  const blocks = [...String(xml).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return blocks.map((match, index) => {
    const block = match[2];
    const title = element(block, ['title']);
    const summary = element(block, ['description', 'summary', 'content:encoded', 'content']).slice(0, 500);
    const url = linkFor(block);
    const published = element(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const parsedDate = Date.parse(published);
    const id = element(block, ['guid', 'id']) || url || `${feed.name || 'feed'}-${index}-${title}`;
    return {
      id,
      title,
      summary,
      body: summary,
      category: feed.category || element(block, ['category']) || 'News',
      source: feed.name || element(block, ['source']) || 'RSS',
      publishedAt: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : null,
      ...(url ? { url } : {}),
    };
  }).filter(story => story.title);
}
