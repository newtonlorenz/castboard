export function prepare({ container, screen }) {
  container.classList.add('screen-type-grid');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${screen.layout.columns}, minmax(0, 1fr))`;
  container.style.gridTemplateRows = `repeat(${screen.layout.rows}, minmax(0, 1fr))`;
  container.style.gap = `${screen.layout.gap ?? 8}px`;
  container.style.padding = `${screen.layout.padding ?? 8}px`;
}

export function place({ element, panel }) {
  element.style.gridColumn = `${panel.position.column} / span ${panel.position.width}`;
  element.style.gridRow = `${panel.position.row} / span ${panel.position.height}`;
}
