'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { E, world, run, settle, types } = require('./helpers.js');
const { PHYS, T } = E;

const FLAT = ['.P......................................G.', '##########################################', '##########################################'];

test('standing on flat ground keeps her grounded and still', () => {
  const w = settle(world(FLAT));
  const y = w.player.y;
  run(w, 60, {});
  assert.equal(w.player.onGround, true);
  assert.equal(w.player.y, y);
  assert.equal(w.player.y + w.player.h, 15 * T);
});

test('running accelerates smoothly up to the top speed and friction stops her', () => {
  const w = settle(world(FLAT));
  const speeds = [];
  run(w, 40, (i) => { speeds.push(w.player.vx); return { right: true }; });
  assert.ok(speeds[3] > 0 && speeds[3] < PHYS.runMax, 'accelerates gradually');
  assert.equal(w.player.vx, PHYS.runMax);
  run(w, 30, {});
  assert.equal(w.player.vx, 0);
});

test('turning around is snappier than starting from rest', () => {
  const a = settle(world(FLAT)); run(a, 30, { right: true }); run(a, 3, { left: true });
  const b = settle(world(FLAT)); run(b, 3, { left: true });
  assert.ok(a.player.vx < PHYS.runMax - 3 * PHYS.accel);
  assert.ok(Math.abs(a.player.vx - PHYS.runMax) > Math.abs(b.player.vx), 'reversal changes speed faster');
});

test('variable jump height: holding jump goes higher than a tap', () => {
  const peak = (hold) => {
    const w = settle(world(FLAT)); const y0 = w.player.y; let minY = y0;
    for (let i = 0; i < 90; i++) { E.step(w, { jump: i < hold, jumpPressed: i === 0 }); minY = Math.min(minY, w.player.y); }
    return y0 - minY;
  };
  const full = peak(60), tap = peak(1);
  assert.ok(full > 55 && full < 66, 'full jump about 3.5-4 tiles, got ' + full);
  assert.ok(tap < 30, 'a tap is a short hop, got ' + tap);
  assert.ok(peak(8) > tap && peak(8) < full);
});

test('coyote time lets her jump a few frames after running off a ledge', () => {
  const LEDGE = ['.P........', '#####.....', '#####.....'];
  const tryJump = (delay) => {
    const w = settle(world(LEDGE));
    let left = -1, jumped = false;
    for (let i = 0; i < 80; i++) {
      const inp = { right: true };
      if (left < 0 && !w.player.onGround) left = i;
      if (left >= 0 && i === left + delay) { inp.jumpPressed = true; inp.jump = true; }
      if (types(E.step(w, inp)).includes('jump')) jumped = true;
    }
    return jumped;
  };
  assert.equal(tryJump(2), true, 'jump 2 frames after the ledge still works');
  assert.equal(tryJump(PHYS.coyote - 2), true);
  assert.equal(tryJump(PHYS.coyote + 4), false, 'too late');
});

test('jump buffering: pressing jump just before landing still jumps', () => {
  const tryBuffer = (early) => {
    const w = settle(world(FLAT));
    E.step(w, { jump: true, jumpPressed: true });
    let landFrame = -1; const log = [];
    for (let i = 0; i < 80; i++) { const ev = E.step(w, {}); log.push(Object.assign({}, w.player)); if (w.player.onGround && landFrame < 0) landFrame = i; }
    // replay the same jump, pressing jump `early` frames before landing
    const w2 = settle(world(FLAT));
    E.step(w2, { jump: true, jumpPressed: true });
    let jumps = 0;
    for (let i = 0; i < 80; i++) { const press = i === landFrame - early; if (types(E.step(w2, { jumpPressed: press, jump: press })).includes('jump')) jumps++; }
    return jumps;
  };
  assert.equal(tryBuffer(4), 1, 'buffered jump fires on landing');
  assert.equal(tryBuffer(PHYS.buffer + 6), 0, 'too early is ignored');
});

