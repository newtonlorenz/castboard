// Shared editor state and geometry; dimensions are in the screen's own pixels.
export const clone = value => JSON.parse(JSON.stringify(value));
export function gridSlot(screen, width = 3, height = 2) {
  const { columns = 12, rows = 8 } = screen.layout || {};
  for (const [w, h] of [[Math.min(width, columns), Math.min(height, rows)], [1, 1]]) {
    for (let row = 1; row <= rows - h + 1; row++) for (let column = 1; column <= columns - w + 1; column++) {
      const candidate = { column, row, width: w, height: h };
      if (!screen.panels.some(panel => overlaps(candidate, panel.position))) return candidate;
    }
  }
  return null;
}
export function overlaps(a, b) {
  return b && a.column < b.column + b.width && a.column + a.width > b.column && a.row < b.row + b.height && a.row + a.height > b.row;
}
export function gridDelta(layout, viewport, scale, dx, dy) {
  const {columns, rows, padding = 8, gap = 8} = layout;
  const cell = (size, count) => (size - padding * 2 - gap * (count - 1)) / count + gap;
  return { x: Math.round(dx / (cell(viewport.width, columns) * scale)), y: Math.round(dy / (cell(viewport.height, rows) * scale)) };
}
export function compatibleSource(pluginId, catalog) {
  const plugin = catalog.plugins.find(item => item.id === pluginId);
  if (!plugin?.inputContract) return undefined;
  const sources = (catalog.sources || []).filter(item => item.contract === plugin.inputContract);
  return (sources.find(item => item.id === pluginId) || sources[0])?.id;
}
export function schemaDefaults(schema) {
  const result = {};
  for (const [key, value] of Object.entries(schema?.properties || {})) {
    if (value.default !== undefined) result[key] = clone(value.default);
  }
  return result;
}
export class History {
  constructor(value, limit = 80) { this.entries = [clone(value)]; this.index = 0; this.limit = limit; this.time = 0; }
  record(value, group = false) {
    if (JSON.stringify(value) === JSON.stringify(this.entries[this.index])) return;
    const merge = group && Date.now() - this.time < 500 && this.index > 0 && this.index === this.entries.length - 1;
    this.entries.length = this.index + 1;
    if (merge) this.entries[this.index] = clone(value);
    else { this.entries.push(clone(value)); this.index++; }
    if (this.entries.length > this.limit) { this.entries.shift(); this.index--; }
    this.time = group ? Date.now() : 0;
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }
  undo() { if (this.canUndo) this.index--; this.time = 0; return clone(this.entries[this.index]); }
  redo() { if (this.canRedo) this.index++; this.time = 0; return clone(this.entries[this.index]); }
}
