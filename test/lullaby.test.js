'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRED, sleep } = require('./helper');
const lullaby = require('../afya-lullaby/afya-lullaby.js');

function setup(config) {
  const RED = createRED();
  lullaby(RED);
  return { RED, node: RED.create('afya-lullaby', config) };
}

test('plan', () => {
  const p = lullaby.plan({ dimmingTime: '1200', startValue: '100', stopValue: '0', step: '1' });
  assert.equal(p.direction, 'down');
  assert.equal(p.recallTime, 12000);
  assert.equal(lullaby.plan({ dimmingTime: 60, startValue: 0, stopValue: 100, step: 10 }).direction, 'up');
  assert.match(lullaby.plan({ dimmingTime: 60, startValue: 5, stopValue: 5, step: 1 }).error, /start value = stop value/);
  assert.match(lullaby.plan({ dimmingTime: 60, startValue: 5, stopValue: 0, step: 0 }).error, /step is 0/);
});

test('dims 10 → 0 and publishes the state', async () => {
  const { RED, node } = setup({
    dimmingTime: '0.15', startValue: '10', stopValue: '0', step: '5', variableName: 'night', scope: 'global',
  });
  await node.receive({ topic: 'lamp' });
  assert.equal(node.sent[0].topic, 'lamp');
  assert.equal(RED.context.global.get('night').state, 'counting');

  await sleep(400);
  assert.deepEqual(
    node.sent.map((m) => [m.payload.value, m.payload.state]),
    [[10, 'counting'], [5, 'counting'], [0, 'end']],
  );
  assert.equal(node.sent[0].payload.direction, 'down');
  const state = RED.context.global.get('night');
  assert.equal(state.value, 0);
  assert.equal(state.state, 'end');
});

test('wake-up (up) and stop / kill', async () => {
  const { RED, node } = setup({
    dimmingTime: 60, startValue: 0, stopValue: 100, step: 1, variableName: 'morning', scope: 'flow',
  });
  await node.receive({});
  assert.equal(node.sent[0].payload.direction, 'up');
  await node.receive({}); // already running – ignored
  assert.equal(node.sent.length, 1);

  await node.receive({ payload: 'STOP' });
  assert.equal(RED.context.flow.get('morning').state, 'killed');
  await node.receive({ payload: 'kill' }); // nothing to stop
  assert.equal(node.lastStatus().fill, 'yellow');
});

test('config error → done(err); legacy node without variable works', async () => {
  const bad = setup({ dimmingTime: 10, startValue: 5, stopValue: 5, step: 1 }).node;
  assert.match((await bad.receive({})).error.message, /start value = stop value/);

  const { RED, node } = setup({ dimmingTime: 60, startValue: 100, stopValue: 0, step: 1 });
  assert.equal((await node.receive({})).error, undefined);
  assert.equal(RED.context.global.keys().length + RED.context.flow.keys().length, 0);
  await node.close();
});

test('redeploy (close) stops the timer', async () => {
  const { RED, node } = setup({ dimmingTime: 0.2, startValue: 10, stopValue: 0, step: 1, variableName: 'x', scope: 'global' });
  await node.receive({});
  await node.close();
  const count = node.sent.length;
  await sleep(100);
  assert.equal(node.sent.length, count);
  assert.equal(RED.context.global.get('x').state, 'stopped');
});

test('startFromPayload / runPlan', () => {
  assert.equal(lullaby.startFromPayload(45), 45);
  assert.equal(lullaby.startFromPayload(' 45,6 '), 46);
  assert.equal(lullaby.startFromPayload('stop'), null);
  assert.equal(lullaby.startFromPayload(-5), null);
  assert.equal(lullaby.startFromPayload({ value: 5 }), null);
  assert.equal(lullaby.startFromPayload(true), null);
  assert.equal(lullaby.startFromPayload(''), null);
  assert.equal(lullaby.startFromPayload(Date.now()), 'timestamp');

  const p = lullaby.plan({ dimmingTime: 100, startValue: 100, stopValue: 0, step: 1 }); // 1 s per step
  const fixed = lullaby.runPlan(p, 50, 'fixed');
  assert.deepEqual([fixed.startValue, fixed.dimmingTime, fixed.recallTime, fixed.direction], [50, 100000, 2000, 'down']);
  const rate = lullaby.runPlan(p, 50, 'rate'); // same speed → half the time
  assert.deepEqual([rate.dimmingTime, rate.recallTime], [50000, 1000]);
  assert.equal(lullaby.runPlan(p, 0, 'fixed').empty, true);
  assert.equal(lullaby.runPlan(p, null, 'rate').startValue, 100); // no payload → configured start
  const up = lullaby.runPlan(lullaby.plan({ dimmingTime: 60, startValue: 0, stopValue: 100, step: 10 }), 30, 'rate');
  assert.deepEqual([up.direction, up.dimmingTime], ['up', 42000]);
});

test('start from msg.payload (issue #1): current brightness as the starting point', async () => {
  const { RED, node } = setup({
    dimmingTime: '0.2', startValue: '100', stopValue: '0', step: '10',
    variableName: 'teatr', scope: 'global', startFromPayload: true, timeMode: 'rate',
  });
  await node.receive({ payload: 30, topic: 'lamp' }); // lamp is at 30 → 30, 20, 10, 0 at the configured speed
  assert.equal(node.sent[0].payload.value, 30);
  assert.equal(node.sent[0].topic, 'lamp');
  assert.equal(RED.context.global.get('teatr').startValue, 30);
  await sleep(250);
  assert.deepEqual(node.sent.map((m) => m.payload.value), [30, 20, 10, 0]);
  assert.equal(node.sent.at(-1).payload.state, 'end');
});

test('start from msg.payload: upwards, already at target, timestamp and text keep the configured start', async () => {
  let { node } = setup({ dimmingTime: 60, startValue: 100, stopValue: 0, step: 1, startFromPayload: true });
  await node.receive({ payload: '0' }); // already at the stop value
  assert.deepEqual([node.sent[0].payload.value, node.sent[0].payload.state], [0, 'end']);

  ({ node } = setup({ dimmingTime: 60, startValue: 0, stopValue: 100, step: 1, startFromPayload: true }));
  await node.receive({ payload: 40 }); // wake-up light from 40 %
  assert.deepEqual([node.sent[0].payload.value, node.sent[0].payload.direction], [40, 'up']);
  await node.close();

  ({ node } = setup({ dimmingTime: 60, startValue: 100, stopValue: 0, step: 1, startFromPayload: true }));
  await node.receive({ payload: Date.now() }); // default inject (timestamp)
  assert.equal(node.sent[0].payload.value, 100);
  assert.match(node.warnings[0], /timestamp/);
  await node.close();

  ({ node } = setup({ dimmingTime: 60, startValue: 100, stopValue: 0, step: 1 })); // option off: payload ignored
  await node.receive({ payload: 30 });
  assert.equal(node.sent[0].payload.value, 100);
  await node.close();
});
