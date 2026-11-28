import test from 'node:test';
import assert from 'node:assert/strict';
import { History, screenAddress, gridSlot, gridDelta, compatibleSource } from '../public/studio-model.js';

test('undo preserves a prior draft, truncates redo after a new edit, and caps retained history', () => {
 const history = new History({title:'saved'},3);
 history.record({title:'first'}); history.record({title:'second'});
 assert.deepEqual(history.undo(),{title:'first'});
 assert.deepEqual(history.redo(),{title:'second'});
 history.undo(); history.record({title:'replacement'});
 assert.equal(history.canRedo,false);
 history.record({title:'third'});
 assert.equal(history.entries.length,3);
 assert.deepEqual(history.undo(),{title:'replacement'});
 assert.deepEqual(history.undo(),{title:'first'});
});
test('grid addition finds smaller space and reports a full grid instead of overlapping a panel', () => {
 const screen={layout:{columns:2,rows:2},panels:[{position:{column:1,row:1,width:2,height:1}}]};
 assert.deepEqual(gridSlot(screen),{column:1,row:2,width:1,height:1});
 screen.panels.push({position:{column:1,row:2,width:2,height:1}});
 assert.equal(gridSlot(screen),null);
});
test('dragging snaps by the rendered grid pitch at every fit scale', () => {
 const layout={columns:4,rows:2,padding:20,gap:16}; const viewport={width:1280,height:800};
 for (const scale of [.3,.67,1]) {
  assert.deepEqual(gridDelta(layout,viewport,scale,314*scale,388*scale),{x:1,y:1});
  assert.deepEqual(gridDelta(layout,viewport,scale,-314*scale,-388*scale),{x:-1,y:-1});
 }
});
test('views choose a compatible source instance and prefer their own source when available', () => {
 const catalog={plugins:[{id:'gauge',inputContract:'reading'}],sources:[{id:'weather',contract:'weather'},{id:'north',contract:'reading'}]};
 assert.equal(compatibleSource('gauge',catalog),'north');
 catalog.sources.push({id:'gauge',contract:'reading'});
 assert.equal(compatibleSource('gauge',catalog),'gauge');
 assert.equal(compatibleSource('missing',catalog),undefined);
});

import {shuffleGrid, swapGrid, sharedEdges, resizeShared, resizeTracks, trackLines, trackDelta, resizePanel, validPlacement} from '../public/studio-model.js';
import {editor as areaEditor} from '../examples/flexible/extensions/screen-types/area-grid/renderer.js';
import {createScreenType as createAreaType} from '../examples/flexible/extensions/screen-types/area-grid/type.js';
const tiled = () => ({columns:4,rows:2,gap:8,padding:8,positions:{a:{column:1,row:1,width:2,height:1},b:{column:3,row:1,width:2,height:1},c:{column:1,row:2,width:2,height:1},d:{column:3,row:2,width:2,height:1}}});
test('moving into a full grid shuffles panels into the vacated space without altering the input',()=>{
 const model=tiled(),before=JSON.stringify(model);const result=shuffleGrid(model,'a',{...model.positions.a,column:3});
 assert.ok(result);assert.ok(validPlacement(result));assert.equal(result.positions.b.column,1);assert.equal(JSON.stringify(model),before);
});
test('an impossible enlargement leaves a full screen intact',()=>{
 const model=tiled();assert.equal(shuffleGrid(model,'a',{column:1,row:1,width:3,height:2}),null);
});
test('shared resizing handles a T junction and clamps every neighbour to one cell',()=>{
 const model={columns:6,rows:2,positions:{a:{column:1,row:1,width:3,height:2},b:{column:4,row:1,width:3,height:1},c:{column:4,row:2,width:3,height:1}}};
 const edge=sharedEdges(model)[0];const result=resizeShared(model,edge,9);
 assert.ok(validPlacement(result));assert.equal(result.positions.a.width,5);assert.equal(result.positions.b.width,1);assert.equal(result.positions.c.width,1);assert.equal(result.positions.c.column,6);
});
test('named-area swaps keep all rectangles valid, including unequal panel sizes',()=>{
 const screen={layout:{areas:['a a b','c c b'],rows:[50,100],gap:12,padding:12},panels:[{id:'first',position:{area:'a'}},{id:'second',position:{area:'b'}},{id:'third',position:{area:'c'}}]};
 const model=areaEditor.read(screen),result=swapGrid(model,'first','second');areaEditor.write(screen,result);
 createAreaType().validateScreen(screen);assert.deepEqual(areaEditor.read(screen).positions.first,{column:3,row:1,width:1,height:2});
 const resize=resizeTracks(result,'y',1,20,{width:600,height:400});areaEditor.write(screen,resize);createAreaType().validateScreen(screen);assert.ok(resize.rowWeights[0]>50);assert.equal(resize.rowWeights.reduce((a,b)=>a+b,0),150);
});
test('weighted geometry honours selected viewport and fitted scale',()=>{
 const model={columns:2,rows:2,columnWeights:[1,3],rowWeights:[1,2],padding:10,gap:10};
 assert.deepEqual(trackLines(2,[1,3],430,10,10),[10,120,430]);
 assert.deepEqual(trackDelta(model,{width:430,height:330},.5,{column:1,row:1},55,55),{x:1,y:1});
});
test('many shuffled moves remain bounded and never lose panel identities',()=>{
 let model=tiled();
 for(let i=0;i<40;i++){const id=['a','b','c','d'][i%4],target={...model.positions[id],column:i%2?1:3,row:i%3?1:2};const next=shuffleGrid(model,id,target);if(next)model=next;assert.ok(validPlacement(model));assert.deepEqual(Object.keys(model.positions).sort(),['a','b','c','d']);}
});

