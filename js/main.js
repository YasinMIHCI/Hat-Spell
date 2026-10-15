// Atelier : saisie à la plume, réserve d'encre, rendu, interface.

import { SIGILS, SIGNS, composeGlyph, distributeSigns } from './glyphs.js';
import { analyze, compass } from './analyzer.js';
import { compile, SURFACES, FORM_NAMES } from './spells.js';
import { World } from './world.js';
import { playIntro } from './intro.js';

const TAU = Math.PI * 2;
const INK_CAPACITY = 100;
const INK_PER_PX = 100 / 5200;

const $ = sel => document.querySelector(sel);
const canvas = $('#scene');
const ctx = canvas.getContext('2d');
const inkCanvas = document.createElement('canvas');
const inkCtx = inkCanvas.getContext('2d');
const paperCanvas = document.createElement('canvas');
const darkCanvas = document.createElement('canvas');

const state = {
  strokes: [],
  current: null,
  tool: 'plume',
  ink: INK_CAPACITY,
  dry: 0,              // longueur de lacune sèche restante (px)
  surface: 'parchemin',
  showAnalysis: true,
  glyphs: [],
  active: new Map(),   // id de sort -> {id, cx, cy, R, signature, strokeIds, spell, startedAt}
  nextStrokeId: 1,
  nextSpellId: 1,
  guide: null,
  autodraw: null,
  w: 0, h: 0, dpr: 1,
};

const world = new World();
world.onSpellEnd = (id, dispelled) => {
  const a = state.active.get(id);
  if (!a) return;
  state.active.delete(id);
  if (!dispelled) {
    // Le sort a consumé l'encre : le glyphe reste sur le papier, éteint.
    const ids = new Set(a.strokeIds);
    for (const s of state.strokes) if (ids.has(s.id)) s.spent = true;
    toast(`Le sort s'éteint : l'encre du glyphe est consumée.`);
    redrawInk();
    reanalyze(false);
  }
  renderPanel();
};

// --- Mise en page --------------------------------------------------------

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  state.w = rect.width; state.h = rect.height;
  for (const c of [canvas, inkCanvas, paperCanvas]) {
    c.width = Math.round(rect.width * state.dpr);
    c.height = Math.round(rect.height * state.dpr);
  }
  darkCanvas.width = Math.round(rect.width / 2);
  darkCanvas.height = Math.round(rect.height / 2);
  world.resize(rect.width, rect.height);
  drawPaper();
  redrawInk();
}

function drawPaper() {
  const g = paperCanvas.getContext('2d');
  const { w, h, dpr } = state;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const base = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  base.addColorStop(0, '#efe4cc');
  base.addColorStop(1, '#d9c7a2');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Grain et fibres du papier.
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '120,90,50' : '255,250,235'},${rnd() * 0.06})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.strokeStyle = 'rgba(120,90,50,0.05)';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = rnd() * h, l = 20 + rnd() * 60, a = rnd() * TAU;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // Sol de l'atelier.
  const fy = h - 26;
  const floor = g.createLinearGradient(0, fy, 0, h);
  floor.addColorStop(0, 'rgba(90,64,40,0.35)');
  floor.addColorStop(1, 'rgba(90,64,40,0.55)');
  g.fillStyle = floor;
  g.fillRect(0, fy, w, h - fy);
  g.strokeStyle = 'rgba(70,48,28,0.5)';
  g.beginPath(); g.moveTo(0, fy); g.lineTo(w, fy); g.stroke();
}

// --- Encre ---------------------------------------------------------------

function strokePath(g, pts, widthK = 1) {
  if (pts.length < 2) {
    const p = pts[0];
    g.beginPath(); g.arc(p.x, p.y, (p.w ?? 2) * 0.5 * widthK, 0, TAU); g.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    g.lineWidth = ((a.w ?? 2) + (b.w ?? 2)) * 0.5 * widthK;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
}

function drawStroke(g, s) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (s.spent) {
    g.strokeStyle = g.fillStyle = 'rgba(120,96,70,0.35)';
    strokePath(g, s.points);
    return;
  }
  // Légère diffusion de l'encre dans les fibres, puis le trait.
  g.strokeStyle = g.fillStyle = 'rgba(30,26,60,0.12)';
  strokePath(g, s.points, 2.1);
  g.strokeStyle = g.fillStyle = 'rgba(22,20,44,0.92)';
  strokePath(g, s.points);
}

