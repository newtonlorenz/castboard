import { flowLayout } from '../../src/core/native-layout.js';
export function createScreenType() {
  return {
    id: 'flow',
    nativeLayout: flowLayout,
    name: 'Responsive flow',
    version: '1.0.2',
    validateScreen(screen, screenId) {
      const layout = screen.layout || {};
      if (layout.minPanelWidth !== undefined && (!Number.isFinite(Number(layout.minPanelWidth)) || Number(layout.minPanelWidth) < 120 || Number(layout.minPanelWidth) > 2000)) throw new Error(`screens.${screenId}.layout.minPanelWidth must be from 120 to 2000`);
      if (layout.minPanelHeight !== undefined && (!Number.isFinite(Number(layout.minPanelHeight)) || Number(layout.minPanelHeight) < 80 || Number(layout.minPanelHeight) > 2000)) throw new Error(`screens.${screenId}.layout.minPanelHeight must be from 80 to 2000`);
      for (const field of ['gap', 'padding']) {
        if (layout[field] !== undefined && (!Number.isFinite(Number(layout[field])) || Number(layout[field]) < 0 || Number(layout[field]) > 64)) throw new Error(`screens.${screenId}.layout.${field} must be from 0 to 64`);
      }
      for (const [index, panel] of screen.panels.entries()) {
        if (!panel.size) continue;
        if (![panel.size.columns || 1, panel.size.rows || 1].every(value => Number.isInteger(Number(value)) && Number(value) > 0)) {
          throw new Error(`screens.${screenId}.panels[${index}].size values must be positive integers`);
        }
      }
    },
  };
}