test('walls stop her and ceilings bump her head', () => {
  const WALL = ['.P....#....', '......#....', '###########'];
  const w = settle(world(WALL));
  run(w, 80, { right: true });
  assert.equal(w.player.x + w.player.w, 6 * T);
  const CEIL = ['###', '...', '...', '.P.', '###'];
  const c = settle(world(CEIL));
  const evs = run(c, 30, (i) => ({ jump: true, jumpPressed: i === 0 }));
  assert.ok(types(evs).includes('bump'));
  assert.ok(c.player.y >= 14 * T - 0.01 - 2 * T, 'head stopped by the ceiling');
});

test('one-way ledges: jump up through, land on top, drop down with down + jump', () => {
  const OW = ['..====....', '..........', '.P........', '##########'];
  const w = settle(world(OW));
  run(w, 4, { right: true });
  let landedOnLedge = false;
  for (let i = 0; i < 80; i++) { E.step(w, { jump: true, jumpPressed: i === 0 }); if (w.player.onGround && w.player.y + w.player.h === 13 * T) landedOnLedge = true; }
  assert.equal(landedOnLedge, true, 'passed through from below and landed on top');
  run(w, 2, { down: true, jump: true, jumpPressed: true });
  run(w, 40, {});
  assert.equal(w.player.y + w.player.h, 16 * T, 'dropped back to the floor');
});

test('love-springs launch her much higher than a normal jump', () => {
  const SP = ['.P.J......', '##########'];
  const w = settle(world(SP));
  let minY = w.player.y, sprang = false;
  for (let i = 0; i < 150; i++) { if (types(E.step(w, { right: i < 30, jump: i < 10, jumpPressed: i === 0 })).includes('spring')) sprang = true; minY = Math.min(minY, w.player.y); }
  assert.equal(sprang, true);
  assert.ok(16 * T - 24 - minY > 100, 'spring height ' + (16 * T - 24 - minY));
});

test('thorns hurt, with a short invulnerability window', () => {
  const TH = ['.P..^^^^^^^^^^^^', '################'];
  const w = settle(world(TH));
  const evs = run(w, 60, { right: true });
  assert.equal(types(evs).filter((t) => t === 'hurt').length, 1);
  assert.equal(w.player.hp, PHYS.hp - 1);
  assert.ok(w.player.invuln > 0);
});

test('falling into a pit costs a life and respawns her at the last lantern', () => {
  const PIT = ['.P....C.......', '#########.....', '#########.....'];
  let died = false;
  const all = [];
  const w1 = settle(world(PIT));
  for (let i = 0; i < 400; i++) { const ev = E.step(w1, { right: !died }); all.push.apply(all, ev); if (types(ev).includes('die')) died = true; }
  assert.ok(types(all).includes('checkpoint'));
  const evs2 = all;
  assert.ok(types(evs2).includes('die'));
  assert.ok(types(evs2).includes('respawn'));
  assert.equal(w1.lives, 2);
  assert.equal(w1.player.hp, PHYS.hp);
  assert.equal(w1.player.x, w1.level.checkpoints[0].x + 1, 'back at the lantern');
});

test('losing every life ends the game', () => {
  const PIT = ['.P............', '###...........', '###...........'];
  const w = E.createWorld([require('./helpers.js').mkLevel(PIT)], 0, { lives: 1 }, {});
  const evs = run(w, 300, { right: true });
  assert.ok(types(evs).includes('gameover'));
  assert.equal(w.state, 'gameover');
  assert.equal(w.lives, 0);
});

test('stomping a bramble cheers it up and bounces her', () => {
  const ST = ['...........', '...........', '.P.....b...', '###########'];
  const w = settle(world(ST));
  const before = w.score;
  let cheer = null, vyAfter = 0;
  for (let i = 0; i < 120 && !cheer; i++) {
    const ev = E.step(w, { right: i < 12, jump: i >= 10 && i < 30, jumpPressed: i === 10 });
    const c = ev.find((e) => e.type === 'cheer'); if (c) { cheer = c; vyAfter = w.player.vy; }
  }
  assert.ok(cheer, 'enemy was stomped');
  assert.equal(cheer.how, 'stomp');
  assert.ok(vyAfter < -4, 'bounced up');
  assert.equal(w.player.hp, PHYS.hp, 'no damage from a stomp');
  assert.ok(w.score >= before + E.SCORE.stomp);
  assert.equal(w.level.enemies[0].alive, false);
});

