function positiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

export function createScreenType() {
  return {
    id: 'grid',
    name: 'Fixed grid',
    version: '1.0.0',
    validateScreen(screen, screenId) {
      const layout = screen.layout;
      if (!layout || typeof layout !== 'object' || Array.isArray(layout)) throw new Error(`screens.${screenId}.layout is required for grid screens`);
      const columns = Number(layout.columns);
      const rows = Number(layout.rows);
      if (!Number.isInteger(columns) || columns < 1 || columns > 24) throw new Error(`screens.${screenId}.layout.columns must be an integer from 1 to 24`);
      if (!Number.isInteger(rows) || rows < 1 || rows > 24) throw new Error(`screens.${screenId}.layout.rows must be an integer from 1 to 24`);
      for (const [index, panel] of screen.panels.entries()) {
        const position = panel.position;
        if (!position || ![position.column, position.row, position.width, position.height].every(positiveInteger)) {
          throw new Error(`screens.${screenId}.panels[${index}].position requires positive column, row, width, and height`);
        }
        if (Number(position.column) + Number(position.width) - 1 > columns || Number(position.row) + Number(position.height) - 1 > rows) {
          throw new Error(`screens.${screenId}.panels[${index}] exceeds its grid`);
        }
      }
    },
  };
}
