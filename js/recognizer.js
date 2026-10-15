// Reconnaissance de tracés multi-traits : "$P Point-Cloud Recognizer"
// (Vatavu, Anthony & Wobbrock, ICMI 2012). Insensible à l'ordre et au sens des traits,
// sensible à la rotation (voulu : "+" et "X" sont deux signes différents).

const NUM_POINTS = 32;

export function makeCloud(strokes) {
  const pts = [];
  strokes.forEach((s, id) => s.forEach(p => pts.push({ x: p.x, y: p.y, id })));
  return normalize(pts);
}

function normalize(points) {
  let pts = resample(points, NUM_POINTS);
  pts = scale(pts);
  pts = translateToOrigin(pts);
  return pts;
}

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].id === points[i - 1].id) d += dist(points[i - 1], points[i]);
  }
  return d;
}

function resample(points, n) {
  const total = pathLength(points);
  const out = [{ ...points[0] }];
  if (total === 0) {
    while (out.length < n) out.push({ ...points[0] });
    return out;
  }
  const I = total / (n - 1);
  let D = 0;
  const pts = points.map(p => ({ ...p }));
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = dist(pts[i - 1], pts[i]);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
        id: pts[i].id,
      };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

function scale(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.map(p => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, id: p.id }));
}

function translateToOrigin(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(p => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

function greedyCloudMatch(points, template) {
  const e = 0.5;
  const step = Math.floor(Math.pow(points.length, 1 - e));
  let min = Infinity;
  for (let i = 0; i < points.length; i += step) {
    const d1 = cloudDistance(points, template, i);
    const d2 = cloudDistance(template, points, i);
    min = Math.min(min, d1, d2);
  }
  return min;
}

function cloudDistance(pts1, pts2, start) {
  const n = pts1.length;
  const matched = new Array(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let index = -1, min = Infinity;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = dist(pts1[i], pts2[j]);
      if (d < min) { min = d; index = j; }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class Recognizer {
  constructor() {
    this.templates = [];
  }

  add(name, strokes) {
    this.templates.push({ name, points: makeCloud(strokes) });
  }

  // Renvoie les classes triées par score décroissant (score 0..1).
  classify(strokes) {
    const pts = makeCloud(strokes);
    const best = new Map();
    for (const t of this.templates) {
      const d = greedyCloudMatch(pts, t.points);
      const score = Math.max((2.0 - d) / 2.0, 0);
      if (!best.has(t.name) || best.get(t.name) < score) best.set(t.name, score);
    }
    return [...best.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);
  }
}
