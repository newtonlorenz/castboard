const list = value => (Array.isArray(value) ? value : []).map(item => String(item).trim().toLocaleLowerCase()).filter(Boolean);
const timestamp = story => { const time = Date.parse(story.publishedAt || ''); return Number.isFinite(time) ? time : null; };
function identity(story) {
  try {
    const url = new URL(story.url); url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return `${String(story.source || story.channel || '').toLocaleLowerCase()}:${String(story.title || '').trim().toLocaleLowerCase()}`; }
}
export function selectStories(stories, options = {}, now = Date.now()) {
  const include = list(options.includeKeywords), exclude = list(options.excludeKeywords), categories = list(options.categories), sources = list(options.sources);
  const selected = (Array.isArray(stories) ? stories : []).filter(story => {
    if (!story || typeof story !== 'object' || !String(story.title || '').trim()) return false;
    const text = [story.title, story.summary, story.body, story.article].filter(Boolean).join(' ').toLocaleLowerCase();
    if (include.length && !include.some(word => text.includes(word))) return false;
    if (exclude.some(word => text.includes(word))) return false;
    if (categories.length && !categories.includes(String(story.category || '').toLocaleLowerCase())) return false;
    if (sources.length && !sources.includes(String(story.source || story.channel || '').toLocaleLowerCase())) return false;
    const published = timestamp(story);
    return !(options.maxAgeHours > 0 && published !== null && published < now - options.maxAgeHours * 3600000);
  });
  const dated = order => (a,b) => {const x=timestamp(a),y=timestamp(b);return x===null?y===null?0:1:y===null?-1:order*(x-y);};
  if (options.sortOrder === 'newest') selected.sort(dated(-1));
  else if (options.sortOrder === 'oldest') selected.sort(dated(1));
  else if (options.sortOrder === 'title') selected.sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  else if (options.sortOrder === 'source') selected.sort((a,b)=>String(a.source || a.channel || '').localeCompare(String(b.source || b.channel || '')));
  const seen = new Set();
  return selected.filter(story=>{if(options.deduplicate===false)return true;const key=identity(story);if(seen.has(key))return false;seen.add(key);return true;}).slice(0, Math.max(1, Math.min(200, options.maxStories || 40)));
}
