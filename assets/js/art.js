/* Lovelight Leap - art
 * Every picture in the game is drawn here with canvas paths: the heroine,
 * her sweetheart, the creatures, tiles, items and parallax backgrounds.
 * No image files are used.
 * © 2026 Rishabh Aryan - MIT License
 */
(function (root) {
  'use strict';
  const T = 16;
  const TAU = Math.PI * 2;

  // ---------- palette ----------
  const C = {
    pink: '#ff5c9a', pinkL: '#ff9cc4', pinkD: '#d93a78', rose: '#ff3d7f', lilac: '#b48cff', lilacD: '#8a62e0',
    gold: '#ffd36e', goldD: '#e8a93c', cream: '#fff7fb', skin: '#ffe0cf', skinS: '#f6c2ad', hair: '#5a2e2a', hairL: '#8c4a3a',
    ink: '#3a1f4a', white: '#ffffff', plum: '#2a1240'
  };

  // ---------- shape helpers ----------
  function heartPath(ctx, x, y, s) { // centred heart, s = width
    const h = s * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.9);
    ctx.bezierCurveTo(x - h * 1.25, y + h * 0.05, x - h * 0.95, y - h * 1.05, x, y - h * 0.38);
    ctx.bezierCurveTo(x + h * 0.95, y - h * 1.05, x + h * 1.25, y + h * 0.05, x, y + h * 0.9);
    ctx.closePath();
  }
  function heart(ctx, x, y, s, fill) { heartPath(ctx, x, y, s); ctx.fillStyle = fill; ctx.fill(); }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function ellipse(ctx, x, y, rx, ry, fill, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function sparkle(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fillStyle = fill; ctx.fill();
  }
  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // =====================================================================
  // HEROINE: Amara. Feet at (0,0), drawn facing right, about 30px tall.
  // pose: { t, state, run, facing, sx, sy, blink, shoot, bow, hug, look }
  // =====================================================================
  function drawHeroine(ctx, x, y, pose) {
    const t = pose.t || 0, st = pose.state || 'idle';
    const run = st === 'run' ? Math.sin(pose.run || 0) : 0;
    const air = st === 'jump' || st === 'fall';
    const breathe = st === 'idle' ? Math.sin(t * 0.08) * 0.4 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((pose.facing || 1) * (pose.sx || 1), pose.sy || 1);
    const bob = st === 'run' ? -Math.abs(Math.sin(pose.run || 0)) * 1.2 : 0;
    ctx.translate(0, bob);

    // flowing ponytail and cape behind her
    const sway = Math.sin(t * 0.12) * 1.2 + (st === 'run' ? -2.5 : 0) + (st === 'jump' ? 2 : st === 'fall' ? -3 : 0);
    ctx.fillStyle = C.lilac;
    ctx.beginPath();
    ctx.moveTo(-2.5, -22); ctx.quadraticCurveTo(-7 + sway * 0.5, -16, -8 + sway, -10.5 + Math.sin(t * 0.2) * 0.8);
    ctx.lineTo(-3, -12); ctx.lineTo(1.5, -21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.lilacD;
    ctx.beginPath(); ctx.moveTo(-2.5, -22); ctx.quadraticCurveTo(-6 + sway * 0.4, -16, -8 + sway, -10.5); ctx.lineTo(-6.5 + sway, -10.8); ctx.quadraticCurveTo(-4.5, -16, -1.5, -21); ctx.fill();

    ctx.fillStyle = C.hair;
    ctx.beginPath();
    ctx.moveTo(-3.5, -31);
    ctx.bezierCurveTo(-9 + sway * 0.3, -30, -10 + sway, -24, -9.5 + sway * 1.3, -17 + breathe);
    ctx.bezierCurveTo(-8 + sway, -19, -6, -22, -3, -24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hairL;
    ctx.beginPath(); ctx.moveTo(-5, -29); ctx.quadraticCurveTo(-8 + sway * 0.6, -25, -8.6 + sway * 1.1, -19.5); ctx.lineTo(-7.6 + sway, -20); ctx.quadraticCurveTo(-6.8, -25, -4.4, -28.6); ctx.fill();

    // legs (white tights, plum boots)
    const legA = air ? (st === 'jump' ? -0.5 : 0.35) : run * 0.75;
    const legB = air ? (st === 'jump' ? 0.25 : -0.25) : -run * 0.75;
    function leg(a, back) {
      ctx.save(); ctx.translate(back ? -1.2 : 1, -10.5); ctx.rotate(a);
      ctx.fillStyle = back ? '#eadcf3' : '#fdf2f8'; rr(ctx, -1.4, 0, 2.8, 8.2, 1.3); ctx.fill();
      ctx.fillStyle = back ? '#5d2d82' : '#7b3fa0'; rr(ctx, -1.7, 6.6, 4.3, 3.6, 1.6); ctx.fill();
      ctx.fillStyle = '#c38ee6'; ctx.fillRect(-1.5, 6.8, 3.6, 0.7);
      ctx.restore();
    }
    leg(legB, true); leg(legA, false);

    // back arm
    const armSwing = st === 'run' ? -run * 0.8 : air ? -1.9 : 0.15 + breathe * 0.05;
    ctx.save(); ctx.translate(-1, -21); ctx.rotate(armSwing);
    ctx.fillStyle = C.pinkD; rr(ctx, -1.3, 0, 2.6, 7, 1.3); ctx.fill();
    circle(ctx, 0, 7.3, 1.3, C.skinS); ctx.restore();

    // skirt (A-line, flares when moving)
    const flare = air ? 2.2 : Math.abs(run) * 1.2;
    const sg = ctx.createLinearGradient(0, -17, 0, -8);
    sg.addColorStop(0, '#ff6fae'); sg.addColorStop(1, '#ff8fc4');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-3.5, -17.5); ctx.lineTo(3.8, -17.5);
    ctx.quadraticCurveTo(6 + flare, -12, 6.8 + flare, -8.6);
    ctx.quadraticCurveTo(0.2, -6.8 - flare * 0.3, -6.4 - flare, -8.6);
    ctx.quadraticCurveTo(-5.5 - flare, -12, -3.5, -17.5);
    ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-6.2 - flare, -8.9); ctx.quadraticCurveTo(0.2, -7.1 - flare * 0.3, 6.6 + flare, -8.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,40,110,0.35)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0.3, -17); ctx.lineTo(0.3 + flare * 0.2, -8); ctx.moveTo(-2.5, -16.5); ctx.lineTo(-4 - flare * 0.5, -8.6); ctx.moveTo(3, -16.5); ctx.lineTo(4.4 + flare * 0.5, -8.6); ctx.stroke();

    // bodice / jacket
    const jg = ctx.createLinearGradient(-4, -24, 4, -16);
    jg.addColorStop(0, '#ff4f8f'); jg.addColorStop(1, '#ff3d7f');
    ctx.fillStyle = jg; rr(ctx, -3.8, -23.6, 7.8, 7, 2.2); ctx.fill();
    ctx.fillStyle = C.cream; // collar
    ctx.beginPath(); ctx.moveTo(-2.5, -23.6); ctx.lineTo(0.2, -21.4); ctx.lineTo(3, -23.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold; ctx.fillRect(-3.8, -17.6, 7.8, 1.1); // belt
    heart(ctx, 1.6, -19.8, 2.6, C.gold); // brooch

    // front arm (holds the bow when shooting)
    ctx.save(); ctx.translate(1.2, -21.2);
    let fa = st === 'run' ? run * 0.8 : air ? -2.2 : -0.12 - breathe * 0.05;
    if (pose.shoot) fa = pose.look ? -2.3 : -1.57;
    if (pose.hug) fa = -1.15;
    ctx.rotate(fa);
    ctx.fillStyle = C.pink; rr(ctx, -1.3, 0, 2.6, 7, 1.3); ctx.fill();
    ctx.fillStyle = C.cream; ctx.fillRect(-1.3, 5.6, 2.6, 0.9);
    circle(ctx, 0, 7.4, 1.35, C.skin);
    if (pose.shoot || (pose.bow && st === 'idle' && false)) {
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-1.6, 7.6, 5.2, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(0.3, 2.7); ctx.lineTo(0.3, 12.5); ctx.stroke();
    }
    ctx.restore();

    // neck and head
    ctx.fillStyle = C.skinS; ctx.fillRect(-0.6, -25, 2.2, 2);
    const hx = 0.8, hy = -29.2 + breathe * 0.3;
    circle(ctx, hx, hy, 6.1, C.skin);
    // hair top and bangs
    ctx.fillStyle = C.hair;
    ctx.beginPath();
    ctx.arc(hx - 0.2, hy - 0.4, 6.6, Math.PI * 0.92, Math.PI * 2.08);
    ctx.quadraticCurveTo(hx + 5, hy - 2.4, hx + 3.8, hy - 2.1);
    ctx.quadraticCurveTo(hx + 2.4, hy - 4.6, hx + 0.4, hy - 2.6);
    ctx.quadraticCurveTo(hx - 1.5, hy - 4.2, hx - 3.2, hy - 1.6);
    ctx.quadraticCurveTo(hx - 5, hy + 1, hx - 6.2, hy + 3.5);
    ctx.closePath(); ctx.fill();
    // side lock framing the face
    ctx.beginPath(); ctx.moveTo(hx + 5.6, hy - 2.8); ctx.quadraticCurveTo(hx + 7, hy + 2, hx + 5.7, hy + 5.6); ctx.quadraticCurveTo(hx + 5.2, hy + 1.6, hx + 4.4, hy - 1.4); ctx.fill();
    ctx.fillStyle = C.hairL;
    ctx.beginPath(); ctx.ellipse(hx - 1.6, hy - 5, 2.6, 0.9, -0.25, 0, TAU); ctx.fill();
    // ribbon bow
    ctx.fillStyle = C.rose;
    ctx.beginPath(); ctx.ellipse(hx - 4.4, hy - 6.4, 2.4, 1.5, -0.7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx - 6.2, hy - 3.4, 2.2, 1.4, 0.5, 0, TAU); ctx.fill();
    circle(ctx, hx - 5, hy - 4.8, 1.1, '#ff7aa6');
    // face
    const eyeY = hy + 0.6;
    if (pose.hurt) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hx + 1.1, eyeY - 1); ctx.lineTo(hx + 2.3, eyeY); ctx.lineTo(hx + 1.1, eyeY + 1);
      ctx.moveTo(hx + 5, eyeY - 1); ctx.lineTo(hx + 3.9, eyeY); ctx.lineTo(hx + 5, eyeY + 1); ctx.stroke();
    } else if (pose.blink || pose.hug) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(hx + 1.7, eyeY - 0.2, 1.1, 0.2, Math.PI - 0.2); ctx.moveTo(hx + 5.4, eyeY); ctx.arc(hx + 4.5, eyeY - 0.2, 1, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      for (const ex of [hx + 1.7, hx + 4.6]) {
        ellipse(ctx, ex, eyeY, 1.05, 1.55, C.ink);
        circle(ctx, ex + 0.35, eyeY - 0.55, 0.42, C.white);
        circle(ctx, ex - 0.3, eyeY + 0.6, 0.22, 'rgba(255,255,255,0.7)');
      }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.45; // lashes
      ctx.beginPath(); ctx.moveTo(hx + 0.4, eyeY - 1.6); ctx.lineTo(hx - 0.3, eyeY - 2.1); ctx.moveTo(hx + 5.6, eyeY - 1.4); ctx.lineTo(hx + 6.2, eyeY - 1.9); ctx.stroke();
    }
    ellipse(ctx, hx + 0.6, eyeY + 2.4, 1.3, 0.7, 'rgba(255,120,150,0.55)');
    ellipse(ctx, hx + 5.6, eyeY + 2.4, 1.1, 0.65, 'rgba(255,120,150,0.55)');
    ctx.strokeStyle = '#c2416b'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (pose.hurt) { ctx.arc(hx + 3.2, eyeY + 3.6, 0.8, Math.PI + 0.3, -0.3); }
    else ctx.arc(hx + 3.2, eyeY + 2.2, 1.0, 0.35, Math.PI - 0.35);
    ctx.stroke();
    ctx.restore();
  }

  // =====================================================================
  // SWEETHEART: Theo. Feet at (0,0), facing right.
  // =====================================================================
  function drawSweetheart(ctx, x, y, pose) {
    const t = pose.t || 0, st = pose.state || 'idle';
    const run = st === 'run' ? Math.sin(pose.run || 0) : 0;
    const breathe = Math.sin(t * 0.07) * 0.4;
    ctx.save(); ctx.translate(x, y); ctx.scale(pose.facing || 1, 1);
    // scarf tail
    ctx.fillStyle = C.goldD;
    ctx.beginPath(); ctx.moveTo(-1, -24); ctx.quadraticCurveTo(-5, -21 + Math.sin(t * 0.15), -7, -17 + Math.sin(t * 0.2)); ctx.lineTo(-5, -17); ctx.quadraticCurveTo(-3.5, -21, 0, -23); ctx.fill();
    // legs
    function leg(a, back) {
      ctx.save(); ctx.translate(back ? -1.4 : 1.2, -11.5); ctx.rotate(a);
      ctx.fillStyle = back ? '#232d58' : '#2e3a6e'; rr(ctx, -1.6, 0, 3.2, 9.6, 1.2); ctx.fill();
      ctx.fillStyle = back ? '#4a2c22' : '#6b4030'; rr(ctx, -1.8, 8.4, 4.6, 3.2, 1.4); ctx.fill();
      ctx.restore();
    }
    leg(-run * 0.7, true); leg(run * 0.7, false);
    // back arm
    ctx.save(); ctx.translate(-1.5, -22.5); ctx.rotate(pose.hug ? -1.2 : -run * 0.7 + 0.1);
    ctx.fillStyle = '#2a9a92'; rr(ctx, -1.4, 0, 2.8, 8, 1.3); ctx.fill(); circle(ctx, 0, 8.3, 1.4, C.skinS); ctx.restore();
    // jacket
    const jg = ctx.createLinearGradient(0, -25, 0, -11);
    jg.addColorStop(0, '#46c7bd'); jg.addColorStop(1, '#2fa39a');
    ctx.fillStyle = jg; rr(ctx, -4.4, -25, 9, 14.5, 2.4); ctx.fill();
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(-1.2, -25); ctx.lineTo(0.6, -17); ctx.lineTo(2.4, -25); ctx.fill();
    ctx.fillStyle = '#1f7f78'; ctx.fillRect(0.2, -17, 0.8, 6);
    ctx.fillStyle = C.gold; rr(ctx, -3.6, -26.4, 7.4, 2.6, 1.2); ctx.fill(); // scarf
    // front arm holding a rose
    ctx.save(); ctx.translate(1.6, -22.5);
    ctx.rotate(pose.hug ? -1.25 : pose.offer ? -1.2 : run * 0.7 - 0.15);
    ctx.fillStyle = '#3fb8af'; rr(ctx, -1.4, 0, 2.8, 8, 1.3); ctx.fill(); circle(ctx, 0, 8.3, 1.45, C.skin);
    if (!pose.hug && pose.rose !== false) {
      ctx.strokeStyle = '#3f9a4a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 8.3); ctx.lineTo(0.5, 14.5); ctx.stroke();
      circle(ctx, 0.5, 15.4, 1.9, '#e8264f'); circle(ctx, 0.2, 15, 0.9, '#ff5c7c');
      ellipse(ctx, 1.4, 12, 1.1, 0.5, '#3f9a4a', 0.6);
    }
    ctx.restore();
    // head
    const hx = 0.8, hy = -31 + breathe * 0.3;
    ctx.fillStyle = C.skinS; ctx.fillRect(-0.4, -27.5, 2.4, 2);
    circle(ctx, hx, hy, 6.1, C.skin);
    ctx.fillStyle = '#2b1d3a';
    ctx.beginPath(); ctx.arc(hx - 0.3, hy - 0.8, 6.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(hx + 4.5, hy - 3.6, hx + 2, hy - 3); ctx.quadraticCurveTo(hx + 0.5, hy - 4.6, hx - 1.8, hy - 2.6);
    ctx.quadraticCurveTo(hx - 4.6, hy - 1.5, hx - 6.3, hy + 2.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 6.6); ctx.quadraticCurveTo(hx + 4, hy - 9, hx + 5.5, hy - 6.4); ctx.quadraticCurveTo(hx + 3.5, hy - 7, hx + 2.5, hy - 5.6); ctx.fill();
    const eyeY = hy + 0.6;
    if (pose.hug || pose.blink) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(hx + 1.7, eyeY - 0.2, 1, 0.2, Math.PI - 0.2); ctx.moveTo(hx + 5.3, eyeY); ctx.arc(hx + 4.4, eyeY - 0.2, 0.95, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      for (const ex of [hx + 1.7, hx + 4.5]) { ellipse(ctx, ex, eyeY, 0.95, 1.35, C.ink); circle(ctx, ex + 0.3, eyeY - 0.5, 0.38, C.white); }
    }
    ellipse(ctx, hx + 0.7, eyeY + 2.4, 1.1, 0.6, 'rgba(255,120,150,0.45)');
    ellipse(ctx, hx + 5.5, eyeY + 2.4, 1, 0.55, 'rgba(255,120,150,0.45)');
    ctx.strokeStyle = '#a8445f'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(hx + 3.2, eyeY + 2.1, 1.1, 0.35, Math.PI - 0.35); ctx.stroke();
    ctx.restore();
  }

  // =====================================================================
  // CREATURES (grumpy until cheered up)
  // =====================================================================
  function face(ctx, x, y, happy, look, s) {
    s = s || 1;
    if (happy) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.arc(x - 2.2 * s, y, 1 * s, Math.PI + 0.3, -0.3); ctx.moveTo(x + 3.2 * s, y); ctx.arc(x + 2.2 * s, y, 1 * s, Math.PI + 0.3, -0.3); ctx.stroke();
      ellipse(ctx, x - 3.4 * s, y + 1.8 * s, 1.2 * s, 0.7 * s, 'rgba(255,110,160,0.8)');
      ellipse(ctx, x + 3.4 * s, y + 1.8 * s, 1.2 * s, 0.7 * s, 'rgba(255,110,160,0.8)');
      ctx.beginPath(); ctx.arc(x, y + 1.4 * s, 1.4 * s, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      for (const ex of [-2.2, 2.2]) { circle(ctx, x + ex * s, y, 1.5 * s, C.white); circle(ctx, x + ex * s + look * 0.6 * s, y + 0.3 * s, 0.8 * s, C.ink); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(x - 3.8 * s, y - 2.4 * s); ctx.lineTo(x - 1 * s, y - 1.4 * s); ctx.moveTo(x + 3.8 * s, y - 2.4 * s); ctx.lineTo(x + 1 * s, y - 1.4 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 3.4 * s, 1.3 * s, Math.PI + 0.4, -0.4); ctx.stroke();
    }
  }

  function drawBramble(ctx, e, t) {
    const happy = !e.alive;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (happy) { ctx.globalAlpha = Math.max(0, 1 - e.cheerT / 80); ctx.translate(0, -e.cheerT * 0.5); }
    const step = Math.sin(t * 0.25) * 1.2;
    ctx.fillStyle = '#3c2a1e';
    if (!happy) { ellipse(ctx, cx - 3, by - 0.8 + Math.min(0, step), 2, 1, '#5a3c2a'); ellipse(ctx, cx + 3, by - 0.8 + Math.min(0, -step), 2, 1, '#5a3c2a'); }
    const body = happy ? '#ff8fbf' : '#4f8a3c', dark = happy ? '#ff5c9a' : '#2f5e2a';
    ctx.fillStyle = dark;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + (happy ? t * 0.05 : 0);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.25) * 6, by - 7 + Math.sin(a - 0.25) * 5.5);
      ctx.lineTo(cx + Math.cos(a) * 9, by - 7 + Math.sin(a) * 8);
      ctx.lineTo(cx + Math.cos(a + 0.25) * 6, by - 7 + Math.sin(a + 0.25) * 5.5);
      ctx.fill();
    }
    ellipse(ctx, cx, by - 7, 7, 6.2, body);
    ellipse(ctx, cx - 2, by - 9.5, 3, 1.6, happy ? '#ffc2dc' : '#77b45a');
    if (happy) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * 0.04; ellipse(ctx, cx + Math.cos(a) * 4, by - 13 + Math.sin(a) * 1.5, 2, 1.2, '#ff3d7f', a); } circle(ctx, cx, by - 13, 1.4, C.gold); }
    face(ctx, cx + (e.vx > 0 ? 1 : -1), by - 7, happy, e.vx > 0 ? 1 : -1, 0.9);
    ctx.restore();
  }

  function cloudShape(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.62, w * 0.5, h * 0.38, 0, 0, TAU);
    ctx.ellipse(x + w * 0.3, y + h * 0.45, w * 0.24, h * 0.36, 0, 0, TAU);
    ctx.ellipse(x + w * 0.58, y + h * 0.33, w * 0.28, h * 0.36, 0, 0, TAU);
    ctx.ellipse(x + w * 0.8, y + h * 0.52, w * 0.2, h * 0.3, 0, 0, TAU);
    ctx.fill();
  }

  function drawCloud(ctx, e, t) {
    const happy = !e.alive;
    ctx.save();
    if (happy) {
      ctx.globalAlpha = Math.max(0, 1 - e.cheerT / 80); ctx.translate(0, -e.cheerT * 0.6);
      const rb = ['#ff5c9a', '#ffd36e', '#7fe0a8', '#7fc8ff', '#b48cff'];
      rb.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(e.x + 3 + i * 3.2, e.y + e.h - 2, 3.2, 10 + e.cheerT * 0.3); });
    }
    cloudShape(ctx, e.x - 1, e.y + 1.5, e.w + 2, e.h + 1, happy ? '#ffb3d1' : '#5b5288');
    cloudShape(ctx, e.x, e.y, e.w, e.h, happy ? '#fff0f7' : '#8f86b8');
    ellipse(ctx, e.x + e.w * 0.4, e.y + e.h * 0.32, 4, 1.6, happy ? '#ffffff' : '#b2aad6');
    face(ctx, e.x + e.w / 2, e.y + e.h * 0.58, happy, 0, 0.9);
    ctx.restore();
  }

  function drawBat(ctx, e, t) {
    const happy = !e.alive;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (happy) { ctx.globalAlpha = Math.max(0, 1 - e.cheerT / 80); ctx.translate(0, -e.cheerT * 0.7); }
    const flap = Math.sin(t * (happy ? 0.5 : 0.35));
    ctx.fillStyle = happy ? '#ffb3d1' : '#3d1d52';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 3, cy - 1);
      ctx.quadraticCurveTo(cx + s * 9, cy - 7 * flap - 2, cx + s * 12, cy - 3 * flap);
      ctx.quadraticCurveTo(cx + s * 9, cy + 1, cx + s * 8, cy + 2);
      ctx.quadraticCurveTo(cx + s * 6, cy + 0.5, cx + s * 3, cy + 2);
      ctx.fill();
    }
    heartPath(ctx, cx, cy + 0.5, 13);
    ctx.fillStyle = happy ? '#ff5c9a' : '#6b2a7e'; ctx.fill();
    if (!happy) { // the crack of a broken heart
      ctx.strokeStyle = '#2a0f38'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(cx, cy - 2.2); ctx.lineTo(cx - 1.2, cy); ctx.lineTo(cx + 1, cy + 1.6); ctx.lineTo(cx, cy + 5.6); ctx.stroke();
    }
    ellipse(ctx, cx - 3, cy - 1.4, 1.6, 1, happy ? '#ffd1e6' : '#9a4fb0');
    face(ctx, cx, cy + 0.5, happy, 0, 0.75);
    ctx.restore();
  }

  function drawBoss(ctx, b, t) {
    const mood = b.cheer / b.need;
    const body = lerpColor('#6d63a6', '#ff9cc4', mood), under = lerpColor('#4a427c', '#ff6fa8', mood), light = lerpColor('#9d94cf', '#ffe0ee', mood);
    ctx.save();
    if (b.cheered) ctx.globalAlpha = Math.max(0, 1 - b.gone / 200);
    const x = b.x, y = b.y, w = b.w, h = b.h;
    if (b.cheered) { // rainbow trail
      const rb = ['#ff5c9a', '#ffb05c', '#ffe66e', '#7fe0a8', '#7fc8ff', '#b48cff'];
      rb.forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.85 * Math.max(0, 1 - b.gone / 200); ctx.fillRect(x + 6 + i * 6, y + h - 4, 6, 40 + b.gone); });
      ctx.globalAlpha = Math.max(0, 1 - b.gone / 200);
    }
    if (b.flash > 0 && b.flash % 4 < 2) ctx.filter = 'brightness(1.8)';
    cloudShape(ctx, x - 3, y + 4, w + 6, h, under);
    cloudShape(ctx, x, y, w, h, body);
    ellipse(ctx, x + w * 0.38, y + h * 0.28, 8, 3, light);
    ctx.filter = 'none';
    // crown with a heart gem
    const cx = x + w * 0.55, cy = y + 4;
    ctx.fillStyle = C.gold;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy + 2); ctx.lineTo(cx - 9, cy - 6); ctx.lineTo(cx - 4.5, cy - 2); ctx.lineTo(cx, cy - 8); ctx.lineTo(cx + 4.5, cy - 2); ctx.lineTo(cx + 9, cy - 6); ctx.lineTo(cx + 8, cy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.goldD; ctx.fillRect(cx - 8, cy, 16, 2.2);
    heart(ctx, cx, cy - 2.4, 4.2, mood > 0.5 ? '#ff3d7f' : '#a05ac8');
    // face
    const fx = x + w / 2, fy = y + h * 0.58;
    if (b.cheered || mood > 0.8) {
      face(ctx, fx, fy, true, 0, 2.2);
    } else {
      const s = 2;
      for (const ex of [-2.4, 2.4]) { circle(ctx, fx + ex * s, fy, 1.7 * s, C.white); circle(ctx, fx + ex * s, fy + 0.4 * s, 0.9 * s, C.ink); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4;
      const brow = 1 - mood;
      ctx.beginPath(); ctx.moveTo(fx - 8, fy - 4 - brow * 1.5); ctx.lineTo(fx - 2.4, fy - 3 + brow * 1); ctx.moveTo(fx + 8, fy - 4 - brow * 1.5); ctx.lineTo(fx + 2.4, fy - 3 + brow * 1); ctx.stroke();
      ctx.beginPath();
      if (mood < 0.4) ctx.arc(fx, fy + 8, 3, Math.PI + 0.5, -0.5);
      else { ctx.moveTo(fx - 3, fy + 6); ctx.lineTo(fx + 3, fy + 6); }
      ctx.stroke();
      ellipse(ctx, fx - 7.5, fy + 3.6, 2.2, 1.2, `rgba(255,110,160,${0.25 + mood * 0.6})`);
      ellipse(ctx, fx + 7.5, fy + 3.6, 2.2, 1.2, `rgba(255,110,160,${0.25 + mood * 0.6})`);
    }
    ctx.restore();
  }

  // =====================================================================
  // ITEMS
  // =====================================================================
  function drawHeartItem(ctx, it, t) {
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2 + Math.sin(t * 0.08 + it.x * 0.05) * 1.5;
    const spin = Math.abs(Math.cos(t * 0.05 + it.x * 0.02));
    glow(ctx, cx, cy, 9, 'rgba(255,92,154,0.35)');
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.35 + spin * 0.65, 1);
    heart(ctx, 0, 0.6, 10.5, '#c2185b');
    heart(ctx, 0, 0, 10, '#ff3d7f');
    heart(ctx, -0.5, -0.4, 6, '#ff7aa6');
    ellipse(ctx, -2.2, -2.2, 1.4, 0.9, 'rgba(255,255,255,0.9)', -0.6);
    ctx.restore();
  }
  function drawLetter(ctx, it, t) {
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2 + Math.sin(t * 0.06) * 2;
    glow(ctx, cx, cy, 16, 'rgba(255,211,110,0.55)', 0.7 + Math.sin(t * 0.1) * 0.3);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 0.05) * 0.12);
    ctx.fillStyle = '#e6c9e8'; rr(ctx, -7, -4.6, 14, 10, 1.4); ctx.fill();
    ctx.fillStyle = C.cream; rr(ctx, -7, -5, 14, 10, 1.4); ctx.fill();
    ctx.strokeStyle = '#e7a6c4'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-7, -4.6); ctx.lineTo(0, 1); ctx.lineTo(7, -4.6); ctx.stroke();
    heart(ctx, 0, 1, 5, '#e8264f');
    ctx.restore();
    sparkle(ctx, cx + 8, cy - 7 + Math.sin(t * 0.1) * 1, 1.8 + Math.sin(t * 0.2), C.white);
  }
  function drawBowItem(ctx, x, y, t, s) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.6);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-3, 0, 7, -1.25, 1.25); ctx.stroke();
    ctx.strokeStyle = C.cream; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-0.8, -6.7); ctx.lineTo(-0.8, 6.7); ctx.stroke();
    ctx.strokeStyle = '#ffb3d1'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(7, 0); ctx.stroke();
    heart(ctx, 7.6, 0.2, 4, C.rose);
    ctx.restore();
  }
  function drawPowerItem(ctx, it, t) {
    const cx = it.x + 8, cy = it.y + 8 + Math.sin(t * 0.07) * 2;
    glow(ctx, cx, cy, 16, it.type === 'bow' ? 'rgba(255,211,110,0.6)' : 'rgba(180,140,255,0.7)');
    ctx.save();
    ctx.globalAlpha = 0.5;
    const bg = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 9);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, it.type === 'bow' ? '#ff9cc4' : '#b48cff');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.stroke();
    if (it.type === 'bow') drawBowItem(ctx, cx, cy, t, 0.8);
    else {
      for (let i = 0; i < 4; i++) { const a = t * 0.06 + i * Math.PI / 2; sparkle(ctx, cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5, 2.2, ['#fff', '#ffd36e', '#ff9cc4', '#9fe8ff'][i]); }
      sparkle(ctx, cx, cy, 4, C.white);
    }
  }
  function drawCheckpoint(ctx, c, t) {
    const x = c.x + c.w / 2, base = c.y + c.h;
    ctx.fillStyle = '#4a3466'; rr(ctx, x - 1.3, base - 28, 2.6, 28, 1); ctx.fill();
    ctx.fillStyle = '#6d4f8f'; rr(ctx, x - 4, base - 3, 8, 3, 1); ctx.fill();
    ctx.strokeStyle = '#4a3466'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, base - 27); ctx.quadraticCurveTo(x + 7, base - 31, x + 8, base - 24); ctx.stroke();
    const lx = x + 8, ly = base - 18 + Math.sin(t * 0.05) * 0.6;
    if (c.active) glow(ctx, lx, ly, 22, 'rgba(255,170,120,0.7)', 0.8 + Math.sin(t * 0.15) * 0.2);
    heart(ctx, lx, ly, 10, c.active ? '#ff6f91' : '#7d6b99');
    heart(ctx, lx, ly - 0.4, 6.5, c.active ? '#ffe28a' : '#a596bd');
    if (c.active) { ellipse(ctx, lx, ly + 0.5 + Math.sin(t * 0.3) * 0.3, 1.3, 2, '#fff7d6'); }
    ctx.fillStyle = C.gold; ctx.fillRect(lx - 1.5, ly - 6.8, 3, 1.4);
  }
  function drawGate(ctx, g, t, open, theme) {
    const x = g.x, y = g.y, w = g.w, h = g.h;
    // portal glow inside the arch
    if (open) {
      const pg = ctx.createLinearGradient(0, y + 8, 0, y + h);
      pg.addColorStop(0, 'rgba(255,240,250,0.95)'); pg.addColorStop(1, 'rgba(255,140,200,0.6)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(x + 4, y + h); ctx.lineTo(x + 4, y + 14); ctx.arc(x + w / 2, y + 14, w / 2 - 4, Math.PI, 0); ctx.lineTo(x + w - 4, y + h); ctx.fill();
      for (let i = 0; i < 4; i++) { const a = t * 0.04 + i * 1.6; sparkle(ctx, x + w / 2 + Math.cos(a) * 7, y + 26 + Math.sin(a * 1.3) * 12, 1.6, C.white); }
      glow(ctx, x + w / 2, y + h / 2, 40, 'rgba(255,170,210,0.45)');
    } else {
      ctx.fillStyle = 'rgba(40,20,60,0.75)'; ctx.beginPath(); ctx.moveTo(x + 4, y + h); ctx.lineTo(x + 4, y + 14); ctx.arc(x + w / 2, y + 14, w / 2 - 4, Math.PI, 0); ctx.lineTo(x + w - 4, y + h); ctx.fill();
      ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 5 + i * 7, y + 12); ctx.quadraticCurveTo(x + 9 + i * 6, y + 28, x + 4 + i * 7, y + h); ctx.stroke(); }
      heart(ctx, x + w / 2, y + 30, 9, '#8b7fa8'); ctx.fillStyle = '#5e4f7e'; ctx.fillRect(x + w / 2 - 1, y + 29, 2, 3);
    }
    // arch of roses
    ctx.strokeStyle = '#3f8a46'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(x + 2, y + h); ctx.lineTo(x + 2, y + 14); ctx.arc(x + w / 2, y + 14, w / 2 - 2, Math.PI, 0); ctx.lineTo(x + w - 2, y + h); ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      let px, py;
      if (i < 4) { px = x + 2; py = y + h - 4 - i * 9; } else if (i > 8) { px = x + w - 2; py = y + h - 4 - (12 - i) * 9; }
      else { const a = Math.PI + ((i - 4) / 4) * Math.PI; px = x + w / 2 + Math.cos(a) * (w / 2 - 2); py = y + 14 + Math.sin(a) * (w / 2 - 2); }
      circle(ctx, px, py, 2.6, i % 2 ? '#ff3d7f' : '#ff7aa6');
      circle(ctx, px - 0.5, py - 0.5, 1.1, '#ffd1e3');
    }
    heart(ctx, x + w / 2, y - 3 + Math.sin(t * 0.08), 11, C.gold);
    heart(ctx, x + w / 2, y - 3.4 + Math.sin(t * 0.08), 7, '#ff3d7f');
  }
  function drawSpring(ctx, x, y, t, squash) {
    const sq = squash > 0 ? Math.sin((16 - squash) / 16 * Math.PI) * 4 : 0;
    ctx.fillStyle = '#8a62e0'; rr(ctx, x + 1, y + 13, 14, 3, 1.2); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 13);
    const top = y + 6 + sq;
    for (let i = 1; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 12 : 4), y + 13 - (13 - 6 - sq) * i / 4);
    ctx.stroke();
    heart(ctx, x + 8, top - 0.6, 13 - sq * 0.4, '#ff3d7f');
    heart(ctx, x + 7, top - 1.6, 6, '#ff8fb8');
  }
  function drawArrow(ctx, a) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save(); ctx.translate(a.x + a.w / 2, a.y + a.h / 2); ctx.rotate(ang);
    ctx.strokeStyle = '#ffe6f1'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(3, 0); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-4, 0); ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
    ctx.rotate(Math.PI / 2); heart(ctx, 0, -4.5, 5.2, C.rose); ctx.restore();
  }
  function drawDrop(ctx, d) {
    ctx.fillStyle = '#7d8cff';
    ctx.beginPath(); ctx.moveTo(d.x + 2, d.y); ctx.quadraticCurveTo(d.x + 4.4, d.y + 4, d.x + 2, d.y + 6.2); ctx.quadraticCurveTo(d.x - 0.4, d.y + 4, d.x + 2, d.y); ctx.fill();
    circle(ctx, d.x + 1.4, d.y + 3.8, 0.7, '#dfe4ff');
  }

  // =====================================================================
  // THEMES: tiles, scenery and parallax backgrounds
  // =====================================================================
  const THEMES = {
    garden: {
      sky: ['#4b2f7d', '#a24d9e', '#ff7eb3', '#ffb58c', '#ffd89e'], ambient: 'petal', music: 0,
      soil: ['#7a3e5c', '#5e2c4a'], top: ['#8fdc7a', '#5fbf62'], block: ['#f49ac1', '#d76b9c'], ui: '#ff5c9a'
    },
    sky: {
      sky: ['#78c8ff', '#9fb8ff', '#c7b0ff', '#f3c6f0', '#ffe0ec'], ambient: 'sparkle', music: 5,
      soil: ['#fff5fb', '#f6d3ea'], top: ['#ffffff', '#ffe4f3'], block: ['#ffffff', '#ff8fbf'], ui: '#b48cff'
    },
    city: {
      sky: ['#090824', '#1a1446', '#331c63', '#6b2f7a', '#b2477e'], ambient: 'firefly', music: -2,
      soil: ['#2b2248', '#1d1734'], top: ['#9a86c8', '#6f5ea0'], block: ['#4b2d6e', '#38214f'], ui: '#ffd36e'
    },
    castle: {
      sky: ['#05041a', '#130d36', '#2a1650', '#4a2667', '#6a3a78'], ambient: 'mote', music: -3,
      soil: ['#6c5b9b', '#54477e'], top: ['#a596d6', '#7f70b3'], block: ['#4a3c78', '#382d5e'], ui: '#9fd4ff'
    }
  };

  // Draw one 16x16 solid tile. mask bits: 1 top open, 2 left open, 4 right open, 8 bottom open
  function drawSolidTile(ctx, theme, ch, mask, variant) {
    const th = THEMES[theme];
    const top = mask & 1, left = mask & 2, right = mask & 4, bottom = mask & 8;
    if (theme === 'garden') {
      if (ch === 'B') { // pink garden stone
        ctx.fillStyle = '#d76b9c'; rr(ctx, 0.5, 0.5, 15, 15, 3); ctx.fill();
        ctx.fillStyle = '#f49ac1'; rr(ctx, 1, 1, 14, 12.5, 2.6); ctx.fill();
        ctx.fillStyle = '#ffc6dd'; rr(ctx, 2.5, 2.2, 6, 2.2, 1.1); ctx.fill();
        circle(ctx, 11.5, 9.5, 1, '#e07fab'); circle(ctx, 5, 10, 0.8, '#e07fab');
        return;
      }
      ctx.fillStyle = '#6e3656'; ctx.fillRect(0, 0, 16, 16);
      if (top) { const g = ctx.createLinearGradient(0, 4, 0, 16); g.addColorStop(0, '#8a4a70'); g.addColorStop(1, '#6e3656'); ctx.fillStyle = g; ctx.fillRect(0, 4, 16, 12); }
      for (let i = 0; i < 4; i++) ellipse(ctx, 2 + ((variant * 5 + i * 7) % 13), 5 + ((variant * 3 + i * 5) % 10), 1.4, 0.9, i % 2 ? '#9a5a7e' : '#4e2440');
      if (left) { ctx.fillStyle = 'rgba(40,10,30,0.25)'; ctx.fillRect(0, 0, 1.5, 16); }
      if (right) { ctx.fillStyle = 'rgba(40,10,30,0.25)'; ctx.fillRect(14.5, 0, 1.5, 16); }
      if (top) {
        ctx.fillStyle = '#5fbf62'; ctx.fillRect(0, 0, 16, 5.5);
        ctx.fillStyle = '#8fdc7a'; ctx.fillRect(0, 0, 16, 3.4);
        ctx.fillStyle = '#5fbf62';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * 3 - 0.5, 5); ctx.lineTo(i * 3 + 1, 8 - (i % 2) * 1.5); ctx.lineTo(i * 3 + 2.5, 5); ctx.fill(); }
        ctx.fillStyle = '#c3f2a5'; ctx.fillRect(0, 0, 16, 1);
        if (variant % 3 === 0) { circle(ctx, 4, 1.2, 1.1, '#ff7aa6'); circle(ctx, 4, 1.2, 0.45, '#fff2a8'); }
        if (variant % 3 === 1) { circle(ctx, 11, 1.4, 1.1, '#fff'); circle(ctx, 11, 1.4, 0.45, '#ffd36e'); }
      }
    } else if (theme === 'sky') {
      if (ch === 'B') { // peppermint candy block
        ctx.fillStyle = '#fff'; rr(ctx, 0.5, 0.5, 15, 15, 4); ctx.fill();
        ctx.save(); rr(ctx, 0.5, 0.5, 15, 15, 4); ctx.clip();
        ctx.fillStyle = '#ff8fbf'; for (let i = -16; i < 32; i += 6) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 3, 0); ctx.lineTo(i + 19, 16); ctx.lineTo(i + 16, 16); ctx.fill(); }
        ctx.restore(); ellipse(ctx, 5, 3.5, 3, 1.2, 'rgba(255,255,255,0.8)');
        return;
      }
      ctx.fillStyle = bottom ? '#f8d9ee' : '#fff5fb'; ctx.fillRect(0, 0, 16, 16);
      if (bottom) { ctx.fillStyle = '#f2c1e2'; ctx.fillRect(0, 10, 16, 6); for (let i = 0; i < 3; i++) circle(ctx, 2.7 + i * 5.3, 15, 3, '#fff5fb'); ctx.fillStyle = 'rgba(0,0,0,0)'; }
      if (top) {
        ctx.clearRect(0, 0, 16, 5);
        for (let i = 0; i < 3; i++) circle(ctx, 2.7 + i * 5.3, 5.6, 3.6, '#f3b8dc');
        for (let i = 0; i < 3; i++) circle(ctx, 2.7 + i * 5.3, 5, 3.6, '#ffffff');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 5, 16, 3);
        ellipse(ctx, 5, 3, 2.2, 1, '#fff9e8');
        ctx.fillStyle = 'rgba(255,170,215,0.35)'; ctx.fillRect(0, 9, 16, 2);
      }
      if (!top) { ctx.fillStyle = 'rgba(214,160,230,0.25)'; ctx.fillRect(0, 0, 16, 16); }
      if (left) { ctx.fillStyle = 'rgba(230,170,215,0.35)'; ctx.fillRect(0, 2, 1.5, 14); }
      if (right) { ctx.fillStyle = 'rgba(230,170,215,0.35)'; ctx.fillRect(14.5, 2, 1.5, 14); }
      if (variant % 4 === 0) circle(ctx, 10, 10, 0.9, '#ffd1ea');
    } else if (theme === 'city') {
      if (ch === '#') { // street
        ctx.fillStyle = '#251c40'; ctx.fillRect(0, 0, 16, 16);
        if (top) { ctx.fillStyle = '#8f7cc0'; ctx.fillRect(0, 0, 16, 4); ctx.fillStyle = '#b6a6e0'; ctx.fillRect(0, 0, 16, 1); ctx.fillStyle = '#6f5ea0'; ctx.fillRect(variant % 2 ? 7 : 15, 1, 1, 3); }
        else if (variant % 3 === 0) { ctx.fillStyle = '#ffd36e'; ctx.fillRect(3, 8, 6, 1); }
        return;
      }
      ctx.fillStyle = '#432763'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#371f53';
      for (let r = 0; r < 4; r++) { ctx.fillRect(0, r * 4 + 3.4, 16, 0.6); ctx.fillRect((r % 2) * 4 + 2, r * 4, 0.6, 4); ctx.fillRect((r % 2) * 4 + 10, r * 4, 0.6, 4); }
      if (!top && variant % 3 !== 2) { // windows
        const lit = variant % 3 === 0;
        ctx.fillStyle = lit ? '#ffd88a' : '#2a1840'; rr(ctx, 4.5, 4, 7, 8, 1); ctx.fill();
        if (lit) { glow(ctx, 8, 8, 8, 'rgba(255,214,140,0.35)'); ctx.fillStyle = '#ff9fc6'; ctx.fillRect(4.5, 4, 7, 1.8); }
        ctx.fillStyle = '#2a1840'; ctx.fillRect(7.7, 4, 0.6, 8);
      }
      if (top) { ctx.fillStyle = '#6d4796'; ctx.fillRect(0, 0, 16, 4); ctx.fillStyle = C.gold; ctx.fillRect(0, 0, 16, 1.2); ctx.fillStyle = '#563779'; ctx.fillRect(0, 4, 16, 1); }
      if (left) { ctx.fillStyle = 'rgba(255,200,255,0.12)'; ctx.fillRect(0, 0, 1.5, 16); }
      if (right) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(14.5, 0, 1.5, 16); }
    } else { // castle
      const base = ch === 'B' ? ['#4a3c78', '#382d5e'] : ['#6c5b9b', '#54477e'];
      ctx.fillStyle = base[1]; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = base[0];
      const off = variant % 2 ? 4 : 0;
      rr(ctx, 0.6, 0.6, 7, 6.8, 1); ctx.fill(); rr(ctx, 8.4, 0.6, 7, 6.8, 1); ctx.fill();
      rr(ctx, -3.4 + off + 0.6, 8.6, 7, 6.8, 1); ctx.fill(); rr(ctx, 4.6 + off, 8.6, 7, 6.8, 1); ctx.fill(); rr(ctx, 12.6 + off, 8.6, 7, 6.8, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(1, 1, 6, 1); ctx.fillRect(9, 1, 6, 1);
      if (top) { ctx.fillStyle = '#c3b6ff'; ctx.fillRect(0, 0, 16, 1.4); ctx.fillStyle = 'rgba(195,182,255,0.3)'; ctx.fillRect(0, 1.4, 16, 2); if (variant % 4 === 1) { ellipse(ctx, 4, 1, 3, 1.4, '#5fae6a'); circle(ctx, 3, 0.4, 0.8, '#ff7aa6'); } }
      if (bottom) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 13, 16, 3); }
      if (variant % 5 === 3 && !top) { ctx.strokeStyle = 'rgba(30,20,50,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(12, 6); ctx.lineTo(11, 9); ctx.stroke(); }
    }
  }

  function drawOneWay(ctx, theme, variant) {
    if (theme === 'garden') { // rose trellis
      ctx.fillStyle = '#9a5b3c'; rr(ctx, 0, 0, 16, 4.5, 1.5); ctx.fill();
      ctx.fillStyle = '#c47e57'; ctx.fillRect(0, 0, 16, 1.4);
      ctx.strokeStyle = '#5fae5a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.quadraticCurveTo(4, 9, 8, 5.5); ctx.quadraticCurveTo(12, 2, 16, 6); ctx.stroke();
      ellipse(ctx, 4, 7, 1.6, 0.8, '#5fae5a', 0.5);
      if (variant % 2) { circle(ctx, 11, 5.2, 1.8, '#ff3d7f'); circle(ctx, 11, 5, 0.8, '#ff9cc4'); }
    } else if (theme === 'sky') { // cotton candy puffs
      circle(ctx, 3.5, 4, 4, '#ffb3d9'); circle(ctx, 8.5, 3.4, 4.6, '#c7b5ff'); circle(ctx, 13, 4, 4, '#ffb3d9');
      circle(ctx, 3.2, 2.6, 1.6, '#ffe0f0'); circle(ctx, 8.4, 2, 1.8, '#ece5ff');
    } else if (theme === 'city') { // striped awning
      ctx.fillStyle = '#fff2f8'; ctx.fillRect(0, 0, 16, 5);
      ctx.fillStyle = '#ff5c9a'; ctx.fillRect(0, 0, 4, 5); ctx.fillRect(8, 0, 4, 5);
      for (let i = 0; i < 4; i++) { circle(ctx, i * 4 + 2, 5, 2, i % 2 ? '#fff2f8' : '#ff5c9a'); }
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, 16, 1);
    } else { // wooden ledge with gold brackets
      ctx.fillStyle = '#7b4a35'; rr(ctx, 0, 0, 16, 4.5, 1); ctx.fill();
      ctx.fillStyle = '#a8694a'; ctx.fillRect(0, 0, 16, 1.4);
      ctx.fillStyle = C.goldD; ctx.beginPath(); ctx.moveTo(2, 4.5); ctx.lineTo(5, 4.5); ctx.lineTo(2, 9); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, 4.5); ctx.lineTo(11, 4.5); ctx.lineTo(14, 9); ctx.fill();
    }
  }

  function drawThorns(ctx, theme) {
    const dark = theme === 'city' || theme === 'castle';
    ctx.fillStyle = dark ? '#3a5e3a' : '#3f7a3a';
    rr(ctx, 0, 12, 16, 4, 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#2f5e2a' : '#4f8a3c';
      ctx.beginPath(); ctx.moveTo(i * 4, 14); ctx.lineTo(i * 4 + 2, 6 + (i % 2) * 2); ctx.lineTo(i * 4 + 4, 14); ctx.fill();
      ctx.fillStyle = '#d9f0c2'; ctx.beginPath(); ctx.moveTo(i * 4 + 1.6, 8 + (i % 2) * 2); ctx.lineTo(i * 4 + 2, 6 + (i % 2) * 2); ctx.lineTo(i * 4 + 2.4, 8 + (i % 2) * 2); ctx.fill();
    }
    circle(ctx, 8, 12, 1.6, '#ff3d7f');
  }

  // scenery that is drawn in front of the background but has no collision
  function drawDecor(ctx, theme, ch, x, y, t) {
    const bx = x, by = y + T; // bottom-left of the tile
    if (theme === 'garden') {
      if (ch === 'r') { // rose bush
        ellipse(ctx, bx + 8, by - 5, 9, 6, '#3f8a46'); ellipse(ctx, bx + 5, by - 7, 5, 4.5, '#4fa356'); ellipse(ctx, bx + 11.5, by - 6.5, 5, 4.2, '#4fa356');
        for (const [px, py, c] of [[4, -9, '#ff3d7f'], [10, -10, '#ff7aa6'], [13, -5, '#e8264f'], [7, -4, '#ff9cc4']]) { circle(ctx, bx + px, by + py, 2, c); circle(ctx, bx + px - 0.4, by + py - 0.4, 0.8, '#ffd1e3'); }
      } else { // picket fence with flowers
        ctx.fillStyle = '#fff4ea';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(bx + 1 + i * 5.5, by); ctx.lineTo(bx + 1 + i * 5.5, by - 11); ctx.lineTo(bx + 2.75 + i * 5.5, by - 13); ctx.lineTo(bx + 4.5 + i * 5.5, by - 11); ctx.lineTo(bx + 4.5 + i * 5.5, by); ctx.fill(); }
        ctx.fillRect(bx, by - 8, 16, 1.6);
        circle(ctx, bx + 6.5, by - 2.5, 1.5, '#b48cff'); circle(ctx, bx + 12, by - 3, 1.5, '#ffd36e');
      }
    } else if (theme === 'sky') {
      if (ch === 'r') { // lollipop
        ctx.fillStyle = '#fff'; ctx.fillRect(bx + 7.3, by - 14, 1.4, 14);
        circle(ctx, bx + 8, by - 17, 5.5, '#ff7aa6');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx + 8, by - 17, 3.4, 0, 4.5); ctx.stroke(); ctx.beginPath(); ctx.arc(bx + 8, by - 17, 1.4, 1, 6); ctx.stroke();
      } else { // candy cane
        ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(bx + 6, by); ctx.lineTo(bx + 6, by - 15); ctx.arc(bx + 9, by - 15, 3, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = '#ff3d7f'; ctx.lineWidth = 3; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(bx + 6, by); ctx.lineTo(bx + 6, by - 15); ctx.arc(bx + 9, by - 15, 3, Math.PI, 0); ctx.stroke();
        ctx.setLineDash([]); ctx.lineCap = 'butt';
      }
    } else if (theme === 'city') {
      if (ch === 'r') { // heart street lamp
        glow(ctx, bx + 8, by - 34, 26, 'rgba(255,200,140,0.45)');
        ctx.fillStyle = '#2b1d45'; ctx.fillRect(bx + 7, by - 32, 2, 32); rr(ctx, bx + 4.5, by - 3, 7, 3, 1); ctx.fill();
        heart(ctx, bx + 8, by - 35, 9, '#ffcf8a'); heart(ctx, bx + 8, by - 35.5, 5, '#fff3d6');
        ctx.fillStyle = '#2b1d45'; ctx.fillRect(bx + 5, by - 31, 6, 1.5);
      } else { // flower box
        ctx.fillStyle = '#8a4f3a'; rr(ctx, bx + 1, by - 6, 14, 6, 1.5); ctx.fill();
        for (let i = 0; i < 4; i++) { ellipse(ctx, bx + 3 + i * 3.4, by - 8, 2, 2.4, '#4f9a52'); circle(ctx, bx + 3 + i * 3.4, by - 9.5, 1.4, ['#ff7aa6', '#ffd36e', '#b48cff', '#ff3d7f'][i]); }
      }
    } else { // castle
      if (ch === 'r') { // candelabra
        const fl = Math.sin(t * 0.3 + x) * 0.6;
        glow(ctx, bx + 8, by - 18, 18, 'rgba(255,190,120,0.5)');
        ctx.fillStyle = C.goldD; ctx.fillRect(bx + 7.3, by - 12, 1.4, 12); rr(ctx, bx + 4, by - 2, 8, 2, 1); ctx.fill();
        ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx + 3, by - 13); ctx.quadraticCurveTo(bx + 8, by - 8, bx + 13, by - 13); ctx.stroke();
        for (const cx of [3, 8, 13]) { ctx.fillStyle = C.cream; ctx.fillRect(bx + cx - 1, by - 17 + (cx === 8 ? -2 : 0), 2, 4); ellipse(ctx, bx + cx, by - 18.5 + (cx === 8 ? -2 : 0), 1, 1.8 + fl * 0.3, '#ffb347'); circle(ctx, bx + cx, by - 18 + (cx === 8 ? -2 : 0), 0.5, '#fff6c9'); }
      } else if (ch === 't') { // hanging heart banner (hangs from the tile top)
        ctx.fillStyle = '#7a2b5e'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 14, y); ctx.lineTo(x + 14, y + 22); ctx.lineTo(x + 8, y + 18); ctx.lineTo(x + 2, y + 22); ctx.fill();
        ctx.fillStyle = C.goldD; ctx.fillRect(x + 1, y, 14, 1.6);
        heart(ctx, x + 8, y + 9, 7, '#ff7aa6');
      } else { // rose vase
        ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.moveTo(bx + 5, by); ctx.quadraticCurveTo(bx + 2, by - 6, bx + 6, by - 9); ctx.lineTo(bx + 10, by - 9); ctx.quadraticCurveTo(bx + 14, by - 6, bx + 11, by); ctx.fill();
        for (const [px, py] of [[6, -13], [10, -14], [8, -16]]) { ctx.strokeStyle = '#3f8a46'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx + 8, by - 9); ctx.lineTo(bx + px, by + py); ctx.stroke(); circle(ctx, bx + px, by + py, 1.8, '#ff3d7f'); }
      }
    }
  }

  // ---------- parallax backgrounds (logical 960 x 272, tile horizontally) ----------
  function bgSky(ctx, theme, W, H) {
    const s = THEMES[theme].sky;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    s.forEach((c, i) => g.addColorStop(i / (s.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function hills(ctx, W, H, y0, amp, freq, color, seed) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const t = x / W * TAU;
      ctx.lineTo(x, y0 - amp * (0.6 * Math.sin(t * freq + seed) + 0.4 * Math.sin(t * freq * 2 + seed * 2.3)));
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawFar(ctx, theme, W, H) {
    const rnd = (i) => hash(i, 77);
    if (theme === 'garden') {
      glow(ctx, 300, 175, 120, 'rgba(255,230,160,0.55)');
      circle(ctx, 300, 175, 38, '#ffe39a'); circle(ctx, 300, 175, 32, '#fff1c4');
      for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.35; cloudShape(ctx, (i * 173) % W, 30 + rnd(i) * 70, 70 + rnd(i + 9) * 40, 18, '#ffd1e6'); ctx.globalAlpha = 1; }
      hills(ctx, W, H, 200, 22, 2, '#9b5fb6', 1);
      for (let i = 0; i < 14; i++) { const x = rnd(i + 3) * W, y = 196 - rnd(i + 5) * 12; ellipse(ctx, x, y, 7, 9, '#83489f'); ctx.fillStyle = '#6e3a87'; ctx.fillRect(x - 1, y + 6, 2, 8); }
    } else if (theme === 'sky') {
      ctx.lineWidth = 9;
      ['#ff9cc4', '#ffd36e', '#b9f2a6', '#9fd4ff', '#c7b0ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(520, 290, 210 - i * 9, Math.PI, 0); ctx.stroke(); });
      ctx.globalAlpha = 1;
      for (let i = 0; i < 9; i++) { ctx.globalAlpha = 0.5; cloudShape(ctx, (i * 117) % W, 150 + rnd(i) * 80, 120 + rnd(i + 4) * 60, 40, '#e9e0ff'); }
      ctx.globalAlpha = 1;
    } else if (theme === 'city') {
      for (let i = 0; i < 90; i++) { const x = rnd(i) * W, y = rnd(i + 200) * 150; circle(ctx, x, y, rnd(i + 400) * 0.9 + 0.3, 'rgba(255,255,255,' + (0.4 + rnd(i + 9) * 0.6) + ')'); }
      glow(ctx, 680, 60, 70, 'rgba(255,230,250,0.4)');
      circle(ctx, 680, 60, 22, '#fff4fb'); circle(ctx, 690, 54, 20, '#2a1a52'); // crescent
      ctx.fillStyle = '#2a1b52';
      let x = 0; let i = 0;
      while (x < W) { const w = 26 + rnd(i) * 40, h = 60 + rnd(i + 50) * 80; ctx.fillRect(x, H - 40 - h, w, h + 40);
        for (let wy = H - 34 - h; wy < H - 50; wy += 9) for (let wx = x + 4; wx < x + w - 6; wx += 8) if (hash(wx, wy) > 0.72) { ctx.fillStyle = 'rgba(255,214,140,0.65)'; ctx.fillRect(wx, wy, 3, 4); ctx.fillStyle = '#2a1b52'; }
        x += w + 2; i++; }
    } else {
      for (let i = 0; i < 120; i++) { const x = rnd(i) * W, y = rnd(i + 300) * 170; circle(ctx, x, y, rnd(i + 500) * 1 + 0.3, 'rgba(230,230,255,' + (0.35 + rnd(i + 7) * 0.65) + ')'); }
      glow(ctx, 300, 80, 110, 'rgba(200,210,255,0.45)');
      circle(ctx, 300, 80, 42, '#f3f0ff'); circle(ctx, 288, 70, 7, '#ded8f7'); circle(ctx, 314, 94, 9, '#e6e0fa'); circle(ctx, 318, 66, 4, '#ded8f7');
      hills(ctx, W, H, 215, 30, 3, '#24184a', 2);
    }
  }

  function drawMid(ctx, theme, W, H) {
    const rnd = (i) => hash(i, 131);
    if (theme === 'garden') {
      hills(ctx, W, H, 228, 18, 3, '#c25f95', 4);
      for (let i = 0; i < 10; i++) { // heart-shaped topiary trees
        const x = rnd(i) * W, y = 214 - rnd(i + 2) * 10;
        ctx.fillStyle = '#7a3d5e'; ctx.fillRect(x - 1.5, y, 3, 22);
        heart(ctx, x, y - 4, 26, '#5fa85e'); heart(ctx, x - 2, y - 6, 14, '#77c06f');
        circle(ctx, x + 5, y - 6, 1.6, '#ff7aa6'); circle(ctx, x - 5, y - 2, 1.4, '#ffd1e3');
      }
    } else if (theme === 'sky') {
      for (let i = 0; i < 5; i++) { // floating candy islands
        const x = i * (W / 5) + rnd(i) * 60, y = 120 + rnd(i + 8) * 70;
        cloudShape(ctx, x - 30, y, 70, 22, 'rgba(255,214,236,0.95)');
        ctx.fillStyle = '#e6a0c9'; ctx.beginPath(); ctx.moveTo(x - 20, y + 16); ctx.lineTo(x + 30, y + 16); ctx.lineTo(x + 5, y + 40); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y - 18, 1.6, 20); circle(ctx, x + 5, y - 20, 6, ['#ff9cc4', '#c7b0ff', '#ffd36e', '#9fe8d4', '#ff7aa6'][i]);
      }
    } else if (theme === 'city') {
      let x = 0, i = 0;
      while (x < W) {
        const w = 40 + rnd(i) * 50, h = 50 + rnd(i + 30) * 70;
        ctx.fillStyle = '#3a2266'; ctx.fillRect(x, H - 30 - h, w, h + 30);
        ctx.fillStyle = '#4a2c7c'; ctx.fillRect(x, H - 30 - h, w, 3);
        for (let wy = H - 22 - h; wy < H - 30; wy += 12) for (let wx = x + 5; wx < x + w - 8; wx += 10) { ctx.fillStyle = hash(wx, wy + 3) > 0.55 ? '#ffd88a' : '#28174a'; ctx.fillRect(wx, wy, 5, 6); }
        if (i % 3 === 1) { glow(ctx, x + w / 2, H - 42 - h, 22, 'rgba(255,92,154,0.6)'); heart(ctx, x + w / 2, H - 42 - h, 14, '#ff5c9a'); heart(ctx, x + w / 2, H - 42.5 - h, 9, '#ffc2dc'); ctx.fillStyle = '#1e1238'; ctx.fillRect(x + w / 2 - 1, H - 35 - h, 2, 6); }
        x += w + 6 + rnd(i + 70) * 20; i++;
      }
    } else {
      // castle silhouette with towers and lit windows
      ctx.fillStyle = '#1a1036';
      ctx.fillRect(0, H - 70, W, 70);
      for (let i = 0; i < 6; i++) {
        const x = i * (W / 6) + rnd(i) * 40, w = 30 + rnd(i + 4) * 20, h = 80 + rnd(i + 9) * 70;
        ctx.fillStyle = '#1a1036'; ctx.fillRect(x, H - 70 - h, w, h);
        ctx.beginPath(); ctx.moveTo(x - 4, H - 70 - h); ctx.lineTo(x + w / 2, H - 110 - h); ctx.lineTo(x + w + 4, H - 70 - h); ctx.fill();
        ctx.fillStyle = '#ff7aa6'; ctx.beginPath(); ctx.moveTo(x + w / 2, H - 110 - h); ctx.lineTo(x + w / 2, H - 124 - h); ctx.lineTo(x + w / 2 + 10, H - 119 - h); ctx.lineTo(x + w / 2, H - 116 - h); ctx.fill();
        for (let k = 0; k < 3; k++) { ctx.fillStyle = hash(i, k) > 0.4 ? '#ffcf7a' : '#2b1c4f'; rr(ctx, x + w / 2 - 3, H - 60 - h + k * 24, 6, 10, 3); ctx.fill(); }
      }
      ctx.fillStyle = 'rgba(180,170,255,0.08)'; ctx.fillRect(0, H - 60, W, 60);
    }
  }

  root.LLArt = {
    T, C, THEMES, heartPath, heart, rr, circle, ellipse, sparkle, glow, hash, lerpColor, cloudShape,
    drawHeroine, drawSweetheart, drawBramble, drawCloud, drawBat, drawBoss,
    drawHeartItem, drawLetter, drawPowerItem, drawBowItem, drawCheckpoint, drawGate, drawSpring, drawArrow, drawDrop,
    drawSolidTile, drawOneWay, drawThorns, drawDecor, bgSky, drawFar, drawMid
  };
})(typeof self !== 'undefined' ? self : this);
