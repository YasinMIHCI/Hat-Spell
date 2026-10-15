# Étude approfondie : le langage des glyphes de *L'Atelier des Sorciers*

*(Tongari Bōshi no Atelier / Witch Hat Atelier, Kamome Shirahama, 2016–)*

Ce document analyse le système de magie du manga, et de l'anime qui l'adapte. Le but est d'en tirer
un **modèle formel**, assez précis pour piloter un simulateur. Le simulateur de ce dépôt
(`index.html`) suit exactement ce modèle.

---

## 0. Avertissement : fiabilité des informations

Je n'ai pas pu consulter les planches originales pendant cette étude : les sites du wiki fandom
étaient bloqués par le réseau. Chaque affirmation est donc marquée d'un niveau de confiance :

| Marque | Signification |
|---|---|
| 🟢 **Canon** | Établi dans le manga ou l'anime, et repris par plusieurs sources concordantes. |
| 🟡 **Communauté** | Vient des wikis de fans, de guides ou de simulateurs de fans. C'est plausible, mais la terminologie n'est pas forcément officielle. |
| 🔵 **Extrapolation** | Règle que j'ai inventée ou déduite pour que le simulateur fonctionne. Elle n'est pas dans l'œuvre. |

> Les **tracés** des pictogrammes du simulateur sont des **créations originales stylisées**. Ils suivent
> la *grammaire* du manga, mais ne reproduisent pas les dessins de Shirahama. C'est voulu : c'est plus
> sûr juridiquement, et les formes sont choisies pour être faciles à reconnaître à la souris ou au doigt.

---

## 1. Le principe fondamental : la magie se **dessine**

- 🟢 Dans ce monde, aucune incantation ni aucun don inné : **la magie est un dessin**. Un glyphe tracé
  avec l'encre spéciale et selon les bonnes règles produit son effet. C'est le secret de Coco au chapitre 1 :
  elle voit Qifrey dessiner un sort et comprend que n'importe qui pourrait le faire.
- 🟢 Ce secret est gardé par les sorciers. Les gens ordinaires (les « ignorants », *Unknowing* en anglais)
  croient que la magie est innée. Depuis le **Jour du Pacte**, la connaissance des glyphes est contrôlée.
- 🟢 La magie est donc une **discipline graphique** : précision du trait, mise en page, symétrie,
  qualité de l'encre et du support. Shirahama, illustratrice, en a fait une métaphore du travail d'artiste.

**Conséquence pour le simulateur :** le joueur doit *dessiner*. Le moteur juge la *qualité* du dessin,
pas seulement sa forme. Un trait tremblant ou un anneau ouvert doivent avoir des conséquences.

---

## 2. Le matériel

### 2.1 L'encre
- 🟢 Les sorts demandent une **encre magique** (*Conjuring Ink* chez les fans). 🟡 Elle serait fabriquée
  à partir d'un **arbre argenté rare**. Une encre ordinaire ne produit rien.
- 🟡 La façon de produire l'encre modifierait l'effet du sort.
- 🔵 *Simulateur :* la plume a une **réserve d'encre** qui se vide avec la longueur tracée. Quand elle est
  presque vide, le trait devient **sec** et se troue. Un anneau tracé à sec peut donc rester ouvert et le
  sort échoue. On recharge en « trempant la plume » (touche `R` ou bouton).

### 2.2 La plume
- 🟢 On dessine à la plume ou au stylet, d'un geste précis et maîtrisé. Les apprentis s'entraînent à tracer
  des cercles et des formes nettes.

### 2.3 Le support
- 🟡 Le support influence le sort. Un glyphe peut être tracé sur du papier, du tissu, le sol, une semelle,
  une pierre, un objet…
- 🟢 Des glyphes **inscrits dans des objets** donnent des **artefacts / mécanismes** (*contraptions*).
  🟡 C'est la seule façon pour les non-sorciers d'utiliser la magie, par exemple des lampes, des véhicules
  ou les chaussures de vol.
- 🔵 *Simulateur :* choix de support (parchemin, pierre, tissu, eau). Le support module la durée et la
  stabilité (voir §9.5).

> **Choix de conception des tracés.** Les formes ont été choisies pour rester **distinctes pour l'algorithme
> de reconnaissance** : « + » et « X » sont deux signes différents parce que la reconnaissance tient compte
> de la rotation, et « o » et « ◎ » se distinguent par leur second cercle. Un gribouillis au hasard obtient au plus 0,31
> de score contre les sigils et 0,66 contre les signes. Les seuils d'acceptation sont donc de 0,60 et 0,68.

