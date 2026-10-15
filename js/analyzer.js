// Analyse des traits : anneaux, zones, reconnaissance, métriques de qualité.
// Implémente la chaîne de traitement de docs/etude-pictogrammes.md §9.2–9.3.

import { sigilRecognizer, signRecognizer, SIGNS } from './glyphs.js';

const TAU = Math.PI * 2;
const RING_MIN_R = 45;
const SIGIL_ZONE = 0.45;     // r/R en dessous duquel un trait appartient au sigil
const MIN_SCORE_SIGIL = 0.6;
const MIN_SCORE_SIGN = 0.68;

export function strokeLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

// Ajustement de cercle algébrique (Kåsa), suivi d'un raffinement géométrique.
export function fitCircle(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my;
    suu += u * u; svv += v * v; suv += u * v;
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + svuu);
  let uc = (b1 * svv - b2 * suv) / det;
  let vc = (suu * b2 - suv * b1) / det;
  let cx = uc + mx, cy = vc + my;
  // Quelques itérations de Gauss-Newton simplifiées (moyenne des rayons).
  let r = 0;
  for (let it = 0; it < 4; it++) {
    r = 0;
    for (const p of pts) r += Math.hypot(p.x - cx, p.y - cy);
    r /= n;
    let gx = 0, gy = 0;
    for (const p of pts) {
      const d = Math.hypot(p.x - cx, p.y - cy) || 1e-6;
      gx += (p.x - cx) / d; gy += (p.y - cy) / d;
    }
    cx = mx - r * gx / n;
    cy = my - r * gy / n;
  }
  r = 0;
  for (const p of pts) r += Math.hypot(p.x - cx, p.y - cy);
  r /= n;
  let varr = 0;
  for (const p of pts) varr += (Math.hypot(p.x - cx, p.y - cy) - r) ** 2;
  return { cx, cy, r, cv: Math.sqrt(varr / n) / r };
}

function angularSpan(pts, cx, cy) {
  let total = 0;
  let prev = Math.atan2(pts[0].y - cy, pts[0].x - cx);
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
    let d = a - prev;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    total += d;
    prev = a;
  }
  return Math.abs(total);
}

function isRingArc(stroke) {
  const pts = stroke.points;
  if (pts.length < 8) return null;
  const len = strokeLength(pts);
  if (len < 70) return null;
  const fit = fitCircle(pts);
  if (!fit || fit.r < RING_MIN_R || fit.r > 2000) return null;
  if (fit.cv > 0.09) return null;
  const span = angularSpan(pts, fit.cx, fit.cy);
  if (span < Math.PI / 3) return null;
  return { ...fit, span, len };
}

// Couverture angulaire de l'anneau, sur 360 cases d'un degré.
function ringCoverage(arcStrokes, cx, cy, R) {
  const bins = new Uint8Array(360);
  const band = R * 0.22;
  const mark = (a0, a1) => {
    let d = a1 - a0;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    const steps = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 360)));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + d * (k / steps);
      const deg = Math.floor(((a * 180 / Math.PI) % 360 + 360) % 360);
      bins[deg] = 1;
    }
  };
  for (const s of arcStrokes) {
    const pts = s.points;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const rp = Math.hypot(p.x - cx, p.y - cy), rq = Math.hypot(q.x - cx, q.y - cy);
      if (Math.abs(rp - R) > band || Math.abs(rq - R) > band) continue;
      mark(Math.atan2(p.y - cy, p.x - cx), Math.atan2(q.y - cy, q.x - cx));
    }
  }
  let covered = 0;
  for (let i = 0; i < 360; i++) covered += bins[i];
  // Plus grande lacune (circulaire) et liste des lacunes.
  const gaps = [];
  if (covered < 360) {
    let start = bins.findIndex(b => b === 1);
    if (start < 0) start = 0;
    let run = 0, runStart = -1;
    for (let k = 1; k <= 360; k++) {
      const i = (start + k) % 360;
      if (!bins[i]) {
        if (run === 0) runStart = i;
        run++;
      } else if (run > 0) {
        gaps.push({ start: runStart, size: run });
        run = 0;
      }
    }
    if (run > 0) gaps.push({ start: runStart, size: run });
  }
  const maxGap = gaps.reduce((m, g) => Math.max(m, g.size), 0);
  return { covered, gaps, maxGap };
}

