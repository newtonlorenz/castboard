import { createHash } from 'node:crypto';
import { reachableScreens } from '../../public/interaction-model.js';

// A dashboard can open other screens and use sources through bindings.
export function dashboardRevisions(config) {
  const plugins = new Map(config.plugins.map(plugin => [plugin.id, plugin]));
  const types = new Map(config.screenTypes.map(type => [type.id, type]));
  return Object.fromEntries(Object.keys(config.screens).map(id => {
    const screens = reachableScreens(config.screens, id);
    const sources = new Set();
    const screenTypes = new Set();
    for (const screenId of screens) {
      const screen = config.screens[screenId];
      screenTypes.add(screen.type);
      for (const panel of screen.panels) {
        sources.add(panel.plugin);
        if (panel.source) sources.add(panel.source);
        for (const source of Object.values(panel.bindings || {})) sources.add(source);
        if (panel.interaction?.source) sources.add(panel.interaction.source);
      }
    }
    for (const source of sources) {
      const plugin = plugins.get(source);
      if (plugin?.defaultSource) sources.add(plugin.defaultSource);
      for (const dependency of Object.values(plugin?.bindings || {})) sources.add(dependency);
    }
    const design = {
      branding: config.branding,
      screens: [...screens].map(screenId => config.screens[screenId]),
      plugins: [...sources].map(source => plugins.get(source)),
      screenTypes: [...screenTypes].map(type => types.get(type)),
    };
    const revision = createHash('sha256').update(JSON.stringify(design)).digest('hex');
    return [id, revision];
  }));
}
