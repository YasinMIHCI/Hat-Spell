// Monde physique partagé : particules, champs de vent, solides, lumières.
// Tous les sorts actifs y vivent ensemble et interagissent (docs §9.6).

const TAU = Math.PI * 2;
const MAX_PARTICLES = 7000;
const rand = (a, b) => a + Math.random() * (b - a);

// Propriétés physiques par type de particule.
const PT = {
  fire:  { g: -230, drag: 1.8, life: [0.45, 1.0], size: [5, 10], add: true, wind: 1.4 },
  ember: { g: 160, drag: 0.6, life: [0.8, 1.6], size: [1.5, 3], add: true, wind: 1.0 },
  smoke: { g: -55, drag: 1.2, life: [1.4, 2.4], size: [8, 16], add: false, wind: 2.0 },
  water: { g: 720, drag: 0.15, life: [2.2, 3.6], size: [2.5, 4.5], add: false, wind: 0.5, bounce: 0.15 },
  steam: { g: -70, drag: 1.0, life: [1.2, 2.2], size: [8, 15], add: false, wind: 2.0 },
  gust:  { g: 0, drag: 0.5, life: [0.5, 1.0], size: [1, 1], add: false, wind: 1.3 },
  spark: { g: -12, drag: 1.4, life: [0.9, 1.9], size: [1.5, 3.5], add: true, wind: 0.4 },
  rock:  { g: 1150, drag: 0.05, life: [5, 8], size: [3, 8], add: false, wind: 0.03, bounce: 0.25 },
  dust:  { g: 30, drag: 1.6, life: [0.8, 1.6], size: [5, 10], add: false, wind: 1.6 },
  leaf:  { g: 110, drag: 2.6, life: [Infinity, Infinity], size: [4, 6], add: false, wind: 4.0 },
};

const ELEMENT_PARTICLE = { feu: 'fire', eau: 'water', vent: 'gust', terre: 'rock', lumiere: 'spark' };
const ELEMENT_SPEED = { feu: 170, eau: 280, vent: 240, terre: 320, lumiere: 120 };
const ELEMENT_RATE = { feu: 260, eau: 220, vent: 70, terre: 40, lumiere: 120 };

