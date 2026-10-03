import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDraft, resolveDraft } from '../public/draft-model.js';

test('draft reconciliation preserves unrelated screen and plugin changes', () => {
  const base={screens:{one:{title:'One',appearance:{accent:'green'},panels:[{id:'clock'}]},two:{title:'Two'}}};
  const local=structuredClone(base);local.screens.one.appearance.accent='blue';
  const latest=structuredClone(base);latest.screens.one.title='Renamed';latest.screens.two.title='Updated';
  const result=mergeDraft(base,local,latest);
  assert.deepEqual(result.conflicts,[]);
  assert.equal(result.value.screens.one.title,'Renamed');assert.equal(result.value.screens.one.appearance.accent,'blue');assert.equal(result.value.screens.two.title,'Updated');
  assert.equal(base.screens.one.appearance.accent,'green');
});
test('overlapping edits and deletion are explicit choices rather than silent overwrites', () => {
  const base={screen:{title:'Original',panels:[{id:'one'}]},keep:1};
  const local={screen:{title:'Mine',panels:[{id:'one'},{id:'two'}]},keep:1};
  const latest={screen:{title:'Theirs',panels:[{id:'three'}]},keep:2};
  const result=mergeDraft(base,local,latest);
  assert.deepEqual(result.conflicts.map(c=>c.path),[['screen','title'],['screen','panels']]);
  assert.throws(()=>resolveDraft(result,['local']),/Choose/);
  assert.deepEqual(resolveDraft(result,['local','latest']),{screen:{title:'Mine',panels:[{id:'three'}]},keep:2});
  const deletion=mergeDraft(base,{},latest);assert.equal(deletion.conflicts.length,2);
  assert.deepEqual(resolveDraft(deletion,['latest','local']),{screen:latest.screen});
});
test('new fields, equal edits and object key order do not create conflicts', () => {
  assert.deepEqual(mergeDraft({a:1,b:2},{b:2,a:1},{a:3,b:2}).conflicts,[]);
  assert.deepEqual(mergeDraft({}, {name:'New'}, {color:'green'}),{value:{name:'New',color:'green'},conflicts:[]});
  assert.deepEqual(mergeDraft({name:'Old'},{name:'New'},{name:'New'}),{value:{name:'New'},conflicts:[]});
});

test('unchanged panel order allows field-level reconciliation within individual panels', () => {
 const base={panels:[{id:'clock',position:{row:1,column:1},options:{title:'Clock'}}]};
 const local=structuredClone(base);local.panels[0].position.row=2;
 const latest=structuredClone(base);latest.panels[0].options.title='New clock';
 const result=mergeDraft(base,local,latest);assert.equal(result.conflicts.length,0);assert.equal(result.value.panels[0].position.row,2);assert.equal(result.value.panels[0].options.title,'New clock');
 latest.panels[0].position.row=3;const conflict=mergeDraft(base,local,latest);assert.deepEqual(conflict.conflicts[0].path,['panels',0,'position','row']);assert.equal(resolveDraft(conflict,['local']).panels[0].position.row,2);
});

test('plugin recovery storage omits protected values and credential-bearing URLs', async () => {
 const {safePluginDraft}=await import('../public/draft-model.js');
 const draft={base:{settings:{title:'Saved',privateUrl:'https://user:password@example.test'},protectedFields:['credential'],settingsSchema:{properties:{api:{sensitive:true}}}},edits:{title:'Draft',api:'secret-api',credential:'private-value',endpoint:'https://example.test?token=secret'},inputs:{api:{value:'secret-api'},headers:{value:'invalid-secret-json'}},clears:[]};
 const safe=safePluginDraft(draft);const encoded=JSON.stringify(safe);
 assert.doesNotMatch(encoded,/secret-api|private-value|user:password|token=secret|invalid-secret-json/);
 assert.equal(safe.edits.title,'Draft');assert.deepEqual(safe.omitted,['api','credential','endpoint','headers']);assert.equal(draft.edits.api,'secret-api');
});
