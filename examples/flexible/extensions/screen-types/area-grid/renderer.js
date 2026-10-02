export function prepare({container,screen}) {
  container.style.display='grid';
  container.style.gridTemplateColumns=screen.layout.columns?.map(value=>`minmax(0,${value}fr)`).join(' ') || `repeat(${screen.layout.areas[0].trim().split(/\s+/).length},minmax(0,1fr))`;
  container.style.gridTemplateRows=screen.layout.rows.map(value=>`minmax(0,${value}fr)`).join(' ');
  container.style.gridTemplateAreas=screen.layout.areas.map(row=>`"${row}"`).join(' ');
  container.style.gap=`${screen.layout.gap??12}px`;
  container.style.padding=`${screen.layout.padding??12}px`;
}
export function place({element,panel}) {element.style.gridArea=panel.position.area;}

export const editor = {
  incremental: true,
  read(screen) {
    const areas=screen.layout.areas.map(row=>row.trim().split(/\s+/));
    const positions={};
    for(const panel of screen.panels) {
      const cells=areas.flatMap((row,y)=>row.flatMap((area,x)=>area===panel.position.area?[[x,y]]:[]));
      if(!cells.length) return null;
      const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
      positions[panel.id]={column:Math.min(...xs)+1,row:Math.min(...ys)+1,width:Math.max(...xs)-Math.min(...xs)+1,height:Math.max(...ys)-Math.min(...ys)+1};
    }
    return {columns:areas[0].length,rows:areas.length,gap:screen.layout.gap??12,padding:screen.layout.padding??12,columnWeights:screen.layout.columns||Array(areas[0].length).fill(1),rowWeights:[...screen.layout.rows],positions,swapOnDrop:true,weightedResize:true};
  },
  write(screen, model) {
    const areas=Array.from({length:model.rows},()=>Array(model.columns).fill('.'));
    for(const panel of screen.panels) {const p=model.positions[panel.id];for(let y=p.row-1;y<p.row-1+p.height;y++)for(let x=p.column-1;x<p.column-1+p.width;x++)areas[y][x]=panel.position.area;}
    screen.layout.areas=areas.map(row=>row.join(' '));screen.layout.rows=[...model.rowWeights];screen.layout.columns=[...model.columnWeights];
  },
};