function makeSprite(r, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

export class World {
  constructor() {
    this.particles = [];
    this.runtimes = new Map();
    this.projectiles = [];
    this.flashes = [];
    this.fields = [];
    this.colliders = [];
    this.lights = [];
    this.beams = [];
    this.night = false;
    this.w = 800; this.h = 600; this.floorY = 570;
    this.time = 0;
    this.leafTimer = 0;
    this.onSpellEnd = null;
    this.sprites = null;
  }

  initSprites() {
    if (this.sprites) return;
    this.sprites = {
      fire: [
        makeSprite(16, [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,220,120,0.9)'], [1, 'rgba(255,140,40,0)']]),
        makeSprite(16, [[0, 'rgba(255,200,90,0.95)'], [0.4, 'rgba(255,120,30,0.7)'], [1, 'rgba(220,60,10,0)']]),
        makeSprite(16, [[0, 'rgba(230,80,20,0.7)'], [0.5, 'rgba(160,30,10,0.4)'], [1, 'rgba(80,10,0,0)']]),
      ],
      smoke: makeSprite(16, [[0, 'rgba(70,64,60,0.35)'], [1, 'rgba(70,64,60,0)']]),
      steam: makeSprite(16, [[0, 'rgba(235,240,245,0.45)'], [1, 'rgba(235,240,245,0)']]),
      water: makeSprite(8, [[0, 'rgba(210,240,255,0.95)'], [0.45, 'rgba(70,160,240,0.85)'], [1, 'rgba(30,100,200,0)']]),
      spark: makeSprite(12, [[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(255,240,160,0.8)'], [1, 'rgba(255,220,100,0)']]),
      dust: makeSprite(16, [[0, 'rgba(150,120,85,0.35)'], [1, 'rgba(150,120,85,0)']]),
      glow: {},
    };
  }

  glowSprite(color) {
    if (!this.sprites.glow[color]) {
      this.sprites.glow[color] = makeSprite(64, [[0, color], [0.25, color + 'aa'], [1, color + '00']]);
    }
    return this.sprites.glow[color];
  }

  resize(w, h) {
    this.w = w; this.h = h; this.floorY = h - 26;
    if (!this.particles.some(p => p.type === 'leaf')) this.scatterLeaves(36);
  }

  scatterLeaves(n) {
    for (let i = 0; i < n; i++) {
      this.spawn('leaf', rand(10, this.w - 10), this.floorY - 2, 0, 0, { rot: rand(0, TAU), hue: rand(20, 110) });
    }
  }

  spawn(type, x, y, vx, vy, extra) {
    if (this.particles.length >= MAX_PARTICLES) return null;
    const t = PT[type];
    const life = rand(t.life[0], t.life[1]);
    const p = { type, x, y, px: x, py: y, vx, vy, life, max: life, size: rand(t.size[0], t.size[1]), owner: 0, lev: false, orb: null, ...extra };
    if (p.life === undefined || p.max === undefined) { p.life = life; p.max = life; }
    this.particles.push(p);
    return p;
  }

  // --- Cycle de vie des sorts -------------------------------------------

  cast(id, glyph, spell) {
    const rt = {
      id, spell, t: 0, fade: 0, ending: false,
      cx: glyph.cx, cy: glyph.cy, R: glyph.R,
      ox: 0, oy: 0,               // dérive accumulée
      emitAcc: 0, projTimer: 0.2, misfireTimer: 0,
      construct: null,
    };
    this.runtimes.set(id, rt);
    this.flashes.push({ x: glyph.cx, y: glyph.cy, r: glyph.R, t: 0, color: spell.color ?? '#ffffff' });
    if (spell.kind === 'rate') {
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU);
        this.spawn('ember', glyph.cx + Math.cos(a) * glyph.R, glyph.cy + Math.sin(a) * glyph.R, Math.cos(a) * 40, Math.sin(a) * 40 - 30);
      }
      this.spawn('smoke', glyph.cx, glyph.cy, 0, -20);
    }
  }

  // Le glyphe a changé pendant que le sort était actif : on garde l'horloge.
  recompile(id, glyph, spell) {
    const rt = this.runtimes.get(id);
    if (!rt) return this.cast(id, glyph, spell);
    const formChanged = rt.spell.form !== spell.form || rt.spell.element !== spell.element;
    rt.spell = spell;
    rt.cx = glyph.cx; rt.cy = glyph.cy; rt.R = glyph.R;
    if (formChanged) { this.releaseConstruct(rt); rt.construct = null; }
    this.flashes.push({ x: glyph.cx, y: glyph.cy, r: glyph.R * 0.8, t: 0, color: spell.color ?? '#ffffff' });
  }

  dispel(id) {
    const rt = this.runtimes.get(id);
    if (rt && !rt.ending) { rt.ending = true; rt.fade = 0; rt.dispelled = true; }
  }

  // --- Mise à jour ------------------------------------------------------

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    this.fields = [];
    this.colliders = [];
    this.lights = [];
    this.beams = [];

    for (const rt of [...this.runtimes.values()]) this.runSpell(rt, dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.interactions();

    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < 0.9);

    // Les feuilles brûlées repoussent doucement.
    this.leafTimer += dt;
    if (this.leafTimer > 3) {
      this.leafTimer = 0;
      const n = this.particles.filter(p => p.type === 'leaf').length;
      if (n < 36) this.scatterLeaves(Math.min(3, 36 - n));
    }
  }

  runSpell(rt, dt) {
    const s = rt.spell;
    rt.t += dt;
    if (s.kind !== 'sort') {
      if (rt.t > (s.duration ?? 0.5)) this.endSpell(rt);
      return;
    }
    if (!rt.ending && rt.t >= s.duration) { rt.ending = true; rt.fade = 0; }
    let level = Math.min(1, rt.t / 0.4);
    if (rt.ending) {
      rt.fade += dt;
      level *= Math.max(0, 1 - rt.fade / 1.0);
      if (rt.fade >= 1.0) { this.endSpell(rt); return; }
    }

    // Instabilité : ratés aléatoires (docs §9.4).
    let jitter = 0;
    if (s.instability > 0.25) {
      rt.misfireTimer -= dt;
      if (rt.misfireTimer <= 0) {
        rt.misfireTimer = rand(0.3, 1.5) / s.instability;
        if (Math.random() < s.instability) {
          rt.misfire = 0.35;
          rt.misfireAngle = rand(0, TAU);
          for (let i = 0; i < 12; i++) {
            const a = rand(0, TAU);
            this.spawn('ember', rt.cx + Math.cos(a) * rt.R, rt.cy + Math.sin(a) * rt.R, Math.cos(a) * 80, Math.sin(a) * 80);
          }
          if (s.instability > 0.7 && Math.random() < 0.08) { rt.ending = true; rt.fade = 0; }
        }
      }
      if (rt.misfire > 0) { rt.misfire -= dt; jitter = 1; }
    }

    let pulse = 1;
    if (s.pulse) {
      const freq = 0.7 * s.pulseCount;
      pulse = Math.sin(rt.t * TAU * freq) > 0.2 ? 1.9 : 0.08;
    }
    if (jitter) pulse *= rand(0, 2.5);

    // Dérive : l'origine de l'effet glisse lentement vers le côté chargé.
    if (s.drift && s.form !== 'projection') {
      const maxOff = rt.R * 1.6 * s.drift;
      const off = Math.min(maxOff, rt.t * 18 * s.drift);
      rt.ox = Math.cos(s.angle) * off;
      rt.oy = Math.sin(s.angle) * off;
    }
    // La lévitation fait monter le foyer de l'effet.
    if (s.levitate && (s.form === 'convergence' || s.form === 'jaillissement')) {
      rt.oy = Math.max(rt.oy - dt * 22, -rt.R * 2.2);
    }

    const ctx = {
      rt, s, level, pulse, jitter,
      x: rt.cx + rt.ox, y: rt.cy + rt.oy,
      P: s.power * level,
      speed: ELEMENT_SPEED[s.element] * Math.sqrt(s.power) * (s.gentle ? 0.6 : 1),
      type: ELEMENT_PARTICLE[s.element],
      angle: jitter ? s.angle + (rt.misfireAngle - s.angle) * 0.5 : s.angle,
    };

    // Lumière émise par les sorts de feu et de lumière.
    if (s.element === 'feu') this.lights.push({ x: ctx.x, y: ctx.y - rt.R * 0.4, r: 150 * Math.sqrt(s.power) * level * rand(0.92, 1.05), color: '255,170,80' });
    if (s.element === 'lumiere') this.lights.push({ x: ctx.x, y: ctx.y, r: 230 * Math.sqrt(s.power) * level, color: '255,245,200' });

    const form = FORMS[s.form] ?? FORMS.jaillissement;
    form.call(this, ctx, dt);
  }

  endSpell(rt) {
    this.releaseConstruct(rt);
    this.runtimes.delete(rt.id);
    // Les particules en orbe sont libérées.
    for (const p of this.particles) if (p.orb === rt) p.orb = null;
    if (this.onSpellEnd) this.onSpellEnd(rt.id, rt.dispelled);
  }

  releaseConstruct(rt) {
    const c = rt.construct;
    if (!c) return;
    // Les constructions de pierre s'effondrent en éboulis.
    if (c.kind === 'rect') {
      const n = Math.min(60, Math.floor((c.w * c.h) / 220));
      for (let i = 0; i < n; i++) this.spawn('rock', rand(c.x, c.x + c.w), rand(c.y, c.y + c.h), rand(-60, 60), rand(-120, 0));
    } else if (c.kind === 'boulder') {
      for (let i = 0; i < 30; i++) this.spawn('rock', c.x + rand(-c.r, c.r), c.y + rand(-c.r, c.r), rand(-100, 100), rand(-200, 0));
    }
  }

  emitCount(ctx, dt, scale = 1) {
    const rate = ELEMENT_RATE[ctx.s.element] * ctx.P * ctx.pulse * scale;
    ctx.rt.emitAcc += rate * dt;
    const n = Math.floor(ctx.rt.emitAcc);
    ctx.rt.emitAcc -= n;
    return n;
  }

  emitParticle(ctx, x, y, vx, vy, extra = {}) {
    const p = this.spawn(ctx.type, x, y, vx, vy, { owner: ctx.rt.id, lev: ctx.s.levitate, ...extra });
    if (p && ctx.s.element === 'feu' && Math.random() < 0.05) this.spawn('smoke', x, y - 10, vx * 0.2, vy * 0.2, { owner: ctx.rt.id });
    return p;
  }

  // --- Projectiles ------------------------------------------------------

  launch(ctx) {
    const { s, rt } = ctx;
    const a = ctx.angle + (ctx.jitter ? rand(-0.8, 0.8) : rand(-0.04, 0.04));
    const sp = (s.element === 'lumiere' ? 900 : 420) * Math.sqrt(s.power) * (s.gentle ? 0.6 : 1);
    const x = ctx.x + Math.cos(a) * rt.R * 0.6, y = ctx.y + Math.sin(a) * rt.R * 0.6;
    this.projectiles.push({
      owner: rt.id, element: s.element, x, y, px: x, py: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 10 + 8 * Math.sqrt(s.power), life: 4, power: s.power, color: s.color,
    });
  }

  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.px = pr.x; pr.py = pr.y;
      if (pr.element === 'eau' || pr.element === 'terre') pr.vy += (pr.element === 'terre' ? 500 : 200) * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      const trail = ELEMENT_PARTICLE[pr.element];
      const n = pr.element === 'vent' ? 2 : 4;
      for (let i = 0; i < n; i++) {
        if (pr.element === 'terre' && Math.random() < 0.7) continue;
        this.spawn(pr.element === 'terre' ? 'dust' : trail, pr.x + rand(-pr.r, pr.r) * 0.5, pr.y + rand(-pr.r, pr.r) * 0.5,
          -pr.vx * 0.1 + rand(-30, 30), -pr.vy * 0.1 + rand(-30, 30), { owner: pr.owner });
      }
      if (pr.element === 'vent') this.fields.push({ kind: 'dir', x: pr.x, y: pr.y, r: pr.r * 4, fx: pr.vx * 3, fy: pr.vy * 3, owner: pr.owner });
      if (pr.element === 'feu') this.lights.push({ x: pr.x, y: pr.y, r: 110, color: '255,170,80' });
      if (pr.element === 'lumiere') this.lights.push({ x: pr.x, y: pr.y, r: 90, color: '255,245,200' });

      let hit = pr.life <= 0 || pr.y > this.floorY || pr.x < -50 || pr.x > this.w + 50 || pr.y < -80;
      if (!hit) {
        for (const c of this.colliders) {
          if (c.owner === pr.owner) continue;
          if (collides(c, pr.x, pr.y, pr.r * 0.5)) { hit = true; break; }
        }
      }
      if (hit) { this.explode(pr); pr.dead = true; }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  explode(pr) {
    const x = Math.max(0, Math.min(this.w, pr.x)), y = Math.min(this.floorY - 2, pr.y);
    const type = ELEMENT_PARTICLE[pr.element];
    const n = Math.floor(40 * Math.sqrt(pr.power));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(60, 260) * Math.sqrt(pr.power);
      this.spawn(type === 'gust' ? 'dust' : type, x, y, Math.cos(a) * v, Math.sin(a) * v - 60, { owner: pr.owner });
    }
    if (pr.element === 'vent') this.fields.push({ kind: 'radial', x, y, r: 160, strength: 2600, owner: pr.owner });
    this.flashes.push({ x, y, r: pr.r * 2, t: 0.3, color: pr.color });
  }

  // --- Particules -------------------------------------------------------

  updateParticles(dt) {
    const floor = this.floorY;
    for (const p of this.particles) {
      const t = PT[p.type];
      p.px = p.x; p.py = p.y;
      p.life -= dt;
      let g = t.g;
      if (p.lev) g = p.type === 'water' || p.type === 'rock' ? -40 : t.g * 0.3 - 30;
      let ax = 0, ay = g;

      // Orbe : ressort vers le centre de l'orbe.
      if (p.orb) {
        const o = p.orb;
        const cx = o.cx + o.ox, cy = o.cy + o.oy;
        const dx = cx - p.x, dy = cy - p.y;
        const k = p.type === 'water' ? 30 : 18;
        ax = dx * k - p.vx * 3 + (-dy) * 4; // léger tourbillon
        ay = dy * k - p.vy * 3 + dx * 4;
      }

      // Champs de vent.
      for (const f of this.fields) {
        const dx = p.x - f.x, dy = p.y - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > f.r * f.r) continue;
        const d = Math.sqrt(d2) || 1;
        const fall = 1 - d / f.r;
        const k = t.wind * fall;
        if (f.kind === 'dir') { ax += f.fx * k; ay += f.fy * k; }
        else if (f.kind === 'radial') { ax += (dx / d) * f.strength * k; ay += (dy / d) * f.strength * k; }
        else if (f.kind === 'vortex') {
          ax += (-dy / d) * f.swirl * k - (dx / d) * f.inward * k;
          ay += (dx / d) * f.swirl * k - (dy / d) * f.inward * k - f.up * k;
        }
      }

      p.vx += ax * dt; p.vy += ay * dt;
      const drag = Math.exp(-t.drag * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;

      // Solides et protections des autres sorts.
      for (const c of this.colliders) {
        if (c.owner === p.owner) continue;
        bounceOff(c, p);
      }

      // Sol.
      if (p.y > floor) {
        p.y = floor;
        if (p.type === 'water') {
          if (Math.abs(p.vy) > 160 && Math.random() < 0.3) {
            p.vy = -Math.abs(p.vy) * 0.25; p.vx += rand(-60, 60);
          } else {
            p.vy = 0; p.vx *= 0.9; p.life = Math.min(p.life, 0.6); p.puddle = true;
          }
        } else if (p.type === 'rock') {
          p.vy = -p.vy * t.bounce; p.vx *= 0.7;
          if (Math.abs(p.vy) < 30) p.vy = 0;
        } else if (p.type === 'leaf') {
          p.vy = 0; p.vx *= 0.8;
        } else if (p.type === 'fire' || p.type === 'spark') {
          p.vy = -Math.abs(p.vy) * 0.3;
        } else {
          p.vy = 0;
        }
      }
      if (p.x < -40 || p.x > this.w + 40 || p.y < -200) p.life = 0;
      if (p.type === 'leaf') p.rot += p.vx * dt * 0.05;
    }

    // Morts : la fumée naît du feu.
    const out = [];
    for (const p of this.particles) {
      if (p.life > 0) out.push(p);
      else if (p.type === 'fire' && Math.random() < 0.08) {
        out.push({ ...p, type: 'smoke', life: 1.6, max: 1.6, size: p.size * 1.4, orb: null });
      }
    }
    this.particles = out;
  }

  // Interactions élémentaires via une grille spatiale.
  interactions() {
    const cell = 14;
    const grid = new Map();
    const key = (x, y) => ((x / cell) | 0) * 100003 + ((y / cell) | 0);
    for (const p of this.particles) {
      if (p.type !== 'fire' && p.type !== 'ember') continue;
      const k = key(p.x, p.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
    if (!grid.size) return;
    const steam = [];
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      if (p.type !== 'water' && p.type !== 'leaf') continue;
      const cx = (p.x / cell) | 0, cy = (p.y / cell) | 0;
      search:
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const list = grid.get((cx + i) * 100003 + (cy + j));
          if (!list) continue;
          for (const f of list) {
            if (f.life <= 0) continue;
            const d = Math.hypot(f.x - p.x, f.y - p.y);
            if (d > 9) continue;
            if (p.type === 'water') {
              // L'eau éteint le feu : vapeur.
              f.life = 0; p.life = 0; p.orb = null;
              steam.push([p.x, p.y]);
            } else {
              // Le feu enflamme les feuilles.
              p.life = 0;
              for (let n = 0; n < 6; n++) steam.push([p.x, p.y, 'fire']);
            }
            break search;
          }
        }
      }
    }
    for (const [x, y, kind] of steam) {
      if (kind === 'fire') this.spawn('fire', x + rand(-4, 4), y, rand(-20, 20), rand(-80, -20));
      else this.spawn('steam', x, y, rand(-20, 20), rand(-60, -20));
    }
  }

  // --- Rendu ------------------------------------------------------------

  render(ctx) {
    this.initSprites();
    const S = this.sprites;

    // Constructions solides (terre).
    for (const rt of this.runtimes.values()) {
      const c = rt.construct;
      if (!c) continue;
      if (c.kind === 'rect') drawStone(ctx, c.x, c.y, c.w, c.h);
      if (c.kind === 'boulder') drawBoulder(ctx, c.x, c.y, c.r, rt.t);
    }

    // Particules non additives.
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      switch (p.type) {
        case 'smoke': ctx.globalAlpha = a; drawSprite(ctx, S.smoke, p.x, p.y, p.size * (2 - a)); break;
        case 'steam': ctx.globalAlpha = a; drawSprite(ctx, S.steam, p.x, p.y, p.size * (2 - a)); break;
        case 'dust': ctx.globalAlpha = a; drawSprite(ctx, S.dust, p.x, p.y, p.size * (1.5 - a * 0.5)); break;
        case 'water': ctx.globalAlpha = p.puddle ? a : 1; drawSprite(ctx, S.water, p.x, p.y, p.size * 1.6); break;
        case 'rock':
          ctx.globalAlpha = Math.min(1, p.life);
          ctx.fillStyle = '#6d5a47';
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.8);
          ctx.fillStyle = '#8f7a63';
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * 0.6, p.size * 0.3);
          break;
        case 'gust': {
          ctx.globalAlpha = a * 0.45;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
          ctx.stroke();
          break;
        }
        case 'leaf': {
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = `hsl(${p.hue}, 45%, 38%)`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    // Sphères d'eau : surface translucide.
    for (const rt of this.runtimes.values()) {
      if (rt.spell.element === 'eau' && rt.spell.form === 'convergence') {
        const r = rt.orbR ?? 0;
        if (r <= 0) continue;
        const x = rt.cx + rt.ox, y = rt.cy + rt.oy;
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(220,245,255,0.55)');
        g.addColorStop(0.7, 'rgba(70,160,240,0.35)');
        g.addColorStop(1, 'rgba(40,110,210,0.15)');
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * TAU;
          const wob = 1 + 0.05 * Math.sin(a * 3 + rt.t * 4) + 0.03 * Math.sin(a * 5 - rt.t * 6);
          ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * wob, y + Math.sin(a) * r * wob);
        }
        ctx.fill();
      }
    }

    // Particules additives et lumières.
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      const g = ctx.createLinearGradient(b.x, b.y, b.x + Math.cos(b.a) * b.len, b.y + Math.sin(b.a) * b.len);
      g.addColorStop(0, `rgba(${b.color},${0.7 * b.level})`);
      g.addColorStop(1, `rgba(${b.color},0)`);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -b.w / 2);
      ctx.lineTo(b.len, -b.w * 0.9);
      ctx.lineTo(b.len, b.w * 0.9);
      ctx.lineTo(0, b.w / 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      const g2 = ctx.createLinearGradient(0, 0, b.len, 0);
      g2.addColorStop(0, `rgba(255,255,255,${0.8 * b.level})`);
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, -b.w * 0.12, b.len, b.w * 0.24);
      ctx.restore();
    }
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      if (p.type === 'fire') {
        const spr = a > 0.66 ? S.fire[0] : a > 0.33 ? S.fire[1] : S.fire[2];
        ctx.globalAlpha = Math.min(1, a * 1.5);
        drawSprite(ctx, spr, p.x, p.y, p.size * (0.6 + a * 0.6));
      } else if (p.type === 'ember') {
        ctx.globalAlpha = a;
        drawSprite(ctx, S.fire[1], p.x, p.y, p.size * 1.5);
      } else if (p.type === 'spark') {
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(this.time * 20 + p.x));
        drawSprite(ctx, S.spark, p.x, p.y, p.size * 2);
      }
    }
    ctx.globalAlpha = 1;
    for (const rt of this.runtimes.values()) {
      const s = rt.spell;
      if (s.kind !== 'sort') continue;
      if (s.form === 'convergence' && (s.element === 'feu' || s.element === 'lumiere')) {
        const r = (rt.orbR ?? 20) * 1.8;
        drawSprite(ctx, this.glowSprite(s.color), rt.cx + rt.ox, rt.cy + rt.oy, r);
      }
    }
    for (const pr of this.projectiles) {
      if (pr.element === 'feu' || pr.element === 'lumiere') drawSprite(ctx, this.glowSprite(pr.color), pr.x, pr.y, pr.r * 1.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const pr of this.projectiles) {
      if (pr.element === 'terre') drawBoulder(ctx, pr.x, pr.y, pr.r * 0.8, this.time);
      if (pr.element === 'eau') { ctx.globalAlpha = 0.85; drawSprite(ctx, S.water, pr.x, pr.y, pr.r); ctx.globalAlpha = 1; }
    }

    // Coupoles et murs.
    for (const c of this.colliders) {
      if (!c.visible) continue;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 * c.level;
      ctx.beginPath();
      if (c.kind === 'shell') ctx.arc(c.x, c.y, c.r, Math.PI, TAU);
      if (c.kind === 'segment') { ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Éclairs d'activation.
    for (const f of this.flashes) {
      const k = f.t / 0.9;
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 + k * 0.6), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Calque d'obscurité percé par les lumières (mode nuit).
  renderDarkness(ctx, darkCanvas, extraLights) {
    const g = darkCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, darkCanvas.width, darkCanvas.height);
    g.fillStyle = 'rgba(8,10,28,0.9)';
    g.fillRect(0, 0, darkCanvas.width, darkCanvas.height);
    g.globalCompositeOperation = 'destination-out';
    const sc = darkCanvas.width / this.w;
    const all = [...this.lights, ...extraLights];
    for (const p of this.particles) if (p.type === 'spark' && Math.random() < 0.15) all.push({ x: p.x, y: p.y, r: 30, color: '255,245,200' });
    for (const L of all) {
      if (L.r <= 0) continue;
      const grad = g.createRadialGradient(L.x * sc, L.y * sc, 0, L.x * sc, L.y * sc, L.r * sc);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect((L.x - L.r) * sc, (L.y - L.r) * sc, L.r * 2 * sc, L.r * 2 * sc);
    }
    ctx.drawImage(darkCanvas, 0, 0, this.w, this.h);
    // Teinte chaude des lumières.
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      const grad = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      grad.addColorStop(0, `rgba(${L.color},0.18)`);
      grad.addColorStop(1, `rgba(${L.color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// --- Formes de sort --------------------------------------------------------
// Chaque forme combine l'élément (type de particule, vitesse) et les modificateurs.

const FORMS = {
  jaillissement(c, dt) {
    const { rt, s } = c;
    if (s.element === 'vent') {
      const a = s.drift ? c.angle : -Math.PI / 2;
      this.fields.push({ kind: 'dir', x: c.x, y: c.y - rt.R * 0.5, r: rt.R * 2.2, fx: Math.cos(a) * 900 * c.P * c.pulse, fy: Math.sin(a) * 900 * c.P * c.pulse, owner: rt.id });
      streaks.call(this, c, dt, a, rt.R * 0.8);
      return;
    }
    if (s.element === 'terre') { pillar.call(this, c, dt, 0.4, 0.5); return; }
    const n = this.emitCount(c, dt);
    const base = s.drift ? c.angle : -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = base + rand(-0.6, 0.6);
      const v = c.speed * rand(0.4, 1);
      this.emitParticle(c, c.x + rand(-0.25, 0.25) * rt.R, c.y + rand(-0.25, 0.25) * rt.R, Math.cos(a) * v, Math.sin(a) * v);
    }
  },

  colonne(c, dt) {
    const { rt, s } = c;
    const a = s.drift ? c.angle : -Math.PI / 2;
    const width = rt.R * 0.3 * Math.sqrt(s.power);
    if (s.element === 'vent') {
      this.fields.push({ kind: 'dir', x: c.x + Math.cos(a) * rt.R, y: c.y + Math.sin(a) * rt.R, r: rt.R * 1.8, fx: Math.cos(a) * 1800 * c.P * c.pulse, fy: Math.sin(a) * 1800 * c.P * c.pulse, owner: rt.id });
      streaks.call(this, c, dt, a, width, 2);
      return;
    }
    if (s.element === 'terre') { pillar.call(this, c, dt, 0.5, 1.4); return; }
    if (s.element === 'lumiere') {
      this.beams.push({ x: c.x, y: c.y, a, len: (260 + 220 * s.power) * c.level, w: width * 1.4 * Math.max(0.2, Math.min(1.5, c.pulse)), level: c.level, color: '255,245,200' });
      this.lights.push({ x: c.x + Math.cos(a) * 150, y: c.y + Math.sin(a) * 150, r: 220 * Math.sqrt(s.power) * c.level, color: '255,245,200' });
    }
    const n = this.emitCount(c, dt, 1.6);
    for (let i = 0; i < n; i++) {
      const off = rand(-1, 1) * width * 0.5;
      const aa = a + rand(-0.08, 0.08);
      const v = c.speed * rand(1.3, 2.0);
      this.emitParticle(c, c.x - Math.sin(a) * off, c.y + Math.cos(a) * off, Math.cos(aa) * v, Math.sin(aa) * v);
    }
  },

  convergence(c, dt) {
    const { rt, s } = c;
    const target = Math.round(130 * Math.sqrt(s.power) * c.level);
    rt.orbR = rt.R * 0.35 * Math.sqrt(s.power) * Math.max(0.2, c.level) * (c.pulse > 1 ? 1.12 : 1);
    if (s.element === 'vent') {
      // Vents rassembleurs : attire tout vers le centre.
      this.fields.push({ kind: 'radial', x: c.x, y: c.y, r: rt.R * 3.5, strength: -1500 * c.P * c.pulse, owner: rt.id });
      this.fields.push({ kind: 'vortex', x: c.x, y: c.y, r: rt.R * 1.2, swirl: 1400 * c.P, inward: 0, up: 0, owner: rt.id });
      streaks.call(this, c, dt, null, rt.R * 2);
      return;
    }
    if (s.element === 'terre') {
      if (!rt.construct) rt.construct = { kind: 'boulder', x: c.x, y: c.y, r: 0 };
      const b = rt.construct;
      b.r = Math.min(rt.R * 0.45 * Math.sqrt(s.power), b.r + dt * 60);
      b.x = c.x; b.y = c.y;
      this.colliders.push({ kind: 'disc', x: b.x, y: b.y, r: b.r, owner: rt.id });
      if (Math.random() < 0.3) this.spawn('dust', b.x + rand(-b.r, b.r), b.y + b.r, 0, 10);
      return;
    }
    rt.orbCount = this.particles.reduce((n, p) => n + (p.orb === rt ? 1 : 0), 0);
    const need = Math.min(target - rt.orbCount, 12);
    for (let i = 0; i < need; i++) {
      const a = rand(0, TAU), r = rt.R * rand(0.6, 1);
      this.emitParticle(c, rt.cx + Math.cos(a) * r, rt.cy + Math.sin(a) * r, 0, 0, { orb: rt });
    }
    if (s.element === 'eau') this.lights.push({ x: c.x, y: c.y, r: 0, color: '120,180,255' });
  },

  dispersion(c, dt) {
    const { rt, s } = c;
    const spread = rt.R * 1.6 * Math.sqrt(s.power);
    if (s.element === 'vent') {
      if (Math.random() < dt * 6) {
        const a = rand(0, TAU);
        rt.gust = { x: c.x + rand(-spread, spread), y: c.y + rand(-spread, spread * 0.5), fx: Math.cos(a) * 1600 * c.P, fy: Math.sin(a) * 1600 * c.P };
      }
      if (rt.gust) this.fields.push({ kind: 'dir', ...rt.gust, r: rt.R * 1.4, owner: rt.id });
      this.fields.push({ kind: 'radial', x: c.x, y: c.y, r: rt.R * 2.5, strength: 900 * c.P * c.pulse, owner: rt.id });
      streaks.call(this, c, dt, null, spread);
      return;
    }
    const n = this.emitCount(c, dt, 1.4);
    for (let i = 0; i < n; i++) {
      if (s.element === 'eau' || s.element === 'terre') {
        // Pluie / grêle tombant d'un nuage au-dessus du glyphe.
        const x = c.x + rand(-spread, spread), y = c.y - rt.R * 1.4 + rand(-15, 15);
        this.emitParticle(c, x, y, rand(-10, 10), rand(40, 120), s.element === 'terre' ? { size: rand(2, 4) } : {});
        if (s.element === 'eau' && Math.random() < 0.15) this.spawn('steam', x, y - 10, rand(-10, 10), rand(-5, 5), { owner: rt.id, life: 1.4, max: 1.4 });
      } else if (s.element === 'lumiere') {
        const a = rand(0, TAU), r = rand(0, spread);
        this.emitParticle(c, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.8, rand(-10, 10), rand(-20, 5));
      } else {
        const a = rand(0, TAU), v = c.speed * rand(0.5, 1.4);
        const p = this.emitParticle(c, c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 60);
        if (p && Math.random() < 0.5) p.type = 'ember';
      }
    }
  },

  projection(c, dt) {
    const { rt, s } = c;
    rt.projTimer -= dt;
    const interval = (s.gentle ? 2 : 1.3) / Math.max(0.5, Math.sqrt(s.power));
    if (rt.projTimer <= 0 && !rt.ending) {
      if (s.pulse) {
        rt.projTimer = interval * 2.2;
        for (let k = 0; k < 2 + s.pulseCount; k++) setTimeout(() => this.runtimes.has(rt.id) && this.launch(c), k * 140);
      } else {
        rt.projTimer = interval;
        this.launch(c);
      }
    }
    // Lueur de charge sur le glyphe.
    const n = this.emitCount(c, dt, 0.15);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      this.emitParticle(c, c.x + Math.cos(a) * rt.R * 0.3, c.y + Math.sin(a) * rt.R * 0.3, Math.cos(c.angle) * 60, Math.sin(c.angle) * 60);
    }
  },

  tourbillon(c, dt) {
    const { rt, s } = c;
    const r = rt.R * 1.5 * Math.sqrt(s.power);
    const strength = s.element === 'vent' ? 2600 : 1400;
    this.fields.push({ kind: 'vortex', x: c.x, y: c.y, r, swirl: strength * c.P * c.pulse, inward: strength * 0.35 * c.P, up: s.element === 'vent' ? 1500 * c.P : 400 * c.P, owner: rt.id });
    if (s.element === 'vent') {
      streaks.call(this, c, dt, null, r * 0.8, 2.5);
      if (Math.random() < 0.4) this.spawn('dust', c.x + rand(-r, r) * 0.5, this.floorY - 4, 0, -30, { owner: 0 });
      return;
    }
    const n = this.emitCount(c, dt, 1.2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), rr = r * rand(0.2, 0.7);
      const type = s.element === 'terre' ? (Math.random() < 0.7 ? 'dust' : 'rock') : c.type;
      const p = this.spawn(type, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.4, -Math.sin(a) * 200, Math.cos(a) * 80 - 60, { owner: 0, lev: s.levitate });
      if (p && s.element === 'terre' && type === 'rock') p.size = rand(2, 4);
    }
  },

  dome(c, dt) {
    const { rt, s } = c;
    const r = rt.R * 1.35 * Math.sqrt(s.power) * Math.min(1, c.level * 1.5);
    this.colliders.push({ kind: 'shell', x: rt.cx, y: rt.cy, r, owner: rt.id, visible: true, color: s.color, level: c.level });
    if (s.element === 'vent') this.fields.push({ kind: 'radial', x: rt.cx, y: rt.cy, r: r * 1.25, strength: 1200 * c.P, owner: rt.id });
    if (s.element === 'lumiere') this.lights.push({ x: rt.cx, y: rt.cy - r * 0.4, r: r * 1.6, color: '255,245,200' });
    const n = this.emitCount(c, dt, s.element === 'terre' ? 0.6 : 0.9);
    for (let i = 0; i < n; i++) {
      const a = Math.PI + rand(0, Math.PI);
      const x = rt.cx + Math.cos(a) * r, y = rt.cy + Math.sin(a) * r;
      const type = s.element === 'terre' ? 'dust' : s.element === 'vent' ? 'gust' : c.type;
      this.spawn(type, x, y, -Math.sin(a) * 60, Math.cos(a) * 60, { owner: rt.id, life: 0.5, max: 0.5, orb: null, lev: true });
    }
  },

  barriere(c, dt) {
    const { rt, s } = c;
    // Normale du mur : direction du sort si elle existe, sinon horizontale.
    const na = s.drift || s.form === 'projection' ? c.angle : 0;
    const half = rt.R * 1.2 * Math.sqrt(s.power);
    const tx = -Math.sin(na), ty = Math.cos(na);
    const x1 = rt.cx + tx * half, y1 = rt.cy + ty * half, x2 = rt.cx - tx * half, y2 = rt.cy - ty * half;
    if (s.element === 'terre') {
      // Mur de pierre qui sort du sol.
      if (!rt.construct) rt.construct = { kind: 'rect', x: rt.cx - rt.R * 0.18, w: rt.R * 0.36, y: this.floorY, h: 0 };
      const w = rt.construct;
      const hMax = Math.min(this.floorY - 20, rt.R * 2.2 * Math.sqrt(s.power));
      if (w.h < hMax) { w.h = Math.min(hMax, w.h + dt * 260); w.y = this.floorY - w.h; this.spawn('dust', w.x + rand(0, w.w), this.floorY - 4, rand(-60, 60), -20); }
      this.colliders.push({ kind: 'rect', x: w.x, y: w.y, w: w.w, h: w.h, owner: rt.id });
      return;
    }
    this.colliders.push({ kind: 'segment', x1, y1, x2, y2, owner: rt.id, visible: true, color: s.color, level: c.level });
    if (s.element === 'vent') this.fields.push({ kind: 'dir', x: rt.cx, y: rt.cy, r: half, fx: Math.cos(na) * 1400 * c.P, fy: Math.sin(na) * 1400 * c.P, owner: rt.id });
    const n = this.emitCount(c, dt, 1.2);
    for (let i = 0; i < n; i++) {
      const k = rand(0, 1);
      const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k;
      const vy = s.element === 'eau' ? 40 : -40;
      this.spawn(c.type, x, y, rand(-10, 10), vy, { owner: rt.id, life: s.element === 'eau' ? 0.6 : undefined, max: s.element === 'eau' ? 0.6 : undefined });
    }
  },
};

// Pilier de pierre qui sort du sol sous le glyphe.
function pillar(c, dt, widthK, heightK) {
  const { rt, s } = c;
  if (!rt.construct) {
    rt.construct = { kind: 'rect', x: c.x - rt.R * widthK / 2, w: rt.R * widthK, y: this.floorY, h: 0 };
  }
  const p = rt.construct;
  const hMax = Math.min(this.floorY - 20, (rt.R * heightK + 140 * s.power) * (s.levitate ? 1.3 : 1));
  if (p.h < hMax) {
    p.h = Math.min(hMax, p.h + dt * 220 * Math.sqrt(s.power));
    p.y = this.floorY - p.h;
    for (let i = 0; i < 2; i++) this.spawn('dust', p.x + rand(0, p.w), this.floorY - 4, rand(-80, 80), rand(-40, 0));
    if (Math.random() < 0.2) this.spawn('rock', p.x + rand(0, p.w), p.y, rand(-120, 120), rand(-250, -100));
  }
  this.colliders.push({ kind: 'rect', x: p.x, y: p.y, w: p.w, h: p.h, owner: rt.id });
}

// Traînées visibles pour les sorts de vent.
function streaks(c, dt, angle, spread, k = 1) {
  const n = this.emitCount(c, dt, k);
  for (let i = 0; i < n; i++) {
    const a = angle ?? rand(0, TAU);
    const v = c.speed * rand(0.6, 1.4);
    this.spawn('gust', c.x + rand(-spread, spread) * 0.6, c.y + rand(-spread, spread) * 0.6, Math.cos(a) * v, Math.sin(a) * v, { owner: c.rt.id });
  }
}

function collides(c, x, y, r) {
  if (c.kind === 'rect') return x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h;
  if (c.kind === 'disc') return Math.hypot(x - c.x, y - c.y) < c.r + r;
  if (c.kind === 'shell') return y < c.y + 4 && Math.abs(Math.hypot(x - c.x, y - c.y) - c.r) < r + 6;
  if (c.kind === 'segment') return segDist(x, y, c) < r + 5;
  return false;
}

function segDist(x, y, c) {
  const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
  const t = Math.max(0, Math.min(1, ((x - c.x1) * dx + (y - c.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (c.x1 + dx * t), y - (c.y1 + dy * t));
}

function bounceOff(c, p) {
  if (c.kind === 'rect') {
    if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) {
      const dl = p.x - c.x, dr = c.x + c.w - p.x, dt = p.y - c.y, db = c.y + c.h - p.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dt) { p.y = c.y; p.vy = -Math.abs(p.vy) * 0.3; p.vx *= 0.8; }
      else if (m === dl) { p.x = c.x; p.vx = -Math.abs(p.vx) * 0.4; }
      else if (m === dr) { p.x = c.x + c.w; p.vx = Math.abs(p.vx) * 0.4; }
      else { p.y = c.y + c.h; p.vy = Math.abs(p.vy) * 0.4; }
    }
  } else if (c.kind === 'disc' || c.kind === 'shell') {
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const pd = Math.hypot(p.px - c.x, p.py - c.y);
    if (c.kind === 'shell' && p.y > c.y + 4) return;
    const inside = d < c.r, wasInside = pd < c.r;
    if (c.kind === 'disc' ? inside : inside !== wasInside) {
      const nx = dx / d, ny = dy / d;
      const out = c.kind === 'disc' ? true : !wasInside;
      const R = out ? c.r + 1 : c.r - 1;
      p.x = c.x + nx * R; p.y = c.y + ny * R;
      const vn = p.vx * nx + p.vy * ny;
      p.vx -= 1.6 * vn * nx; p.vy -= 1.6 * vn * ny;
    }
  } else if (c.kind === 'segment') {
    const side = (x, y) => (c.x2 - c.x1) * (y - c.y1) - (c.y2 - c.y1) * (x - c.x1);
    const s0 = side(p.px, p.py), s1 = side(p.x, p.y);
    if ((s0 < 0) !== (s1 < 0) && segDist(p.x, p.y, c) < 12) {
      const len = Math.hypot(c.x2 - c.x1, c.y2 - c.y1) || 1;
      let nx = -(c.y2 - c.y1) / len, ny = (c.x2 - c.x1) / len;
      if (s0 < 0) { nx = -nx; ny = -ny; }
      p.x = p.px; p.y = p.py;
      const vn = p.vx * nx + p.vy * ny;
      p.vx -= 1.6 * vn * nx; p.vy -= 1.6 * vn * ny;
    }
  }
}

function drawSprite(ctx, spr, x, y, r) {
  ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
}

function drawStone(ctx, x, y, w, h) {
  if (h <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#5d4c3b');
  g.addColorStop(0.4, '#8a7259');
  g.addColorStop(1, '#4b3d30');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(30,20,10,0.5)';
  ctx.lineWidth = 1;
  for (let yy = y + 18; yy < y + h; yy += 22) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy + ((yy / 22) % 2 ? 4 : -4));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,220,0.15)';
  ctx.fillRect(x, y, w, 3);
}

function drawBoulder(ctx, x, y, r, t) {
  if (r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.3);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#9c856b');
  g.addColorStop(1, '#4a3c2f');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const rr = r * (0.85 + 0.15 * Math.sin(i * 2.7));
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
