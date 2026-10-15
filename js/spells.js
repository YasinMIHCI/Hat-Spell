// Compilation d'un glyphe analysé en paramètres de sort (docs §9.4).

import { SIGILS, SIGNS } from './glyphs.js';
import { compass } from './analyzer.js';

export const SURFACES = {
  parchemin: { name: 'Parchemin', duration: 1.0, stability: 1.0 },
  pierre: { name: 'Pierre', duration: 1.6, stability: 1.1 },
  tissu: { name: 'Tissu', duration: 0.8, stability: 0.9 },
  eau: { name: 'Eau', duration: 0.4, stability: 0.6 },
};

const FORM_PRIORITY = ['dome', 'barriere', 'tourbillon', 'colonne', 'projection', 'convergence', 'dispersion'];

const BASE_DURATION = { feu: 14, eau: 18, vent: 16, terre: 22, lumiere: 20 };

export const FORM_NAMES = {
  jaillissement: 'Jaillissement',
  dome: 'Dôme', barriere: 'Barrière', tourbillon: 'Tourbillon', colonne: 'Colonne',
  projection: 'Projection', convergence: 'Orbe', dispersion: 'Dispersion',
};

export function compile(glyph, surfaceKey = 'parchemin') {
  const surface = SURFACES[surfaceKey] ?? SURFACES.parchemin;
  if (!glyph.ring.closed) return null;
  if (!glyph.sigil) return { kind: 'vide', description: "L'anneau se ferme sur du vide : rien ne se produit." };
  if (!glyph.sigil.key) {
    return {
      kind: 'rate',
      description: "Le sigil est illisible : l'encre crépite et se consume sans effet.",
      duration: 1.2,
      power: 0.5,
    };
  }

  const keys = glyph.signs.filter(s => s.key).map(s => s.key);
  const count = k => keys.filter(x => x === k).length;
  const form = FORM_PRIORITY.find(f => keys.includes(f)) ?? 'jaillissement';

  const m = glyph.metrics;
  let power = Math.pow(glyph.R / 140, 1.2) * Math.pow(1.5, count('amplification'));
  let duration = BASE_DURATION[glyph.sigil.key] * (0.45 + 0.75 * m.neatness)
    * Math.pow(1.8, count('persistance')) * surface.duration;
  const gentle = count('attenuation') > 0;
  if (gentle) { power *= 0.6; duration *= 1.4; }

  // Direction : signe de projection, sinon dérive vers les signes (Q4), sinon vers le haut.
  const proj = glyph.signs.find(s => s.key === 'projection');
  let angle = -Math.PI / 2;
  let drift = 0;
  if (proj) angle = proj.angle;
  else if (glyph.imbalance > 0.3) { angle = glyph.imbalanceAngle; drift = glyph.imbalance; }

  const unread = glyph.signs.filter(s => !s.key).length;
  const instability = Math.min(1, Math.max(0,
    (1 - m.neatness) * 0.9 / surface.stability + unread * 0.25 + (1 - glyph.sigil.score) * 0.8 - 0.1));

  const spell = {
    kind: 'sort',
    element: glyph.sigil.key,
    form,
    power,
    duration,
    angle,
    drift,
    pulse: count('repetition') > 0,
    pulseCount: count('repetition'),
    levitate: count('levitation') > 0,
    gentle,
    instability,
    // Quand Lévitation est la seule indication de forme, l'effet monte doucement.
    color: SIGILS[glyph.sigil.key].color,
  };
  spell.description = describe(spell, glyph);
  return spell;
}

function describe(s, glyph) {
  const el = SIGILS[s.element].name.toLowerCase();
  const de = /^[aeiouéèh]/i.test(el) ? "d'" : 'de ';
  const forms = {
    jaillissement: `Jaillissement ${de}${el}`,
    colonne: s.element === 'terre' ? 'Pilier de pierre qui sort du sol' : `Colonne ${de}${el}`,
    convergence: s.element === 'terre' ? 'Rocher en suspension' : `Orbe ${de}${el}`,
    dispersion: { eau: 'Pluie fine', feu: 'Pluie de braises', vent: 'Rafales éparpillées', terre: 'Grêle de gravier', lumiere: 'Nuée d\'étincelles' }[s.element],
    projection: { eau: "Trait d'eau", feu: 'Boule de feu', vent: 'Lame de vent', terre: 'Projectile de pierre', lumiere: 'Flèche de lumière' }[s.element],
    tourbillon: { eau: 'Tourbillon d\'eau', feu: 'Tornade de flammes', vent: 'Tornade', terre: 'Tourbillon de poussière', lumiere: 'Spirale lumineuse' }[s.element],
    dome: `Dôme protecteur ${de}${el}`,
    barriere: `Mur ${de}${el}`,
  };
  const parts = [forms[s.form]];
  if (s.form === 'projection') parts.push(`tiré vers ${compass(s.angle)}`);
  else if (s.drift) parts.push(`qui dérive vers ${compass(s.angle)}`);
  if (s.levitate) parts.push('en lévitation');
  if (s.pulse) parts.push('par pulsations');
  if (s.gentle) parts.push('tout en douceur');
  let txt = parts.join(', ') + '.';
  txt += ` Puissance ${s.power.toFixed(2)}, durée ${s.duration.toFixed(0)} s.`;
  if (s.instability > 0.55) txt += ' ⚠ Très instable : ratés probables.';
  else if (s.instability > 0.3) txt += ' Légèrement instable.';
  return txt;
}
