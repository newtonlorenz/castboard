import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../src/server.js';

test('forwarded actions validate the target and invalidate its shared cached data',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castboard-action-forward-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const type of ['counter','delegate'])await fs.mkdir(path.join(dir,'plugins',type),{recursive:true});
 await fs.writeFile(path.join(dir,'plugins/counter/plugin.js'),`export function createPlugin(){let count=0;return {id:'counter',name:'Counter',getData:()=>({count}),actionSchemas:{increment:{type:'object',required:['action'],properties:{action:{type:'string'}}}},action:()=>({count:++count})};}`);
 await fs.writeFile(path.join(dir,'plugins/delegate/plugin.js'),`export function createPlugin({context}){return {id:'delegate',name:'Delegate',action:payload=>context.action('counter',payload)};}`);
 const config={server:{host:'127.0.0.1',port:8787},branding:{name:'Test'},defaultScreen:'test',screens:{test:{path:'/',type:'grid',panels:[],layout:{columns:1,rows:1}}},extensions:{plugins:['plugins']},plugins:{counter:{cacheMs:60000},delegate:{}}};
 const app=await createApp({loadedConfig:{config,rawConfig:config,configDir:dir,configPath:path.join(dir,'config.json')},logger:{error(){}}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await app.dispose();});
 const base=`http://127.0.0.1:${app.server.address().port}/api/plugins`;
 const read=async()=> (await(await fetch(base+'/counter/data')).json()).data.count;
 const action=payload=>fetch(base+'/delegate/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal(await read(),0);
 assert.equal((await action({action:'increment'})).status,200);
 assert.equal(await read(),1);
 assert.equal((await action({action:'unsupported'})).status,422);
 assert.equal(await read(),1);
});
