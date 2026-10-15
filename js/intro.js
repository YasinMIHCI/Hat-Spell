// Intro animée (5 s) : une plume trace un glyphe de lumière à l'encre d'argent,
// l'anneau se ferme, le sort éclate, puis le glyphe s'ouvre sur l'atelier.

import { SIGILS, SIGNS } from './glyphs.js';

const TAU = Math.PI * 2;
const DURATION = 5.0;

// Chronologie (secondes). L'ordre suit le manga : sigil, signes, anneau en dernier.
const T = {
  sigil: [0.35, 1.25],
  signs: [1.2, 2.15],
  ring: [2.1, 3.15],
  burst: 3.15,
  title: 3.35,
  reveal: [4.2, 5.0],
};

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = t => Math.max(0, Math.min(1, t));
const phase = (t, [a, b]) => clamp01((t - a) / (b - a));

export function playIntro() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.getElementById('intro');
  if (!overlay || reduce) {
    overlay?.remove();
    return Promise.resolve();
  }

  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const title = overlay.querySelector('.intro-title');
  const skip = overlay.querySelector('.intro-skip');

  // Titre lettre par lettre.
  const text = title.textContent;
  title.textContent = '';
  title.setAttribute('aria-label', text);
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    title.appendChild(s);
  });

  let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  let strokes = null, stars = [], motes = [], sparks = [];

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = overlay.clientWidth; h = overlay.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cx = w / 2; cy = h * 0.4;
    R = Math.min(w, h) * 0.22;
    strokes = buildGlyph(cx, cy, R);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    stars = Array.from({ length: Math.round((w * h) / 5000) }, () => ({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.3 + 0.2, p: rnd() * TAU }));
    motes = Array.from({ length: 40 }, () => ({ x: rnd() * w, y: rnd() * h, v: 6 + rnd() * 14, r: rnd() * 1.6 + 0.4, p: rnd() * TAU }));
  }
  layout();
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  return new Promise(resolve => {
    let start = null, raf = 0, done = false, burstDone = false;

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      overlay.classList.add('gone');
      setTimeout(() => overlay.remove(), 450);
      resolve();
    }
    skip.addEventListener('click', finish);
    overlay.addEventListener('pointerdown', e => { if (e.target !== skip) finish(); });
    window.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { window.removeEventListener('keydown', onKey); finish(); }
    });

    function frame(now) {
      if (start === null) start = now;
      const t = (now - start) / 1000;
      if (t >= T.burst && !burstDone) {
        burstDone = true;
        for (let i = 0; i < 160; i++) {
          const a = Math.random() * TAU, v = 80 + Math.random() * 380;
          sparks.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.8 + Math.random() * 1.2, max: 2 });
        }
        for (let i = 0; i < 60; i++) {
          const a = Math.random() * TAU, rr = Math.random() * R * 0.4;
          sparks.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 140, life: 1 + Math.random() * 1.5, max: 2.5 });
        }
        overlay.classList.add('lit');
      }
      if (t >= T.title) title.classList.add('show');
      draw(t);
      // Révélation : un trou qui s'ouvre depuis le centre du glyphe.
      const rv = ease(phase(t, T.reveal));
      if (rv > 0) {
        const hole = rv * Math.hypot(w, h);
        overlay.style.setProperty('--hole', `${hole}px`);
        overlay.style.setProperty('--hx', `${cx}px`);
        overlay.style.setProperty('--hy', `${cy}px`);
        overlay.classList.add('revealing');
      }
      if (t >= DURATION) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ciel de nuit de l'atelier.
    const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#1d2050');
    bg.addColorStop(1, '#070818');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const fadeIn = clamp01(t / 0.5);
    for (const s of stars) {
      ctx.globalAlpha = fadeIn * (0.35 + 0.35 * Math.sin(t * 2.2 + s.p));
      ctx.fillStyle = '#dfe4ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    // Poussière dorée qui monte.
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      const y = ((m.y - t * m.v) % h + h) % h;
      const x = m.x + Math.sin(t * 0.8 + m.p) * 8;
      ctx.globalAlpha = fadeIn * 0.5;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
    }

    const lit = clamp01((t - T.burst) / 0.25);
    const after = Math.max(0, t - T.burst);

    // Cercle d'ornement gradué qui s'ouvre et tourne après la fermeture.
    if (lit > 0) {
      const k = ease(clamp01(after / 0.9));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(after * 0.35);
      ctx.strokeStyle = '#ffe7a8';
      ctx.globalAlpha = 0.55 * k;
      ctx.lineWidth = 1;
      const r1 = R * (1.05 + 0.25 * k);
      ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r1 + 9, 0, TAU); ctx.stroke();
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU, l = i % 6 === 0 ? 9 : 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * (r1 + l), Math.sin(a) * (r1 + l));
        ctx.stroke();
      }
      ctx.rotate(-after * 0.8);
      ctx.globalAlpha = 0.35 * k;
      const r2 = R * (1.45 + 0.2 * k);
      ctx.setLineDash([2, 10]);
      ctx.beginPath(); ctx.arc(0, 0, r2, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Rayons de lumière.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-after * 0.2);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const len = R * (1.2 + 1.4 * k) * (i % 2 ? 0.7 : 1);
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, `rgba(255,236,170,${0.22 * lit})`);
        g.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - 0.05) * len, Math.sin(a - 0.05) * len);
        ctx.lineTo(Math.cos(a + 0.05) * len, Math.sin(a + 0.05) * len);
        ctx.fill();
      }
      ctx.restore();

      // Halo central.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      halo.addColorStop(0, `rgba(255,240,190,${0.55 * lit})`);
      halo.addColorStop(0.35, `rgba(255,200,110,${0.18 * lit})`);
      halo.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);

      // Onde de choc.
      const sw = clamp01(after / 0.7);
      if (sw < 1) {
        ctx.strokeStyle = '#fff4d0';
        ctx.globalAlpha = 1 - sw;
        ctx.lineWidth = 3 * (1 - sw) + 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, R * (1 + sw * 1.4), 0, TAU); ctx.stroke();
      }
    }

    // Le glyphe, tracé à l'encre d'argent.
    const ink = lit > 0 ? `rgb(${Math.round(200 + 55 * lit)},${Math.round(215 + 23 * lit)},${Math.round(255 - 85 * lit)})` : '#cfd8ff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let tip = null;
    for (const g of strokes) {
      const p = ease(phase(t, g.window));
      if (p <= 0) continue;
      const pt = drawPartial(g.points, p, ink, g.width, lit);
      if (p < 1) tip = pt;
    }

    // Pointe de la plume.
    if (tip) {
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 26);
      g.addColorStop(0, 'rgba(235,240,255,0.95)');
      g.addColorStop(0.2, 'rgba(160,180,255,0.45)');
      g.addColorStop(1, 'rgba(120,140,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(tip.x - 26, tip.y - 26, 52, 52);
      if (Math.random() < 0.7) {
        sparks.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 40, life: 0.5 + Math.random() * 0.4, max: 0.9, cool: true });
      }
    }

    // Étincelles.
    const dt = 1 / 60;
    for (const s of sparks) {
      s.life -= dt;
      s.vy += 40 * dt;
      s.vx *= 0.985; s.vy *= 0.985;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const a = clamp01(s.life / s.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.cool ? '#c7d2ff' : '#ffe2a0';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.cool ? 1.2 : 1.8, 0, TAU); ctx.fill();
    }
    sparks = sparks.filter(s => s.life > 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawPartial(points, p, color, width, lit) {
    const n = Math.max(2, Math.ceil(points.length * p));
    ctx.strokeStyle = color;
    ctx.shadowColor = lit > 0 ? '#ffd27a' : '#8fa2ff';
    ctx.shadowBlur = 10 + 14 * lit;
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx[i ? 'lineTo' : 'moveTo'](points[i].x, points[i].y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    return points[n - 1];
  }
}

// Glyphe de démonstration : sigil de lumière, six signes, anneau double.
function buildGlyph(cx, cy, R) {
  const out = [];
  const place = (unit, ox, oy, half) => unit.map(s => s.map(p => ({ x: ox + p.x * half, y: oy + p.y * half })));
  const add = (list, window, width) => {
    const k = list.length;
    list.forEach((pts, i) => {
      const a = window[0] + ((window[1] - window[0]) * i) / k;
      const b = window[0] + ((window[1] - window[0]) * (i + 1)) / k;
      out.push({ points: densify(pts), window: [a, b], width });
    });
  };

  add(place(SIGILS.lumiere.strokes(), cx, cy, R * 0.3), T.sigil, 2.6);

  const keys = ['convergence', 'amplification', 'persistance', 'colonne', 'repetition', 'levitation'];
  const signStrokes = [];
  keys.forEach((k, i) => {
    const a = -Math.PI / 2 + (i / keys.length) * TAU;
    signStrokes.push(...place(SIGNS[k].strokes(), cx + Math.cos(a) * R * 0.68, cy + Math.sin(a) * R * 0.68, R * 0.1));
  });
  add(signStrokes, T.signs, 1.8);

  // Anneau principal (tracé en dernier) et filet intérieur.
  const ring = [];
  for (let i = 0; i <= 160; i++) {
    const a = -Math.PI / 2 + (i / 160) * TAU;
    ring.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  out.push({ points: ring, window: T.ring, width: 3 });
  const inner = [];
  for (let i = 0; i <= 120; i++) {
    const a = Math.PI / 2 - (i / 120) * TAU;
    inner.push({ x: cx + Math.cos(a) * R * 0.45, y: cy + Math.sin(a) * R * 0.45 });
  }
  out.push({ points: inner, window: [T.ring[0] + 0.1, T.ring[1] - 0.1], width: 1 });
  return out;
}

function densify(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}
