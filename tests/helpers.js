'use strict';
const E = require('../assets/js/engine.js');
// Build a tiny test level. rows are drawn bottom-aligned into a 17-row map.
function mkLevel(rows, extra) {
  const w = Math.max.apply(null, rows.map((r) => r.length));
  const map = [];
  for (let i = 0; i < 17 - rows.length; i++) map.push('.'.repeat(w));
  rows.forEach((r) => map.push(r.padEnd(w, '.')));
  return Object.assign({ id: 'test', name: 'Test', theme: 'garden', par: 60, map }, extra || {});
}
// two copies so the test level is not the final level (the final level ends with the reunion)
function world(rows, opts, extra) { const d = mkLevel(rows, extra); return E.createWorld([d, d], 0, { lives: 3 }, opts || {}); }
function run(w, frames, input) { const evs = []; for (let i = 0; i < frames; i++) evs.push.apply(evs, E.step(w, typeof input === 'function' ? input(i, w) : input || {})); return evs; }
function settle(w) { run(w, 10, {}); return w; }
const types = (evs) => evs.map((e) => e.type);
module.exports = { E, mkLevel, world, run, settle, types };
