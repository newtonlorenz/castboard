import test from 'node:test';
import assert from 'node:assert/strict';
import { initialNavigation, navigate, activeScreen, reachableScreens, validateInteraction } from '../public/interaction-model.js';
import { validateConfig } from '../src/core/config.js';
import { extractDesign, mergeDesign } from '../src/core/admin-config.js';

const screens = {
  home: { path: '/', panels: [{ id: 'weather', plugin: 'weather', interaction: {type:'modal',screenId:'details'} }] },
  details: { path: '/details', presentation:'modal', viewport:{width:640,height:360}, panels: [{id:'next',plugin:'weather',interaction:{type:'screen',screenId:'second'}}] },
  second: { path:'/second',panels:[] },
  private: { path:'/private',panels:[] },
};
const config = () => ({server:{port:8787},plugins:{weather:{enabled:true}},screens:structuredClone(screens),defaultScreen:'home'});

test('modal navigation preserves the underlying screen, supports nesting, close and back',()=>{
  const first=initialNavigation('home');
  const modal=navigate(first,{type:'modal',screenId:'details'},screens);
  assert.equal(activeScreen(modal),'details');assert.equal(modal.screenId,'home');assert.deepEqual(first,initialNavigation('home'));
  assert.deepEqual(navigate(modal,{type:'close'},screens),first);
  const second=navigate(modal,{type:'screen',screenId:'second'},screens);
  assert.deepEqual(second,{screenId:'second',history:['home'],modals:[]});
  assert.deepEqual(navigate(second,{type:'back'},screens),first);
  let stacked=first;for(let n=0;n<4;n++)stacked=navigate(stacked,{type:'modal',screenId:'details'},screens);
  assert.throws(()=>navigate(stacked,{type:'modal',screenId:'details'},screens),/Close/);
});
test('assigned-screen reachability follows declared links only and tolerates cycles',()=>{
  const cyclic=structuredClone(screens);cyclic.second.panels=[{interaction:{type:'screen',screenId:'home'}}];
  const allowed=reachableScreens(cyclic,'home');assert.deepEqual([...allowed],['home','details','second']);
  assert.throws(()=>navigate(initialNavigation('home'),{type:'screen',screenId:'private'},screens,allowed),/not available/);
});
test('configuration rejects broken targets, payload action overrides and invalid display dimensions',()=>{
  assert.doesNotThrow(()=>validateConfig(config()));
  const broken=config();broken.screens.home.panels[0].interaction.screenId='missing';assert.throws(()=>validateConfig(broken),/unknown screen/);
  assert.throws(()=>validateInteraction({type:'action',action:'volume',payload:{action:'erase'}},screens,{}),/override/);
  const invalid=config();invalid.screens.details.viewport.width=-1;assert.throws(()=>validateConfig(invalid),/viewport/);
});
test('design extraction and saves retain modal compositions and private display settings',()=>{
  const current=config();current.screens.details.targets=[{address:'private-target'}];
  const draft=extractDesign(current);assert.equal(draft.screens.details.presentation,'modal');assert.equal(draft.screens.details.viewport.width,640);
  assert.equal(draft.screens.details.targets,undefined);
  const merged=mergeDesign(current,draft);assert.equal(merged.screens.details.presentation,'modal');assert.deepEqual(merged.screens.details.viewport,current.screens.details.viewport);assert.deepEqual(merged.screens.details.targets,current.screens.details.targets);assert.deepEqual(merged.screens.home.panels,current.screens.home.panels);
});
