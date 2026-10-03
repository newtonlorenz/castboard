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

// Renderer editor adapters expose a bounded grid without changing the screen schema.
export function trackLines(count, weights, extent, gap = 0, padding = 0) {
  const values = weights?.length === count ? weights : Array(count).fill(1);
  const available = extent - padding * 2 - gap * (count - 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const lines = [padding];
  for (const value of values) lines.push(lines.at(-1) + available * value / total + gap);
  return lines;
}
export function trackDelta(model, viewport, scale, position, dx, dy) {
  const delta = (axis, count, weights, value, start) => {
    const lines = trackLines(count, weights, viewport[axis], model.gap, model.padding);
    const target = lines[start - 1] + value / scale;
    return lines.reduce((best, line, index) => Math.abs(line - target) < Math.abs(lines[best] - target) ? index : best, start - 1) - start + 1;
  };
  return {x:delta('width',model.columns,model.columnWeights,dx,position.column),y:delta('height',model.rows,model.rowWeights,dy,position.row)};
}
export function validPlacement(model, positions = model.positions) {
  const entries = Object.values(positions);
  return entries.every((p, i) => [p.column,p.row,p.width,p.height].every(Number.isInteger) && p.column >= 1 && p.row >= 1 && p.width >= 1 && p.height >= 1 && p.column+p.width-1<=model.columns && p.row+p.height-1<=model.rows && entries.slice(i+1).every(other=>!overlaps(p,other)));
}
export function shuffleGrid(model, id, target) {
  if (!validPlacement({...model,positions:{[id]:target}})) return null;
  const original = model.positions;
  const others = Object.keys(original).filter(key=>key!==id);
  const collisions = others.filter(key=>overlaps(target,original[key]));
  const attempt = movable => {
    const positions = {[id]:{...target}};
    for (const key of others.filter(key=>!movable.includes(key))) positions[key]={...original[key]};
    if (!validPlacement(model,positions)) return null;
    let budget = 12000;
    const place = index => {
      if (!budget-- || index===movable.length) return index===movable.length;
      const key=movable[index], p=original[key];
      const candidates=[];
      for(let row=1;row<=model.rows-p.height+1;row++) for(let column=1;column<=model.columns-p.width+1;column++) {
        const next={...p,column,row};
        const distance=Math.abs(column-p.column)+Math.abs(row-p.row);
        const vacated=Math.abs(column-original[id].column)+Math.abs(row-original[id].row);
        candidates.push({next,score:distance+(collisions.includes(key)?vacated*.25:0)});
      }
      candidates.sort((a,b)=>a.score-b.score);
      for(const {next} of candidates) if(Object.values(positions).every(other=>!overlaps(next,other))) {
        positions[key]=next;
        if(place(index+1)) return true;
        delete positions[key];
      }
      return false;
    };
    return place(0)?{...model,positions}:null;
  };
  return attempt(collisions) || attempt(others.sort((a,b)=>Number(collisions.includes(b))-Number(collisions.includes(a)) || original[b].width*original[b].height-original[a].width*original[a].height));
}
export function swapGrid(model, first, second) {
  if(first===second||!model.positions[first]||!model.positions[second]) return model;
  const next=clone(model); [next.positions[first],next.positions[second]]=[next.positions[second],next.positions[first]]; return next;
}
export function sharedEdges(model) {
  const edges=[]; const entries=Object.entries(model.positions);
  for(const [id,p] of entries) for(const [other,q] of entries) {
    if(id===other) continue;
    if(p.column+p.width===q.column && Math.max(p.row,q.row)<Math.min(p.row+p.height,q.row+q.height)) edges.push({axis:'x',line:q.column,start:Math.max(p.row,q.row),end:Math.min(p.row+p.height,q.row+q.height),before:id,after:other});
    if(p.row+p.height===q.row && Math.max(p.column,q.column)<Math.min(p.column+p.width,q.column+q.width)) edges.push({axis:'y',line:q.row,start:Math.max(p.column,q.column),end:Math.min(p.column+p.width,q.column+q.width),before:id,after:other});
  }
  return edges;
}
export function resizeShared(model, edge, delta) {
  const next=clone(model); const vertical=edge.axis==='x';
  const origin=vertical?'column':'row',size=vertical?'width':'height';
  // A T-junction is one connected edge. Adjust every panel meeting that edge.
  let group=[edge], keys=new Set([edge.before,edge.after]);
  for(let changed=true;changed;) {changed=false;for(const candidate of sharedEdges(model)) if(candidate.axis===edge.axis&&candidate.line===edge.line&&(keys.has(candidate.before)||keys.has(candidate.after))) {if(!group.includes(candidate)&&(!keys.has(candidate.before)||!keys.has(candidate.after))){group.push(candidate);keys.add(candidate.before);keys.add(candidate.after);changed=true;}}}
  const before=new Set(group.map(e=>e.before)),after=new Set(group.map(e=>e.after));
  const minimum=Math.max(...[...before].map(id=>1-model.positions[id][size]));
  const maximum=Math.min(...[...after].map(id=>model.positions[id][size]-1));
  const movement=Math.max(minimum,Math.min(maximum,delta));
  for(const id of before) next.positions[id][size]+=movement;
  for(const id of after) {next.positions[id][origin]+=movement;next.positions[id][size]-=movement;}
  return validPlacement(next)?next:model;
}
export function resizeTracks(model, axis, boundary, pixels, viewport) {
  const next=clone(model), field=axis==='x'?'columnWeights':'rowWeights',count=axis==='x'?model.columns:model.rows;
  const weights=next[field] ||= Array(count).fill(1);
  const extent=viewport[axis==='x'?'width':'height']-model.padding*2-model.gap*(count-1);
  const total=weights.reduce((a,b)=>a+b,0),minimum=Math.min(24,extent/count/2)*total/extent;
  const movement=Math.max(minimum-weights[boundary-1],Math.min(weights[boundary]-minimum,pixels*total/extent));
  weights[boundary-1]+=movement;weights[boundary]-=movement;return next;
}

// Screen names are human-facing; generated addresses avoid internal route names.
export function screenAddress(title, screens = {}) {
  let stem = String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'screen';
  if (!/^[a-z]/.test(stem)) stem = `screen-${stem}`;
  const paths = new Set(Object.values(screens).map(screen => screen.path));
  let id = stem, suffix = 2;
  while (screens[id] || paths.has(`/screens/${id}`)) id = `${stem}-${suffix++}`;
  return {id, path: `/screens/${id}`};
}