// Tremblement : déviation moyenne à la courbe lissée, relative au rayon.
function tremor(arcStrokes, cx, cy, R) {
  let sum = 0, n = 0;
  for (const s of arcStrokes) {
    const r = s.points.map(p => Math.hypot(p.x - cx, p.y - cy));
    for (let i = 2; i < r.length - 2; i++) {
      const smooth = (r[i - 2] + r[i - 1] + r[i] + r[i + 1] + r[i + 2]) / 5;
      sum += Math.abs(r[i] - smooth);
      n++;
    }
  }
  if (!n) return 0;
  return Math.min(1, (sum / n) / (R * 0.012));
}

function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function clusterStrokes(strokes, margin) {
  const boxes = strokes.map(s => bbox(s.points));
  const parent = strokes.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.minX - margin <= b.maxX && b.minX - margin <= a.maxX &&
          a.minY - margin <= b.maxY && b.minY - margin <= a.maxY) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map();
  strokes.forEach((s, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(s);
  });
  return [...groups.values()];
}

const DIRS = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
export function compass(angle) {
  const i = Math.round((((angle % TAU) + TAU) % TAU) / (Math.PI / 4)) % 8;
  return DIRS[i];
}

// Point d'entrée : liste de traits {id, points:[{x,y}]} → liste de glyphes analysés.
export function analyze(strokes) {
  const live = strokes.filter(s => !s.spent && s.points.length > 1);

  // 1. Arcs d'anneau candidats.
  const arcs = [];
  for (const s of live) {
    const fit = isRingArc(s);
    if (fit) arcs.push({ stroke: s, fit });
  }

  // 2. Fusion des arcs de même centre et même rayon.
  const groups = [];
  arcs.sort((a, b) => b.fit.len - a.fit.len);
  for (const a of arcs) {
    const g = groups.find(g =>
      Math.hypot(g.cx - a.fit.cx, g.cy - a.fit.cy) < g.r * 0.18 &&
      Math.abs(g.r - a.fit.r) < g.r * 0.18);
    if (g) {
      g.arcs.push(a);
    } else {
      groups.push({ cx: a.fit.cx, cy: a.fit.cy, r: a.fit.r, arcs: [a] });
    }
  }

  const arcIds = new Set(arcs.map(a => a.stroke.id));
  const rings = [];
  for (const g of groups) {
    const allPts = g.arcs.flatMap(a => a.stroke.points);
    const fit = fitCircle(allPts);
    if (!fit) continue;
    const arcStrokes = g.arcs.map(a => a.stroke);
    // Petits traits posés sur l'anneau (fermeture d'une lacune) : ils en font partie.
    for (const s of live) {
      if (arcIds.has(s.id)) continue;
      let onRing = 0;
      for (const p of s.points) if (Math.abs(Math.hypot(p.x - fit.cx, p.y - fit.cy) - fit.r) < fit.r * 0.07) onRing++;
      if (onRing / s.points.length >= 0.85) arcStrokes.push(s);
    }
    const cov = ringCoverage(arcStrokes, fit.cx, fit.cy, fit.r);
    // Il faut au moins une moitié d'anneau pour parler d'un glyphe.
    if (cov.covered < 180) continue;
    const toleranceDeg = Math.max(2, (7 / fit.r) * 180 / Math.PI);
    rings.push({
      cx: fit.cx, cy: fit.cy, R: fit.r,
      cv: fit.cv,
      strokes: arcStrokes,
      coverage: cov,
      closed: cov.maxGap <= toleranceDeg,
      tremor: tremor(arcStrokes, fit.cx, fit.cy, fit.r),
    });
  }
  rings.sort((a, b) => a.R - b.R);

  // 3. Attribution des autres traits au plus petit anneau qui les contient.
  const ringStrokeIds = new Set(rings.flatMap(r => r.strokes.map(s => s.id)));
  const contents = rings.map(() => []);
  for (const s of live) {
    if (ringStrokeIds.has(s.id)) continue;
    for (let k = 0; k < rings.length; k++) {
      const r = rings[k];
      let inside = 0;
      for (const p of s.points) if (Math.hypot(p.x - r.cx, p.y - r.cy) < r.R * 0.97) inside++;
      if (inside / s.points.length >= 0.9) { contents[k].push(s); break; }
    }
  }

  // 4. Zonage, reconnaissance, métriques.
  return rings.map((ring, k) => analyzeGlyph(ring, contents[k]));
}

