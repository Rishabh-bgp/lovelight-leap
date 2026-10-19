/* Bots used by the tests: they record every input frame so a run can be
 * replayed exactly in the browser (the engine is deterministic). */
'use strict';
const E = require('../assets/js/engine.js');
const { solve } = require('./solver.js');

// The boss fighter: keep a 45 degree line to the King and shoot heart arrows up at him,
// shoot straight while he sweeps low, and hop on his head when he comes close.
function bossPolicy(w) {
  const p = w.player, b = w.boss, L = w.level;
  const inp = {};
  const pc = p.x + p.w / 2;
  if (!b.active) { inp.right = true; return inp; }
  const bc = b.x + b.w / 2;
  const dx = bc - pc;
  const toward = dx > 0 ? 1 : -1;
  const low = b.phase === 'sweep' || b.phase === 'dive';
  if (!low) {
    const h = Math.max(30, (p.y + 8) - (b.y + b.h / 2));
    const side = pc < bc ? -1 : 1;
    let target = bc + side * h;
    const minX = L.arena[0] * E.T + 8, maxX = L.arena[1] * E.T - 18;
    if (target < minX || target > maxX) target = bc - side * h;
    const err = target - pc;
    if (Math.abs(err) > 6) { if (err > 0) inp.right = true; else inp.left = true; }
    else if (p.facing !== toward) { if (toward > 0) inp.right = true; else inp.left = true; }
    inp.up = true;
  } else {
    if (p.facing !== toward) { if (toward > 0) inp.right = true; else inp.left = true; }
    if (Math.abs(dx) < 52 && p.onGround) { inp.jumpPressed = true; inp.jump = true; inp[toward > 0 ? 'right' : 'left'] = true; }
    else if (!p.onGround && p.vy < 0) inp.jump = true;
  }
  if (p.shootCd === 0 && (w.frame % 2 === 0)) inp.shootPressed = true;
  return inp;
}

// Play the final level: follow the solver route to the arena, beat the boss, walk to the gate.
function playFinal(levels, opts) {
  opts = opts || {};
  const idx = levels.length - 1;
  const route = solve(levels, idx, { stopAtGoal: true }).route;
  const w = E.createWorld(levels, idx, { lives: 3 }, Object.assign({ seed: 1000 + idx }, opts.worldOpts || {}));
  if (opts.noEnemies) w.level.enemies.length = 0;
  const inputs = [];
  let i = 0, phase = 'route', frames = 0;
  if (opts.fromCheckpoint) { // start at the last heart lantern before the arena
    const cps = w.level.checkpoints.filter((c) => c.x < levels[idx].arena[0] * E.T);
    const c = cps[cps.length - 1];
    c.active = true; w.checkpoint = { x: c.x + 1, y: c.y + c.h - E.PHYS.ph };
    w.player.x = w.checkpoint.x; w.player.y = w.checkpoint.y; E.snapCamera(w);
    phase = 'boss';
  }
  const log = { bossFrames: 0, hurts: 0, deaths: 0 };
  while (frames++ < 60 * 60 * 4) {
    let inp;
    if (w.state === 'dying' || w.state === 'gameover') inp = {};
    else if (phase === 'route') {
      inp = route[i++] || { right: true };
      if (w.boss.active) phase = 'boss';
      if (w.player.x > levels[idx].arena[0] * E.T + 40) phase = 'boss';
    }
    if (phase === 'boss' && w.state === 'play') {
      if (w.boss.cheered) phase = 'walk'; else { inp = bossPolicy(w); log.bossFrames++; }
    }
    if (phase === 'walk' && w.state === 'play') inp = { right: true };
    inp = inp || {};
    inputs.push(inp);
    const ev = E.step(w, inp);
    for (const e of ev) { if (e.type === 'hurt') log.hurts++; if (e.type === 'die') log.deaths++; }
    if (w.state === 'dying' && phase !== 'route') { /* after respawn go back to the arena */ }
    if (w.state === 'play' && phase === 'boss' && !w.boss.active && w.player.x < levels[idx].arena[0] * E.T) phase = 'boss';
    if (w.state === 'ending' || w.state === 'gameover') break;
  }
  return { world: w, inputs, log };
}

module.exports = { bossPolicy, playFinal };

if (require.main === module) {
  const levels = require('../assets/js/levels.js');
  for (const o of [{ noEnemies: true }, { fromCheckpoint: true }]) {
    const r = playFinal(levels, o);
    console.log(JSON.stringify(o), r.world.state, 'boss cheer', r.world.boss.cheer + '/' + r.world.boss.need, 'frames', r.inputs.length, r.log, 'lives', r.world.lives);
  }
}
