import test from 'node:test';
import assert from 'node:assert/strict';
import {panelStyle, FONT_STACKS, previewStructure} from '../public/appearance-model.js';
test('screen appearance reaches modules and panel overrides retain zero values',()=>{
 const style=panelStyle({radius:0,padding:0,fontScale:80,textColor:'#112233'},{fontFamily:'mono',fontScale:125,panelBackground:'#abcdef',panelPadding:20,radius:14,textColor:'#fff000'});
 assert.equal(style['font-size'],'16px');assert.equal(style['font-family'],FONT_STACKS.mono);assert.equal(style['background'],'#abcdef');assert.equal(style['padding'],'0px');assert.equal(style['border-radius'],'0px');assert.equal(style['--castboard-textColor'],'#112233');
});
test('unconfigured themes keep plugin-owned colours and fonts',()=>{
 assert.deepEqual(panelStyle(),{'font-size':'16px','--castboard-text-scale':'1'});
});
test('appearance and geometry update in place while option and source changes remount',()=>{
 const config={branding:{name:'Demo'},plugins:[],screens:{home:{id:'home',type:'grid',layout:{columns:2},panels:[{id:'a',plugin:'clock',position:{column:1},options:{title:'Clock'}}]}}};
 const initial=previewStructure(config,'home');const next=structuredClone(config);next.screens.home.appearance={fontFamily:'mono'};next.screens.home.layout.columns=4;next.screens.home.panels[0].position.column=2;next.screens.home.panels[0].appearance={textColor:'#abcdef'};assert.equal(previewStructure(next,'home'),initial);
 next.screens.home.panels[0].options.title='New';assert.notEqual(previewStructure(next,'home'),initial);
});
