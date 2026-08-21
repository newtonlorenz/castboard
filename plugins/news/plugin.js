import fs from 'node:fs/promises';
import path from 'node:path';
import { demoTimestamp, readJsonSource } from '../../src/core/providers.js';

function parseMarkdown(markdown, source, prefix) {
  const sections = String(markdown).split(/^##\s+/m).slice(1);
  return sections.map((section, index) => {
    const [heading, ...bodyLines] = section.split('\n');
    const body = bodyLines.join('\n').trim();
    return { id: `${prefix}-${index}`, title: heading.replace(/^#+\s*/, '').trim(), summary: body.replace(/[#*`>\[\]()]/g, '').slice(0, 260), body, category: 'Briefing', source, publishedAt: demoTimestamp() };
  }).filter(item => item.title && item.body);
}

export function createPlugin({ config, context }) {
  return {
    id: 'news',
    name: 'News and briefings',
    publicConfig: () => ({ title: config.title || 'Briefings', maxStories: config.maxStories || 40 }),
    async getData() {
      if (config.provider === 'demo') return {
        stories: [
          { id: 'demo-1', title: 'A calm command centre for the whole home', summary: 'Castboard brings independent household services together without coupling the display to one backend.', body: 'Each tile is loaded as a plugin. Providers stay on the server, private configuration stays private, and the display receives a small canonical payload.', category: 'Top Stories', source: 'Castboard', publishedAt: demoTimestamp() },
          { id: 'demo-2', title: 'Weather, energy and schedule settle into one glance', summary: 'The home screen prioritizes legibility, touch targets, and failure isolation at smart-display distance.', body: 'Every integration refreshes on its own cadence. A provider failure becomes a quiet unavailable state rather than a broken screen.', category: 'Home', source: 'Design desk', publishedAt: demoTimestamp() },
          { id: 'demo-3', title: 'Bring any backend that speaks the contract', summary: 'Canonical JSON, ICS, Fronius, camera streams, and media-control backends can be configured independently.', body: 'Environment references keep sensitive settings out of source control. Plugin authors can add a backend hook, a browser widget, or both.', category: 'Projects', source: 'Engineering', publishedAt: demoTimestamp() },
          { id: 'demo-4', title: 'The briefing screen is built for ambient reading', summary: 'Categories, headline wire, automatic rotation and a full reader make longer updates usable from across the room.', body: 'Tap a category to filter the wire, pause rotation whenever you want, and open a story for the full body.', category: 'Products', source: 'Office wire', publishedAt: demoTimestamp() }
        ], updatedAt: demoTimestamp(),
      };
      if (config.provider === 'markdown-directory') {
        if (!config.path) throw new Error('markdown-directory provider requires path');
        const directory = path.resolve(context.configDir, config.path);
        const files = (await fs.readdir(directory)).filter(file => file.endsWith('.md')).sort().reverse().slice(0, config.maxFiles || 10);
        const groups = await Promise.all(files.map(async file => parseMarkdown(await fs.readFile(path.join(directory, file), 'utf8'), file.replace(/\.md$/, ''), file)));
        return { stories: groups.flat(), updatedAt: demoTimestamp() };
      }
      return readJsonSource(config, context);
    },
  };
}
