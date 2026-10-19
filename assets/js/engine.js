/* Lovelight Leap - game engine
 * Pure game logic: level parsing, physics, collisions, enemies, items, boss,
 * camera, results and save data. It never touches the DOM, so it runs in the
 * browser and in Node (for the automated tests).
 * © 2026 Rishabh Aryan - MIT License
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LLEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const T = 16;            // tile size in world pixels
  const VIEW_W = 480;      // logical screen size
  const VIEW_H = 272;
  const FPS = 60;

  // Tunable physics, in pixels per frame at 60 frames per second
  const PHYS = Object.freeze({
    runMax: 2.3, accel: 0.22, airAccel: 0.16, friction: 0.3, airDrag: 0.04, turnBoost: 0.18,
    gravity: 0.34, fallGravity: 0.42, cutGravity: 0.95, maxFall: 7,
    jumpVel: 6.5, coyote: 6, buffer: 7,
    springVel: 9.4, stompBounce: 5.4, stompBounceHeld: 7.4,
    pw: 10, ph: 24, hp: 3, invuln: 90, shieldTime: 8 * 60,
    arrowSpeed: 5.4, arrowCooldown: 14, maxArrows: 3,
    heartsPerLife: 100
  });

  const SCORE = Object.freeze({ heart: 10, letter: 500, power: 1000, stomp: 100, arrow: 100, checkpoint: 100, boss: 5000, timeBonus: 20, life: 0 });

  // ---------- tiles ----------
  const isSolid = (c) => c === '#' || c === 'B' || c === 'J';
  const isOneWay = (c) => c === '=';
  const isHazard = (c) => c === '^';

  // ---------- small helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function makeRng(seed) { // mulberry32, deterministic
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- level parsing ----------
  function parseLevel(def) {
    const h = def.map.length;
    const w = Math.max.apply(null, def.map.map((r) => r.length));
    const grid = [];
    const L = {
      id: def.id, name: def.name, theme: def.theme, par: def.par, w, h, grid,
      start: null, goal: null, sweetheart: null, bossSpawn: null, arena: def.arena || null,
      items: [], enemies: [], checkpoints: [], letters: 0, heartsTotal: 0
    };
    for (let y = 0; y < h; y++) {
      const row = def.map[y].padEnd(w, '.').split('');
      for (let x = 0; x < w; x++) {
        const c = row[x];
        const px = x * T, py = y * T, floor = (y + 1) * T;
        let clear = true;
        switch (c) {
          case 'P': L.start = { x: px + 3, y: floor - PHYS.ph }; break;
          case 'o': L.items.push({ type: 'heart', x: px + 3, y: py + 3, w: 10, h: 10, taken: false }); L.heartsTotal++; break;
          case 'L': L.items.push({ type: 'letter', idx: L.letters++, x: px + 1, y: py + 2, w: 14, h: 12, taken: false }); break;
          case 'w': L.items.push({ type: 'bow', x: px, y: py, w: 16, h: 16, taken: false, power: true }); break;
          case 's': L.items.push({ type: 'shield', x: px, y: py, w: 16, h: 16, taken: false, power: true }); break;
          case 'C': L.checkpoints.push({ x: px + 2, y: floor - 32, w: 12, h: 32, active: false }); break;
          case 'G': L.goal = { x: px, y: floor - 48, w: 32, h: 48 }; break;
          case 'H': L.sweetheart = { x: px + 3, y: floor - PHYS.ph, w: PHYS.pw, h: PHYS.ph }; break;
          case 'K': L.bossSpawn = { x: px, y: py }; break;
          case 'b': L.enemies.push({ type: 'bramble', x: px + 1, y: floor - 12, w: 14, h: 12, vx: -0.55, vy: 0 }); break;
          case 'c': L.enemies.push({ type: 'cloud', x0: px - 3, y0: py, x: px - 3, y: py, w: 22, h: 14, rain: 60 }); break;
          case 'v': L.enemies.push({ type: 'bat', x0: px + 1, y0: py + 3, x: px + 1, y: py + 3, w: 14, h: 10 }); break;
          default: clear = false;
        }
        if (clear) row[x] = '.';
      }
      grid.push(row);
    }
    L.enemies.forEach((e, i) => { e.id = i; e.alive = true; e.cheerT = 0; e.t = (i * 37) % 200; e.active = false; });
    return L;
  }

  function validateLevel(def, isFinal) {
    const errors = [];
    if (!def || !Array.isArray(def.map)) return ['map missing'];
    if (def.map.length !== 17) errors.push('level must be 17 rows tall, got ' + def.map.length);
    const all = def.map.join('');
    const count = (ch) => all.split(ch).length - 1;
    if (count('P') !== 1) errors.push('needs exactly one start P');
    if (count('G') !== 1) errors.push('needs exactly one goal G');
    if (count('L') !== 3) errors.push('needs exactly three love letters L, got ' + count('L'));
    if (isFinal && count('K') !== 1) errors.push('final level needs a boss K');
    if (isFinal && count('H') !== 1) errors.push('final level needs the sweetheart H');
    if (isFinal && !def.arena) errors.push('final level needs an arena');
    if (!(def.par > 0)) errors.push('par time missing');
    const bad = all.replace(/[.#B=^JPoLwsCGHKbcvrytu]/g, '');
    if (bad.length) errors.push('unknown tiles: ' + Array.from(new Set(bad)).join(''));
    return errors;
  }

  // ---------- world ----------
  function createWorld(levels, index, carry, opts) {
    carry = carry || {};
    opts = opts || {};
    const def = levels[index];
    const L = parseLevel(def);
    const w = {
      index, def, level: L, levelCount: levels.length, isFinal: index === levels.length - 1,
      opts, rng: makeRng(opts.seed || 12345 + index),
      frame: 0, time: 0, state: 'play', stateTimer: 0,
      score: carry.score || 0, lives: carry.lives == null ? 3 : carry.lives,
      hearts: carry.hearts || 0, levelHearts: 0, letters: [false, false, false],
      stompCombo: 0, shake: 0,
      player: null, checkpoint: { x: L.start.x, y: L.start.y },
      arrows: [], drops: [], events: [], boss: null, arenaLocked: false, gateOpen: !L.bossSpawn,
      camera: { x: 0, y: 0, look: 0 }, result: null, springs: {}
    };
    w.player = makePlayer(L.start.x, L.start.y);
    if (L.bossSpawn) w.boss = makeBoss(L);
    if (opts.noEnemies) L.enemies.length = 0;
    snapCamera(w);
    return w;
  }

  function makePlayer(x, y) {
    return {
      x, y, w: PHYS.pw, h: PHYS.ph, vx: 0, vy: 0, onGround: false, facing: 1,
      coyote: 0, buffer: 0, hp: PHYS.hp, invuln: 0, bow: false, shield: 0, shootCd: 0,
      dropTimer: 0, bounce: false, landed: 0, jumped: 0, hurtT: 0, dead: false, shooting: 0, onSpring: false
    };
  }

  function makeBoss(L) {
    const s = L.bossSpawn;
    return {
      type: 'boss', x: s.x, y: s.y, w: 48, h: 36, homeY: s.y, t: 0, phase: 'wait', phaseT: 0,
      cheer: 0, need: 20, cheered: false, active: false, flash: 0, dir: 1, rainT: 40, gone: 0
    };
  }

  function emit(w, type, data) { const e = Object.assign({ type }, data || {}); w.events.push(e); return e; }

  // ---------- collision with tiles ----------
  function tileAt(L, tx, ty) {
    if (ty < 0 || ty >= L.h) return '.';
    if (tx < 0 || tx >= L.w) return '#';
    return L.grid[ty][tx];
  }
  function solidAt(L, tx, ty) { return isSolid(tileAt(L, tx, ty)); }

  function moveX(L, b, dx) {
    b.x += dx;
    const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 0.01) / T);
      for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { b.x = tx * T - b.w; return true; }
    } else if (dx < 0) {
      const tx = Math.floor(b.x / T);
      for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { b.x = (tx + 1) * T; return true; }
    }
    return false;
  }

  // returns 'land' | 'bump' | null ; sets b.groundTile
  function moveY(L, b, dy, allowOneWay) {
    const prevBottom = b.y + b.h;
    b.y += dy;
    const left = Math.floor(b.x / T), right = Math.floor((b.x + b.w - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - 0.01) / T);
      for (let tx = left; tx <= right; tx++) {
        const c = tileAt(L, tx, ty);
        if (isSolid(c) || (allowOneWay && isOneWay(c) && prevBottom <= ty * T + 0.5)) {
          b.y = ty * T - b.h;
          // which tile are we standing on (prefer a spring)
          let g = c, gx = tx;
          for (let k = left; k <= right; k++) { const ck = tileAt(L, k, ty); if (ck === 'J') { g = 'J'; gx = k; } }
          b.groundTile = g; b.groundX = gx; b.groundY = ty;
          return 'land';
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor(b.y / T);
      for (let tx = left; tx <= right; tx++) if (solidAt(L, tx, ty)) { b.y = (ty + 1) * T; return 'bump'; }
    }
    return null;
  }

  // ---------- main step ----------
  const NO_INPUT = Object.freeze({});
  function step(w, input) {
    input = input || NO_INPUT;
    w.lastInput = input;
    w.events = [];
    w.frame++;
    if (w.shake > 0) w.shake--;
    for (const k in w.springs) { if (--w.springs[k] <= 0) delete w.springs[k]; }

    if (w.state === 'play') {
      w.time++;
      updatePlayer(w, input);
      if (w.state === 'play') {
        updateEnemies(w);
        updateArrows(w);
        updateDrops(w);
        updateBoss(w);
        updateItems(w);
        checkGoal(w);
      }
      updateCamera(w);
    } else if (w.state === 'dying') {
      const p = w.player;
      p.vy = Math.min(p.vy + 0.3, 6); p.y += p.vy;
      updateEnemiesIdle(w);
      if (--w.stateTimer <= 0) {
        if (w.lives <= 0) { w.state = 'gameover'; emit(w, 'gameover'); }
        else respawn(w);
      }
    } else if (w.state === 'complete' || w.state === 'ending') {
      // walk into the gate / toward the sweetheart for a moment, scripted by the renderer
      w.stateTimer++;
      updateEnemiesIdle(w);
      if (w.boss) updateBoss(w);
    }
    return w.events;
  }

  function updatePlayer(w, input) {
    const L = w.level, p = w.player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // horizontal movement
    if (dir !== 0) {
      p.vx += dir * (p.onGround ? PHYS.accel : PHYS.airAccel);
      if (p.onGround && Math.sign(p.vx) !== dir && p.vx !== 0) p.vx += dir * PHYS.turnBoost;
      p.vx = clamp(p.vx, -PHYS.runMax, PHYS.runMax);
      p.facing = dir;
    } else {
      const f = p.onGround ? PHYS.friction : PHYS.airDrag;
      if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f;
    }

    // jump buffering and coyote time
    if (input.jumpPressed) p.buffer = PHYS.buffer; else if (p.buffer > 0) p.buffer--;
    if (p.onGround) p.coyote = PHYS.coyote; else if (p.coyote > 0) p.coyote--;

    // drop through a one-way platform with down + jump
    if (input.down && input.jumpPressed && p.onGround && isOneWay(p.groundTile)) {
      p.dropTimer = 12; p.buffer = 0; p.coyote = 0; p.onGround = false; p.y += 1;
    } else if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHYS.jumpVel; p.buffer = 0; p.coyote = 0; p.onGround = false; p.jumped = 1;
      emit(w, 'jump', { x: p.x + p.w / 2, y: p.y + p.h });
    }
    if (p.dropTimer > 0) p.dropTimer--;

    // gravity, with variable jump height
    // (springs and stomps give a fixed bounce that releasing jump does not cut short)
    if (p.vy >= 0) p.bounce = false;
    const g = p.vy < 0 ? (input.jump || p.bounce ? PHYS.gravity : PHYS.cutGravity) : PHYS.fallGravity;
    p.vy = Math.min(p.vy + g, PHYS.maxFall);

    // move and collide
    const wasGround = p.onGround, fallSpeed = p.vy;
    moveX(L, p, p.vx) && (p.vx = 0);
    // keep the player inside the boss arena while it is locked
    if (w.arenaLocked && L.arena) {
      const minX = L.arena[0] * T, maxX = L.arena[1] * T - p.w;
      if (p.x < minX) { p.x = minX; p.vx = 0; }
      if (p.x > maxX) { p.x = maxX; p.vx = 0; }
    }
    const r = moveY(L, p, p.vy, p.dropTimer === 0);
    p.onGround = false;
    if (r === 'land') {
      p.vy = 0; p.onGround = true; w.stompCombo = 0;
      if (p.groundTile === 'J') { // love-spring
        p.vy = -PHYS.springVel; p.onGround = false; p.coyote = 0; p.bounce = true;
        w.springs[p.groundX + ',' + p.groundY] = 16;
        emit(w, 'spring', { x: p.groundX * T + 8, y: p.groundY * T });
      } else if (!wasGround && fallSpeed > 1.5) {
        p.landed = 1;
        emit(w, 'land', { x: p.x + p.w / 2, y: p.y + p.h, power: fallSpeed });
      }
    } else if (r === 'bump') {
      p.vy = 0.5;
      emit(w, 'bump', { x: p.x + p.w / 2, y: p.y });
    }

    // timers
    if (p.invuln > 0) p.invuln--;
    if (p.shield > 0) { p.shield--; if (p.shield === 0) emit(w, 'shieldEnd'); }
    if (p.shootCd > 0) p.shootCd--;
    if (p.shooting > 0) p.shooting--;

    // shooting heart arrows
    if (p.bow && input.shootPressed && p.shootCd === 0 && w.arrows.length < PHYS.maxArrows) {
      const up = !!input.up;
      const s = PHYS.arrowSpeed;
      w.arrows.push({
        x: p.x + p.w / 2 + p.facing * 6 - 4, y: p.y + 9, w: 8, h: 6,
        vx: up ? s * 0.72 * p.facing : s * p.facing, vy: up ? -s * 0.72 : 0, life: 70
      });
      p.shootCd = PHYS.arrowCooldown; p.shooting = 12;
      emit(w, 'shoot', { x: p.x + p.w / 2, y: p.y + 10 });
    }

    // thorns
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T);
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (isHazard(tileAt(L, tx, ty)) && overlap(p, { x: tx * T + 2, y: ty * T + 7, w: 12, h: 9 })) hurt(w, tx * T + 8);
    }

    // falling out of the world
    if (p.y > L.h * T + 24 && w.state === 'play') die(w, 'fall');
  }

  function hurt(w, fromX) {
    const p = w.player;
    if (w.state !== 'play' || p.invuln > 0 || p.shield > 0 || w.opts.god) return false;
    p.hp--;
    p.invuln = PHYS.invuln;
    p.hurtT = 20;
    const away = fromX == null ? -p.facing : Math.sign(p.x + p.w / 2 - fromX) || -p.facing;
    p.vx = away * 2.2; p.vy = -3.6; p.onGround = false;
    w.shake = 12;
    emit(w, 'hurt', { x: p.x + p.w / 2, y: p.y + p.h / 2 });
    if (p.hp <= 0) die(w, 'hurt');
    return true;
  }

  function die(w, why) {
    const p = w.player;
    if (w.state !== 'play') return;
    if (w.opts.god && why === 'fall') { // test mode: put her back on the last checkpoint
      respawn(w, true); return;
    }
    w.lives--;
    w.state = 'dying';
    w.stateTimer = 80;
    p.dead = true; p.vx = 0; p.vy = why === 'fall' ? 0 : -5.5;
    p.bow = false; p.shield = 0;
    w.arrows.length = 0; w.drops.length = 0;
    w.shake = 16;
    emit(w, 'die', { x: p.x + p.w / 2, y: Math.min(p.y, w.level.h * T - 20), why });
  }

  function respawn(w, quiet) {
    const L = w.level;
    const old = w.player;
    const p = makePlayer(w.checkpoint.x, w.checkpoint.y);
    p.facing = 1; p.invuln = 60;
    if (quiet) { p.bow = old.bow; p.shield = old.shield; }
    w.player = p;
    w.state = 'play';
    // power-ups come back so a retry is always possible
    L.items.forEach((it) => { if (it.power) it.taken = false; });
    if (w.boss && !w.boss.cheered) { const b = makeBoss(L); w.boss = b; w.arenaLocked = false; }
    w.arrows.length = 0; w.drops.length = 0;
    snapCamera(w);
    if (!quiet) emit(w, 'respawn', { x: p.x, y: p.y });
  }

  // ---------- enemies ----------
  function isNearCamera(w, e, margin) {
    const cx = w.camera.x;
    return e.x + e.w > cx - margin && e.x < cx + VIEW_W + margin;
  }

  function updateEnemiesIdle(w) {
    for (const e of w.level.enemies) if (!e.alive && e.cheerT < 90) e.cheerT++;
  }

  function updateEnemies(w) {
    const L = w.level, p = w.player;
    for (const e of L.enemies) {
      if (!e.alive) { if (e.cheerT < 90) e.cheerT++; continue; }
      if (!e.active) { if (isNearCamera(w, e, 48)) e.active = true; else continue; }
      e.t++;
      if (e.type === 'bramble') {
        e.vy = Math.min(e.vy + 0.4, 6);
        const hitWall = moveX(L, e, e.vx);
        const land = moveY(L, e, e.vy, true);
        if (land === 'land') e.vy = 0;
        let turn = hitWall;
        if (land === 'land' && !turn) { // turn around at ledges
          const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
          const below = tileAt(L, Math.floor(fx / T), Math.floor((e.y + e.h + 2) / T));
          if (!isSolid(below) && !isOneWay(below)) turn = true;
        }
        if (turn) e.vx = -e.vx;
        if (e.y > L.h * T + 32) { e.alive = false; e.cheerT = 90; }
      } else if (e.type === 'cloud') {
        e.x = e.x0 + Math.sin(e.t * 0.018) * 40;
        e.y = e.y0 + Math.sin(e.t * 0.05) * 3;
        if (--e.rain <= 0) {
          e.rain = 150;
          const dx = Math.abs(p.x - e.x);
          if (dx < 120 && p.y > e.y) { w.drops.push({ x: e.x + e.w / 2 - 2, y: e.y + e.h, w: 4, h: 6, vy: 2.2 }); emit(w, 'rain', { x: e.x + e.w / 2, y: e.y + e.h }); }
        }
      } else if (e.type === 'bat') {
        e.x = e.x0 + Math.sin(e.t * 0.022) * 52;
        e.y = e.y0 + Math.sin(e.t * 0.09) * 12;
      }
      if (!w.player.dead && overlap(p, e)) touchEnemy(w, e);
    }
  }

  function touchEnemy(w, e) {
    const p = w.player;
    const prevBottom = p.y + p.h - p.vy;
    if (p.vy > 0 && prevBottom <= e.y + 6) {
      cheerUp(w, e, 'stomp');
      p.vy = -(w.lastInput && w.lastInput.jump ? PHYS.stompBounceHeld : PHYS.stompBounce);
      p.bounce = true;
      p.y = e.y - p.h;
      p.onGround = false;
    } else if (p.shield > 0) {
      cheerUp(w, e, 'shield');
    } else {
      hurt(w, e.x + e.w / 2);
    }
  }

  function cheerUp(w, e, how) {
    e.alive = false; e.cheerT = 0;
    let pts = SCORE.stomp;
    if (how === 'stomp') { w.stompCombo++; pts = SCORE.stomp * Math.min(8, Math.pow(2, w.stompCombo - 1)); }
    else if (how === 'arrow') pts = SCORE.arrow;
    w.score += pts;
    emit(w, 'cheer', { x: e.x + e.w / 2, y: e.y + e.h / 2, how, pts, enemy: e.type });
  }

  function updateArrows(w) {
    const L = w.level;
    for (let i = w.arrows.length - 1; i >= 0; i--) {
      const a = w.arrows[i];
      a.x += a.vx; a.y += a.vy; a.life--;
      let gone = a.life <= 0;
      const tx = Math.floor((a.x + a.w / 2) / T), ty = Math.floor((a.y + a.h / 2) / T);
      if (!gone && solidAt(L, tx, ty)) { gone = true; emit(w, 'arrowPop', { x: a.x + a.w / 2, y: a.y + a.h / 2 }); }
      if (!gone) for (const e of L.enemies) {
        if (e.alive && e.active && overlap(a, e)) { cheerUp(w, e, 'arrow'); gone = true; break; }
      }
      const b = w.boss;
      if (!gone && b && b.active && !b.cheered && overlap(a, b)) { gone = true; bossHit(w, 1); }
      if (gone) w.arrows.splice(i, 1);
    }
  }

  function updateDrops(w) {
    const L = w.level, p = w.player;
    for (let i = w.drops.length - 1; i >= 0; i--) {
      const d = w.drops[i];
      d.vy = Math.min(d.vy + 0.12, 5); d.y += d.vy;
      if (d.x !== undefined && d.vx) d.x += d.vx;
      const hitTile = solidAt(L, Math.floor((d.x + 2) / T), Math.floor((d.y + d.h) / T)) || isOneWay(tileAt(L, Math.floor((d.x + 2) / T), Math.floor((d.y + d.h) / T)));
      if (hitTile || d.y > L.h * T) { w.drops.splice(i, 1); emit(w, 'splash', { x: d.x + 2, y: d.y + d.h }); continue; }
      if (overlap(p, d) && !p.dead) {
        w.drops.splice(i, 1);
        if (p.shield > 0) emit(w, 'splash', { x: d.x + 2, y: d.y + d.h }); else hurt(w, d.x);
      }
    }
  }

  // ---------- boss: King Grumblecloud ----------
  function updateBoss(w) {
    const b = w.boss; if (!b) return;
    const L = w.level, p = w.player;
    if (b.flash > 0) b.flash--;
    if (b.cheered) { // happy and floating away on a rainbow
      b.gone++; b.y -= 0.6; b.x += Math.sin(b.gone * 0.05) * 0.6;
      return;
    }
    if (!b.active) {
      if (w.state === 'play' && p.x >= L.arena[0] * T + 40) {
        b.active = true; w.arenaLocked = true; b.phase = 'intro'; b.phaseT = 90;
        emit(w, 'bossStart');
      }
      return;
    }
    if (w.state !== 'play') return;
    b.t++;
    const left = L.arena[0] * T + 24, right = L.arena[1] * T - 24 - b.w;
    const floorY = groundBelow(L, b.x + b.w / 2, b.homeY) - b.h - 2;
    switch (b.phase) {
      case 'intro':
        b.y = b.homeY + Math.sin(b.t * 0.05) * 4;
        if (--b.phaseT <= 0) { b.phase = 'hover'; b.phaseT = 230; }
        break;
      case 'hover':
        b.x += b.dir * 1.1;
        if (b.x < left) { b.x = left; b.dir = 1; }
        if (b.x > right) { b.x = right; b.dir = -1; }
        b.y = b.homeY + Math.sin(b.t * 0.06) * 6;
        if (--b.rainT <= 0) {
          b.rainT = b.cheer >= b.need / 2 ? 34 : 48;
          const cx = b.x + b.w / 2;
          const aim = clamp((p.x + p.w / 2 - cx) / 60, -1.2, 1.2);
          w.drops.push({ x: cx - 2, y: b.y + b.h - 4, w: 4, h: 6, vy: 1.5, vx: aim });
          emit(w, 'rain', { x: cx, y: b.y + b.h });
        }
        if (--b.phaseT <= 0) { b.phase = 'dive'; b.phaseT = 50; }
        break;
      case 'dive':
        b.y += (floorY - b.y) * 0.08;
        if (--b.phaseT <= 0) { b.phase = 'sweep'; b.phaseT = 150; emit(w, 'bossSweep'); }
        break;
      case 'sweep':
        b.x += b.dir * 1.5;
        if (b.x < left) { b.x = left; b.dir = 1; }
        if (b.x > right) { b.x = right; b.dir = -1; }
        b.y = floorY + Math.sin(b.t * 0.15) * 2;
        if (--b.phaseT <= 0) { b.phase = 'rise'; b.phaseT = 60; }
        break;
      case 'rise':
        b.y += (b.homeY - b.y) * 0.07;
        if (--b.phaseT <= 0) { b.phase = 'hover'; b.phaseT = 230; b.rainT = 30; }
        break;
    }
    // contact with the heroine
    if (!p.dead && overlap(p, b)) {
      const prevBottom = p.y + p.h - p.vy;
      if (p.vy > 0 && prevBottom <= b.y + 8) {
        p.vy = -PHYS.stompBounceHeld; p.y = b.y - p.h; p.bounce = true;
        bossHit(w, 2);
      } else if (p.shield > 0) {
        if (b.flash === 0) bossHit(w, 1);
      } else hurt(w, b.x + b.w / 2);
    }
  }

  function groundBelow(L, x, y) {
    const tx = Math.floor(x / T);
    for (let ty = Math.max(0, Math.floor(y / T)); ty < L.h; ty++) if (isSolid(tileAt(L, tx, ty))) return ty * T;
    return L.h * T;
  }

  function bossHit(w, amount) {
    const b = w.boss;
    if (!b || b.cheered) return;
    b.cheer = Math.min(b.need, b.cheer + amount);
    b.flash = 14;
    w.score += 50 * amount;
    emit(w, 'bossHit', { x: b.x + b.w / 2, y: b.y + b.h / 2, cheer: b.cheer, need: b.need });
    if (b.cheer >= b.need) {
      b.cheered = true; b.gone = 0;
      w.arenaLocked = false; w.gateOpen = true; w.drops.length = 0;
      w.score += SCORE.boss;
      w.shake = 20;
      emit(w, 'bossCheered', { x: b.x + b.w / 2, y: b.y + b.h / 2 });
    }
  }

  // ---------- items, checkpoints and goal ----------
  function updateItems(w) {
    const L = w.level, p = w.player;
    if (p.dead) return;
    for (const it of L.items) {
      if (it.taken || !overlap(p, it)) continue;
      it.taken = true;
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      if (it.type === 'heart') {
        w.hearts++; w.levelHearts++; w.score += SCORE.heart;
        emit(w, 'heart', { x: cx, y: cy });
        if (w.hearts % PHYS.heartsPerLife === 0) { w.lives++; emit(w, 'oneup', { x: cx, y: cy }); }
      } else if (it.type === 'letter') {
        w.letters[it.idx] = true; w.score += SCORE.letter;
        emit(w, 'letter', { x: cx, y: cy, idx: it.idx });
      } else if (it.type === 'bow') {
        p.bow = true; w.score += SCORE.power;
        emit(w, 'powerup', { x: cx, y: cy, power: 'bow' });
      } else if (it.type === 'shield') {
        p.shield = PHYS.shieldTime; w.score += SCORE.power;
        emit(w, 'powerup', { x: cx, y: cy, power: 'shield' });
      }
    }
    for (const c of L.checkpoints) {
      if (!c.active && overlap(p, c)) {
        c.active = true;
        w.checkpoint = { x: c.x + 1, y: c.y + c.h - PHYS.ph };
        w.score += SCORE.checkpoint;
        emit(w, 'checkpoint', { x: c.x + c.w / 2, y: c.y });
      }
    }
  }

  function checkGoal(w) {
    const L = w.level, p = w.player, g = L.goal;
    if (!g || p.dead) return;
    const zone = { x: g.x + 8, y: g.y, w: g.w - 16, h: g.h };
    if (!overlap(p, zone)) return;
    if (!w.gateOpen) { if (!w.lockedHint) { w.lockedHint = true; emit(w, 'gateLocked'); } return; }
    finishLevel(w);
  }

  function finishLevel(w) {
    const L = w.level;
    const seconds = Math.floor(w.time / FPS);
    const letters = w.letters.filter(Boolean).length;
    const underPar = seconds <= L.par;
    const stars = 1 + (letters === 3 ? 1 : 0) + (underPar ? 1 : 0);
    const timeBonus = Math.max(0, L.par - seconds) * SCORE.timeBonus;
    w.score += timeBonus;
    w.result = {
      level: w.index, id: L.id, stars, seconds, par: L.par, underPar, letters: w.letters.slice(),
      hearts: w.levelHearts, heartsTotal: L.heartsTotal, timeBonus, score: w.score, lives: w.lives
    };
    w.state = w.isFinal ? 'ending' : 'complete';
    w.stateTimer = 0;
    w.player.vx = 0;
    emit(w, w.isFinal ? 'ending' : 'complete', { result: w.result });
  }

  // ---------- camera ----------
  function cameraTarget(w) {
    const p = w.player, L = w.level;
    let x = p.x + p.w / 2 - VIEW_W / 2 + w.camera.look;
    if (w.arenaLocked && L.arena) x = L.arena[0] * T;
    return clamp(x, 0, Math.max(0, L.w * T - VIEW_W));
  }
  function updateCamera(w) {
    const c = w.camera, p = w.player;
    c.look += (p.facing * 36 - c.look) * 0.03;
    const tx = cameraTarget(w);
    c.x += (tx - c.x) * (w.arenaLocked ? 0.08 : 0.14);
    c.x = clamp(c.x, 0, Math.max(0, w.level.w * T - VIEW_W));
  }
  function snapCamera(w) { w.camera.look = 36; w.camera.x = cameraTarget(w); }

  // ---------- save data ----------
  const SAVE_KEY = 'lovelight-leap-save-v1';
  function defaultSave() {
    return { v: 1, unlocked: 1, highScore: 0, finished: false, levels: {}, settings: { sound: true, music: true } };
  }
  function parseSave(str) {
    const d = defaultSave();
    if (!str) return d;
    let o;
    try { o = JSON.parse(str); } catch (e) { return d; }
    if (!o || typeof o !== 'object' || o.v !== 1) return d;
    if (Number.isInteger(o.unlocked) && o.unlocked >= 1 && o.unlocked <= 99) d.unlocked = o.unlocked;
    if (typeof o.highScore === 'number' && o.highScore >= 0 && isFinite(o.highScore)) d.highScore = Math.floor(o.highScore);
    d.finished = o.finished === true;
    if (o.settings && typeof o.settings === 'object') {
      if (typeof o.settings.sound === 'boolean') d.settings.sound = o.settings.sound;
      if (typeof o.settings.music === 'boolean') d.settings.music = o.settings.music;
    }
    if (o.levels && typeof o.levels === 'object') {
      for (const id of Object.keys(o.levels)) {
        const r = o.levels[id];
        if (!r || typeof r !== 'object') continue;
        d.levels[id] = {
          stars: clamp(Math.floor(Number(r.stars) || 0), 0, 3),
          bestScore: Math.max(0, Math.floor(Number(r.bestScore) || 0)),
          bestTime: Number.isFinite(r.bestTime) ? r.bestTime : null,
          letters: Array.isArray(r.letters) ? [0, 1, 2].map((i) => r.letters[i] === true) : [false, false, false]
        };
      }
    }
    return d;
  }
  function applyResult(save, result, levelCount) {
    const s = JSON.parse(JSON.stringify(save));
    const prev = s.levels[result.id] || { stars: 0, bestScore: 0, bestTime: null, letters: [false, false, false] };
    s.levels[result.id] = {
      stars: Math.max(prev.stars, result.stars),
      bestScore: Math.max(prev.bestScore, result.score),
      bestTime: prev.bestTime == null ? result.seconds : Math.min(prev.bestTime, result.seconds),
      letters: prev.letters.map((v, i) => v || !!result.letters[i])
    };
    s.unlocked = Math.max(s.unlocked, Math.min(result.level + 2, levelCount));
    s.highScore = Math.max(s.highScore, result.score);
    if (result.level === levelCount - 1) s.finished = true;
    return s;
  }
  function recordScore(save, score) {
    const s = JSON.parse(JSON.stringify(save));
    s.highScore = Math.max(s.highScore, Math.floor(score) || 0);
    return s;
  }
  function totalStars(save) { return Object.values(save.levels).reduce((a, r) => a + r.stars, 0); }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  return {
    T, VIEW_W, VIEW_H, FPS, PHYS, SCORE, SAVE_KEY,
    isSolid, isOneWay, isHazard, overlap, clamp, makeRng,
    parseLevel, validateLevel, createWorld, step, tileAt, solidAt,
    hurt, die, respawn, cheerUp, bossHit, finishLevel, snapCamera,
    defaultSave, parseSave, applyResult, recordScore, totalStars, formatTime
  };
});
