/* Lovelight Leap - main
 * Game loop (fixed 60 fps timestep), input (keyboard, touch, gamepad),
 * rendering, particles, screens, transitions and saving.
 * © 2026 Rishabh Aryan - MIT License
 */
(function () {
  'use strict';
  const E = window.LLEngine, LEVELS = window.LLLevels, A = window.LLArt, S = window.LLAudio;
  const T = E.T, VW = E.VIEW_W, VH = E.VIEW_H;
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const frameEl = $('#frame');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FONT = 'ui-rounded, "Arial Rounded MT Bold", "Nunito", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  // ---------------------------------------------------------------- save
  function loadSave() {
    try { return E.parseSave(localStorage.getItem(E.SAVE_KEY)); } catch (e) { return E.defaultSave(); }
  }
  function writeSave() {
    try { localStorage.setItem(E.SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: play without saving */ }
  }
  let save = loadSave();
  S.setSound(save.settings.sound); S.setMusic(save.settings.music);

  // ---------------------------------------------------------------- state
  let mode = 'title';          // title | story | play | paused | complete | gameover | ending
  let world = null;
  let run = { lives: 3, score: 0, hearts: 0 };
  let levelStart = { lives: 3, score: 0, hearts: 0 };
  let particles = [];
  let ambient = [];
  let ticks = 0;
  let transition = null;
  let banner = null;
  let floaters = [];
  let autoplay = null;
  let cut = null;               // ending cutscene
  let shown = null;             // which result screen is up
  const vis = { sx: 1, sy: 1, runPhase: 0, blink: 0, flash: 0, shake: 0, completeT: 0 };
  const titleWorld = E.createWorld(LEVELS, 0, {}, { noEnemies: false });
  let titleCam = 0;

  // ---------------------------------------------------------------- canvas scaling
  let K = 2;
  const cache = new Map();
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = frameEl.clientWidth || VW;
    const k = Math.max(1, Math.min(4, Math.ceil((cssW * dpr) / VW)));
    if (k !== K || canvas.width !== VW * k) {
      K = k; canvas.width = VW * K; canvas.height = VH * K; cache.clear();
    }
  }
  window.addEventListener('resize', resize);

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * K); c.height = Math.ceil(h * K); const g = c.getContext('2d'); g.scale(K, K); return [c, g]; }
  function cached(key, w, h, draw) {
    let c = cache.get(key);
    if (!c) { const [cv, g] = makeCanvas(w, h); draw(g); cache.set(key, cv); c = cv; }
    return c;
  }

  // ---------------------------------------------------------------- input
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'shoot', KeyJ: 'shoot',
    KeyP: 'pause', Escape: 'pause', KeyM: 'mute'
  };
  const keys = {}, touchKeys = {}, pressed = {};
  let padPrev = {};
  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (mode === 'play' && a !== 'mute' && a !== 'pause') e.preventDefault();
    if (e.code === 'Space' && document.activeElement && document.activeElement.tagName === 'BUTTON' && mode !== 'play') return;
    if (!e.repeat) pressed[a] = true;
    keys[a] = true;
    S.init();
  });
  window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) keys[a] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touchKeys) touchKeys[k] = false; });

  document.querySelectorAll('.tbtn').forEach((b) => {
    const act = b.dataset.act;
    const on = (e) => { e.preventDefault(); touchKeys[act] = true; pressed[act] = true; b.classList.add('on'); S.init(); if (b.setPointerCapture && e.pointerId != null) try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
    const off = (e) => { e.preventDefault(); touchKeys[act] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  function enableTouch() { document.documentElement.classList.add('touch'); resize(); }
  if (window.matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) enableTouch();
  window.addEventListener('touchstart', () => { if (!document.documentElement.classList.contains('touch')) enableTouch(); }, { passive: true, once: true });

  function pollPad() {
    const out = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      out.jump = out.jump || b(0) || b(1);
      out.shoot = out.shoot || b(2) || b(3);
      out.pause = out.pause || b(9);
      out.up = out.up || b(12) || p.axes[1] < -0.6;
      out.down = out.down || b(13) || p.axes[1] > 0.6;
      out.left = out.left || b(14) || p.axes[0] < -0.4;
      out.right = out.right || b(15) || p.axes[0] > 0.4;
    }
    for (const k of ['jump', 'shoot', 'pause', 'up']) if (out[k] && !padPrev[k]) pressed[k] = true;
    padPrev = out;
    return out;
  }

  function readInput() {
    const pad = pollPad();
    const held = (a) => !!(keys[a] || touchKeys[a] || pad[a]);
    return {
      left: held('left'), right: held('right'), up: held('up'), down: held('down'),
      jump: held('jump') || held('up'), jumpPressed: !!(pressed.jump || pressed.up),
      shoot: held('shoot'), shootPressed: !!pressed.shoot
    };
  }

  // ---------------------------------------------------------------- screens
  const screens = ['title', 'story', 'levels', 'howto', 'pause', 'complete', 'gameover', 'ending'];
  let backTo = 'title';
  function show(name) {
    screens.forEach((s) => { const el = $('#scr-' + s); if (el) el.hidden = s !== name; });
    const el = name && $('#scr-' + name);
    if (el) { const f = el.querySelector('.btn-primary, .card:not(:disabled), .btn'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30); }
    $('#btn-pause').hidden = !(mode === 'play' && !name);
  }
  function announce(msg) { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 20); }

  function refreshTitle() {
    $('#title-best').textContent = 'Best score ' + save.highScore.toLocaleString('en-US');
    $('#title-stars').textContent = E.totalStars(save) + ' / ' + LEVELS.length * 3 + ' stars';
    const cont = $('#btn-continue');
    cont.hidden = !(save.unlocked > 1);
    if (save.unlocked > 1) cont.textContent = 'Continue: World ' + save.unlocked;
    updateSoundBtn();
  }
  function goTitle() {
    mode = 'title'; world = null; cut = null; shown = null;
    S.playMusic('love', 0);
    refreshTitle(); show('title');
  }

  function buildLevelGrid() {
    const grid = $('#level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const rec = save.levels[L.id];
      const locked = i + 1 > save.unlocked;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card theme-' + L.theme; b.disabled = locked;
      const stars = rec ? rec.stars : 0;
      const letters = rec ? rec.letters.filter(Boolean).length : 0;
      b.innerHTML =
        '<span class="num">World ' + (i + 1) + '</span>' + (locked ? '<span class="lock">Locked</span>' : '') +
        '<span class="name">' + L.name + '</span>' +
        '<span class="cstars" aria-hidden="true">' + [0, 1, 2].map((s) => '<span class="' + (s < stars ? '' : 'off') + '">★</span>').join('') + '</span>' +
        (locked ? '' : '<span class="sr-only">' + stars + ' of 3 stars, </span>') +
        '<span class="info">' + letters + '/3 letters' + (rec ? ' · best ' + rec.bestScore.toLocaleString('en-US') : '') + '</span>';
      b.addEventListener('click', () => { S.init(); S.sfx('ui'); fadeTo(() => startLevel(i, true)); });
      grid.appendChild(b);
    });
  }

  function updateSoundBtn() {
    const on = save.settings.sound || save.settings.music;
    const b = $('#btn-sound');
    b.textContent = on ? 'Sound on' : 'Sound off';
    b.setAttribute('aria-pressed', String(!on));
    $('#opt-music').checked = save.settings.music;
    $('#opt-sound').checked = save.settings.sound;
  }
  function toggleMute() {
    const on = !(save.settings.sound || save.settings.music);
    save.settings.sound = on; save.settings.music = on;
    S.setSound(on); S.setMusic(on); writeSave(); updateSoundBtn();
    toast(on ? 'Sound on' : 'Sound off');
  }

  // ---------------------------------------------------------------- flow
  function startLevel(i, fresh) {
    if (fresh) run = { lives: 3, score: 0, hearts: 0 };
    levelStart = Object.assign({}, run);
    world = E.createWorld(LEVELS, i, run, { seed: 1000 + i });
    particles = []; floaters = []; ambient = []; cut = null; shown = null;
    vis.sx = vis.sy = 1; vis.completeT = 0; vis.flash = 0;
    mode = 'play';
    show(null);
    const th = A.THEMES[world.level.theme];
    S.playMusic('level', th.music);
    banner = { title: 'World ' + (i + 1), sub: world.level.name, t: 0 };
    announce('World ' + (i + 1) + ': ' + world.level.name);
    document.body.classList.toggle('no-bow', true);
  }

  function pauseGame() {
    if (mode !== 'play') return;
    mode = 'paused'; S.sfx('pause'); S.suspend();
    show('pause');
  }
  function resumeGame() {
    if (mode !== 'paused') return;
    S.resume(); mode = 'play'; show(null);
    for (const k in keys) keys[k] = false;
  }

  function fadeTo(cb) {
    if (transition) return;
    transition = { t: 0, dur: reduceMQ.matches ? 10 : 34, phase: 'out', cb };
  }

  // ---------------------------------------------------------------- particles
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function burst(x, y, n, kind, opts) {
    opts = opts || {};
    if (reduceMQ.matches) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = opts.up ? rnd(-Math.PI * 0.95, -Math.PI * 0.05) : rnd(0, Math.PI * 2);
      const sp = rnd(opts.min || 0.6, opts.max || 2.4);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: opts.g == null ? 0.05 : opts.g,
        life: 0, max: rnd(opts.lmin || 24, opts.lmax || 46), kind, size: rnd(opts.smin || 2, opts.smax || 4),
        color: opts.colors ? opts.colors[i % opts.colors.length] : '#fff', rot: rnd(0, 6), vr: rnd(-0.2, 0.2)
      });
    }
  }
  function floatText(x, y, text, color) { floaters.push({ x, y, text, color: color || '#fff', t: 0 }); }
  let toastMsg = null;
  function toast(text) { toastMsg = { text, t: 0 }; }

  const PINKS = ['#ff3d7f', '#ff7aa6', '#ffd1e3', '#ffd36e', '#b48cff'];

  function handleEvents(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'jump': S.sfx('jump'); vis.sx = 0.75; vis.sy = 1.28; burst(e.x, e.y, 5, 'dust', { up: true, max: 1, g: -0.01, colors: ['#ffffff'] }); break;
        case 'land': S.sfx('land'); vis.sx = 1.3; vis.sy = 0.74; burst(e.x, e.y, 6, 'dust', { up: true, max: 1.2, g: 0, colors: ['#ffffff'] }); break;
        case 'heart': S.sfx('heart'); burst(e.x, e.y, 6, 'spark', { colors: PINKS, max: 1.6 }); break;
        case 'letter':
          S.sfx('letter'); burst(e.x, e.y, 22, 'heart', { colors: PINKS, max: 2.8 });
          floatText(e.x, e.y - 10, 'Love letter ' + world.letters.filter(Boolean).length + '/3!', '#ffd36e');
          announce('Love letter found, ' + world.letters.filter(Boolean).length + ' of 3');
          break;
        case 'cheer': S.sfx('cheer'); burst(e.x, e.y, 12, 'heart', { colors: PINKS, max: 2.2 }); floatText(e.x, e.y - 8, '+' + e.pts, '#fff'); break;
        case 'hurt': S.sfx('hurt'); vis.flash = 10; if (!reduceMQ.matches) vis.shake = 10; burst(e.x, e.y, 8, 'spark', { colors: ['#ffffff', '#9fd4ff'] }); break;
        case 'die': S.sfx('die'); vis.flash = 14; if (!reduceMQ.matches) vis.shake = 14; burst(e.x, e.y, 18, 'heart', { colors: ['#ff7aa6', '#b48cff'], max: 3 }); break;
        case 'respawn': burst(e.x + 5, e.y + 12, 16, 'spark', { colors: PINKS }); break;
        case 'shoot': S.sfx('shoot'); break;
        case 'arrowPop': S.sfx('arrowPop'); burst(e.x, e.y, 5, 'spark', { colors: PINKS, max: 1.4 }); break;
        case 'powerup':
          S.sfx('powerup'); burst(e.x, e.y, 26, 'spark', { colors: ['#ffd36e', '#ffffff', '#ff9cc4', '#b48cff'], max: 3 });
          if (e.power === 'bow') { floatText(e.x, e.y - 12, "Cupid's Bow!", '#ffd36e'); toast('Press X to shoot heart arrows (hold ↑ to aim up)'); document.body.classList.remove('no-bow'); }
          else { floatText(e.x, e.y - 12, 'Sparkle Shield!', '#d9c4ff'); toast('Sparkle Shield: you are safe for 8 seconds'); }
          announce(e.power === 'bow' ? "Got Cupid's Bow" : 'Got the Sparkle Shield');
          break;
        case 'checkpoint': S.sfx('checkpoint'); burst(e.x + 8, e.y + 12, 18, 'spark', { colors: ['#ffd36e', '#ff9cc4', '#fff'] }); floatText(e.x, e.y - 6, 'Lantern lit!', '#ffd36e'); break;
        case 'spring': S.sfx('spring'); burst(e.x, e.y, 8, 'heart', { up: true, colors: PINKS }); vis.sx = 0.7; vis.sy = 1.35; break;
        case 'bump': S.sfx('bump'); break;
        case 'rain': S.sfx('rain'); break;
        case 'splash': burst(e.x, e.y, 3, 'dust', { up: true, colors: ['#9fb0ff'], max: 1 }); break;
        case 'oneup': S.sfx('oneup'); floatText(e.x, e.y - 14, '+1 life', '#9fffc8'); break;
        case 'shieldEnd': S.sfx('shieldEnd'); break;
        case 'gateLocked': S.sfx('gateLocked'); toast('The heart gate is locked. Cheer up the King first!'); break;
        case 'bossStart':
          S.sfx('bossStart'); S.playMusic('boss', 0);
          banner = { title: 'King Grumblecloud', sub: 'is sulking! Cheer him up with heart arrows or hops', t: 0, y: 150 };
          announce('Boss: King Grumblecloud. Cheer him up with heart arrows or by hopping on his head');
          break;
        case 'bossHit': S.sfx('bossHit'); burst(e.x, e.y, 8, 'heart', { colors: PINKS, max: 2 }); break;
        case 'bossCheered':
          S.sfx('bossCheered'); S.playMusic('love', 0);
          burst(e.x, e.y, 50, 'heart', { colors: PINKS, max: 4, lmax: 70 });
          banner = { title: 'He’s smiling!', sub: 'The heart gate is open', t: 0 };
          announce('King Grumblecloud is smiling again. The heart gate is open');
          break;
        case 'complete': S.sfx('complete'); S.stopMusic(); onComplete(e.result); break;
        case 'ending': S.sfx('complete'); onComplete(e.result, true); break;
        case 'gameover': S.sfx('gameover'); S.stopMusic(); break;
      }
    }
  }

  function onComplete(result, final) {
    save = E.applyResult(save, result, LEVELS.length);
    writeSave();
    run = { lives: world.lives, score: world.score, hearts: world.hearts };
    vis.completeT = 0;
    $('#btn-pause').hidden = true;
    if (final) {
      const p = world.player, sh = world.level.sweetheart;
      cut = { t: 0, ax: p.x, tx: sh.x, hug: -1, done: false, meet: Math.round((world.level.goal.x + world.level.goal.w + sh.x) / 2) - 2 };
    }
  }

  function showComplete() {
    const r = world.result;
    shown = 'complete'; mode = 'complete';
    $('#complete-h').textContent = world.level.name + ' clear!';
    const starEls = document.querySelectorAll('#complete-stars span');
    starEls.forEach((s) => s.classList.remove('on'));
    starEls.forEach((s, i) => { if (i < r.stars) setTimeout(() => { s.classList.add('on'); S.sfx('heart'); }, 350 + i * 300); });
    $('#complete-stars').setAttribute('aria-label', r.stars + ' of 3 stars');
    $('#complete-stats').innerHTML = statsHTML([
      ['Hearts', r.hearts + ' / ' + r.heartsTotal],
      ['Love letters', r.letters.filter(Boolean).length + ' / 3'],
      ['Time', E.formatTime(r.seconds) + (r.underPar ? ' ✓' : '') + ' (par ' + E.formatTime(r.par) + ')'],
      ['Time bonus', '+' + r.timeBonus.toLocaleString('en-US')],
      ['Score', r.score.toLocaleString('en-US')]
    ]);
    $('#btn-next').hidden = world.index >= LEVELS.length - 1;
    show('complete');
    announce(world.level.name + ' clear. ' + r.stars + ' of 3 stars. Score ' + r.score);
  }
  function statsHTML(rows) { return rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join(''); }

  function showGameOver() {
    shown = 'gameover'; mode = 'gameover';
    save = E.recordScore(save, world.score); writeSave();
    $('#over-score').textContent = 'Score ' + world.score.toLocaleString('en-US');
    show('gameover');
    announce('Game over. Score ' + world.score);
  }

  function showEnding() {
    shown = 'ending'; mode = 'ending';
    const total = E.totalStars(save);
    $('#end-stats').innerHTML = statsHTML([
      ['Final score', world.score.toLocaleString('en-US')],
      ['Hearts collected', world.hearts.toLocaleString('en-US')],
      ['Stars earned', total + ' / ' + LEVELS.length * 3],
      ['Best score', save.highScore.toLocaleString('en-US')]
    ]);
    show('ending');
    announce('Together at last. Final score ' + world.score);
  }

  // ---------------------------------------------------------------- update
  const STEP = 1000 / 60;
  let acc = 0, last = performance.now();

  function update() {
    ticks++;
    if (pressed.mute) toggleMute();
    if (pressed.pause) { if (mode === 'play') pauseGame(); else if (mode === 'paused') resumeGame(); }

    if (transition) {
      transition.t++;
      if (transition.phase === 'out' && transition.t >= transition.dur) { const cb = transition.cb; transition.phase = 'in'; transition.t = 0; if (cb) cb(); }
      else if (transition.phase === 'in' && transition.t >= transition.dur) transition = null;
    }

    if (mode === 'title' || mode === 'story') {
      titleCam += 0.35;
      titleWorld.camera.x = 280 + Math.sin(titleCam / 900) * 260;
      titleWorld.frame++;
      titleWorld.player.x = 120; titleWorld.player.y = 224 - 24;
    }

    if (world && (mode === 'play' || mode === 'complete' || mode === 'ending' || mode === 'gameover')) {
      let input = {};
      if (mode === 'play') {
        if (autoplay) { input = autoplay.shift() || {}; if (!autoplay.length) autoplay = null; }
        else input = readInput();
      }
      if (mode === 'play' && !(transition && transition.phase === 'out')) {
        const evs = E.step(world, input);
        handleEvents(evs);
      } else if (mode !== 'play') {
        E.step(world, {});
      }
      updateVisual(input);
      if (world.state === 'complete' && !shown) {
        vis.completeT++;
        if (vis.completeT > 70) showComplete();
      } else if (world.state === 'gameover' && !shown) {
        vis.completeT++;
        if (vis.completeT > 40) showGameOver();
      } else if (world.state === 'ending') {
        updateCutscene();
      }
    }

    updateParticles();
    if (banner) { banner.t++; if (banner.t > 200) banner = null; }
    if (toastMsg) { toastMsg.t++; if (toastMsg.t > 220) toastMsg = null; }
    if (vis.shake > 0) vis.shake--;
    if (vis.flash > 0) vis.flash--;
    for (const k in pressed) pressed[k] = false;
  }

  function updateVisual() {
    const p = world.player;
    vis.sx += (1 - vis.sx) * 0.18; vis.sy += (1 - vis.sy) * 0.18;
    if (p.onGround) vis.runPhase += Math.abs(p.vx) * 0.2;
    if (vis.blink > 0) vis.blink--; else if (Math.random() < 0.006) vis.blink = 7;
    if (p.shield > 0 && ticks % 3 === 0) burst(p.x + p.w / 2 + rnd(-8, 8), p.y + rnd(0, 24), 1, 'spark', { colors: ['#ffffff', '#ffd36e', '#b48cff', '#9fe8ff'], max: 0.5, g: -0.02, lmax: 30 });
  }

  function updateCutscene() {
    const c = cut; if (!c) return;
    c.t++;
    const meet = c.meet;
    if (c.hug < 0) {
      if (c.ax < meet - 6) c.ax = Math.min(meet - 6, c.ax + 0.9);
      if (c.t > 20 && c.tx > meet + 4) c.tx = Math.max(meet + 4, c.tx - 0.8);
      if (c.ax >= meet - 6.01 && c.tx <= meet + 4.01 && c.t > 40) {
        c.hug = c.t; banner = null; toastMsg = null;
        S.sfx('letter'); setTimeout(() => S.sfx('oneup'), 300);
        burst(c.meet + 5, world.player.y + 4, 60, 'heart', { colors: PINKS, max: 4.2, lmax: 90, g: -0.01 });
      }
    } else {
      if ((c.t - c.hug) % 18 === 0) burst(c.meet + 5 + rnd(-30, 30), world.player.y - 20 + rnd(-10, 10), 4, 'heart', { colors: PINKS, max: 1.2, g: -0.03, lmax: 80 });
      if (c.t - c.hug > 170 && !shown) showEnding();
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.98; p.rot += p.vr;
      if (p.life >= p.max) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t++; if (floaters[i].t > 70) floaters.splice(i, 1); }
    // ambient weather
    const w = mode === 'title' || mode === 'story' || !world ? titleWorld : world;
    const kind = A.THEMES[w.level.theme].ambient;
    const want = reduceMQ.matches ? 10 : 28;
    if (ambient.length < want && Math.random() < 0.3) {
      ambient.push({
        x: rnd(-20, VW + 20), y: kind === 'petal' ? -8 : rnd(0, VH), t: 0, max: rnd(260, 520), kind,
        vx: kind === 'petal' ? rnd(-0.6, -0.15) : rnd(-0.15, 0.15), vy: kind === 'petal' ? rnd(0.25, 0.6) : rnd(-0.12, 0.05),
        rot: rnd(0, 6), vr: rnd(-0.04, 0.04), s: rnd(0.7, 1.4), ph: rnd(0, 6)
      });
    }
    for (let i = ambient.length - 1; i >= 0; i--) {
      const a = ambient[i]; a.t++; a.x += a.vx + Math.sin(a.t * 0.03 + a.ph) * 0.2; a.y += a.vy; a.rot += a.vr;
      if (a.t > a.max || a.y > VH + 10 || a.x < -30) ambient.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- render
  function solidAt(L, x, y) { if (y >= L.h) return true; if (x < 0 || x >= L.w) return true; if (y < 0) return false; return E.isSolid(L.grid[y][x]) && L.grid[y][x] !== 'J'; }

  function tileCanvas(theme, ch, mask, variant) {
    return cached('t:' + theme + ch + mask + ':' + variant, T, T, (g) => A.drawSolidTile(g, theme, ch, mask, variant));
  }

  function drawBackground(theme, camX) {
    const sky = cached('sky:' + theme, VW, VH, (g) => A.bgSky(g, theme, VW, VH));
    ctx.drawImage(sky, 0, 0, VW, VH);
    const BW = 960;
    const far = cached('far:' + theme, BW, VH, (g) => A.drawFar(g, theme, BW, VH));
    const mid = cached('mid:' + theme, BW, VH, (g) => A.drawMid(g, theme, BW, VH));
    const fo = -((camX * 0.12) % BW);
    ctx.drawImage(far, fo, 0, BW, VH); ctx.drawImage(far, fo + BW, 0, BW, VH);
    const mo = -((camX * 0.35) % BW);
    ctx.drawImage(mid, mo, 0, BW, VH); ctx.drawImage(mid, mo + BW, 0, BW, VH);
  }

  function drawAmbient(front) {
    for (const a of ambient) {
      if ((a.s > 1.1) !== front) continue;
      const fade = Math.min(1, a.t / 30, (a.max - a.t) / 30);
      ctx.globalAlpha = Math.max(0, fade) * (front ? 0.95 : 0.7);
      if (a.kind === 'petal') A.ellipse(ctx, a.x, a.y, 2.4 * a.s, 1.3 * a.s, a.s > 1.1 ? '#ff9cc4' : '#ffc2dc', a.rot);
      else if (a.kind === 'sparkle') A.sparkle(ctx, a.x, a.y, 1.8 * a.s * (0.6 + 0.4 * Math.sin(a.t * 0.1)), '#ffffff');
      else if (a.kind === 'firefly') { A.glow(ctx, a.x, a.y, 5 * a.s, 'rgba(255,220,140,0.8)'); A.circle(ctx, a.x, a.y, 0.8, '#fff3c4'); }
      else { A.glow(ctx, a.x, a.y, 5 * a.s, 'rgba(170,200,255,0.7)'); A.circle(ctx, a.x, a.y, 0.7, '#e8f0ff'); }
    }
    ctx.globalAlpha = 1;
  }

  function drawTiles(w, camX) {
    const L = w.level, theme = L.theme;
    const x0 = Math.max(0, Math.floor(camX / T) - 1), x1 = Math.min(L.w - 1, Math.floor((camX + VW) / T) + 1);
    for (let ty = 0; ty < L.h; ty++) {
      const row = L.grid[ty];
      for (let tx = x0; tx <= x1; tx++) {
        const ch = row[tx];
        if (ch === '.') continue;
        const px = tx * T, py = ty * T;
        if (ch === '#' || ch === 'B') {
          const mask = (solidAt(L, tx, ty - 1) ? 0 : 1) | (solidAt(L, tx - 1, ty) ? 0 : 2) | (solidAt(L, tx + 1, ty) ? 0 : 4) | (solidAt(L, tx, ty + 1) ? 0 : 8);
          ctx.drawImage(tileCanvas(theme, ch, mask, Math.floor(A.hash(tx, ty) * 4)), px, py, T, T);
        } else if (ch === '=') {
          ctx.drawImage(cached('ow:' + theme + (tx % 2), T, T, (g) => A.drawOneWay(g, theme, tx % 2)), px, py, T, T);
        } else if (ch === '^') {
          ctx.drawImage(cached('th:' + theme, T, T, (g) => A.drawThorns(g, theme)), px, py, T, T);
        } else if (ch === 'J') {
          A.drawSpring(ctx, px, py, ticks, w.springs[tx + ',' + ty] || 0);
        } else {
          A.drawDecor(ctx, theme, ch, px, py, ticks);
        }
      }
    }
  }

  function heroPose(w) {
    const p = w.player;
    let state = 'idle';
    if (p.dead) state = 'hurt';
    else if (!p.onGround) state = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 0.25) state = 'run';
    return {
      t: ticks, state: state === 'hurt' ? 'fall' : state, run: vis.runPhase, facing: p.facing, sx: vis.sx, sy: vis.sy,
      blink: vis.blink > 0, hurt: p.dead || p.invuln > PHYS_INV - 20, shoot: p.shooting > 0, look: w.lastInput && w.lastInput.up, bow: p.bow
    };
  }
  const PHYS_INV = E.PHYS.invuln;

  function drawWorld(w) {
    const L = w.level;
    let camX = w.camera.x;
    let sx = 0, sy = 0;
    if (vis.shake > 0 && !reduceMQ.matches) { sx = rnd(-1, 1) * vis.shake * 0.25; sy = rnd(-1, 1) * vis.shake * 0.25; }
    if (cut) { const target = Math.min(L.w * T - VW, Math.max(0, (cut.ax + cut.tx) / 2 - VW / 2)); w.camera.x += (target - w.camera.x) * 0.05; camX = w.camera.x; }
    const cr = Math.round((camX + sx) * K) / K;
    drawBackground(L.theme, cr);
    drawAmbient(false);
    let zoom = 1;
    if (cut && cut.hug >= 0) {
      const k = Math.min(1, (cut.t - cut.hug) / 90);
      zoom = 1 + 0.9 * (reduceMQ.matches ? 1 : k * k * (3 - 2 * k));
      const zx = cut.meet + 5 - cr, zy = w.player.y + w.player.h - 22;
      ctx.save(); ctx.translate(zx, zy); ctx.scale(zoom, zoom); ctx.translate(-zx, -zy);
    }
    // depth haze so gaps read as drops
    ctx.drawImage(cached('haze:' + L.theme, VW, 70, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 70);
      const c = L.theme === 'sky' ? '255,236,248' : L.theme === 'garden' ? '70,20,60' : '10,4,28';
      gr.addColorStop(0, 'rgba(' + c + ',0)'); gr.addColorStop(1, 'rgba(' + c + ',0.85)');
      g.fillStyle = gr; g.fillRect(0, 0, VW, 70);
    }), 0, VH - 70, VW, 70);
    ctx.save();
    ctx.translate(-cr, Math.round(sy * K) / K);
    drawTiles(w, cr);
    const t = ticks;
    // gate, lanterns, items
    if (L.goal) A.drawGate(ctx, L.goal, t, w.gateOpen, L.theme);
    for (const c of L.checkpoints) A.drawCheckpoint(ctx, c, t);
    for (const it of L.items) {
      if (it.taken || it.x + 20 < cr || it.x - 20 > cr + VW) continue;
      if (it.type === 'heart') A.drawHeartItem(ctx, it, t);
      else if (it.type === 'letter') A.drawLetter(ctx, it, t);
      else A.drawPowerItem(ctx, it, t);
    }
    // sweetheart waits beyond the gate
    if (L.sweetheart) {
      const sh = L.sweetheart;
      const hugging = cut && cut.hug >= 0;
      const tx = cut ? cut.tx : sh.x;
      const walking = cut && cut.hug < 0 && cut.t > 20 && cut.tx > cut.meet + 4.01;
      if (!hugging) A.drawSweetheart(ctx, tx + sh.w / 2, sh.y + sh.h, { t, facing: -1, state: walking ? 'run' : 'idle', run: t * 0.25, offer: !!cut, blink: (t % 190) < 6 });
    }
    // creatures
    for (const e of L.enemies) {
      if (e.x + 30 < cr || e.x - 30 > cr + VW) continue;
      if (!e.alive && e.cheerT >= 90) continue;
      if (e.type === 'bramble') A.drawBramble(ctx, e, t + e.id * 9);
      else if (e.type === 'cloud') A.drawCloud(ctx, e, t);
      else A.drawBat(ctx, e, t + e.id * 13);
    }
    if (w.boss && (w.boss.active || !w.boss.cheered) && !(w.boss.cheered && w.boss.gone > 200)) {
      if (w.boss.active || Math.abs(w.boss.x - cr - VW / 2) < VW) A.drawBoss(ctx, w.boss, t);
    }
    for (const d of w.drops) A.drawDrop(ctx, d);
    for (const a of w.arrows) A.drawArrow(ctx, a);
    // heroine
    drawHeroineInWorld(w);
    // particles
    for (const p of particles) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 'heart') A.heart(ctx, p.x, p.y, p.size * 1.6 * (0.6 + k * 0.4), p.color);
      else if (p.kind === 'spark') A.sparkle(ctx, p.x, p.y, p.size * k + 0.5, p.color);
      else A.circle(ctx, p.x, p.y, p.size * 0.6 * (1.2 - k * 0.5), p.color);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, (70 - f.t) / 20);
      text(f.text, f.x, f.y - f.t * 0.4, 9, f.color, 'center');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (zoom !== 1) ctx.restore();
    drawAmbient(true);
  }

  function drawHeroineInWorld(w) {
    const p = w.player;
    if (cut) {
      const hugging = cut.hug >= 0;
      const sh = w.level.sweetheart;
      const feetY = p.y + p.h;
      if (hugging) {
        const k = Math.min(1, (cut.t - cut.hug) / 40);
        A.glow(ctx, cut.meet + 5, feetY - 18, 30 + k * 40, 'rgba(255,140,190,0.55)');
        A.heart(ctx, cut.meet + 5, feetY - 44 - k * 4, 10 + k * 16, 'rgba(255,61,127,' + (0.25 + k * 0.65) + ')');
        A.heart(ctx, cut.meet + 4.5, feetY - 45 - k * 4, 5 + k * 7, 'rgba(255,209,227,' + (0.2 + k * 0.6) + ')');
        A.drawSweetheart(ctx, cut.meet + 10, sh.y + sh.h, { t: ticks, facing: -1, hug: true });
        A.drawHeroine(ctx, cut.meet, feetY, { t: ticks, facing: 1, hug: true, state: 'idle' });
      } else {
        A.drawHeroine(ctx, cut.ax + p.w / 2, feetY, { t: ticks, facing: 1, state: cut.ax < cut.meet - 6.01 ? 'run' : 'idle', run: ticks * 0.28 });
      }
      return;
    }
    if (w.state === 'complete') { // step into the glowing gate
      const k = Math.min(1, vis.completeT / 40);
      ctx.globalAlpha = 1 - k;
      A.drawHeroine(ctx, p.x + p.w / 2 + k * 10, p.y + p.h, { t: ticks, facing: 1, state: 'run', run: ticks * 0.25 });
      ctx.globalAlpha = 1;
      return;
    }
    const flicker = p.invuln > 0 && !p.dead && Math.floor(p.invuln / 4) % 2 === 0;
    if (p.shield > 0) {
      const a = p.shield < 120 ? (Math.floor(p.shield / 6) % 2 ? 0.25 : 0.6) : 0.6;
      A.glow(ctx, p.x + p.w / 2, p.y + p.h / 2, 24, 'rgba(200,170,255,' + a + ')');
      ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2 - 2, 17, 0, Math.PI * 2); ctx.stroke();
    }
    if (!flicker) {
      ctx.globalAlpha = 1;
      A.drawHeroine(ctx, p.x + p.w / 2, p.y + p.h, heroPose(w));
    }
    if (p.bow && !p.dead) A.drawBowItem(ctx, p.x + p.w / 2 - p.facing * 5, p.y + 13, ticks, 0.5);
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.font = (weight || '800') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.32);
    ctx.strokeStyle = 'rgba(42,18,64,0.9)'; ctx.strokeText(str, x, y);
    ctx.fillStyle = color || '#fff'; ctx.fillText(str, x, y);
  }

  function drawHUD(w) {
    const p = w.player;
    // left glass pill
    ctx.fillStyle = 'rgba(30,10,52,0.55)'; A.rr(ctx, 6, 6, 196, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,236,0.35)'; ctx.lineWidth = 0.7; A.rr(ctx, 6, 6, 196, 22, 11); ctx.stroke();
    // lives: a tiny portrait
    A.circle(ctx, 18, 17, 7, '#ffe0cf');
    ctx.fillStyle = A.C.hair; ctx.beginPath(); ctx.arc(18, 16, 7.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    A.ellipse(ctx, 13, 11.5, 2.4, 1.6, A.C.rose, -0.6);
    A.circle(ctx, 16, 18, 0.9, A.C.ink); A.circle(ctx, 20, 18, 0.9, A.C.ink);
    text('×' + w.lives, 27, 17.5, 9, '#fff');
    // health hearts
    for (let i = 0; i < E.PHYS.hp; i++) {
      const on = i < p.hp;
      A.heart(ctx, 50 + i * 11, 17, 10, on ? '#ff3d7f' : 'rgba(255,255,255,0.18)');
      if (on) A.ellipse(ctx, 48.2 + i * 11, 14.6, 1.3, 0.8, 'rgba(255,255,255,0.8)', -0.6);
    }
    // heart count
    A.heart(ctx, 92, 17, 10, '#ff7aa6'); A.heart(ctx, 91.5, 16.5, 5, '#ffd1e3');
    text(String(w.hearts), 100, 17.5, 9, '#ffd1e3');
    // letters
    for (let i = 0; i < 3; i++) {
      const x = 134 + i * 20, on = w.letters[i];
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.fillStyle = on ? '#fff7fb' : '#d9c6e6'; A.rr(ctx, x, 11, 15, 11, 2); ctx.fill();
      ctx.strokeStyle = on ? '#e7a6c4' : '#a991b8'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, 11.5); ctx.lineTo(x + 7.5, 17.5); ctx.lineTo(x + 15, 11.5); ctx.stroke();
      A.heart(ctx, x + 7.5, 17.6, 5, on ? '#e8264f' : '#8d7aa0');
      ctx.globalAlpha = 1;
    }
    // right pill: score and time
    ctx.fillStyle = 'rgba(30,10,52,0.55)'; A.rr(ctx, VW - 150, 6, 100, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,236,0.35)'; A.rr(ctx, VW - 150, 6, 100, 22, 11); ctx.stroke();
    text(String(w.score).padStart(6, '0'), VW - 142, 17.5, 9, '#ffd36e');
    const secs = Math.floor(w.time / 60);
    text(E.formatTime(secs), VW - 58, 17.5, 9, secs > w.level.par ? '#ffb3c8' : '#fff', 'right');
    // power-ups
    let px = 12;
    if (p.bow) { ctx.fillStyle = 'rgba(30,10,52,0.55)'; A.rr(ctx, 6, 32, 30, 18, 9); ctx.fill(); A.drawBowItem(ctx, 21, 41, ticks, 0.75); px = 42; }
    if (p.shield > 0) {
      ctx.fillStyle = 'rgba(30,10,52,0.55)'; A.rr(ctx, px - 6, 32, 54, 18, 9); ctx.fill();
      A.sparkle(ctx, px + 4, 41, 4, '#fff');
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; A.rr(ctx, px + 12, 38.5, 30, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#c7a6ff'; A.rr(ctx, px + 12, 38.5, 30 * p.shield / E.PHYS.shieldTime, 5, 2.5); ctx.fill();
    }
    // boss mood bar
    const b = w.boss;
    if (b && b.active && !b.cheered) {
      const bw = 170, bx = VW / 2 - bw / 2, by = 36;
      text("King Grumblecloud's mood", VW / 2, by - 3, 8, '#ffd1e3', 'center');
      ctx.fillStyle = 'rgba(30,10,52,0.7)'; A.rr(ctx, bx, by + 3, bw, 9, 4.5); ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#8f86b8'); g.addColorStop(1, '#ff5c9a');
      ctx.fillStyle = g; A.rr(ctx, bx + 1.5, by + 4.5, Math.max(6, (bw - 3) * b.cheer / b.need), 6, 3); ctx.fill();
      A.heart(ctx, bx + bw + 8, by + 7.5, 10, b.cheer / b.need > 0.5 ? '#ff3d7f' : '#8f86b8');
    }
  }

  function drawBanner() {
    if (!banner) return;
    const t = banner.t;
    const k = t < 20 ? t / 20 : t > 170 ? Math.max(0, (200 - t) / 30) : 1;
    const ease = 1 - Math.pow(1 - k, 3);
    const y = (banner.y || 78) - (1 - ease) * 20;
    ctx.globalAlpha = ease;
    const g = ctx.createLinearGradient(VW / 2 - 140, 0, VW / 2 + 140, 0);
    g.addColorStop(0, 'rgba(255,92,154,0)'); g.addColorStop(0.2, 'rgba(255,92,154,0.85)'); g.addColorStop(0.8, 'rgba(180,140,255,0.85)'); g.addColorStop(1, 'rgba(180,140,255,0)');
    ctx.fillStyle = g; ctx.fillRect(VW / 2 - 160, y - 18, 320, 40);
    ctx.fillStyle = 'rgba(255,211,110,0.9)'; ctx.fillRect(VW / 2 - 120, y - 18, 240, 1); ctx.fillRect(VW / 2 - 120, y + 21, 240, 1);
    text(banner.title, VW / 2, y - 5, 15, '#fff6d6', 'center', '900');
    text(banner.sub, VW / 2, y + 11, 9, '#fff', 'center');
    A.heart(ctx, VW / 2 - 132, y + 1, 10, '#ffd36e'); A.heart(ctx, VW / 2 + 132, y + 1, 10, '#ffd36e');
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    if (!toastMsg) return;
    const t = toastMsg.t, k = Math.min(1, t / 12, (220 - t) / 20);
    ctx.globalAlpha = Math.max(0, k);
    ctx.font = '800 9px ' + FONT;
    const w = ctx.measureText(toastMsg.text).width + 26;
    ctx.fillStyle = 'rgba(30,10,52,0.78)'; A.rr(ctx, VW / 2 - w / 2, VH - 30, w, 20, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,110,0.6)'; ctx.lineWidth = 0.8; A.rr(ctx, VW / 2 - w / 2, VH - 30, w, 20, 10); ctx.stroke();
    text(toastMsg.text, VW / 2, VH - 19.5, 9, '#fff', 'center');
    ctx.globalAlpha = 1;
  }

  function drawTransition() {
    if (!transition) return;
    const tr = transition, k = tr.t / tr.dur;
    const amount = tr.phase === 'out' ? k : 1 - k; // 0 = open, 1 = closed
    if (reduceMQ.matches) { ctx.fillStyle = 'rgba(26,11,46,' + amount + ')'; ctx.fillRect(0, 0, VW, VH); return; }
    const size = (1 - amount) * 900;
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath(); ctx.rect(0, 0, VW, VH);
    if (size > 1) { A.heartPath(ctx, VW / 2, VH / 2 + size * 0.05, size); }
    ctx.fill('evenodd');
    if (amount > 0.98) { A.heart(ctx, VW / 2, VH / 2, 18, '#ff5c9a'); }
  }

  function render() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const w = world || titleWorld;
    if (!world) {
      drawBackground(titleWorld.level.theme, titleWorld.camera.x);
      drawAmbient(false);
      ctx.save(); ctx.translate(-Math.round(titleWorld.camera.x * K) / K, 0);
      drawTiles(titleWorld, titleWorld.camera.x);
      for (const it of titleWorld.level.items) if (it.type === 'heart') A.drawHeartItem(ctx, it, ticks);
      ctx.restore();
      drawAmbient(true);
      // the couple on the title screen
      const gx = VW * 0.74, gy = 224;
      A.glow(ctx, gx, gy - 30, 70, 'rgba(255,170,210,0.45)');
      A.heart(ctx, gx, gy - 58 + Math.sin(ticks * 0.05) * 2, 26, 'rgba(255,61,127,0.85)');
      A.heart(ctx, gx - 1, gy - 59 + Math.sin(ticks * 0.05) * 2, 13, 'rgba(255,209,227,0.9)');
      A.drawHeroine(ctx, gx - 9, gy, { t: ticks, facing: 1, state: 'idle', blink: (ticks % 200) < 6 });
      A.drawSweetheart(ctx, gx + 10, gy, { t: ticks, facing: -1, state: 'idle', offer: true, blink: (ticks % 230) < 6 });
    } else {
      drawWorld(w);
      if (mode !== 'title' && !cut) drawHUD(w);
      drawBanner();
      drawToast();
      if (vis.flash > 0) { ctx.fillStyle = 'rgba(255,90,140,' + vis.flash / 40 + ')'; ctx.fillRect(0, 0, VW, VH); }
      // soft vignette
      const vg = cached('vignette', VW, VH, (g) => { const gr = g.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,0,30,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); });
      ctx.drawImage(vg, 0, 0, VW, VH);
    }
    drawTransition();
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = now - last; last = now;
    if (dt > 250) dt = 250;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) { update(); acc -= STEP; n++; }
    if (n >= 5) acc = 0;
    render();
  }

  // ---------------------------------------------------------------- buttons
  function on(id, fn) { $(id).addEventListener('click', () => { S.init(); S.sfx('ui'); fn(); }); }
  on('#btn-start', () => { mode = 'story'; show('story'); });
  on('#btn-story-go', () => fadeTo(() => startLevel(0, true)));
  on('#btn-continue', () => fadeTo(() => startLevel(Math.min(save.unlocked, LEVELS.length) - 1, true)));
  on('#btn-levels', () => { backTo = 'title'; buildLevelGrid(); show('levels'); });
  on('#btn-howto', () => { backTo = 'title'; show('howto'); });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { S.sfx('ui'); if (backTo === 'pause') show('pause'); else if (backTo === 'complete') show('complete'); else goTitle(); }));
  on('#btn-resume', resumeGame);
  on('#btn-restart', () => { S.resume(); run = Object.assign({}, levelStart); const i = world.index; fadeTo(() => startLevel(i, false)); mode = 'play'; show(null); });
  on('#btn-pause-levels', () => { S.resume(); backTo = 'pause'; buildLevelGrid(); show('levels'); });
  on('#btn-quit', () => { S.resume(); fadeTo(goTitle); });
  on('#btn-next', () => { const i = world.index + 1; fadeTo(() => startLevel(i, false)); });
  on('#btn-replay', () => { run = Object.assign({}, levelStart); const i = world.index; fadeTo(() => startLevel(i, false)); });
  on('#btn-complete-levels', () => { backTo = 'complete'; buildLevelGrid(); show('levels'); });
  on('#btn-retry', () => { run = { lives: 3, score: levelStart.score, hearts: levelStart.hearts }; const i = world.index; fadeTo(() => startLevel(i, false)); });
  on('#btn-over-title', () => fadeTo(goTitle));
  on('#btn-again', () => fadeTo(() => startLevel(0, true)));
  on('#btn-end-levels', () => { backTo = 'title'; buildLevelGrid(); show('levels'); });
  $('#btn-pause').addEventListener('click', () => pauseGame());
  $('#btn-sound').addEventListener('click', () => { S.init(); toggleMute(); });
  $('#opt-music').addEventListener('change', (e) => { save.settings.music = e.target.checked; S.setMusic(save.settings.music); writeSave(); updateSoundBtn(); });
  $('#opt-sound').addEventListener('change', (e) => { save.settings.sound = e.target.checked; S.setSound(save.settings.sound); writeSave(); updateSoundBtn(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('pointerdown', () => { S.init(); if (!S.current && (mode === 'title' || mode === 'story')) S.playMusic('love', 0); }, { once: true });
  window.addEventListener('keydown', () => { if (!S.current && (mode === 'title' || mode === 'story')) S.playMusic('love', 0); }, { once: true });

  // ---------------------------------------------------------------- test hooks (used by the automated browser tests)
  window.__LL = {
    get mode() { return mode; }, get world() { return world; }, get save() { return save; }, get K() { return K; },
    levels: LEVELS, engine: E,
    start(i, opts) { startLevel(i, true); if (opts) { if (opts.noEnemies) world.level.enemies.length = 0; if (opts.god) world.opts.god = true; } return true; },
    autoplay(inputs) { autoplay = inputs.slice(); },
    get autoplaying() { return !!autoplay; },
    finishNow() { E.finishLevel(world); handleEvents(world.events); },
    pause: pauseGame, resume: resumeGame, title: goTitle, showEnding,
    particles: () => particles.length, transition: () => !!transition,
    get vis() { return vis; }, get ticks() { return ticks; }
  };

  // ---------------------------------------------------------------- boot
  resize();
  goTitle();
  requestAnimationFrame((t) => { last = t; loop(t); });
})();
