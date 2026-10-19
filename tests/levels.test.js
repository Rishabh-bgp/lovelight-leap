'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../assets/js/engine.js');
const LEVELS = require('../assets/js/levels.js');
const { solve } = require('./solver.js');
const { playFinal } = require('./bots.js');

test('there are 4 worlds with distinct themes, and every map is valid', () => {
  assert.equal(LEVELS.length, 4);
  assert.equal(new Set(LEVELS.map((l) => l.theme)).size, 4);
  LEVELS.forEach((def, i) => {
    assert.deepEqual(E.validateLevel(def, i === LEVELS.length - 1), [], def.id);
    assert.equal(new Set(def.map.map((r) => r.length)).size, 1, def.id + ' rows are the same width');
    assert.ok(def.map[0].length >= 160, def.id + ' is a proper length');
    const L = E.parseLevel(def);
    assert.equal(L.letters, 3);
    assert.ok(L.heartsTotal >= 40, def.id + ' has plenty of hearts');
    assert.ok(L.checkpoints.length >= 1, def.id + ' has a checkpoint');
    assert.ok(L.enemies.length >= 5, def.id + ' has creatures');
    assert.ok(L.items.some((it) => it.power), def.id + ' has a power-up');
  });
  const fin = E.parseLevel(LEVELS[3]);
  assert.ok(fin.bossSpawn && fin.sweetheart && fin.arena);
  assert.equal(fin.arena[1] - fin.arena[0], E.VIEW_W / E.T, 'the boss arena is exactly one screen wide');
});

const solved = LEVELS.map((def, i) => ({ def, i }));
for (const { def, i } of solved) {
  test(`world ${i + 1} (${def.name}) can be finished and all 3 love letters can be collected`, () => {
    const r = solve(LEVELS, i);
    assert.equal(r.reachable, true, 'the heart gate is reachable');
    assert.deepEqual(r.lettersOk, [true, true, true], 'each letter is reachable and the gate is still reachable afterwards');
    // replay the route the solver found in a fresh world: it must finish the level
    const w = E.createWorld(LEVELS, i, { lives: 3 }, { noEnemies: true });
    if (w.boss) { w.boss = null; w.gateOpen = true; }
    for (const inp of r.route) { E.step(w, inp); if (w.state !== 'play') break; }
    assert.ok(w.state === 'complete' || w.state === 'ending', 'replayed route finishes, state ' + w.state);
    assert.ok(w.result.seconds <= def.par, 'the par time is achievable (' + w.result.seconds + 's of ' + def.par + 's)');
  });
}

test('final world: a bot beats King Grumblecloud with real enemies and no cheats, then the reunion starts', () => {
  const r = playFinal(LEVELS, { fromCheckpoint: true });
  assert.equal(r.world.boss.cheered, true);
  assert.equal(r.world.state, 'ending');
  assert.ok(r.world.lives >= 1);
});

test('final world: a full scripted run from the start to the reunion', () => {
  const r = playFinal(LEVELS, { noEnemies: true });
  assert.equal(r.world.state, 'ending');
  assert.equal(r.world.result.level, 3);
});

test('the game makes no external requests: no CDNs, fonts, scripts or images from elsewhere', () => {
  const root = path.join(__dirname, '..');
  const code = ['index.html', 'assets/css/style.css'].concat(fs.readdirSync(path.join(root, 'assets/js')).map((f) => 'assets/js/' + f));
  for (const f of code) {
    const txt = fs.readFileSync(path.join(root, f), 'utf8');
    const urls = (txt.match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !u.startsWith('https://github.com/Rishabh-bgp/'));
    assert.deepEqual(urls, [], f + ' loads nothing from other sites');
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (m[1].startsWith('https://github.com/')) continue;
    assert.ok(fs.existsSync(path.join(root, m[1])), m[1] + ' exists');
  }
});