function redrawInk() {
  const { dpr } = state;
  inkCtx.setTransform(1, 0, 0, 1, 0, 0);
  inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const s of state.strokes) drawStroke(inkCtx, s);
}

function addStroke(points) {
  if (points.length < 2) return null;
  const s = { id: state.nextStrokeId++, points };
  state.strokes.push(s);
  drawStroke(inkCtx, s);
  return s;
}

// --- Saisie --------------------------------------------------------------

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

let last = null;
canvas.addEventListener('pointerdown', e => {
  if (state.autodraw) return;
  canvas.setPointerCapture(e.pointerId);
  const p = pos(e);
  last = { ...p, t: performance.now() };
  if (state.tool === 'gomme') { erase(p); return; }
  if (state.ink <= 0) { toast('La plume est sèche. Trempez-la dans l\'encrier (touche R).'); }
  state.current = state.dry > 0 || state.ink <= 0 ? null : [{ ...p, w: penWidth(e, 0) }];
});

canvas.addEventListener('pointermove', e => {
  if (!last) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) {
    const p = pos(ev);
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 1.5) continue;
    const now = performance.now();
    const speed = d / Math.max(1, now - last.t);
    if (state.tool === 'gomme') erase(p);
    else penMove(p, d, penWidth(ev, speed));
    last = { ...p, t: now };
  }
});

function endPointer() {
  if (!last) return;
  last = null;
  if (state.tool === 'plume') {
    if (state.current) addStroke(state.current);
    state.current = null;
    state.dry = 0;
    reanalyze(true);
  } else {
    redrawInk();
    reanalyze(true);
  }
  updateInkGauge();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function penWidth(e, speed) {
  if (e.pointerType === 'pen' && e.pressure > 0) return 1.2 + e.pressure * 3.6;
  return Math.max(1.4, 3.6 - speed * 1.1);
}

function penMove(p, d, w) {
  state.ink = Math.max(0, state.ink - d * INK_PER_PX);
  // Plume presque vide : le trait se troue (lacunes sèches).
  if (state.dry <= 0 && state.ink < 15) {
    const chance = state.ink <= 0 ? 1 : ((15 - state.ink) / 15) * 0.025 * d;
    if (Math.random() < chance) state.dry = state.ink <= 0 ? Infinity : 6 + Math.random() * 10;
  }
  if (state.dry > 0) {
    state.dry -= d;
    if (state.current) { addStroke(state.current); state.current = null; }
    if (state.dry <= 0 && state.ink > 0) state.current = [{ ...p, w }];
    return;
  }
  if (!state.current) state.current = [];
  const prev = state.current[state.current.length - 1];
  const smoothW = prev ? prev.w * 0.6 + w * 0.4 : w;
  state.current.push({ ...p, w: smoothW });
  if (prev) {
    inkCtx.lineCap = 'round';
    inkCtx.strokeStyle = 'rgba(22,20,44,0.92)';
    inkCtx.lineWidth = smoothW;
    inkCtx.beginPath(); inkCtx.moveTo(prev.x, prev.y); inkCtx.lineTo(p.x, p.y); inkCtx.stroke();
  }
}

// Gomme : coupe les traits, ce qui peut briser un anneau actif.
function erase(p) {
  const r = 14;
  const out = [];
  let changed = false;
  for (const s of state.strokes) {
    let seg = [];
    let cut = false;
    for (const q of s.points) {
      if (Math.hypot(q.x - p.x, q.y - p.y) < r) {
        cut = true;
        if (seg.length > 1) out.push({ ...s, id: state.nextStrokeId++, points: seg });
        seg = [];
      } else seg.push(q);
    }
    if (!cut) { out.push(s); continue; }
    changed = true;
    if (seg.length > 1) out.push({ ...s, id: state.nextStrokeId++, points: seg });
  }
  if (changed) { state.strokes = out; redrawInk(); }
}

// --- Analyse et cycle de vie des sorts ----------------------------------

function matchActive(g) {
  for (const a of state.active.values()) {
    if (Math.hypot(a.cx - g.cx, a.cy - g.cy) < a.R * 0.25 && Math.abs(a.R - g.R) < a.R * 0.25) return a;
  }
  return null;
}

function reanalyze(react) {
  state.glyphs = analyze(state.strokes);
  if (!react) { renderPanel(); return; }
  const seen = new Set();
  for (const g of state.glyphs) {
    const a = matchActive(g);
    if (a) seen.add(a.id);
    if (!g.ring.closed) {
      if (a) {
        world.dispel(a.id);
        state.active.delete(a.id);
        toast('Anneau brisé : le sort s\'interrompt.');
      }
      continue;
    }
    const spell = compile(g, state.surface);
    if (!spell || spell.kind === 'vide') continue;
    if (a) {
      a.strokeIds = g.strokeIds;
      if (a.signature !== g.signature) {
        a.signature = g.signature; a.spell = spell;
        world.recompile(a.id, g, spell);
        toast('Le glyphe a changé : le sort se reconfigure.');
      }
    } else {
      const id = state.nextSpellId++;
      state.active.set(id, { id, cx: g.cx, cy: g.cy, R: g.R, signature: g.signature, strokeIds: g.strokeIds, spell, startedAt: world.time });
      seen.add(id);
      world.cast(id, g, spell);
      toast(spell.kind === 'rate' ? spell.description : `Anneau fermé : ${spell.description.split('.')[0]}.`);
    }
  }
  for (const a of [...state.active.values()]) {
    if (!seen.has(a.id)) {
      world.dispel(a.id);
      state.active.delete(a.id);
      toast('Glyphe effacé : le sort se dissipe.');
    }
  }
  renderPanel();
}

// --- Rendu ---------------------------------------------------------------

let prevT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - prevT) / 1000);
  prevT = t;
  world.night = $('#night').checked;
  world.update(dt);
  render();
  requestAnimationFrame(frame);
}