---

## 3. Anatomie d'un glyphe

Un glyphe compte **trois couches concentriques** :

```
            ┌───────────── ANNEAU (cercle extérieur) ─────────────┐
            │      signe          signe          signe            │
            │                 ┌──────────┐                        │
            │    signe        │  SIGIL   │        signe           │
            │                 └──────────┘                        │
            │      signe          signe          signe            │
            └──────────────────────────────────────────────────────┘
```

| Couche | Rôle | Analogie linguistique |
|---|---|---|
| **Sigil** (centre) | Donne l'**élément**, la *nature* de l'effet | le **nom** / le verbe principal |
| **Signes** (*keystones*) | Donnent la **forme** : direction, intensité, taille, comportement | les **adverbes** / compléments |
| **Anneau** | **Contient** le sort et l'**active** quand il est fermé | la **ponctuation finale** / la signature |

### 3.1 L'anneau
- 🟢 **Le sort s'active quand l'anneau se ferme** autour du sigil et des signes. Tant qu'il reste ouvert,
  rien ne se passe.
- 🟢 Les sorciers s'en servent pour **préparer un sort à l'avance** : ils tracent tout en laissant un petit
  **espace** dans l'anneau. Le sort est alors « chargé ». Il suffit de **fermer** le trou pour lancer le sort
  instantanément, d'un seul coup de plume.
- 🟢 Un glyphe peut être **réparti sur deux supports**. Le cas typique est celui des **chaussures de vol**
  (*Sylph Shoes*) : chaque semelle porte une moitié du glyphe, et le sort s'active quand les deux moitiés
  se rejoignent.
- 🟡 La moindre **lacune** dans l'encre, ou un **tremblement** du trait, peut faire échouer le sort ou le
  rendre **erratique**.
- 🔵 Endommager ou effacer l'anneau d'un sort actif l'**interrompt**. Le manga le suggère avec les sorts
  rompus ou effacés, et c'est une mécanique essentielle pour le simulateur.

### 3.2 Le sigil
- 🟡 Il y a **cinq familles principales** : **Feu, Eau, Terre, Vent, Lumière**. Certaines sources n'en
  comptent que quatre et rangent la Lumière avec le Feu. D'autres parlent d'une *tétrade primaire*
  (Feu, Eau, Terre, Vent) dont les variantes deviennent des sigils à part entière.
- 🟡 Chaque élément a **plusieurs variantes** de sigil (« les variétés du sigil du vent », par exemple).
- 🟡 Certains **signes jouent le rôle de sigil** dans des sorts précis : *vision*, *répétition*,
  *billowing* (gonflement, bouillonnement).
- 🟡 Les dessins de certains glyphes ont **varié** au fil des tomes. Le wiki retient la version la plus
  récente comme officielle.

### 3.3 Les signes (*keystones*)
- 🟡 Ils sont placés **autour du sigil, entre le sigil et l'anneau**. Leur **nombre n'est pas fixé**.
- 🟡 Ils contrôlent la **direction**, l'**intensité** et la **taille** de la manifestation.
- 🟡 Signes nommés par la communauté :
  - **Colonne** : l'effet se manifeste en colonne ou en rayon **au-dessus** du glyphe.
  - **Dispersion** : l'effet est éparpillé.
  - **Lévitation** : l'effet ou la cible flotte.
  - **Convergence** : l'effet se concentre en un point (une sphère).
  - **Marionnette dansante** (*Dancing Puppet*) : anime un objet.
  - **Vision**, **Répétition**, **Billowing**.

---

## 4. Règles de qualité : la « physique » du dessin

Ce sont les règles qui rendent ce système unique, et les plus importantes pour un simulateur poussé.

| # | Règle | Source |
|---|---|---|
| Q1 | **Taille → puissance.** Un grand glyphe est plus puissant qu'un petit. | 🟡 |
| Q2 | **Netteté → durée.** Un glyphe propre dure plus longtemps qu'un glyphe brouillon. | 🟡 |
| Q3 | **Symétrie et régularité** : un anneau parfait et des traits nets donnent un résultat fort et fiable. | 🟡 |
| Q4 | **Équilibre des signes → direction.** Si les signes sont déséquilibrés, le sort part **du côté où il y a le plus de signes**. | 🟡 |
| Q5 | **Lacune ou tremblement → échec ou effet erratique.** | 🟡 |
| Q6 | **Anneau fermé = activation.** | 🟢 |
| Q7 | **Forme exacte requise.** Un signe mal formé ne veut rien dire, ou veut dire autre chose. | 🟢 (Coco rate souvent ses premiers sorts) |