test('touching a creature from the side hurts, and three hits cost a life', () => {
  const w = settle(world(['.P.......b....', '##############']));
  const e = w.level.enemies[0];
  w.camera.x = 0;
  const all = [];
  for (let hit = 0; hit < 3; hit++) {
    w.player.invuln = 0; w.player.vy = 0;
    w.player.x = e.x - w.player.w + 2; w.player.y = e.y + e.h - w.player.h;
    all.push.apply(all, E.step(w, {}));
    if (hit === 0) { assert.equal(w.player.hp, PHYS.hp - 1); all.push.apply(all, E.step(w, {})); assert.equal(w.player.hp, PHYS.hp - 1, 'invulnerable right after a hit'); }
  }
  assert.equal(types(all).filter((t) => t === 'hurt').length, 3);
  assert.ok(types(all).includes('die'));
  assert.equal(w.lives, 2);
});

test('brambles turn around at walls and ledges', () => {
  const B = ['.P....b.....', '...######...', '############'];
  const w = settle(world(B, { god: true }));
  w.camera.x = 0;
  const e = w.level.enemies[0];
  const xs = [];
  for (let i = 0; i < 400; i++) { E.step(w, {}); xs.push(e.x); }
  assert.ok(Math.min.apply(null, xs) >= 3 * T - 1 && Math.max.apply(null, xs) <= 9 * T + 1, 'stays on its platform');
  assert.ok(new Set(xs.map((x) => Math.sign(x - 6 * T))).size >= 2);
});

test('stomp combos double the points', () => {
  const w = settle(world(['.P...b.b.b..', '############']));
  const e = w.level.enemies;
  w.stompCombo = 0;
  E.cheerUp(w, e[0], 'stomp'); E.cheerUp(w, e[1], 'stomp'); E.cheerUp(w, e[2], 'stomp');
  assert.equal(w.score, 100 + 200 + 400);
});

test('grumpy clouds rain on her and raindrops hurt', () => {
  const R = ['....c.....', '..........', '..........', '..........', '..........', '.P........', '##########'];
  const w = settle(world(R));
  const c = w.level.enemies[0];
  const evs = run(w, 400, () => { w.player.x = c.x + c.w / 2 - w.player.w / 2; return {}; }); // stay right under the cloud
  assert.ok(types(evs).includes('rain'));
  assert.ok(types(evs).includes('hurt'));
});

test('hearts add to the count and score, 100 hearts give an extra life', () => {
  const H = ['.Pooooo....', '###########'];
  const w = settle(world(H));
  w.hearts = 97;
  const evs = run(w, 60, { right: true });
  assert.equal(types(evs).filter((t) => t === 'heart').length, 5);
  assert.equal(w.levelHearts, 5);
  assert.ok(types(evs).includes('oneup'));
  assert.equal(w.lives, 4);
  assert.equal(w.score, 50);
});

test('love letters are tracked by index', () => {
  const Lw = ['.P.L.L.L...', '###########'];
  const w = settle(world(Lw));
  run(w, 30, { right: true });
  assert.deepEqual(w.letters, [true, true, false]);
  run(w, 30, { right: true });
  assert.deepEqual(w.letters, [true, true, true]);
  assert.equal(w.score, 1500);
});

test("Cupid's Bow: no arrows without it, then heart arrows cheer creatures up", () => {
  const BW = ['.Pw.......b.....', '################'];
  const w = settle(world(BW));
  run(w, 3, { shootPressed: true });
  assert.equal(w.arrows.length, 0, 'cannot shoot without the bow');
  run(w, 12, { right: true });
  assert.equal(w.player.bow, true);
  const evs = run(w, 120, (i) => ({ shootPressed: i % 20 === 0 }));
  assert.ok(types(evs).includes('shoot'));
  const c = evs.find((e) => e.type === 'cheer');
  assert.ok(c && c.how === 'arrow');
});

