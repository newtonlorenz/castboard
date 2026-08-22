export function createScreenType() {
  return {
    id: 'flow',
    name: 'Responsive flow',
    version: '1.0.1',
    validateScreen(screen, screenId) {
      const layout = screen.layout || {};
      if (layout.minPanelWidth !== undefined && Number(layout.minPanelWidth) < 120) throw new Error(`screens.${screenId}.layout.minPanelWidth must be at least 120`);
      for (const [index, panel] of screen.panels.entries()) {
        if (!panel.size) continue;
        if (![panel.size.columns || 1, panel.size.rows || 1].every(value => Number.isInteger(Number(value)) && Number(value) > 0)) {
          throw new Error(`screens.${screenId}.panels[${index}].size values must be positive integers`);
        }
      }
    },
  };
}
