// Tests du moteur (sans navigateur) : node tests/run-tests.mjs
import { SIGILS, SIGNS, composeGlyph, distributeSigns, sigilRecognizer, signRecognizer } from '../js/glyphs.js';
import { analyze } from '../js/analyzer.js';
import { compile } from '../js/spells.js';

let failures = 0, passes = 0;
function check(cond, msg) {
  if (cond) passes++;
  else { failures++; console.log('ÉCHEC :', msg); }
}

// Générateur pseudo-aléatoire déterministe.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

let nextId = 1;
const toStrokes = list => list.map(points => ({ id: nextId++, points }));

// 1. Reconnaissance isolée avec bruit.
function noisy(strokes, amount) {
  return strokes.map(s => s.map((p, i) => ({
    x: p.x * 50 + (rng() - 0.5) * amount + Math.sin(i * 0.5) * amount * 0.5,
    y: p.y * 50 + (rng() - 0.5) * amount,
  })));
}
for (const [set, rec, label] of [[SIGILS, sigilRecognizer, 'sigil'], [SIGNS, signRecognizer, 'signe']]) {
  for (const key of Object.keys(set)) {
    let ok = 0;
    const trials = 20;
    let worst = 1;
    for (let t = 0; t < trials; t++) {
      const res = rec.classify(noisy(set[key].strokes(), 4));
      if (res[0].name === key) ok++;
      worst = Math.min(worst, res[0].score);
    }
    check(ok >= trials * 0.9, `${label} ${key} reconnu ${ok}/${trials}`);
    console.log(`  ${label.padEnd(5)} ${key.padEnd(14)} ${ok}/${trials}  score min ${worst.toFixed(2)}`);
  }
}

// 2. Glyphe complet : anneau fermé, sigil et signes reconnus.
for (const sigil of Object.keys(SIGILS)) {
  const signKeys = ['colonne', 'amplification', 'persistance'];
  const strokes = toStrokes(composeGlyph({ cx: 400, cy: 300, R: 150, sigil, signs: distributeSigns(signKeys), rng }));
  const [g] = analyze(strokes);
  check(!!g, `glyphe ${sigil} détecté`);
  if (!g) continue;
  check(g.ring.closed, `anneau ${sigil} fermé`);
  check(g.sigil?.key === sigil, `sigil ${sigil} lu comme ${g.sigil?.key} (${g.sigil?.guess} ${g.sigil?.score.toFixed(2)})`);
  const read = g.signs.map(s => s.key).sort().join(',');
  check(read === [...signKeys].sort().join(','), `signes ${sigil} : ${read}`);
  check(g.imbalance < 0.2, `équilibre ${sigil} : ${g.imbalance.toFixed(2)}`);
  const sp = compile(g);
  check(sp?.kind === 'sort' && sp.form === 'colonne', `compilation ${sigil} : ${sp?.form}`);
}

// 3. Anneau laissé ouvert → pas d'activation ; fermeture → activation.
{
  const raw = composeGlyph({ cx: 300, cy: 300, R: 120, sigil: 'feu', signs: [], leaveOpen: true, rng });
  const strokes = toStrokes(raw);
  const [g] = analyze(strokes);
  check(g && !g.ring.closed, 'anneau ouvert détecté comme ouvert');
  check(compile(g) === null, 'anneau ouvert : pas de sort');
  // Fermer avec un petit arc.
  const ring = raw[raw.length - 1];
  const a = ring[ring.length - 1], b = ring[0];
  const closing = [];
  for (let i = 0; i <= 10; i++) closing.push({ x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10 });
  strokes.push({ id: nextId++, points: closing.concat([{ x: b.x + 2, y: b.y + 1 }]) });
  const [g2] = analyze(strokes);
  check(g2 && g2.ring.closed, 'anneau fermé après coup');
}

// 4. Anneau tracé en plusieurs arcs.
{
  const pts = (a0, a1) => {
    const out = [];
    for (let i = 0; i <= 40; i++) {
      const a = a0 + (a1 - a0) * i / 40;
      out.push({ x: 500 + 130 * Math.cos(a), y: 400 + 130 * Math.sin(a) });
    }
    return out;
  };
  const strokes = toStrokes([pts(0, 2.2), pts(2.18, 4.4), pts(4.38, Math.PI * 2 + 0.02)]);
  const [g] = analyze(strokes);
  check(g && g.ring.closed, 'anneau en trois arcs fermé');
}

// 5. Déséquilibre → dérive.
{
  const signs = [{ key: 'amplification', angle: 0 }, { key: 'persistance', angle: 0.6 }, { key: 'repetition', angle: -0.6 }];
  const [g] = analyze(toStrokes(composeGlyph({ cx: 400, cy: 300, R: 150, sigil: 'eau', signs, rng })));
  const sp = compile(g);
  check(g.imbalance > 0.5 && Math.abs(sp.angle) < 0.3, `dérive vers l'est : imbalance ${g.imbalance.toFixed(2)}, angle ${sp.angle.toFixed(2)}`);
}

// 6. Projection → direction du signe.
{
  const signs = distributeSigns(['projection', 'amplification'], Math.PI); // vers l'ouest
  const [g] = analyze(toStrokes(composeGlyph({ cx: 400, cy: 300, R: 150, sigil: 'feu', signs, rng })));
  const sp = compile(g);
  check(sp?.form === 'projection' && Math.abs(Math.abs(sp.angle) - Math.PI) < 0.3, `projection vers l'ouest : ${sp?.form} ${sp?.angle?.toFixed(2)}`);
}

// 7. Deux glyphes séparés.
{
  const s = toStrokes([
    ...composeGlyph({ cx: 200, cy: 200, R: 100, sigil: 'feu', signs: [], rng }),
    ...composeGlyph({ cx: 600, cy: 300, R: 110, sigil: 'eau', signs: [], rng }),
  ]);
  const gs = analyze(s);
  check(gs.length === 2 && gs.map(g => g.sigil.key).sort().join() === 'eau,feu', `deux glyphes : ${gs.map(g => g.sigil?.key)}`);
}

// 8. Les petits cercles des signes ne sont pas pris pour des anneaux.
{
  const [g, extra] = analyze(toStrokes(composeGlyph({ cx: 400, cy: 300, R: 160, sigil: 'lumiere', signs: distributeSigns(['convergence', 'persistance']), rng })));
  check(g && !extra, 'pas de faux anneau');
}

console.log(`\n${passes} réussis, ${failures} échecs`);
process.exit(failures ? 1 : 0);