test('screen addresses need no technical input, including numbered and non-Latin names', () => {
 assert.deepEqual(screenAddress('21 Café'), {id:'screen-21-cafe',path:'/screens/screen-21-cafe'});
 assert.deepEqual(screenAddress('書斎'), {id:'screen',path:'/screens/screen'});
 assert.deepEqual(screenAddress('Admin'), {id:'admin',path:'/screens/admin'});
 const screens = {kitchen:{path:'/old-kitchen'},other:{path:'/screens/kitchen-2'}};
 assert.deepEqual(screenAddress('Kitchen',screens), {id:'kitchen-3',path:'/screens/kitchen-3'});
 assert.deepEqual(screenAddress('  North & South  '), {id:'north-south',path:'/screens/north-south'});
});


import {createScreenType as areaType} from '../examples/flexible/extensions/screen-types/area-grid/type.js';
import {schemaDefaults} from '../public/studio-model.js';
test('named-area creation and repeated additions stay valid without manual geometry', () => {
 const type=areaType(),screen={type:'area-grid',layout:schemaDefaults(type.layoutSchema),panels:[]};
 for(let i=0;i<18;i++){
  areaEditor.add(screen,{id:`clock-${i}`,plugin:'clock'});
  type.validateScreen(screen);
  assert.equal(screen.panels.length,i+1);
  assert.equal(Object.keys(areaEditor.read(screen).positions).length,i+1);
 }
 const removed=screen.panels.splice(3,1)[0],rowsBefore=screen.layout.rows.length;
 areaEditor.add(screen,{id:'replacement',plugin:'clock'});
 assert.equal(screen.panels.at(-1).position.area,removed.position.area);
 assert.equal(screen.layout.rows.length,rowsBefore);
 type.validateScreen(screen);
});
test('adding to a full named-area layout divides space and preserves every existing panel', () => {
 const screen={layout:{areas:['main main side side','main main side side'],rows:[1,1],columns:[1,2,1,2]},panels:[{id:'main',position:{area:'main'}},{id:'side',position:{area:'side'}}]};
 areaEditor.add(screen,{id:'clock',plugin:'clock'});
 areaType().validateScreen(screen);
 assert.deepEqual(screen.panels.map(p=>p.id),['main','side','clock']);
 assert.deepEqual(screen.layout.columns,[1,2,1,2]);
 assert.deepEqual(screen.layout.rows,[1,1]);
});