Ces règles se traduisent directement en **métriques mesurables** (§9.3).

---

## 5. Composition et combinaison

- 🟢 Les sorciers expérimentés **combinent** les glyphes : plusieurs cercles côte à côte, des sorts qui
  s'enchaînent, des glyphes cachés dans des motifs décoratifs.
- 🟢 Coco se distingue par des **usages créatifs** de glyphes simples : elle détourne des sorts de base pour
  des effets inattendus. C'est la thématique centrale de l'œuvre.
- 🔵 *Simulateur :* chaque anneau est un **sort indépendant**. Tous partagent un **même monde physique**,
  donc les sorts **interagissent** : l'eau éteint le feu et produit de la vapeur, le vent pousse les
  particules, la lumière éclaire la nuit, le feu évapore une sphère d'eau. C'est ce qui permet de créer
  des combinaisons.

---

## 6. La magie interdite

- 🟢 Depuis le **Jour du Pacte**, toute magie **dessinée sur le corps humain** ou qui **agit sur le corps
  humain** est interdite. 🟡 La seule exception est le **sort d'effacement de mémoire**, réservé aux
  Gardiens (les *Moralistes*).
- 🟢 Les **Chapeaux à larges bords** (*Brimmed Caps*) pratiquent cette magie interdite.
- 🟢 Au chapitre 1, Coco trace un sort tiré d'un livre que lui a donné un Chapeau à larges bords : **sa
  mère est pétrifiée**. C'est l'élément déclencheur de l'histoire.
- 🔵 *Simulateur :* si un glyphe comporte trop de **signes illisibles**, le sort devient **instable**
  (effet aléatoire). Je n'ai pas modélisé la magie interdite elle-même : sans corps humain dans la scène,
  elle n'a pas d'objet.

---

## 7. Sorts connus (noms des wikis anglophones)

| Famille | Sorts cités | Composition probable |
|---|---|---|
| Feu | *Phantasmal Fireball*, *Pyreball*, *Kindle Orb* | Feu + Convergence (orbe), parfois + Projection 🔵 |
| Eau | *Rainmaker's Glyph*, *Rising Wave*, *Water Bolt* | Eau + Dispersion (pluie) / Colonne (vague montante) / Projection 🔵 |
| Vent | *Wind Wall*, *Gathering Winds*, *Skysoar Seal* | Vent + Barrière / Convergence / Lévitation 🔵 |
| Terre | *Earth Breaker* (dont les premières versions avaient un signe de lévitation à la place du sigil) | Terre + Colonne / Projection 🔵 |
| Lumière | orbes lumineux, éclairage | Lumière + Convergence / Colonne 🔵 |
| Mécanismes | *Sylph Shoes* (chaussures de vol) | glyphe partagé entre deux semelles 🟢 |

---

## 8. Analyse graphique des pictogrammes

*(Cette partie est mon analyse, utile pour concevoir des glyphes crédibles. 🔵)*

1. **Symétrie radiale.** Les glyphes sont des **rosaces**. L'anneau impose un centre, et les signes se
   répartissent souvent en couronne. On y reconnaît l'influence des **sceaux alchimiques**, des
   **enluminures médiévales** et des **rosaces gothiques**, en cohérence avec l'esthétique Art nouveau et
   gravure de la série.
2. **Lisibilité hiérarchique.** Le sigil est **plus grand** et **plus dense** que les signes, qui sont des
   pictogrammes **courts** (1 à 3 traits). On lit le glyphe comme une phrase : d'abord le nom au centre,
   puis les modificateurs.
3. **Vocabulaire de formes.**
   - Courbes, ondes, spirales → éléments **fluides** (eau, vent).
   - Angles et pointes vers le haut → **feu** (élan, flamme).
   - Formes lourdes, bases horizontales, triangles pointe en bas → **terre** (ancrage).
   - Rayonnements, étoiles → **lumière**.
   - Flèches et chevrons → **direction** ; points et cercles → **concentration / durée**.
4. **Trait continu.** Un bon glyphe s'exécute en **peu de gestes fluides**, comme une calligraphie.
5. **L'espace négatif compte.** L'équilibre entre les signes (règle Q4) fait du **placement** un élément
   *sémantique*, pas seulement esthétique. Déplacer un signe change le sort.

