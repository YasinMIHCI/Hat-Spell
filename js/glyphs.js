// Vocabulaire des pictogrammes : sigils (centre) et signes (couronne).
// Les tracés sont des créations originales qui suivent la grammaire du manga
// (voir docs/etude-pictogrammes.md §10). Coordonnées unitaires [-1, 1], y vers le bas.

import { Recognizer } from './recognizer.js';

// --- Primitives de tracé -------------------------------------------------

function line(x1, y1, x2, y2, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

function polyline(coords, perSeg = 10) {
  const pts = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const seg = line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1], perSeg);
    if (i > 0) seg.shift();
    pts.push(...seg);
  }
  return pts;
}

function arc(cx, cy, r, a0, a1, n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function bezier(p0, p1, p2, p3, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({
      x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    });
  }
  return pts;
}

function wave(y, amp, cycles, x0, x1, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x0 + (x1 - x0) * t, y: y - amp * Math.sin(t * cycles * Math.PI * 2) });
  }
  return pts;
}

function spiral(turns, r0, r1, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

const TAU = Math.PI * 2;

// --- Sigils --------------------------------------------------------------

export const SIGILS = {
  feu: {
    name: 'Feu', color: '#ff7a2a', glow: '#ffb35c',
    hint: 'Flamme : une goutte pointe en haut, avec un trait au centre.',
    strokes: () => {
      const left = bezier([0, 0.85], [-0.8, 0.45], [-0.45, -0.35], [0, -0.95]);
      const right = bezier([0, -0.95], [0.45, -0.35], [0.8, 0.45], [0, 0.85]);
      right.shift();
      return [[...left, ...right], line(0, 0.55, 0, -0.2)];
    },
  },
  eau: {
    name: 'Eau', color: '#3aa0ff', glow: '#9fd4ff',
    hint: 'Deux vagues horizontales superposées.',
    strokes: () => [wave(-0.32, 0.22, 1.5, -0.9, 0.9), wave(0.32, 0.22, 1.5, -0.9, 0.9)],
  },
  vent: {
    name: 'Vent', color: '#bfe8d6', glow: '#e6fff4',
    hint: 'Une spirale qui part du centre (deux tours).',
    strokes: () => [spiral(2, 0.05, 0.9)],
  },
  terre: {
    name: 'Terre', color: '#a9794a', glow: '#d8b48a',
    hint: 'Triangle pointe en bas, traversé par une barre horizontale.',
    strokes: () => [
      polyline([[-0.85, -0.6], [0.85, -0.6], [0, 0.85], [-0.85, -0.6]], 14),
      line(-0.6, 0, 0.6, 0),
    ],
  },
  lumiere: {
    name: 'Lumière', color: '#ffe88a', glow: '#fff8d6',
    hint: 'Étoile à six branches : trois traits qui se croisent.',
    strokes: () => [0, 60, 120].map(d => {
      const a = (d - 90) * Math.PI / 180;
      return line(-0.95 * Math.cos(a), -0.95 * Math.sin(a), 0.95 * Math.cos(a), 0.95 * Math.sin(a));
    }),
  },
};

// --- Signes (keystones) --------------------------------------------------

export const SIGNS = {
  colonne: {
    name: 'Colonne', kind: 'forme', glyph: '‖',
    hint: 'Deux barres verticales parallèles, comme un pilier.',
    effect: 'Jet vertical, pilier ou rayon.',
    strokes: () => [line(-0.35, -0.9, -0.35, 0.9), line(0.35, -0.9, 0.35, 0.9)],
  },
  levitation: {
    name: 'Lévitation', kind: 'mod', glyph: '↑',
    hint: 'Une flèche vers le haut.',
    effect: "L'effet flotte : gravité inversée.",
    strokes: () => [line(0, 0.9, 0, -0.9), polyline([[-0.55, -0.35], [0, -0.9], [0.55, -0.35]])],
  },
  convergence: {
    name: 'Convergence', kind: 'forme', glyph: '◎',
    hint: 'Deux cercles concentriques.',
    effect: "Concentre l'effet en un orbe.",
    strokes: () => [arc(0, 0, 0.85, 0, TAU, 36), arc(0, 0, 0.38, 0, TAU, 20)],
  },
  dispersion: {
    name: 'Dispersion', kind: 'forme', glyph: '✕',
    hint: 'Une croix en X.',
    effect: 'Éparpille : pluie, gerbe, nuée.',
    strokes: () => [line(-0.8, -0.8, 0.8, 0.8), line(0.8, -0.8, -0.8, 0.8)],
  },
  projection: {
    name: 'Projection', kind: 'forme', glyph: '>',
    hint: 'Un chevron ouvert vers la gauche (>). Le sort part vers ce signe.',
    effect: 'Tire un projectile dans la direction du signe.',
    strokes: () => [polyline([[-0.6, -0.85], [0.7, 0], [-0.6, 0.85]])],
  },
  repetition: {
    name: 'Répétition', kind: 'mod', glyph: '≡',
    hint: 'Trois traits horizontaux.',
    effect: 'Le sort pulse par vagues.',
    strokes: () => [-0.6, 0, 0.6].map(y => line(-0.8, y, 0.8, y)),
  },
  amplification: {
    name: 'Amplification', kind: 'mod', glyph: '+',
    hint: 'Une croix droite (+).',
    effect: 'Puissance ×1,5.',
    strokes: () => [line(0, -0.85, 0, 0.85), line(-0.85, 0, 0.85, 0)],
  },
  persistance: {
    name: 'Persistance', kind: 'mod', glyph: 'o',
    hint: 'Un petit cercle simple.',
    effect: 'Durée ×1,8.',
    strokes: () => [arc(0, 0, 0.85, -Math.PI / 2, TAU - Math.PI / 2, 36)],
  },
  tourbillon: {
    name: 'Tourbillon', kind: 'forme', glyph: 'S',
    hint: 'Un S.',
    effect: 'Vortex, tornade.',
    strokes: () => {
      const top = arc(0, -0.45, 0.45, -0.35, -1.5 * Math.PI, 24);
      const bottom = arc(0, 0.45, 0.45, -Math.PI / 2, 0.85 * Math.PI, 24);
      bottom.shift();
      return [[...top, ...bottom]];
    },
  },
  dome: {
    name: 'Dôme', kind: 'forme', glyph: '∩',
    hint: 'Une arche (∩).',
    effect: 'Coupole qui repousse les autres sorts.',
    strokes: () => [[...line(-0.8, 0.85, -0.8, 0.35, 5), ...arc(0, 0.35, 0.8, Math.PI, TAU, 24).slice(1), ...line(0.8, 0.35, 0.8, 0.85, 5).slice(1)]],
  },
  barriere: {
    name: 'Barrière', kind: 'forme', glyph: 'W',
    hint: 'Un zigzag en W.',
    effect: 'Mur perpendiculaire à la direction du sort.',
    strokes: () => [polyline([[-0.9, -0.6], [-0.45, 0.6], [0, -0.6], [0.45, 0.6], [0.9, -0.6]], 8)],
  },
  attenuation: {
    name: 'Atténuation', kind: 'mod', glyph: '~',
    hint: 'Un tilde (~).',
    effect: 'Effet doux et lent, mais plus durable.',
    strokes: () => [wave(0, 0.32, 1, -0.9, 0.9)],
  },
};

// --- Moteurs de reconnaissance ------------------------------------------

function withVariants(strokes) {
  // Variantes légèrement déformées pour tolérer les tracés manuels.
  const variants = [strokes];
  const tf = [
    (p) => ({ x: p.x * 1.15, y: p.y * 0.9 }),
    (p) => ({ x: p.x * 0.88, y: p.y * 1.12 }),
    (p) => ({ x: p.x + p.y * 0.12, y: p.y }),
    (p) => ({ x: p.x - p.y * 0.12, y: p.y }),
  ];
  for (const f of tf) variants.push(strokes.map(s => s.map(f)));
  return variants;
}

export const sigilRecognizer = new Recognizer();
for (const [key, def] of Object.entries(SIGILS)) {
  for (const v of withVariants(def.strokes())) sigilRecognizer.add(key, v);
}
// Variantes : spirales dans l'autre sens et avec plus ou moins de tours.
for (const turns of [-2, 1.5, -1.5, 2.5, -2.5, 3, -3]) sigilRecognizer.add('vent', [spiral(turns, 0.05, 0.9)]);

export const signRecognizer = new Recognizer();
for (const [key, def] of Object.entries(SIGNS)) {
  for (const v of withVariants(def.strokes())) signRecognizer.add(key, v);
}
// Le S peut être tracé en miroir de lecture (Z arrondi) : on accepte les deux.
signRecognizer.add('tourbillon', SIGNS.tourbillon.strokes().map(s => s.map(p => ({ x: -p.x, y: p.y }))));

// --- Génération d'un glyphe complet (démonstration / tracé automatique) --

// Renvoie des traits en coordonnées écran avec un léger bruit "humain".
export function composeGlyph({ cx, cy, R, sigil, signs, leaveOpen = false, wobble = 1, rng = Math.random }) {
  const strokes = [];
  const jitter = (pts, scale) => {
    const ph1 = rng() * TAU, ph2 = rng() * TAU;
    return pts.map((p, i) => ({
      x: p.x + (Math.sin(i * 0.37 + ph1) * 0.6 + (rng() - 0.5) * 0.5) * scale * wobble,
      y: p.y + (Math.cos(i * 0.29 + ph2) * 0.6 + (rng() - 0.5) * 0.5) * scale * wobble,
    }));
  };
  const place = (unitStrokes, ox, oy, half) =>
    unitStrokes.map(s => jitter(s.map(p => ({ x: ox + p.x * half, y: oy + p.y * half })), Math.max(0.6, half * 0.025)));

  if (sigil && SIGILS[sigil]) strokes.push(...place(SIGILS[sigil].strokes(), cx, cy, R * 0.3));

  for (const s of signs) {
    if (!SIGNS[s.key]) continue;
    const ox = cx + Math.cos(s.angle) * R * 0.7;
    const oy = cy + Math.sin(s.angle) * R * 0.7;
    strokes.push(...place(SIGNS[s.key].strokes(), ox, oy, R * 0.12));
  }

  // L'anneau en dernier : sa fermeture déclenche le sort.
  const a0 = -Math.PI / 2 + (rng() - 0.5) * 0.6;
  const span = leaveOpen ? TAU - 0.22 : TAU + 0.12;
  const n = Math.max(60, Math.round(R * 0.6));
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + span * (i / n);
    const r = R * (1 + Math.sin(a * 3 + 1) * 0.008 * wobble);
    ring.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  strokes.push(jitter(ring, 0.5));
  return strokes;
}

// Répartit des signes uniformément autour du centre, en partant du haut.
export function distributeSigns(keys, projectionAngle = 0) {
  const out = [];
  const others = keys.filter(k => k !== 'projection');
  if (keys.includes('projection')) out.push({ key: 'projection', angle: projectionAngle });
  const start = keys.includes('projection') ? projectionAngle + Math.PI : -Math.PI / 2;
  others.forEach((k, i) => {
    const a = keys.includes('projection')
      ? start + ((i + 1) / (others.length + 1) - 0.5) * Math.PI * 1.2
      : start + (i / others.length) * TAU;
    out.push({ key: k, angle: a });
  });
  return out;
}
