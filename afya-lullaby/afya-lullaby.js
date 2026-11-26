/**
 * AFYA Lullaby – changes a value from X to Y in Z seconds (dimming to sleep / slow wake-up light).
 * (C) 2019–2026 Marcin Chuć · MIT
 */
'use strict';

/** Bigger numbers in msg.payload are taken for timestamps (e.g. a default inject), not for a start value. */
const MAX_START = 1e9;

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

/**
 * Start value from msg.payload: a number or a numeric text ("45", "45,5"), ≥ 0, rounded.
 * null = not a start value (text command, object, negative…), 'timestamp' = looks like a timestamp.
 */
function startFromPayload(payload) {
  if (typeof payload !== 'number' && typeof payload !== 'string') return null;
  const txt = typeof payload === 'string' ? payload.trim().replace(',', '.') : payload;
  if (txt === '') return null;
  const n = Number(txt);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > MAX_START) return 'timestamp';
  return Math.round(n);
}

/**
 * Plan of one run. `start` = start value from msg.payload (or null → configured start).
 * timeMode 'fixed' – always the configured time; 'rate' – same speed as the configured range,
 * so a shorter range takes proportionally less time.
 */
function runPlan(p, start, timeMode) {
  if (start === null || start === undefined || start === p.startValue) return { ...p, from: 'config', empty: false };
  const range = Math.abs(start - p.stopValue);
  const dimmingTime =
    timeMode === 'rate' ? Math.round((p.dimmingTime * range) / Math.abs(p.startValue - p.stopValue)) : p.dimmingTime;
  const down = start > p.stopValue;
  const steps = Math.max(1, Math.round(range / p.step));
  return {
    ...p,
    startValue: start,
    dimmingTime,
    down,
    direction: down ? 'down' : 'up',
    recallTime: Math.max(1, Math.round(dimmingTime / steps)),
    from: 'payload',
    empty: range === 0,
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
    const fromPayload = !!config.startFromPayload;
    const timeMode = config.timeMode === 'rate' ? 'rate' : 'fixed';
    let timer = null;
    let run = null; // { p, value, startTime, stopTime, shape }

    const payload = (r, value, state) => ({
      value,
      timestamp: Date.now(),
      direction: r.direction,
      state,
    });

    const publishState = (r, value, state, startTime = null, stopTime = null) =>
      publish({
        value,
        state,
        direction: r.direction,
        startValue: r.startValue,
        stopValue: r.stopValue,
        startTime,
        stopTime,
        timestamp: Date.now(),
      });

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      run = null;
    }

    function tick() {
      const r = run.p;
      run.value += r.down ? -r.step : r.step;
      run.shape = run.shape === 'dot' ? 'ring' : 'dot';
      const reached = r.down ? run.value <= r.stopValue : run.value >= r.stopValue;
      const late = run.stopTime + r.recallTime < Date.now();

      if (reached || late) {
        node.status({ fill: 'red', shape: 'dot', text: `end · ${r.stopValue} · ${hhmmss()}` });
        publishState(r, r.stopValue, 'end', run.startTime, run.stopTime);
        stop();
        node.send({ payload: payload(r, r.stopValue, 'end') });
        return;
      }
      node.status({
        fill: 'green',
        shape: run.shape,
        text: `${r.startValue} → ${r.stopValue} · now ${run.value} · ${hhmmss()}`,
      });
      publishState(r, run.value, 'counting', run.startTime, run.stopTime);
      node.send({ payload: payload(r, run.value, 'counting') });
    }

    if (p.error) node.status({ fill: 'red', shape: 'ring', text: `config error: ${p.error}` });
    else {
      node.status({
        fill: 'grey',
        shape: 'ring',
        text: `ready · ${fromPayload ? 'msg.payload' : p.startValue} → ${p.stopValue}`,
      });
    }

    node.on('input', (msg, send, done) => {
      const cmd = String(msg.payload).trim().toLowerCase();

      if (cmd === 'kill' || cmd === 'stop') {
        if (timer) {
          const { value, p: r, startTime, stopTime } = run;
          stop();
          publishState(r, value, 'killed', startTime, stopTime);
          node.status({ fill: 'red', shape: 'dot', text: `stopped at ${value} · ${hhmmss()}` });
        } else {
          node.status({ fill: 'yellow', shape: 'dot', text: `not running · ${hhmmss()}` });
        }
        return done();
      }

      if (p.error) return done(new Error(`AFYA lullaby: ${p.error}`));
      if (timer) return done(); // already running – ignore

      let start = fromPayload ? startFromPayload(msg.payload) : null;
      if (start === 'timestamp') {
        node.warn('msg.payload looks like a timestamp – using the configured start value');
        start = null;
      }
      const r = runPlan(p, start, timeMode);
      const now = Date.now();
      const zrodlo = r.from === 'payload' ? ' (from msg.payload)' : '';

      if (r.empty) {
        // already at the stop value – nothing to dim
        node.status({ fill: 'red', shape: 'dot', text: `already at ${r.stopValue}${zrodlo} · ${hhmmss()}` });
        publishState(r, r.stopValue, 'end', now, now);
        msg.payload = payload(r, r.stopValue, 'end');
        send(msg);
        return done();
      }

      run = { p: r, value: r.startValue, startTime: now, stopTime: now + r.dimmingTime, shape: 'ring' };
      node.status({ fill: 'blue', shape: 'ring', text: `start ${r.startValue} → ${r.stopValue}${zrodlo} · ${hhmmss()}` });
      publishState(r, r.startValue, 'counting', run.startTime, run.stopTime);
      timer = setInterval(tick, r.recallTime);
      msg.payload = payload(r, r.startValue, 'counting');
      send(msg);
      done();
    });

    node.on('close', (removed, done) => {
      if (timer) {
        const { value, p: r, startTime, stopTime } = run;
        stop();
        publishState(r, value, 'stopped', startTime, stopTime);
      }
      done();
    });
  }

  RED.nodes.registerType('afya-lullaby', AFYALullaby);
};

module.exports.plan = plan;
module.exports.runPlan = runPlan;
module.exports.startFromPayload = startFromPayload;
