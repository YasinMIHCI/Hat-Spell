# Hat-Spell : Atelier des Glyphes

Un simulateur de magie dessinée inspiré de *L'Atelier des Sorciers* (*Witch Hat Atelier*, Kamome Shirahama).
On trace un **sigil** au centre, des **signes** autour et un **anneau** pour fermer le tout. Le sort part au moment où l'anneau se ferme.

- **Étude des pictogrammes** : [`docs/etude-pictogrammes.md`](docs/etude-pictogrammes.md). Elle couvre la grammaire du glyphe, les règles de qualité, la magie interdite, le modèle formel du simulateur et les sources.
- **Simulateur** : `index.html` (HTML, CSS et JavaScript, sans dépendance ni compilation).

## Lancer

```bash
npm start              # serveur local sur http://localhost:8080
# ou : python3 -m http.server 8080
```

Les modules ES ne se chargent pas depuis `file://` : il faut passer par un serveur.

## Ce que fait le simulateur

| Fonction | Détail |
|---|---|
| Dessin libre | Plume (souris, doigt ou stylet avec pression), gomme, réserve d'encre. Une plume sèche laisse des trous dans le trait. |
| Reconnaissance | Détection des anneaux par ajustement de cercle, y compris un anneau tracé en plusieurs arcs. Zonage sigil / couronne. Reconnaissance multi-traits $P. |
| Qualité du tracé | Fermeture au degré près, circularité, tremblement, lisibilité, équilibre des signes. Ces mesures donnent la puissance, la durée, la dérive et l'instabilité. |
| Vocabulaire | 5 sigils (Feu, Eau, Vent, Terre, Lumière) × 12 signes (Colonne, Lévitation, Convergence, Dispersion, Projection, Répétition, Amplification, Persistance, Tourbillon, Dôme, Barrière, Atténuation) |
| Monde partagé | Particules, champs de vent, solides de pierre, coupoles et murs. L'eau éteint le feu (vapeur), le feu brûle les feuilles, le vent pousse tout, la lumière éclaire le mode nuit. |
| Gestes du manga | Anneau laissé ouvert puis fermé d'un trait. Anneau gommé : le sort s'interrompt. Signe ajouté dans un sort actif : le sort se reconfigure. |
| Grimoire | Référence des tracés, composeur de recette, guide à repasser, tracé automatique de démonstration. |

Raccourcis : `P` plume, `E` gomme, `R` tremper la plume, `N` nuit.

## Tests

```bash
npm test                          # moteur : reconnaissance, anneaux, compilation (node)
node tests/browser-smoke.mjs      # Chromium via Playwright : 40 combinaisons élément × forme, tracé à la souris, mobile
```

## Structure

```
js/recognizer.js  reconnaissance $P (nuages de points)
js/glyphs.js      vocabulaire des sigils et signes, générateur de glyphes
js/analyzer.js    anneaux, zones, métriques de qualité
js/spells.js      compilation glyphe → paramètres de sort
js/world.js       moteur de particules et interactions élémentaires
js/main.js        plume, encre, rendu, interface
```

Les tracés sont des créations originales qui suivent la grammaire du manga. Ce ne sont pas des reproductions des planches.
