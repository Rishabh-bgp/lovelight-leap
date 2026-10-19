/* Reachability solver used by the tests.
 * It searches over short input "moves" (walk, short hop, full jump, drift...)
 * using the REAL engine physics, so if it finds a route the level is beatable.
 * Thorns, enemies' damage and falling count as failures.
 */
'use strict';
const E = require('../assets/js/engine.js');

function makeMoves() {
  const moves = [];
  for (const dir of [-1, 0, 1]) {
    if (dir) moves.push({ name: 'walk' + dir, dir, jump: 0, frames: 8 });
    for (const hold of [2, 7, 12, 30]) {
      moves.push({ name: `jump${dir}/${hold}`, dir, jump: hold, frames: 0 });
      if (dir) moves.push({ name: `jump${dir}/${hold}/stop`, dir, jump: hold, frames: 0, stopAt: 14 });
      if (dir) moves.push({ name: `jump${dir}/${hold}/late`, dir, jump: hold, frames: 0, startAt: 10 });
    }
  }
  return moves;
}
const MOVES = makeMoves();

function inputFor(m, f) {
  let d = m.dir;
  if (m.stopAt != null && f >= m.stopAt) d = 0;
  if (m.startAt != null && f < m.startAt) d = 0;
  return {
    left: d < 0, right: d > 0,
    jump: m.jump > 0 && f < m.jump, jumpPressed: m.jump > 0 && f === 0
  };
}

function baseWorld(levels, index) {
  const w = E.createWorld(levels, index, { lives: 9 }, { noEnemies: true });
  w.boss = null; w.gateOpen = true; w.arenaLocked = false;
  return w;
}

function cloneWorld(w, p) {
  return Object.assign({}, w, {
    player: Object.assign({}, p), camera: Object.assign({}, w.camera), events: [], arrows: [], drops: [],
    springs: {}, state: 'play', letters: [false, false, false], level: w.solverLevel
  });
}

// Simulate one move; returns { end, frames, inputs, letters:Set, goal, dead }
function simulate(w0, p0, m, letterRects) {
  const w = cloneWorld(w0, p0);
  const inputs = [];
  const letters = new Set();
  const maxF = 160;
  let left = false;
  for (let f = 0; f < maxF; f++) {
    const inp = inputFor(m, f);
    inputs.push(inp);
    const ev = E.step(w, inp);
    const p = w.player;
    for (const L of letterRects) if (E.overlap(p, L)) letters.add(L.idx);
    if (ev.some((e) => e.type === 'hurt' || e.type === 'die') || w.state === 'dying') return { dead: true };
    if (w.state === 'complete' || w.state === 'ending') return { goal: true, inputs, letters, frames: f + 1 };
    if (!p.onGround) left = true;
    const minF = m.jump ? 2 : m.frames;
    if (f + 1 >= minF && p.onGround && (left || !m.jump) && (m.jump || f + 1 >= m.frames)) {
      return { end: p, inputs, letters, frames: f + 1 };
    }
  }
  return { dead: true };
}

function key(p) { return Math.round(p.x / 3) + ',' + Math.round(p.y / 2) + ',' + Math.round(p.vx * 2); }

function solve(levels, index, opts) {
  opts = opts || {};
  const w0 = baseWorld(levels, index);
  const lvl = w0.level;
  w0.solverLevel = Object.assign({}, lvl, { items: [], checkpoints: [], enemies: [] });
  const letterRects = lvl.items.filter((i) => i.type === 'letter');
  // settle the start state onto the ground
  const w = cloneWorld(w0, w0.player);
  for (let i = 0; i < 5; i++) E.step(w, {});
  const start = Object.assign({}, w.player);
  const nodes = [{ p: start, parent: -1, inputs: [], key: key(start) }];
  const seen = new Map([[nodes[0].key, 0]]);
  const succ = [[]];
  const letterEdges = [];
  let goalNode = -1, goalInputs = null;
  const goalNodes = new Set();
  const limit = opts.limit || 120000;
  for (let qi = 0; qi < nodes.length && nodes.length < limit; qi++) {
    const n = nodes[qi];
    for (const m of MOVES) {
      const r = simulate(w0, n.p, m, letterRects);
      if (r.dead) continue;
      if (r.goal) {
        goalNodes.add(qi);
        r.letters.forEach((idx) => letterEdges.push({ from: qi, to: -1, idx }));
        if (goalNode < 0) { goalNode = qi; goalInputs = r.inputs; }
        continue;
      }
      const k = key(r.end);
      let j = seen.get(k);
      if (j == null) {
        j = nodes.length;
        nodes.push({ p: Object.assign({}, r.end), parent: qi, inputs: r.inputs, key: k });
        seen.set(k, j); succ.push([]);
      }
      succ[qi].push(j);
      r.letters.forEach((idx) => letterEdges.push({ from: qi, to: j, idx }));
    }
    if (goalNode >= 0 && opts.stopAtGoal) break;
  }
  // which states can still reach the goal?
  const pred = nodes.map(() => []);
  succ.forEach((list, i) => list.forEach((j) => pred[j].push(i)));
  const canFinish = new Set(goalNodes);
  const stack = Array.from(goalNodes);
  while (stack.length) { const j = stack.pop(); for (const i of pred[j]) if (!canFinish.has(i)) { canFinish.add(i); stack.push(i); } }
  const lettersOk = [false, false, false];
  for (const e of letterEdges) if (e.to === -1 || canFinish.has(e.to)) lettersOk[e.idx] = true;
  // route to the goal
  let route = null;
  if (goalNode >= 0) {
    const chain = [];
    for (let i = goalNode; i > 0; i = nodes[i].parent) chain.push(nodes[i].inputs);
    route = [];
    for (let i = 0; i < 5; i++) route.push({});
    chain.reverse().forEach((c) => route.push.apply(route, c));
    route.push.apply(route, goalInputs);
  }
  return { reachable: goalNode >= 0, lettersOk, states: nodes.length, route };
}

module.exports = { solve, MOVES };

if (require.main === module) {
  const levels = require('../assets/js/levels.js');
  const t0 = Date.now();
  levels.forEach((def, i) => {
    const r = solve(levels, i);
    console.log(def.id, 'goal:', r.reachable, 'letters:', r.lettersOk.join(','), 'states:', r.states, 'route frames:', r.route && r.route.length, (Date.now() - t0) + 'ms');
  });
}