test('arrows respect the cooldown and the 3-arrow limit, and can aim up', () => {
  const w = settle(world(['.P.........................................', '###########################################']));
  w.player.bow = true;
  let shots = 0;
  for (let i = 0; i < 10; i++) shots += types(E.step(w, { shootPressed: true })).filter((t) => t === 'shoot').length;
  assert.equal(shots, 1, 'cooldown');
  for (let i = 0; i < 60; i++) E.step(w, { shootPressed: true });
  assert.ok(w.arrows.length <= PHYS.maxArrows);
  const w2 = settle(world(['.P...........', '#############']));
  w2.player.bow = true;
  E.step(w2, { up: true, shootPressed: true });
  assert.ok(w2.arrows[0].vy < 0 && w2.arrows[0].vx > 0, 'diagonal shot');
});

test('Sparkle Shield: no damage, creatures are cheered on touch, and it wears off', () => {
  const SH = ['.Ps..b..^^^.b..........', '#######################'];
  const w = settle(world(SH));
  const evs = run(w, 120, { right: true });
  assert.ok(types(evs).includes('powerup'));
  assert.equal(types(evs).includes('hurt'), false);
  assert.ok(evs.filter((e) => e.type === 'cheer' && e.how === 'shield').length >= 1);
  run(w, PHYS.shieldTime, {});
  assert.equal(w.player.shield, 0);
});

test('power-ups come back after a respawn so a retry is always possible', () => {
  const w = settle(world(['.Pw...........', '######........']));
  run(w, 20, { right: true });
  assert.equal(w.player.bow, true);
  let died = false;
  for (let i = 0; i < 300; i++) { if (types(E.step(w, { right: !died })).includes('die')) died = true; }
  assert.equal(w.player.bow, false, 'lost on death');
  assert.equal(w.level.items.find((i) => i.type === 'bow').taken, false, 'back on the map');
});

test('reaching the heart gate completes the level with stars and a time bonus', () => {
  const G = ['.P.L.L.L.......G...', '###################'];
  const w = settle(world(G));
  const evs = run(w, 200, { right: true });
  const done = evs.find((e) => e.type === 'complete');
  assert.ok(done);
  assert.equal(w.state, 'complete');
  assert.equal(done.result.stars, 3);
  assert.ok(done.result.timeBonus > 0);
  assert.equal(done.result.score, w.score);
  // slow and no letters: one star
  const w2 = settle(world(['.P.............G...', '###################']));
  w2.time = 61 * 60;
  const ev2 = run(w2, 200, { right: true }).find((e) => e.type === 'complete');
  assert.equal(ev2.result.stars, 1);
  assert.equal(ev2.result.timeBonus, 0);
});

function bossWorld() {
  const row = (s) => s.padEnd(40, '.');
  const map = [];
  for (let i = 0; i < 4; i++) map.push(row(''));
  map.push(row('...............K'));
  for (let i = 0; i < 9; i++) map.push(row(''));
  map.push(row('.P..........................G.H'));
  map.push('#'.repeat(40)); map.push('#'.repeat(40));
  return E.createWorld([{ id: 'boss', name: 'Boss', theme: 'castle', par: 60, arena: [2, 32], map }], 0, { lives: 3 }, {});
}

test('boss: arena locks, gate stays shut until the King is cheered up', () => {
  const w = settle(bossWorld());
  assert.equal(w.gateOpen, false);
  run(w, 30, { right: true });
  assert.equal(w.boss.active, true);
  assert.equal(w.arenaLocked, true);
  w.player.x = w.level.goal.x + 10; w.opts.god = true;
  const evs = run(w, 2, {});
  assert.ok(types(evs).includes('gateLocked'));
  assert.equal(w.state, 'play');
});