test('corner resizing shares occupied grid space and measures from the dragged edge', () => {
 const model=tiled();
 const next=resizePanel(model,'a','se',100,0,{width:400,height:200});
 assert.ok(validPlacement(next));assert.equal(next.positions.a.width,3);assert.equal(next.positions.b.width,1);
 assert.equal(model.positions.a.width,2);
 const weighted={...model,weightedResize:true,columnWeights:[1,5,1,1],rowWeights:[1,1]};
 const smaller=resizePanel(weighted,'a','se',-30,0,{width:800,height:400});
 assert.ok(validPlacement(smaller));assert.ok(smaller.columnWeights[1]<5);assert.equal(smaller.columnWeights.reduce((a,b)=>a+b),8);
});
test('all four corners resize weighted panels, including the bottom-right panel', () => {
 const model={...tiled(),weightedResize:true,columnWeights:[1,1,1,1],rowWeights:[1,1]};
 for(const [id,corner,dx,dy] of [['a','se',20,20],['b','sw',-20,20],['c','ne',20,-20],['d','nw',-20,-20]]) {
  const next=resizePanel(model,id,corner,dx,dy,{width:800,height:400});
  assert.ok(validPlacement(next));assert.notDeepEqual(next.columnWeights,model.columnWeights);assert.notDeepEqual(next.rowWeights,model.rowWeights);
 }
});
test('isolated weighted panels resize into empty space at every viewport scale', () => {
 const model={columns:3,rows:3,gap:8,padding:8,weightedResize:true,columnWeights:[1,1,1],rowWeights:[1,1,1],positions:{a:{column:1,row:1,width:1,height:1}}};
 for(const scale of [.3,.67,1]) {
  const next=resizePanel(model,'a','se',20*scale,30*scale,{width:600,height:400},scale);
  assert.ok(validPlacement(next));assert.ok(next.columnWeights[0]>1);assert.ok(next.rowWeights[0]>1);
 }
});
test('full-width panels can shrink from an outside corner and named areas round-trip', () => {
 const screen={layout:{areas:['a a a','b b b'],rows:[1,1],gap:8,padding:8},panels:[{id:'a',position:{area:'a'}},{id:'b',position:{area:'b'}}]};
 const model=areaEditor.read(screen),next=resizePanel(model,'a','se',-200,0,{width:600,height:400});
 assert.equal(next.positions.a.width,2);assert.ok(validPlacement(next));areaEditor.write(screen,next);areaType().validateScreen(screen);
 assert.deepEqual(areaEditor.read(screen).positions,next.positions);
});
test('a minimum-sized adjacent track does not block resizing across a wider neighbour', () => {
 const model={columns:4,rows:1,gap:0,padding:0,columnWeights:[2,.24,1.76,2],positions:{a:{column:1,row:1,width:1,height:1},b:{column:2,row:1,width:2,height:1},c:{column:4,row:1,width:1,height:1}},weightedResize:true};
 const next=resizePanel(model,'a','se',50,0,{width:600,height:200});
 assert.equal(next.columnWeights[0],2.5);assert.equal(next.columnWeights[1],.24);assert.equal(next.columnWeights[2],1.26);
 assert.ok(validPlacement(next));assert.equal(next.columnWeights.reduce((a,b)=>a+b),6);
 const clamped=resizePanel(model,'a','se',5000,0,{width:600,height:200});
 assert.ok(clamped.columnWeights.every(w=>w>=.24));assert.ok(Math.abs(clamped.columnWeights.reduce((a,b)=>a+b)-6)<1e-10);
});
test('large named-area panels can extend down to fill the empty bottom row', () => {
 const screen={layout:{areas:['portfolio portfolio calendar camera','portfolio portfolio calendar camera','metrics . . .'],rows:[130,240,170],columns:[1,1,1,1],gap:12,padding:12},panels:['portfolio','calendar','camera','metrics'].map(id=>({id,position:{area:id}}))};
 let model=areaEditor.read(screen);
 const viewport={width:800,height:600};
 for(const id of ['calendar','camera','portfolio']) {
  const before=JSON.stringify(model);
  const next=resizePanel(model,id,'s',0,1000,viewport);
  assert.equal(next.positions[id].row+next.positions[id].height-1,model.rows);
  assert.ok(validPlacement(next));assert.equal(JSON.stringify(model),before);
  assert.deepEqual(next.rowWeights,model.rowWeights);
  areaEditor.write(screen,next);areaType().validateScreen(screen);
 }
 // Calendar and Camera can both fill the bottom without moving the small panel.
 model=resizePanel(model,'calendar','s',0,1000,viewport);
 model=resizePanel(model,'camera','s',0,1000,viewport);
 assert.equal(model.positions.calendar.height,3);assert.equal(model.positions.camera.height,3);
 assert.deepEqual(model.positions.metrics,{column:1,row:3,width:1,height:1});
});

test('a single edge ignores motion parallel to that edge', () => {
 const model={...tiled(),weightedResize:true,columnWeights:[1,1,1,1],rowWeights:[1,1]};
 const viewport={width:800,height:400};
 const next=resizePanel(model,'a','s',120,20,viewport);
 assert.deepEqual(next.columnWeights,model.columnWeights);
 assert.notDeepEqual(next.rowWeights,model.rowWeights);
});
