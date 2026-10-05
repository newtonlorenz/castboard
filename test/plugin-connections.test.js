import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConnectionSchema, acceptsConnection, validatePluginConnections} from '../src/core/plugin-connections.js';

const data = {id: 'calendar-data', bindings: {}, contract: 'calendar@1', getData() {}};
const view = {id: 'timeline', bindings: {calendar: data.id}, connectionSchema: {calendar: {title: 'Calendar', required: true, contract: 'calendar@1', capabilities: ['data']}}};
const configuration = {plugins: {timeline: {}, 'calendar-data': {}}};

test('a declared shared provider must satisfy its contract and capabilities', () => {
  validatePluginConnections([view, data], configuration);
  assert.equal(acceptsConnection(view.connectionSchema.calendar, data), true);
  assert.equal(acceptsConnection(view.connectionSchema.calendar, {...data, contract: 'weather@1'}), false);
  assert.equal(acceptsConnection({capabilities: ['data', 'action']}, data), false);
  assert.equal(acceptsConnection({capabilities: ['data', 'action']}, {...data, action() {}}), true);
});

test('missing or incompatible connections fail before a configuration is activated', () => {
  assert.throws(() => validatePluginConnections([{...view, bindings: {}}, data], configuration), /requires connection Calendar/);
  assert.throws(() => validatePluginConnections([view], configuration), /requires calendar@1/);
  assert.throws(() => validatePluginConnections([view, {...data, contract: 'weather@1'}], configuration), /requires calendar@1/);
});

test('direct-provider mode does not require the optional shared source', () => {
  const plugin = {...view, bindings: {}, connectionSchema: {calendar: {...view.connectionSchema.calendar, showWhen: {provider: ['shared']}}}};
  validatePluginConnections([plugin], {plugins: {timeline: {provider: 'ics'}}});
  assert.throws(() => validatePluginConnections([plugin], {plugins: {timeline: {provider: 'shared'}}}), /requires connection Calendar/);
});

test('connection cycles fail even when all targets exist', () => {
  const a = {id: 'a', bindings: {input: 'b'}, getData() {}};
  const b = {id: 'b', bindings: {input: 'a'}, getData() {}};
  assert.throws(() => validatePluginConnections([a, b], {plugins: {a: {}, b: {}}}), /cycle/);
});

test('self connections fail and independent copies are accepted', () => {
  assert.throws(() => validatePluginConnections([{id: 'a', bindings: {input: 'a'}}], {plugins: {a: {}}}), /cycle/);
  validatePluginConnections([view, {...view, id: 'second-timeline'}, data], {plugins: {...configuration.plugins, 'second-timeline': {}}});
});

test('malformed connection declarations are rejected', () => {
  for (const schema of [[], {bad: {capabilities: ['filesystem']}}, {bad: {contract: ''}}, {bad: {required: 'yes'}}, {bad: {showWhen: {provider: 'shared'}}}]) assert.throws(() => validateConnectionSchema(schema), /connection|input/);
});


test('manifest defaults activate required inputs when the setting is omitted', () => {
  const plugin = {...view, defaultConfig: {provider: 'shared'}, bindings: {}, connectionSchema: {calendar: {...view.connectionSchema.calendar, showWhen: {provider: ['shared']}}}};
  assert.throws(() => validatePluginConnections([plugin], {plugins: {timeline: {}}}), /requires connection Calendar/);
  validatePluginConnections([plugin], {plugins: {timeline: {provider: 'ics'}}});
});

test('inactive legacy inputs may refer to removed instances without entering the graph', () => {
  const plugin = {...view, defaultConfig: {provider: 'ics'}, bindings: {calendar: 'removed'}, connectionSchema: {calendar: {...view.connectionSchema.calendar, showWhen: {provider: ['shared']}}}};
  validatePluginConnections([plugin], {plugins: {timeline: {}}});
  assert.throws(() => validatePluginConnections([plugin], {plugins: {timeline: {provider: 'shared'}}}), /requires calendar@1/);
  assert.throws(() => validatePluginConnections([{id: 'legacy', bindings: {data: 'removed'}}], {plugins: {legacy: {}}}), /missing or disabled/);
});
