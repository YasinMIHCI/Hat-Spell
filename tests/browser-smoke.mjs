// Test de fumée dans Chromium : node tests/browser-smoke.mjs [dossier-captures]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.argv[2] ?? path.join(root, 'tests', 'out');
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(4500);
await page.screenshot({ path: path.join(outDir, '1-exemple.png') });

// Glyphe de démonstration actif ?
const active = await page.evaluate(() => window.__atelier.state.active.size);
console.log('sorts actifs après l\'exemple :', active);

// Toutes les combinaisons élément × forme tournent sans erreur.
const forms = ['colonne', 'convergence', 'dispersion', 'projection', 'tourbillon', 'dome', 'barriere', null];
const elements = ['feu', 'eau', 'vent', 'terre', 'lumiere'];
const result = await page.evaluate(async ({ forms, elements }) => {
  const A = window.__atelier;
  const out = [];
  for (const el of elements) {
    for (const f of forms) {
      A.state.strokes = []; for (const id of [...A.state.active.keys()]) A.world.dispel(id); A.state.active.clear();
      const signs = f ? [f, 'amplification'] : ['amplification', 'persistance'];
      const strokes = A.composeGlyph({ cx: 500, cy: 330, R: 120, sigil: el, signs: A.distributeSigns(signs, 0) });
      strokes.forEach(s => A.addStroke(s.map(p => ({ ...p, w: 2.5 }))));
      A.reanalyze(true);
      for (let i = 0; i < 90; i++) A.world.update(1 / 60);
      const g = A.state.glyphs[0];
      out.push(`${el}/${f ?? 'jaillissement'}: actif=${A.state.active.size} sigil=${g?.sigil?.key} signes=${g?.signs.map(s => s.key)} particules=${A.world.particles.length}`);
    }
  }
  return out;
}, { forms, elements });
console.log(result.join('\n'));

// Scène combinée pour la capture.
await page.evaluate(() => {
  const A = window.__atelier;
  A.state.strokes = []; for (const id of [...A.state.active.keys()]) A.world.dispel(id); A.state.active.clear();
  const add = o => A.composeGlyph(o).forEach(s => A.addStroke(s.map(p => ({ ...p, w: 2.5 }))));
  add({ cx: 220, cy: 420, R: 95, sigil: 'feu', signs: A.distributeSigns(['colonne', 'amplification']) });
  add({ cx: 520, cy: 260, R: 105, sigil: 'eau', signs: A.distributeSigns(['convergence', 'persistance']) });
  add({ cx: 760, cy: 470, R: 90, sigil: 'terre', signs: A.distributeSigns(['colonne']) });
  A.reanalyze(true);
});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, '2-scene.png') });
await page.click('#night', { force: true });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '3-nuit.png') });
await page.click('#tab-grimoire');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, '4-grimoire.png') });

// Dessin à la souris : un anneau tracé à la main autour d'un sigil de lumière.
await page.evaluate(() => { const A = window.__atelier; A.state.strokes = []; for (const id of [...A.state.active.keys()]) A.world.dispel(id); A.state.active.clear(); A.reanalyze(false); });
await page.click('#night', { force: true });
const box = await page.locator('#scene').boundingBox();
const cx = box.x + 400, cy = box.y + 300;
for (const d of [0, 60, 120]) {
  const a = (d - 90) * Math.PI / 180;
  await page.mouse.move(cx - 30 * Math.cos(a), cy - 30 * Math.sin(a));
  await page.mouse.down();
  await page.mouse.move(cx + 30 * Math.cos(a), cy + 30 * Math.sin(a), { steps: 12 });
  await page.mouse.up();
}
await page.mouse.move(cx + 110, cy);
await page.mouse.down();
for (let i = 1; i <= 80; i++) {
  const a = (i / 80) * Math.PI * 2.05;
  await page.mouse.move(cx + 110 * Math.cos(a), cy + 110 * Math.sin(a));
}
await page.mouse.up();
await page.waitForTimeout(1200);
const hand = await page.evaluate(() => { const g = window.__atelier.state.glyphs[0]; return { closed: g?.ring.closed, sigil: g?.sigil?.key, active: window.__atelier.state.active.size }; });
console.log('tracé à la souris :', JSON.stringify(hand));
await page.click('#tab-glyphes');
await page.screenshot({ path: path.join(outDir, '5-souris.png') });

const mobile = await browser.newPage({ viewport: { width: 400, height: 820 } });
mobile.on('pageerror', e => errors.push(String(e)));
await mobile.goto(`http://localhost:${port}/`);
await mobile.waitForTimeout(3500);
await mobile.screenshot({ path: path.join(outDir, '6-mobile.png'), fullPage: true });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('débordement horizontal mobile :', overflow);

console.log('erreurs :', errors.length ? errors : 'aucune');
await browser.close();
server.close();
process.exit(errors.length || overflow ? 1 : 0);