function render() {
  const { w, h, dpr } = state;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paperCanvas, 0, 0);
  ctx.drawImage(inkCanvas, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.guide) drawGuide(state.guide);
  drawActiveGlow();
  if (state.showAnalysis) drawAnnotations();
  world.render(ctx);
  if (state.autodraw) drawAutodrawStep();
  if (world.night) {
    const glyphLights = [...state.active.values()].map(a => ({ x: a.cx, y: a.cy, r: a.R * 1.2, color: '255,255,255' }));
    world.renderDarkness(ctx, darkCanvas, glyphLights);
    drawActiveGlow();
  }
  if (state.ink < 15) {
    ctx.fillStyle = 'rgba(140,40,30,0.8)';
    ctx.font = '600 12px "Alegreya Sans", sans-serif';
    ctx.fillText(state.ink <= 0 ? 'Plume sèche' : 'Encre presque épuisée', 12, h - 34);
  }
}

function drawActiveGlow() {
  const t = world.time;
  for (const a of state.active.values()) {
    const rt = world.runtimes.get(a.id);
    if (!rt) continue;
    const color = a.spell.color ?? '#ffffff';
    const pulse = 0.55 + 0.25 * Math.sin(t * 3 + a.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = pulse * (rt.ending ? Math.max(0, 1 - rt.fade) : 1);
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(a.cx, a.cy, a.R, 0, TAU); ctx.stroke();
    // Le reste du glyphe luit faiblement.
    const ids = new Set(a.strokeIds);
    ctx.lineWidth = 1.4;
    ctx.globalAlpha *= 0.7;
    for (const s of state.strokes) {
      if (!ids.has(s.id)) continue;
      ctx.beginPath();
      s.points.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
      ctx.stroke();
    }
    ctx.restore();
    // Temps restant.
    if (rt.spell.duration && !world.night) {
      const left = Math.max(0, 1 - rt.t / rt.spell.duration);
      ctx.strokeStyle = 'rgba(40,30,70,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(a.cx, a.cy, a.R + 7, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
    }
  }
}

function drawAnnotations() {
  ctx.save();
  ctx.font = '600 11px "Alegreya Sans", sans-serif';
  ctx.textAlign = 'center';
  for (const g of state.glyphs) {
    // Zone du sigil.
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(60,70,130,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.45, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // Lacunes de l'anneau en rouge.
    if (!g.ring.closed) {
      ctx.strokeStyle = 'rgba(200,40,30,0.85)';
      ctx.lineWidth = 4;
      for (const gap of g.ring.coverage.gaps) {
        const a0 = gap.start * Math.PI / 180, a1 = (gap.start + gap.size) * Math.PI / 180;
        ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, a0, a1); ctx.stroke();
      }
    }
    // Étiquettes.
    if (g.sigil) {
      const name = g.sigil.key ? SIGILS[g.sigil.key].name : '?';
      label(name, g.cx, g.sigil.box.maxY + 14, !!g.sigil.key);
    }
    for (const s of g.signs) {
      label(s.key ? SIGNS[s.key].name : '?', s.x, s.box.maxY + 12, !!s.key);
    }
  }
  ctx.restore();
}

function label(text, x, y, ok) {
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = ok ? 'rgba(36,44,96,0.78)' : 'rgba(170,40,30,0.85)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 9, w, 15, 4);
  ctx.fill();
  ctx.fillStyle = '#f6efe0';
  ctx.fillText(text, x, y + 2);
}

function drawGuide(guide) {
  ctx.save();
  ctx.strokeStyle = 'rgba(60,80,160,0.22)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  for (const s of guide.strokes) {
    ctx.beginPath();
    s.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
    ctx.stroke();
  }
  ctx.restore();
}

