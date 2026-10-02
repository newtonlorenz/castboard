export function prepare({container,screen}) {
  container.style.display='grid';
  container.style.gridTemplateColumns=`repeat(${screen.layout.areas[0].trim().split(/\s+/).length},minmax(0,1fr))`;
  container.style.gridTemplateRows=screen.layout.rows.map(value=>`minmax(0,${value}fr)`).join(' ');
  container.style.gridTemplateAreas=screen.layout.areas.map(row=>`"${row}"`).join(' ');
  container.style.gap=`${screen.layout.gap??12}px`;
  container.style.padding=`${screen.layout.padding??12}px`;
}
export function place({element,panel}) {element.style.gridArea=panel.position.area;}
