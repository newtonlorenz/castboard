export function prepare({ container, screen }) {
  const layout = screen.layout || {};
  container.classList.add('screen-type-flow');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(auto-fit, minmax(min(100%, ${layout.minPanelWidth || 240}px), 1fr))`;
  container.style.gridTemplateRows = 'none';
  container.style.gridAutoRows = `minmax(${layout.minPanelHeight || 140}px, 1fr)`;
  container.style.gap = `${layout.gap ?? 8}px`;
  container.style.padding = `${layout.padding ?? 8}px`;
  container.style.overflow = 'auto';
}

export function place({ element, panel }) {
  element.style.gridColumn = `span ${panel.size?.columns || 1}`;
  element.style.gridRow = `span ${panel.size?.rows || 1}`;
}

export const editor = {incremental:true};