// --- Tracé automatique (démonstration) ----------------------------------

function startAutodraw(strokes, speed = 1) {
  state.autodraw = { strokes, i: 0, k: 0, speed, acc: 0 };
  state.guide = null;
}

function drawAutodrawStep() {
  const ad = state.autodraw;
  const s = ad.strokes[ad.i];
  ad.k += Math.max(2, s.length / 14) * ad.speed;
  const n = Math.min(s.length, Math.floor(ad.k));
  // Plume en cours.
  ctx.strokeStyle = 'rgba(22,20,44,0.92)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let j = 0; j < n; j++) ctx[j ? 'lineTo' : 'moveTo'](s[j].x, s[j].y);
  ctx.stroke();
  if (n > 0) {
    const tip = s[n - 1];
    ctx.fillStyle = 'rgba(22,20,44,0.9)';
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 3, 0, TAU); ctx.fill();
  }
  if (n >= s.length) {
    addStroke(s.map(p => ({ ...p, w: 2.6 })));
    ad.i++; ad.k = 0;
    if (ad.i >= ad.strokes.length) {
      state.autodraw = null;
      reanalyze(true);
    }
  }
}

function freeSpot(R) {
  const { w, h } = state;
  const taken = state.glyphs.map(g => ({ x: g.cx, y: g.cy, r: g.R }));
  const cands = [];
  for (let y = R + 20; y < h - R - 40; y += R * 0.5) {
    for (let x = R + 20; x < w - R - 20; x += R * 0.5) cands.push({ x, y });
  }
  cands.sort((a, b) => Math.hypot(a.x - w / 2, a.y - h * 0.45) - Math.hypot(b.x - w / 2, b.y - h * 0.45));
  return cands.find(c => taken.every(t => Math.hypot(c.x - t.x, c.y - t.y) > t.r + R + 10)) ?? { x: w / 2, y: h * 0.45 };
}

// --- Interface -----------------------------------------------------------

const composer = { sigil: 'feu', signs: [], projAngle: 0 };

function composerGlyph() {
  const R = Math.max(70, Math.min(150, Math.min(state.w, state.h) * 0.24));
  const spot = freeSpot(R);
  return composeGlyph({
    cx: spot.x, cy: spot.y, R,
    sigil: composer.sigil,
    signs: distributeSigns(composer.signs, composer.projAngle),
    leaveOpen: $('#leave-open').checked,
  });
}

function svgFor(strokes) {
  const d = strokes.map(s => 'M' + s.map(p => `${(p.x * 40 + 50).toFixed(1)} ${(p.y * 40 + 50).toFixed(1)}`).join(' L')).join(' ');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}"/></svg>`;
}

