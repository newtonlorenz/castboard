import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDefaults, recordInputValue } from '../public/record-list-field.js';

test('record forms keep typed enum choices, zero, false and unset values distinct', () => {
  assert.equal(recordInputValue({type:'integer',enum:[0,1,2]}, '2'), 2);
  assert.equal(recordInputValue({type:'boolean',enum:[true,false]}, 'false'), false);
  assert.equal(recordInputValue({type:'string',enum:['0','1']}, '0'), '0');
  assert.equal(recordInputValue({type:'number'}, '0'), 0);
  assert.equal(recordInputValue({type:'boolean'}, 'on', false), false);
  assert.equal(recordInputValue({type:'number'}, ''), undefined);
});

test('new record defaults are saved as shown without replacing explicit or extension fields', () => {
  const schema={properties:{name:{default:'News'},count:{default:0},enabled:{default:false}}};
  assert.deepEqual(recordDefaults(schema), {name:'News',count:0,enabled:false});
  assert.deepEqual(recordDefaults(schema,{name:'',count:3,extension:'kept'}), {name:'',count:3,enabled:false,extension:'kept'});
  assert.deepEqual(schema.properties.count,{default:0});
});
