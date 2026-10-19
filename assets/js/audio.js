/* Lovelight Leap - sound
 * All sound effects and music are synthesized live with the Web Audio API.
 * The songs are original compositions stored as note strings below.
 * © 2026 Rishabh Aryan - MIT License
 */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let sfxOn = true, musicOn = true;
  let song = null, songName = null, transpose = 0, step = 0, nextTime = 0, timer = null;

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name, tr) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12 + (tr || 0);
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.42 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
  }

  // ---------- building blocks ----------
  function tone(type, f0, f1, dur, vol, when, bus, attack) {
    if (!ctx) return;
    const t = (when || ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, when, filterFreq, bus, type) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = filterFreq || 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function seq(notes, type, gap, dur, vol, tr) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    notes.forEach((n, i) => { if (n) tone(type, freq(n, tr), 0, dur, vol, t0 + i * gap); });
  }

  // ---------- sound effects ----------
  const SFX = {
    jump: () => tone('square', 320, 720, 0.13, 0.12),
    land: () => noise(0.06, 0.08, 0, 400, null, 'lowpass'),
    heart: () => { seq(['E6', 'B6'], 'triangle', 0.055, 0.12, 0.2); },
    letter: () => { seq(['C6', 'E6', 'G6', 'C7', 'E7'], 'triangle', 0.06, 0.22, 0.22); seq(['G7', null, 'C8'], 'sine', 0.09, 0.2, 0.06); },
    cheer: () => { tone('sine', 620, 240, 0.16, 0.22); setTimeout(() => seq(['G5', 'C6', 'E6'], 'triangle', 0.045, 0.1, 0.15), 60); },
    hurt: () => { tone('square', 520, 140, 0.32, 0.14); tone('sawtooth', 300, 90, 0.25, 0.05); },
    die: () => seq(['G5', 'E5', 'C5', 'A4', 'F4'], 'square', 0.11, 0.18, 0.11),
    shoot: () => { tone('triangle', 900, 1500, 0.09, 0.15); noise(0.08, 0.05, 0, 5000, null, 'highpass'); },
    arrowPop: () => tone('sine', 900, 500, 0.06, 0.08),
    powerup: () => seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 'square', 0.045, 0.12, 0.09),
    checkpoint: () => { seq(['A5', 'E6', 'A6'], 'triangle', 0.08, 0.35, 0.2); },
    spring: () => tone('sine', 180, 980, 0.28, 0.25),
    bump: () => tone('square', 160, 120, 0.06, 0.08),
    rain: () => tone('sine', 1800, 1200, 0.05, 0.03),
    splash: () => noise(0.05, 0.03, 0, 3000),
    bossHit: () => { seq(['C6', 'G6'], 'square', 0.04, 0.08, 0.1); },
    bossStart: () => seq(['A4', 'C5', 'E5', 'A5'], 'sawtooth', 0.09, 0.2, 0.07),
    bossCheered: () => seq(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6', 'G6', 'C7'], 'square', 0.07, 0.25, 0.1),
    complete: () => { seq(['C5', 'E5', 'G5', 'C6', null, 'G5', 'C6', 'E6'], 'square', 0.09, 0.22, 0.1); seq(['C4', null, null, 'G4', null, null, 'C5'], 'triangle', 0.12, 0.3, 0.2); },
    oneup: () => seq(['E6', 'G6', 'E7', 'C7', 'D7', 'G7'], 'triangle', 0.07, 0.15, 0.18),
    gameover: () => seq(['C5', 'B4', 'Bb4', 'A4', null, 'F4', 'E4', 'C4'], 'triangle', 0.16, 0.35, 0.2),
    gateLocked: () => tone('sawtooth', 140, 110, 0.25, 0.06),
    shieldEnd: () => tone('sine', 900, 300, 0.25, 0.08),
    ui: () => tone('triangle', 660, 880, 0.07, 0.12),
    pause: () => seq(['E5', 'C5'], 'triangle', 0.06, 0.1, 0.14)
  };
  function sfx(name) { if (!ctx || !sfxOn) return; const f = SFX[name]; if (f) f(); }

  // ---------- music (original songs) ----------
  // one token per 16th note: a note starts it, '-' holds it, '.' is silence
  const SONGS = {
    level: {
      bpm: 128,
      chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
      lead: [
        'E5 - G5 - C6 - - - B5 - A5 - G5 - - -',
        'A5 - - - E5 - C5 - E5 - A5 - G5 - - -',
        'F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -',
        'D5 - G5 - - - B5 - D6 - - - . . . .',
        'E6 - D6 - C6 - G5 - E5 - G5 - C6 - - -',
        'B5 - A5 - E5 - A5 - C6 - B5 - A5 - - -',
        'F5 - E5 - D5 - F5 - A5 - G5 - F5 - D5 -',
        'G5 - B5 - D6 - - - C6 - - - . . . .'
      ],
      drums: true, arp: true
    },
    love: {
      bpm: 84,
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'],
      lead: [
        'A5 - - - C6 - - - F5 - - - A5 - G5 -',
        'F5 - - - D5 - - - F5 - A5 - D6 - - -',
        'D6 - C6 - Bb5 - - - F5 - - - D5 - F5 -',
        'E5 - - - G5 - - - C6 - - - . . . .',
        'C6 - - - A5 - C6 - F6 - - - E6 - D6 -',
        'C6 - - - A5 - - - E5 - A5 - C6 - - -',
        'Bb5 - A5 - G5 - - - F5 - G5 - A5 - - -',
        'G5 - - - E5 - - - F5 - - - . . . .'
      ],
      drums: false, arp: true
    },
    boss: {
      bpm: 150,
      chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E'],
      lead: [
        'A5 . A5 . C6 . A5 . E6 - - - D6 - C6 -',
        'C6 . A5 . F5 . A5 . C6 - - - B5 - A5 -',
        'B5 . G5 . D5 . G5 . B5 - D6 - G6 - - -',
        'G#5 - - - B5 - - - E6 - - - . . E5 .',
        'A5 . A5 . C6 . A5 . E6 - - - D6 - C6 -',
        'C6 . A5 . F5 . A5 . C6 - - - B5 - A5 -',
        'B5 . G5 . D5 . G5 . B5 - D6 - G6 - - -',
        'E6 - D6 - C6 - B5 - G#5 - - - . . . .'
      ],
      drums: true, arp: true, drive: true
    }
  };
  const CHORD = {
    C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Dm: ['D', 'F', 'A'],
    Bb: ['Bb', 'D', 'F'], E: ['E', 'G#', 'B']
  };

  function compile(def) {
    const lead = [];
    def.lead.forEach((bar) => bar.split(/\s+/).forEach((tok) => lead.push(tok)));
    return { def, lead, steps: lead.length };
  }

  function scheduleStep(s, t) {
    const def = song.def, dur = 60 / def.bpm / 4;
    const bar = Math.floor(s / 16) % def.chords.length, inBar = s % 16;
    const ch = CHORD[def.chords[bar]];
    const tok = song.lead[s % song.steps];
    if (tok !== '-' && tok !== '.') {
      let len = 1; while (song.lead[(s + len) % song.steps] === '-' && len < 16) len++;
      tone('square', freq(tok, transpose), 0, dur * len * 0.92, 0.085, t, musicBus, 0.01);
      tone('triangle', freq(tok, transpose + 12), 0, dur * len * 0.6, 0.03, t, musicBus, 0.01);
    }
    // bass
    const root = ch[0] + '2', fifth = ch[2] + (ch[2] < ch[0] || 'CDE'.includes(ch[2][0]) ? '3' : '2');
    if (def.drive) { if (inBar % 2 === 0) tone('triangle', freq(inBar % 4 === 0 ? root : ch[0] + '3', transpose), 0, dur * 1.6, 0.32, t, musicBus); }
    else if (inBar === 0 || inBar === 8) tone('triangle', freq(root, transpose), 0, dur * 3.5, 0.34, t, musicBus);
    else if (inBar === 6 || inBar === 14) tone('triangle', freq(fifth, transpose), 0, dur * 1.8, 0.26, t, musicBus);
    // arpeggio
    if (def.arp && inBar % 2 === 0) {
      const n = ch[(inBar / 2) % 3] + (inBar % 8 < 4 ? '4' : '5');
      tone('triangle', freq(n, transpose), 0, dur * 1.2, 0.05, t, musicBus);
    }
    // drums
    if (def.drums) {
      if (inBar % 2 === 0) noise(0.03, 0.05, t, 8000, musicBus, 'highpass');
      if (inBar === 0 || inBar === 8 || (def.drive && inBar === 10)) tone('sine', 150, 45, 0.14, 0.5, t, musicBus);
      if (inBar === 4 || inBar === 12) noise(0.12, 0.16, t, 1800, musicBus);
    }
  }

  function tick() {
    if (!ctx || !song) return;
    const dur = 60 / song.def.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      if (musicOn) scheduleStep(step, nextTime);
      nextTime += dur; step++;
    }
  }

  function playMusic(name, tr) {
    if (!ctx) return;
    if (songName === name && transpose === (tr || 0) && timer) return;
    stopMusic();
    songName = name; transpose = tr || 0;
    song = compile(SONGS[name]);
    step = 0; nextTime = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25);
  }
  function stopMusic() { if (timer) clearInterval(timer); timer = null; song = null; songName = null; }

  function setSound(on) { sfxOn = !!on; if (sfxBus) sfxBus.gain.value = sfxOn ? 1 : 0; }
  function setMusic(on) { musicOn = !!on; if (musicBus) musicBus.gain.value = musicOn ? 0.42 : 0; }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  root.LLAudio = {
    init, sfx, playMusic, stopMusic, setSound, setMusic, suspend, resume, freq,
    get ready() { return !!ctx; }, get current() { return songName; }, SONGS
  };
})(typeof self !== 'undefined' ? self : this);