function buildGrimoire() {
  const sig = $('#sigil-list');
  sig.innerHTML = '';
  for (const [key, def] of Object.entries(SIGILS)) {
    const b = document.createElement('button');
    b.className = 'glyph-tile';
    b.id = `sigil-${key}`;
    b.setAttribute('aria-pressed', String(composer.sigil === key));
    b.innerHTML = `${svgFor(def.strokes())}<span class="tile-name">${def.name}</span><span class="tile-hint">${def.hint}</span>`;
    b.style.setProperty('--el', def.color);
    b.onclick = () => { composer.sigil = key; buildGrimoire(); };
    sig.appendChild(b);
  }
  const sg = $('#sign-list');
  sg.innerHTML = '';
  for (const [key, def] of Object.entries(SIGNS)) {
    const count = composer.signs.filter(k => k === key).length;
    const b = document.createElement('button');
    b.className = 'glyph-tile small';
    b.id = `sign-${key}`;
    b.setAttribute('aria-pressed', String(count > 0));
    b.innerHTML = `${svgFor(def.strokes())}<span class="tile-name">${def.name}${count > 1 ? ` ×${count}` : ''}</span><span class="tile-hint">${def.effect}</span>`;
    b.title = `${def.hint} Clic : ajouter. Clic droit : retirer.`;
    b.onclick = () => {
      if (composer.signs.length >= 8) { toast('Huit signes au plus dans un anneau.'); return; }
      composer.signs.push(key); buildGrimoire();
    };
    b.oncontextmenu = e => {
      e.preventDefault();
      const i = composer.signs.lastIndexOf(key);
      if (i >= 0) composer.signs.splice(i, 1);
      buildGrimoire();
    };
    sg.appendChild(b);
  }
  const recipe = $('#recipe');
  const signTxt = composer.signs.length ? composer.signs.map(k => SIGNS[k].name).join(' · ') : 'aucun signe';
  recipe.textContent = `${SIGILS[composer.sigil].name} — ${signTxt}`;
  $('#proj-dir').hidden = !composer.signs.includes('projection');
}

function renderPanel() {
  const list = $('#glyph-list');
  if (!state.glyphs.length) {
    list.innerHTML = `<p class="empty">Aucun glyphe sur le papier. Tracez un cercle autour d'un sigil, ou ouvrez le Grimoire pour qu'une plume le trace pour vous.</p>`;
    return;
  }
  list.innerHTML = '';
  state.glyphs.forEach((g, i) => {
    const a = matchActive(g);
    const rt = a ? world.runtimes.get(a.id) : null;
    const spell = g.ring.closed ? compile(g, state.surface) : null;
    const status = rt ? 'actif' : g.ring.closed ? (spell?.kind === 'vide' ? 'vide' : 'fermé') : 'ouvert';
    const m = g.metrics;
    const el = g.sigil?.key ? SIGILS[g.sigil.key] : null;
    const card = document.createElement('article');
    card.className = 'glyph-card';
    card.style.setProperty('--el', el?.color ?? 'var(--muted)');
    card.innerHTML = `
      <header>
        <span class="g-index">Glyphe ${i + 1}</span>
        <span class="pill pill-${status}">${{ actif: 'Actif', fermé: 'Fermé', ouvert: 'Ouvert', vide: 'Vide' }[status]}</span>
      </header>
      <p class="g-title">${el ? el.name : g.sigil ? 'Sigil illisible' : 'Sans sigil'}${spell?.form ? ` · ${FORM_NAMES[spell.form]}` : ''}</p>
      <ul class="g-signs">${g.signs.map(s => `<li class="${s.key ? '' : 'bad'}">${s.key ? SIGNS[s.key].glyph + ' ' + SIGNS[s.key].name : '? illisible'} <small>${compass(s.angle)} · ${(s.score * 100) | 0} %</small></li>`).join('') || '<li class="none">aucun signe</li>'}</ul>
      <dl class="metrics">
        ${meter('Fermeture', m.closure)}
        ${meter('Circularité', m.circularity)}
        ${meter('Stabilité du trait', m.steadiness)}
        ${meter('Lisibilité', Math.max(0, (m.legibility - 0.5) / 0.5))}
        ${meter('Netteté', m.neatness)}
      </dl>
      <p class="g-desc">${spell?.description ?? (g.ring.closed ? '' : 'Le sort attend que l\'anneau soit fermé.')}</p>
      ${rt && rt.spell.duration ? `<p class="g-time">Reste ${Math.max(0, rt.spell.duration - rt.t).toFixed(0)} s · rayon ${g.R.toFixed(0)} px</p>` : `<p class="g-time">Rayon ${g.R.toFixed(0)} px</p>`}
      ${g.warnings.length ? `<ul class="warnings">${g.warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <div class="g-actions"><button class="btn ghost" data-erase="${i}">Effacer ce glyphe</button></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-erase]').forEach(b => b.onclick = () => {
    const g = state.glyphs[+b.dataset.erase];
    const ids = new Set(g.strokeIds);
    state.strokes = state.strokes.filter(s => !ids.has(s.id));
    redrawInk();
    reanalyze(true);
  });
}