---

## 9. Modèle formel du simulateur

### 9.1 Grammaire

```
Glyphe     ::= Anneau( Sigil , Signe* )
Anneau     ::= un ou plusieurs arcs de même centre et même rayon ; actif ⇔ couverture angulaire ≥ 360° − ε
Sigil      ::= Feu | Eau | Vent | Terre | Lumière          (zone centrale : r < 0,45·R)
Signe      ::= Colonne | Lévitation | Convergence | Dispersion | Projection
             | Répétition | Amplification | Persistance | Tourbillon | Dôme
             | Barrière | Atténuation                       (couronne : 0,45·R ≤ r < 0,95·R)
```

### 9.2 Chaîne de traitement

```
Traits (plume, encre)
  └─► 1. Détection des ANNEAUX : traits quasi circulaires (ajustement de cercle) ; les arcs de même centre
        et même rayon sont fusionnés ; couverture angulaire mesurée sur 360 cases d'un degré
  └─► 2. Attribution des traits : chaque trait restant appartient au plus petit anneau qui le contient
  └─► 3. Zonage : zone centrale → sigil ; couronne → signes (traits regroupés par proximité, un groupe = un signe)
  └─► 4. Reconnaissance : nuage de points ($P Point-Cloud Recognizer) → classe et confiance
  └─► 5. Métriques de qualité (§9.3)
  └─► 6. Compilation : (sigil, signes, métriques) → paramètres du sort (§9.4)
  └─► 7. Simulation : monde de particules partagé, interactions élémentaires (§9.6)
```

### 9.3 Métriques

| Métrique | Calcul | Règle |
|---|---|---|
| `fermeture` | part des 360 degrés couverts par de l'encre humide | Q6 |
| `circularité` | 1 − écart-type(rayon) / rayon moyen × k | Q3 |
| `tremblement` | moyenne des déviations locales (dérivée seconde) du tracé de l'anneau | Q5 |
| `netteté` | moyenne pondérée de circularité, 1 − tremblement et confiance de reconnaissance | Q2 |
| `puissance` | (R / 140)^1,2 × amplifications | Q1 |
| `équilibre` | vecteur Σ(direction des signes) / n ; module = déséquilibre, angle = dérive | Q4 |
| `lisibilité` | confiance moyenne des reconnaissances | Q7 |

### 9.4 Compilation (sigil + signes → sort)

- **Forme** (priorité décroissante) : Dôme > Barrière > Tourbillon > Colonne > Projection > Convergence > Dispersion.
  Sans signe de forme : **jaillissement** simple.
- **Modificateurs cumulables** :
  - **Amplification** ×1,5 de puissance par occurrence.
  - **Persistance** ×1,8 de durée.
  - **Répétition** : le sort pulse.
  - **Lévitation** : l'effet flotte (gravité annulée et inversée).
  - **Atténuation** : effet doux et lent (×0,6 de puissance, ×1,4 de durée).
- **Direction** : le signe *Projection* envoie l'effet vers lui-même. Sinon, l'effet dérive vers le
  côté le plus chargé en signes (Q4).
- **Instabilité** = f(1 − netteté, signes illisibles). Au-delà d'un seuil, des **ratés** aléatoires surviennent :
  bouffées, changements de direction, extinction prématurée.
- **Durée** = base(élément) × netteté × persistance × support.

### 9.5 Supports

| Support | Durée | Stabilité | Remarque |
|---|---|---|---|
| Parchemin | ×1,0 | ×1,0 | référence |
| Pierre | ×1,6 | ×1,1 | support durable |
| Tissu | ×0,8 | ×0,9 | l'encre bave légèrement |
| Eau | ×0,4 | ×0,6 | l'encre se dilue vite |

### 9.6 Interactions élémentaires

| | Feu | Eau | Vent | Terre | Lumière |
|---|---|---|---|---|---|
| **Feu** | — | les deux disparaissent → **vapeur** | attisé : grossit et suit le vent | aucune | rien de plus (le feu éclaire déjà) |
| **Eau** | → vapeur | — | poussée, embruns | ruisselle sur la pierre | reflets |
| **Vent** | pousse | pousse | se combine (tourbillons) | n'agit que sur les petits débris | — |
| **Terre** | obstacle | obstacle | obstacle | empilement | — |
| **Lumière** | — | — | — | — | éclaire la scène nocturne |

