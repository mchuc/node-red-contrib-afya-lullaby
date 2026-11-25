/**
 * AFYA Lullaby – changes a value from X to Y in Z seconds (dimming to sleep / slow wake-up light).
 * (C) 2019–2026 Marcin Chuć · MIT
 */
'use strict';

function hhmmss(d = new Date()) {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Validated plan of the dimming, or { error }. */
function plan(config) {
  const dimmingTime = Math.abs(Number(config.dimmingTime)) * 1000;
  const startValue = Math.round(Math.abs(Number(config.startValue)));
  const stopValue = Math.round(Math.abs(Number(config.stopValue)));
  const step = Math.round(Math.abs(Number(config.step)));
  if (![dimmingTime, startValue, stopValue, step].every(Number.isFinite)) return { error: 'numbers expected' };
  if (step === 0) return { error: 'step is 0' };
  if (startValue === stopValue) return { error: 'start value = stop value' };
  if (dimmingTime === 0) return { error: 'time is 0' };
  const down = startValue > stopValue;
  const steps = Math.max(1, Math.round(Math.abs(startValue - stopValue) / step));
  return {
    dimmingTime,
    startValue,
    stopValue,
    step,
    down,
    direction: down ? 'down' : 'up',
    recallTime: Math.max(1, Math.round(dimmingTime / steps)),
  };
}

module.exports = function (RED) {
  function AFYALullaby(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // the variable is optional for nodes created before 0.1.0
    const scope = config.scope === 'flow' ? 'flow' : 'global';
    const name = String(config.variableName || '').trim();
    const { key, store } = RED.util.parseContextStore(name);
    const publish = (state) => {
      if (key) node.context()[scope].set(key, state, store);
    };

    const p = plan(config);
    let timer = null;
    let run = null; // { value, startTime, stopTime, shape }

    const payload = (value, state) => ({
      value,
      timestamp: Date.now(),
      direction: p.direction,
      state,
    });

    const publishState = (value, state) =>
      publish({
        value,
        state,
        direction: p.direction,
        startValue: p.startValue,
        stopValue: p.stopValue,
        startTime: run ? run.startTime : null,
        stopTime: run ? run.stopTime : null,
        timestamp: Date.now(),
      });

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      run = null;
    }

    function tick() {
      run.value += p.down ? -p.step : p.step;
      run.shape = run.shape === 'dot' ? 'ring' : 'dot';
      const reached = p.down ? run.value <= p.stopValue : run.value >= p.stopValue;
      const late = run.stopTime + p.recallTime < Date.now();

      if (reached || late) {
        node.status({ fill: 'red', shape: 'dot', text: `end · ${p.stopValue} · ${hhmmss()}` });
        publishState(p.stopValue, 'end');
        stop();
        node.send({ payload: payload(p.stopValue, 'end') });
        return;
      }
      node.status({
        fill: 'green',
        shape: run.shape,
        text: `${p.startValue} → ${p.stopValue} · now ${run.value} · ${hhmmss()}`,
      });
      publishState(run.value, 'counting');
      node.send({ payload: payload(run.value, 'counting') });
    }

    if (p.error) node.status({ fill: 'red', shape: 'ring', text: `config error: ${p.error}` });
    else node.status({ fill: 'grey', shape: 'ring', text: `ready · ${p.startValue} → ${p.stopValue}` });

    node.on('input', (msg, send, done) => {
      const cmd = String(msg.payload).trim().toLowerCase();

      if (cmd === 'kill' || cmd === 'stop') {
        if (timer) {
          const value = run.value;
          stop();
          publishState(value, 'killed');
          node.status({ fill: 'red', shape: 'dot', text: `stopped at ${value} · ${hhmmss()}` });
        } else {
          node.status({ fill: 'yellow', shape: 'dot', text: `not running · ${hhmmss()}` });
        }
        return done();
      }

      if (p.error) return done(new Error(`AFYA lullaby: ${p.error}`));
      if (timer) return done(); // already running – ignore

      const now = Date.now();
      run = { value: p.startValue, startTime: now, stopTime: now + p.dimmingTime, shape: 'ring' };
      node.status({ fill: 'blue', shape: 'ring', text: `start ${p.startValue} → ${p.stopValue} · ${hhmmss()}` });
      publishState(p.startValue, 'counting');
      timer = setInterval(tick, p.recallTime);
      msg.payload = payload(p.startValue, 'counting');
      send(msg);
      done();
    });

    node.on('close', (removed, done) => {
      if (timer) {
        const value = run.value;
        stop();
        publishState(value, 'stopped');
      }
      done();
    });
  }

  RED.nodes.registerType('afya-lullaby', AFYALullaby);
};

module.exports.plan = plan;