test('boss: heart arrows and stomps fill the mood bar, then the gate opens and the ending starts', () => {
  const w = settle(bossWorld());
  run(w, 30, { right: true });
  const b = w.boss;
  E.bossHit(w, 1); assert.equal(b.cheer, 1);
  // a real arrow hit
  w.player.bow = true; w.player.x = b.x - 40; w.player.y = b.y + 6; w.player.facing = 1; w.player.shootCd = 0;
  const before = b.cheer;
  const evs = run(w, 20, (i) => ({ shootPressed: i === 0 }));
  assert.ok(types(evs).includes('bossHit'));
  assert.ok(b.cheer > before);
  while (!b.cheered) E.bossHit(w, 2);
  assert.equal(w.gateOpen, true);
  assert.equal(w.arenaLocked, false);
  w.opts.god = true;
  w.player.x = w.level.goal.x + 10; w.player.y = w.level.goal.y + 20;
  const ev2 = run(w, 3, {});
  assert.ok(types(ev2).includes('ending'));
  assert.equal(w.state, 'ending');
});

test('camera stays inside the level and the engine is deterministic', () => {
  const levels = require('../assets/js/levels.js');
  const a = E.createWorld(levels, 0, {}, {}), b = E.createWorld(levels, 0, {}, {});
  const script = (i) => ({ right: i % 90 < 70, jump: i % 50 < 12, jumpPressed: i % 50 === 0, shootPressed: i % 30 === 0 });
  for (let i = 0; i < 1200; i++) { E.step(a, script(i)); E.step(b, script(i)); assert.ok(a.camera.x >= 0 && a.camera.x <= a.level.w * T - E.VIEW_W); }
  assert.deepEqual(
    [a.player.x, a.player.y, a.score, a.hearts, a.lives, a.state],
    [b.player.x, b.player.y, b.score, b.hearts, b.lives, b.state]
  );
});

test('save data: defaults, sanitising bad data, merging results and unlocking worlds', () => {
  const d = E.defaultSave();
  assert.equal(d.unlocked, 1);
  assert.deepEqual(E.parseSave('not json'), d);
  assert.deepEqual(E.parseSave(null), d);
  assert.deepEqual(E.parseSave('{"v":2}'), d);
  const bad = E.parseSave(JSON.stringify({ v: 1, unlocked: -5, highScore: 'lots', levels: { x: { stars: 99, letters: 'no', bestScore: -1 } }, settings: { sound: 'yes', music: false } }));
  assert.equal(bad.unlocked, 1); assert.equal(bad.highScore, 0);
  assert.equal(bad.levels.x.stars, 3); assert.deepEqual(bad.levels.x.letters, [false, false, false]); assert.equal(bad.levels.x.bestScore, 0);
  assert.equal(bad.settings.sound, true); assert.equal(bad.settings.music, false);

  let s = E.applyResult(d, { level: 0, id: 'a', stars: 2, seconds: 80, letters: [true, false, false], score: 1200 }, 4);
  assert.equal(s.unlocked, 2); assert.equal(s.levels.a.stars, 2);
  s = E.applyResult(s, { level: 0, id: 'a', stars: 1, seconds: 60, letters: [false, true, false], score: 900 }, 4);
  assert.equal(s.levels.a.stars, 2, 'keeps best stars');
  assert.equal(s.levels.a.bestScore, 1200);
  assert.equal(s.levels.a.bestTime, 60, 'keeps fastest time');
  assert.deepEqual(s.levels.a.letters, [true, true, false], 'letters found across runs add up');
  assert.equal(s.highScore, 1200);
  assert.equal(d.unlocked, 1, 'the original save object is not mutated');
  s = E.applyResult(s, { level: 3, id: 'd', stars: 3, seconds: 100, letters: [true, true, true], score: 50000 }, 4);
  assert.equal(s.finished, true); assert.equal(s.unlocked, 4);
  assert.equal(E.totalStars(s), 5);
  assert.deepEqual(E.parseSave(JSON.stringify(s)), s, 'round trip');
  assert.equal(E.recordScore(s, 99999).highScore, 99999);
  assert.equal(E.formatTime(75), '1:15');
});
