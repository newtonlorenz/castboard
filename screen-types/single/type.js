export function createScreenType() {
  return {
    id: 'single',
    name: 'Single panel',
    version: '1.0.0',
    validateScreen(screen, screenId) {
      if (screen.panels.length !== 1) throw new Error(`screens.${screenId} must contain exactly one panel for the single screen type`);
    },
  };
}