---

## 10. Vocabulaire du simulateur : tracés de référence

Voici les tracés à reproduire. Ils sont aussi affichés dans le **Grimoire** de l'application, qui peut
les tracer pour vous en démonstration.

### Sigils (au centre)
| Sigil | Tracé | Mnémotechnique |
|---|---|---|
| **Feu** | flamme : goutte pointe en haut + trait central | l'élan vers le haut |
| **Eau** | deux vagues horizontales superposées | les flots |
| **Vent** | spirale | le souffle qui tourne |
| **Terre** | triangle pointe en bas + barre horizontale | symbole alchimique de la terre |
| **Lumière** | étoile à six branches (trois traits croisés) | le rayonnement |

### Signes (dans la couronne)
| Signe | Tracé | Effet |
|---|---|---|
| **Colonne** | « ‖ » (deux barres verticales, comme un pilier) | jet vertical / pilier / rayon |
| **Lévitation** | flèche vers le haut « ↑ » | flotte, gravité inversée |
| **Convergence** | deux cercles concentriques « ◎ » | concentration en orbe |
| **Dispersion** | « X » | éparpillement, pluie, gerbe |
| **Projection** | chevron « > » | projectile tiré vers la position du signe |
| **Répétition** | trois petits traits horizontaux « ≡ » | pulsations |
| **Amplification** | « + » | puissance ×1,5 |
| **Persistance** | petit cercle « o » | durée ×1,8 |
| **Tourbillon** | « S » | vortex / tornade |
| **Dôme** | arche « ∩ » | coupole protectrice |
| **Barrière** | zigzag « W » | mur perpendiculaire à la direction |
| **Atténuation** | tilde « ~ » | doux, lent, durable |

---

## 11. Limites et pistes

- Vérifier la terminologie avec l'édition française (Pika) et les sous-titres officiels de l'anime.
- Ajouter des **variantes de sigils** (plusieurs vents, par exemple) et des **signes-sigils** (vision, répétition).
- Ajouter des **glyphes répartis** : deux demi-glyphes à assembler, comme les *Sylph Shoes*.
- Ajouter des **mécanismes** : glyphes posés sur des objets du décor (lanterne, chariot volant).
- Ajouter un **apprentissage** de la reconnaissance : enregistrer ses propres tracés comme modèles
  (le moteur $P le permet nativement).
- Gérer l'**imbrication** d'anneaux (un sort dans un sort) pour les sorts composés.

---

## Sources

- [Witch Hat Atelier — Wikipedia](https://en.wikipedia.org/wiki/Witch_Hat_Atelier)
- [Witch Hat Atelier Wiki — Magic (fandom)](https://witch-hat-atelier.fandom.com/wiki/Magic)
- [Witch Hat Atelier Wiki — Signs Explained](https://witch-hat-atelier.fandom.com/wiki/Signs_Explained)
- [Witch Hat Atelier Wiki — Forbidden Magic](https://witch-hat-atelier.fandom.com/wiki/Forbidden_Magic)
- [Sigils Explained — telepedia](https://witchhatatelier.telepedia.net/wiki/Sigils_Explained)
- [Witch Hat Atelier's Magic System, Explained — GameRant](https://gamerant.com/witch-hat-atelier-magic-system-explained/)
- [Power System Explained — FandomWire](https://fandomwire.com/witch-hat-atelier-power-system-explained-what-are-magic-glyphs-how-do-they-work/)
- [All Known Forbidden Spells — FandomWire](https://fandomwire.com/all-known-forbidden-spells-in-witch-hat-atelier-explained/)
- [Magic System Explained — Anime Focus Network](https://www.animefocusnetwork.net/post/witch-hat-atelier-magic-system-explained-how-spells-really-work)
- [Magic & Glyphs — shapes.inc](https://shapes.inc/fandom/witch-hat-atelier/magic-system)
- [Sigils and Signs: Interactive Reference — whaspellsimulator.wiki](https://whaspellsimulator.wiki/sigils/)
- Simulateurs de fans existants, pour comparaison : [the-night7](https://the-night7.github.io/witch-hat-atelier-sigil-emulator/), [wha-spell-simulator](https://wha-spell-simulator.vercel.app/)
- Algorithme de reconnaissance : Vatavu, Anthony & Wobbrock, *Gestures as Point Clouds: A $P Recognizer for User Interface Prototypes* (ICMI 2012).
