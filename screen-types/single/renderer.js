export function prepare({ container, screen }) {
  container.classList.add('screen-type-single');
  container.style.display = 'block';
  container.style.padding = `${screen.layout?.padding ?? 8}px`;
}

export function place({ element }) {
  element.style.width = '100%';
  element.style.height = '100%';
}
