'use strict';
/**
 * Minimal Node-RED runtime mock – enough to run AFYA nodes in `node --test`
 * without installing Node-RED. Context: flow/global with optional store name.
 */

function contextStore() {
  const data = new Map();
  const id = (key, store) => `${store || 'default'}::${key}`;
  return {
    get: (key, store) => data.get(id(key, store)),
    set: (key, value, store) => (value === undefined ? data.delete(id(key, store)) : data.set(id(key, store), value)),
    keys: () => [...data.keys()],
  };
}

function createRED({ settings = {} } = {}) {
  const types = {};
  const context = { flow: contextStore(), global: contextStore() };
  const RED = {
    settings,
    context,
    util: {
      parseContextStore(key) {
        const m = /^#:\((\S+?)\)::(.*)$/.exec(key);
        return m ? { store: m[1], key: m[2] } : { key };
      },
      cloneMessage: (v) => (v === undefined ? v : structuredClone(v)),
    },
    nodes: {
      createNode(node, config) {
        node.id = config.id;
        node.handlers = {};
        node.statuses = [];
        node.warnings = [];
        node.errors = [];
        node.sent = [];
        node.on = (event, fn) => (node.handlers[event] = fn);
        node.status = (s) => node.statuses.push(s);
        node.warn = (w) => node.warnings.push(w);
        node.error = (e) => node.errors.push(e);
        node.send = (msg) => node.sent.push(msg);
        node.context = () => context;
      },
      registerType(type, ctor) {
        types[type] = ctor;
      },
    },
  };

  /** Creates a node of `type` with the given config. */
  RED.create = (type, config = {}) => {
    const Ctor = types[type];
    if (!Ctor) throw new Error(`type ${type} not registered`);
    const node = new Ctor({ id: 'n1', ...config });
    /** Sends a message; resolves with { error } when the node calls done(). */
    node.receive = (msg = {}) =>
      new Promise((resolve) => {
        node.handlers.input(msg, (out) => node.sent.push(out), (error) => resolve({ error }));
      });
    node.close = (removed = false) =>
      new Promise((resolve) => {
        const fn = node.handlers.close;
        if (!fn) return resolve();
        if (fn.length >= 2) fn(removed, resolve);
        else if (fn.length === 1) fn(resolve);
        else resolve(fn());
      });
    node.lastStatus = () => node.statuses.at(-1);
    return node;
  };
  return RED;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { createRED, sleep };