function meter(name, v) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  const level = pct >= 80 ? 'good' : pct >= 55 ? 'warn' : 'bad';
  return `<div class="meter"><dt>${name}</dt><dd><span class="bar"><span class="fill ${level}" style="width:${pct}%"></span></span><span class="num">${pct}</span></dd></div>`;
}

function updateInkGauge() {
  const pct = Math.round(state.ink / INK_CAPACITY * 100);
  $('#ink-fill').style.height = `${pct}%`;
  $('#ink-level').textContent = `${pct} %`;
  $('#ink').classList.toggle('low', pct < 15);
}

function refill() {
  state.ink = INK_CAPACITY;
  state.dry = 0;
  updateInkGauge();
  toast('Plume trempée dans l\'encrier.');
}

function setTool(t) {
  state.tool = t;
  $('#tool-plume').setAttribute('aria-pressed', String(t === 'plume'));
  $('#tool-gomme').setAttribute('aria-pressed', String(t === 'gomme'));
  canvas.dataset.tool = t;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function setTab(name) {
  for (const t of ['glyphes', 'grimoire', 'regles']) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`#panel-${t}`).hidden = t !== name;
  }
  try { localStorage.setItem('hat-spell-tab', name); } catch { /* stockage indisponible */ }
}

function bindUI() {
  $('#tool-plume').onclick = () => setTool('plume');
  $('#tool-gomme').onclick = () => setTool('gomme');
  $('#refill').onclick = refill;
  $('#analysis').onchange = e => { state.showAnalysis = e.target.checked; };
  $('#surface').onchange = e => { state.surface = e.target.value; reanalyze(false); };
  $('#autodraw').onclick = () => { if (!state.autodraw) startAutodraw(composerGlyph()); };
  $('#show-guide').onclick = () => {
    if (state.guide) { state.guide = null; $('#show-guide').textContent = 'Afficher le guide'; return; }
    state.guide = { strokes: composerGlyph() };
    $('#show-guide').textContent = 'Masquer le guide';
    toast('Repassez le guide à la plume. Fermez l\'anneau en dernier.');
  };
  $('#clear-signs').onclick = () => { composer.signs = []; buildGrimoire(); };
  $('#proj-angle').onchange = e => { composer.projAngle = +e.target.value * Math.PI / 180; };
  const clear = $('#clear');
  let armed = null;
  clear.onclick = () => {
    if (!armed) {
      clear.textContent = 'Confirmer ?';
      clear.classList.add('armed');
      armed = setTimeout(() => { armed = null; clear.textContent = 'Tout effacer'; clear.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(armed); armed = null;
    clear.textContent = 'Tout effacer'; clear.classList.remove('armed');
    for (const id of [...state.active.keys()]) world.dispel(id);
    state.active.clear();
    state.strokes = [];
    state.guide = null;
    redrawInk();
    reanalyze(false);
  };
  for (const t of ['glyphes', 'grimoire', 'regles']) $(`#tab-${t}`).onclick = () => setTab(t);
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') refill();
    else if (k === 'e') setTool('gomme');
    else if (k === 'p') setTool('plume');
    else if (k === 'n') { $('#night').checked = !$('#night').checked; }
  });
  new ResizeObserver(resize).observe(canvas);
  setInterval(() => { if (state.active.size) renderPanel(); }, 1000);
}

// --- Démarrage -----------------------------------------------------------

bindUI();
buildGrimoire();
setTool('plume');
let tab = 'glyphes';
try { tab = localStorage.getItem('hat-spell-tab') || tab; } catch { /* stockage indisponible */ }
setTab(['glyphes', 'grimoire', 'regles'].includes(tab) ? tab : 'glyphes');
resize();
updateInkGauge();
renderPanel();
requestAnimationFrame(frame);

// Exemple à l'ouverture, après l'intro : une plume trace une sphère d'eau.
playIntro().then(() => setTimeout(() => {
  if (state.strokes.length) return;
  const R = Math.max(70, Math.min(130, Math.min(state.w, state.h) * 0.22));
  startAutodraw(composeGlyph({
    cx: state.w * 0.5, cy: state.h * 0.42, R,
    sigil: 'eau', signs: distributeSigns(['convergence', 'persistance', 'levitation']),
  }), 1.6);
}, 300));

// Accès pour les tests automatisés.
window.__atelier = { state, world, analyze, startAutodraw, composeGlyph, distributeSigns, reanalyze, addStroke };
