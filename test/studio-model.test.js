import test from 'node:test';
import assert from 'node:assert/strict';
import { History, gridSlot, gridDelta, compatibleSource } from '../public/studio-model.js';

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
