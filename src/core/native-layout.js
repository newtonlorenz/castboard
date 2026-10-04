// Layout extensions can supply their own nativeLayout(screen, viewport) hook.
// Rectangles are logical pixels in the device's configured orientation.
export function gridLayout(screen, viewport) {
  const { columns, rows, gap = 8, padding = 8 } = screen.layout;
  const width = (viewport.width - padding * 2 - (columns - 1) * gap) / columns;
  const height = (viewport.height - padding * 2 - (rows - 1) * gap) / rows;
  return screen.panels.map(panel => ({ id: panel.id,
    x: padding + (panel.position.column - 1) * (width + gap), y: padding + (panel.position.row - 1) * (height + gap),
    width: panel.position.width * width + (panel.position.width - 1) * gap,
    height: panel.position.height * height + (panel.position.height - 1) * gap,
  }));
}

export function singleLayout(screen, viewport) {
  const padding = screen.layout?.padding ?? 8;
  return screen.panels.map(panel => ({ id: panel.id, x: padding, y: padding, width: viewport.width - padding * 2, height: viewport.height - padding * 2 }));
}

export function flowLayout(screen, viewport) {
  const { gap = 8, padding = 8, minPanelWidth = 240, minPanelHeight = 140 } = screen.layout || {};
  const columns = Math.max(1, Math.floor((viewport.width - padding * 2 + gap) / (minPanelWidth + gap)));
  const occupied = new Set();
  let rowCount = 1;
  const cells = screen.panels.map(panel => {
    const width = Math.min(columns, Number(panel.size?.columns) || 1);
    const height = Math.min(24, Number(panel.size?.rows) || 1);
    for (let row = 0; row < 2400; row++) for (let column = 0; column <= columns - width; column++) {
      const keys = [];
      for (let y = row; y < row + height; y++) for (let x = column; x < column + width; x++) keys.push(`${x}:${y}`);
      if (keys.some(key => occupied.has(key))) continue;
      keys.forEach(key => occupied.add(key)); rowCount = Math.max(rowCount, row + height);
      return { id: panel.id, column, row, width, height };
    }
    throw new Error('Flow layout exceeds the native scene limit');
  });
  const cellWidth = (viewport.width - padding * 2 - (columns - 1) * gap) / columns;
  const cellHeight = Math.max(minPanelHeight, (viewport.height - padding * 2 - (rowCount - 1) * gap) / rowCount);
  return cells.map(cell => ({ id: cell.id, x: padding + cell.column * (cellWidth + gap), y: padding + cell.row * (cellHeight + gap), width: cell.width * cellWidth + (cell.width - 1) * gap, height: cell.height * cellHeight + (cell.height - 1) * gap }));
}
