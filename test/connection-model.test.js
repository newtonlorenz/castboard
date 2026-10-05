import test from 'node:test';
import assert from 'node:assert/strict';
import {editableConnections, compatibleSource, connectionVisible} from '../public/connection-model.js';

test('internal dependencies are excluded while explicit unbound inputs remain editable', () => {
 const plugin={bindings:{runtime:'runtime', theme:'theme', old:'old'}, internalBindings:['runtime','theme'], connectionSchema:{calendar:{contract:'calendar@1'}}};
 const inputs=editableConnections(plugin);
 assert.deepEqual(inputs.map(item=>item.alias),['calendar','old']);
 assert.equal(inputs[1].input.legacy,true);
});

test('source choices enforce data contract, capabilities and enabled status', () => {
 const source={enabled:true,contract:'calendar@1',hasData:true,hasAction:false};
 assert.equal(compatibleSource({contract:'calendar@1'},source),true);
 assert.equal(compatibleSource({contract:'weather@1'},source),false);
 assert.equal(compatibleSource({capabilities:['data','action']},source),false);
 assert.equal(compatibleSource({}, {...source,enabled:false}),false);
 assert.equal(compatibleSource({capabilities:['stream']},{...source,hasStream:true}),true);
});

test('shared input visibility follows the selected provider', () => {
 const input={showWhen:{provider:['plugin']}};
 assert.equal(connectionVisible(input,{provider:'demo'}),false);
 assert.equal(connectionVisible(input,{provider:'plugin'}),true);
});
