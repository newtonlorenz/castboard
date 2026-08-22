export function createScreenType() {
  return {
    id: 'single',
    name: 'Single panel',
    version: '1.0.0',
    validateScreen(screen, screenId) {
      if (screen.panels.length !== 1) throw new Error(`screens.${screenId} must contain exactly one panel for the single screen type`);
      if (screen.layout?.padding !== undefined && (!Number.isFinite(Number(screen.layout.padding)) || Number(screen.layout.padding) < 0 || Number(screen.layout.padding) > 64)) throw new Error(`screens.${screenId}.layout.padding must be from 0 to 64`);
    },
  };
}
