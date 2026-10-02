export function createScreenType() {
  return {
    id: 'area-grid', name: 'Named area grid', version: '1.1.0',
    layoutSchema: {type:'object',required:['areas','rows'],properties:{areas:{type:'array',items:{type:'string'},title:'Named area rows'},rows:{type:'array',items:{type:'number',minimum:0.001},title:'Row weights'},columns:{type:'array',items:{type:'number',minimum:0.001},title:'Column weights'},gap:{type:'number',minimum:0,title:'Panel gap'},padding:{type:'number',minimum:0,title:'Screen padding'}}},
    positionSchema: {type:'object',required:['area'],properties:{area:{type:'string'}}},
    validateScreen(screen) {
      const rows=screen.layout.areas.map(row=>row.trim().split(/\s+/));
      if(!rows.length||rows.some(row=>row.length!==rows[0].length)||rows.length!==screen.layout.rows.length)throw new Error('Area grid rows must have equal columns and row weights');
      for(const area of new Set(rows.flat().filter(area=>area!=='.'))){
        if(!/^[a-z][a-z0-9-]*$/.test(area))throw new Error('Invalid named area');
        const cells=rows.flatMap((row,y)=>row.flatMap((name,x)=>name===area?[[x,y]]:[]));
        const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
        if(cells.length!==(Math.max(...xs)-Math.min(...xs)+1)*(Math.max(...ys)-Math.min(...ys)+1))throw new Error('Named areas must form rectangles');
      }
      if(screen.layout.columns && (screen.layout.columns.length!==rows[0].length || screen.layout.columns.some(value=>!Number.isFinite(value)||value<=0)))throw new Error('Column weights must match the grid and be positive');
      const used=new Set();
      for(const panel of screen.panels){const area=panel.position?.area;if(!rows.flat().includes(area)||used.has(area))throw new Error(`Invalid or repeated panel area: ${area}`);used.add(area);}
    }
  };
}