function analyzeGlyph(ring, inner) {
  const { cx, cy, R } = ring;
  const sigilStrokes = [], signStrokes = [];
  for (const s of inner) {
    const c = centroid(s.points);
    const d = Math.hypot(c.x - cx, c.y - cy) / R;
    (d < SIGIL_ZONE ? sigilStrokes : signStrokes).push(s);
  }

  let sigil = null;
  if (sigilStrokes.length) {
    const res = sigilRecognizer.classify(sigilStrokes.map(s => s.points));
    const best = res[0];
    const margin = best.score - (res[1]?.score ?? 0);
    sigil = {
      key: best.score >= MIN_SCORE_SIGIL ? best.name : null,
      guess: best.name,
      score: best.score,
      margin,
      strokes: sigilStrokes,
      box: bbox(sigilStrokes.flatMap(s => s.points)),
    };
  }

  const signs = [];
  for (const group of clusterStrokes(signStrokes, R * 0.09)) {
    const pts = group.flatMap(s => s.points);
    const c = centroid(pts);
    const res = signRecognizer.classify(group.map(s => s.points));
    const best = res[0];
    signs.push({
      key: best.score >= MIN_SCORE_SIGN ? best.name : null,
      guess: best.name,
      score: best.score,
      angle: Math.atan2(c.y - cy, c.x - cx),
      x: c.x, y: c.y,
      box: bbox(pts),
      strokes: group,
    });
  }

  // Équilibre (règle Q4) : vecteur moyen des signes.
  let bx = 0, by = 0;
  for (const s of signs) { bx += Math.cos(s.angle); by += Math.sin(s.angle); }
  const imbalance = signs.length ? Math.hypot(bx, by) / signs.length : 0;
  const imbalanceAngle = Math.atan2(by, bx);

  const circularity = Math.max(0, 1 - ring.cv * 8);
  const steadiness = 1 - ring.tremor;
  const readScores = [sigil?.score ?? 0, ...signs.map(s => s.score)];
  const legibility = readScores.reduce((a, b) => a + b, 0) / readScores.length;
  const neatness = Math.max(0, Math.min(1,
    0.4 * circularity + 0.3 * steadiness + 0.3 * Math.min(1, Math.max(0, (legibility - 0.6) / 0.35))));

  const warnings = [];
  if (!ring.closed) {
    const missing = 360 - ring.coverage.covered;
    warnings.push(`Anneau ouvert : il manque ${missing}° d'encre. Fermez-le pour activer le sort.`);
  }
  if (!sigilStrokes.length) warnings.push("Aucun sigil au centre : l'anneau est vide.");
  else if (!sigil.key) warnings.push(`Sigil illisible (ressemble à « ${guessName(sigil.guess, true)} », ${(sigil.score * 100) | 0} %).`);
  const unread = signs.filter(s => !s.key);
  if (unread.length) warnings.push(`${unread.length} signe(s) illisible(s) : le sort sera instable.`);
  if (circularity < 0.6) warnings.push('Anneau irrégulier : le sort sera moins stable.');
  if (ring.tremor > 0.6) warnings.push('Trait tremblant : risque de ratés.');
  if (imbalance > 0.3 && !signs.some(s => s.key === 'projection')) {
    warnings.push(`Signes déséquilibrés : le sort dérive vers ${compass(imbalanceAngle)}.`);
  }

  return {
    cx, cy, R,
    ring,
    sigil,
    signs,
    imbalance, imbalanceAngle,
    metrics: {
      closure: ring.coverage.covered / 360,
      circularity, tremor: ring.tremor, steadiness, legibility, neatness,
    },
    warnings,
    strokeIds: [...ring.strokes, ...inner].map(s => s.id),
    signature: signature(sigil, signs),
  };
}

function guessName(key, isSigil) {
  if (isSigil) return { feu: 'Feu', eau: 'Eau', vent: 'Vent', terre: 'Terre', lumiere: 'Lumière' }[key] ?? key;
  return SIGNS[key]?.name ?? key;
}

function signature(sigil, signs) {
  const parts = [sigil?.key ?? '?'];
  for (const s of [...signs].sort((a, b) => a.angle - b.angle)) {
    parts.push(`${s.key ?? '?'}@${Math.round(s.angle * 4)}`);
  }
  return parts.join('|');
}
