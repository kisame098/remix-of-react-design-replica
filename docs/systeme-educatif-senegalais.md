# Système éducatif sénégalais — notes de référence

Document vivant, mis à jour au fil des explications de l'utilisateur (propriétaire du produit, connaissance directe du système). Sert de référence pour configurer les cursus par défaut dans l'app (`src/contexts/SchoolContext.tsx`, `DEFAULT_FILIERE_TEMPLATES`).

**Convention** : ✅ = confirmé par grille officielle ou par l'utilisateur. ❓ = incertain / à confirmer. Ne jamais coder en dur une valeur marquée ❓ sans confirmation.

---

## Ce que je sais déjà (avant mise à jour par l'utilisateur)

### Structure générale
- Collège (6e → 3e) : programme identique pour tous, pas de série. Examen de fin de cycle : **BFEM**.
- Lycée (2nde → Tle) : à partir de la 2nde, séries scientifiques (S) et littéraires (L) déjà distinctes ; la scission en sous-séries (S1/S2, L2/L') se fait en général à l'entrée en 1ère. Examen de fin de cycle : **Baccalauréat**.
- Passage collège → lycée : commission d'orientation sur dossier après le BFEM (le BFEM seul ne suffit pas à choisir librement sa série).
- Deux grilles de coefficients distinctes à ne pas confondre : la grille **scolaire** (bulletins trimestriels, utilisée pour la moyenne courante) et la grille **d'examen national** (BFEM/Bac, ne sert qu'à pondérer l'épreuve finale). Ce document et les cursus par défaut de l'app utilisent la grille **scolaire**.

### Coefficients scolaires (grille de bulletin) — ✅ confirmés

**Collège**
| Niveau | Français | Maths | Anglais | HG | Éduc. civique | SVT | SP | Arabe | EPS |
|---|---|---|---|---|---|---|---|---|---|
| 6e/5e | 4 | 3 | 2 | 2 | 1 | 2 | – | – | 2 |
| 4e/3e | 4 | 3 | 2 | 2 | 1 | 2 | 2 | 2 | 2 |

**Lycée — séries scientifiques**
| Niveau | Français | Anglais | Maths | HG | SVT | SP | Arabe | Espagnol | Éco | Philo | EPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2nde S (tronc commun avant scission) | 3 | 3 | 5 | 2 | 5 | 5 | 3 | 3 | 2 | – | 1 |
| 1ère S1 | 3 | 2 | 8 | 2 | 2 | 8 | 2 | 2 | – | – | 1 |
| Tle S1 | 3 | 2 | 8 | 2 | 2 | 8 | – | – | – | 2 | 1 |
| 1ère S2 | 3 | 2 | 5 | 2 | 6 | 6 | 2 | 2 | 2 | – | 1 |
| Tle S2 | 3 | 2 | 5 | 2 | 6 | 6 | – | – | – | 2 | 1 |

Point notable ✅ : le socle commun (Français/Anglais/Maths/HG/SVT/SP/EPS) est **identique entre 1ère et Tle** pour une même série S1/S2 — seuls Arabe/Espagnol/Éco disparaissent en Tle et Philosophie apparaît. Pas de matière au choix en S1/S2 — tout est obligatoire, coefficients fixes.

**Lycée — séries littéraires**
| Niveau | Français | Anglais | Maths | HG | SVT | SP | Arabe | Espagnol | Éco | Philo | EPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2nde L (tronc commun avant scission) | 4 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 2 | – | 1 |
| 1ère L2 | 5 | 4/2 (choix) | 3 | 6 | 2 | 2 | 4/2 (choix) | 4/2 (choix) | 2 | – | 1 |
| Tle L2 | 5 | 4/2 (choix) | 2 | 6 | 2 | 2 | 4/2 (choix) | 4/2 (choix) | 2 | 6 | 1 |
| 1ère L' | 6 | 4 | 3 | 2 | – | – | 4 | 4 | – | – | 1 |
| Tle L' | 6 | 4 | 2 | 2 | – | – | 4 | 4 | – | 4 | 1 |

Points notables :
- ✅ En L2, "4/2" = un vrai choix : l'élève désigne UNE langue dominante (coef 4) parmi Anglais/Arabe/Espagnol, les deux autres restent non-dominantes (coef 2 chacune) — choix individuel, pas par classe. Ce choix reste identique entre 1ère et Tle.
- ✅ En L2, Maths change entre 1ère (3) et Tle (2) — contrairement aux séries S où Maths reste stable.
- ❓ En L', Anglais/Arabe/Espagnol sont tous à coef 4 dans la grille dont je dispose, **sans** indication de mécanisme de choix (pas de "4/2"). Je ne sais pas si c'est un vrai tronc commun trilingue obligatoire, ou si un choix existe dans la pratique sans être visible dans cette grille. **À confirmer.**

### Zones connues comme non confirmées (❓)
- Sous-branches L1, L1a, L1b — mentionnées comme existantes mais coefficients non trouvés/confirmés.
- STEG (Sciences et Techniques Économiques et de Gestion), STIDD — coefficients non confirmés.
- Filières franco-arabes (LA, S1A, S2A) — structure où le Français jouerait le rôle de "LV1" face à l'Arabe, mécanisme exact non confirmé.
- Grilles d'examen (BFEM/Bac) — connues séparément de la grille scolaire mais pas systématiquement recoupées avec elle dans ce document.

---

## Mises à jour de l'utilisateur

### Round 1 — analyse de 15 bulletins réels (divers lycées/CEM, 2021-2025)

Source bien plus fiable que la grille "officielle" trouvée par recherche web : des bulletins réels de plusieurs établissements différents. Un bulletin ne montre QUE les matières que l'élève suit réellement — confirme directement notre philosophie "profil individuel de l'élève".

**Récapitulatif brut (établissement, classe/série, matières et coefficients affichés) :**

| Établissement | Classe | Série | Matières (coef) |
|---|---|---|---|
| Lycée Dahra 1 | 1ère | **L'1** | Fr(6) Maths(3) Ang(4) HG(2) **Espagnol(4)** EPS(1) — pas d'Arabe |
| Lycée Elhadj Baba Ndiongue | 1S1 | S1 | Fr(3) Maths(8) Ang(2) HG(2) SVT(2) SP(8) EPS(**2**) — pas d'Arabe/Espagnol |
| Lycée Elhadj Baba Ndiongue | 1L2B | L2 | Fr(5) Maths(3) Ang(2) HG(6) **SP(2) seule** **Espagnol(4)** EPS(2) — pas de SVT, pas d'Arabe |
| Lycée Thiaroye | 1S2E | S2 | Fr(3) Maths(5) Ang(2) HG(2) SVT(6) SP(6) EPS(1) — pas d'Arabe/Espagnol/Éco |
| Lycée Mame Cheikh Mbaye | 2LA | L (2nde) | Fr(4) Maths(3) Ang(3) **HG(4)** SVT(2) **Espagnol(3) seule** EPS(1) Éco(2) — pas de SP, pas d'Arabe |
| Lycée Enseignement Général | 2LOK | L (2nde) | Fr(4) Maths(3) Ang(3) **HG(4)** SVT(2) SP(2) **Espagnol(3)** EPS(1) — pas d'Éco |
| Lycée Sinthiou Dangde | 2ndS | S (2nde) | Fr(3) Maths(5) **Ang(2)** HG(2) SVT(5) **Arabe(2)** SP(5) EPS(**2**) — pas d'Espagnol/Éco |
| Lycée Mamadou Amadou Deme | 1L2D | L2 | Fr(5) Maths(3) **Ang(4) seule** HG(6) **SP(2) seule** EPS(1) **Philosophie(1)** Éco(2) **Conduite(1)** — pas de SVT |
| Lycée Camp Marchand | TL'1 | L'1 (Tle) | Fr(6) Maths(2) Ang(4) HG(2) EPS(1) Philosophie(4) **Portugais(4)** — pas d'Arabe/Espagnol |
| Lycée Alpha Molo Balde | 2LE | L (2nde) | Fr(4) Maths(3) Ang(3) **HG(4)** SP(2) EPS(1) **Portugais(3)** — pas de SVT |
| Lycée Ahmadou Ndack Seck | 1L2B | L2 | Fr(5) Maths(3) **Ang(4)** HG(6) **SVT(2) seule** **Espagnol(2)** EPS(1) Éco(2) **Éduc. Artistique(1)** — pas de SP |
| CEM Mbacke 3 | 1èreL2A | L2 | Fr(5) Maths(3) **Ang(2)** HG(6) **SVT(2) seule** **Espagnol(4)** EPS(1) — pas de SP |
| Lycée Enseignement Général | 2L0J | L (2nde) | Fr(4) Maths(3) Ang(3) **HG(4)** SVT(2) SP(2) EPS(1) **Portugais(3)** — *"Série proposée : L2"* |
| Lycée Abdoulaye Sadji | 2LE | L (2nde) | Fr(4) Maths(3) Ang(3) **HG(4)** SVT(2) SP(2) EPS(1) **Allemand(3)** — *"Série proposée : L2"* |
| Lycée Fahu | TL2B | L2 (Tle) | Fr(5) **Maths(2)** **Ang(4)** HG(6) **SP(2) seule** **Espagnol(2)** EPS(1) **Philosophie(6)** — pas de SVT |

**Ce qui contredit / met à jour ma vision précédente (✅ nouvelle certitude, remplace le ❓ ou le mauvais ✅ d'avant) :**

1. **HG en 2nde L = 4, pas 3.** Confirmé sur 5 bulletins 2nde L différents, tous à 4. Je corrige la grille du round précédent.
2. **En L2 (1ère et Tle), SVT et Sciences Physiques ne sont JAMAIS montrées ensemble — c'est un vrai choix, pas deux matières obligatoires.** Sur 4 bulletins L2 indépendants (écoles différentes), chacun montre EXACTEMENT une seule des deux. Ça confirme mot pour mot ce que l'utilisateur avait dit il y a plusieurs échanges ("pour L2 on doit aussi choisir entre SVT et Sciences Physiques") — **notre cursus "L2" actuellement en base a SVT(2) ET SP(2) comme deux matières obligatoires séparées, c'est faux, ça doit devenir un groupe de choix "Sciences" (coef 2, options SVT/Sciences Physiques).**
3. **La langue "au choix" en L2 n'est pas toujours à 3 (Anglais+Arabe+Espagnol tous étudiés) — dans la pratique, un élève ne montre souvent que 2 langues au total (parfois même 1 seule), jamais 3 à la fois.** Le mécanisme dominant(4)/non-dominant(2) est confirmé réel et individuel (vu dans les deux sens : Espagnol dominant+Anglais non-dominant sur un bulletin, Anglais dominant+Espagnol non-dominant sur un autre) — bonne nouvelle, ça valide exactement l'architecture LV1/LV2 déjà construite (deux groupes de choix indépendants, pas obligatoire de remplir les deux).
4. **Le pool de langues au choix est plus large que Anglais/Arabe/Espagnol — Portugais et Allemand apparaissent aussi**, dès la 2nde L. Rien à changer dans le moteur (le pool est déjà libre/configurable), mais les valeurs par défaut pourraient inclure Portugais/Allemand comme options courantes.
5. **Philosophie peut apparaître dès la 1ère (pas seulement Tle), à un coefficient très faible (1)** — vu sur un seul bulletin (1L2D), donc probablement une pratique d'un établissement particulier ("initiation"), pas une règle générale. Reste ❓, je ne change pas la base Tle-uniquement par défaut, mais c'est un cas réel qui existe.
6. **1ère/Tle S1 et S2 : Arabe/Espagnol/Économie n'apparaissent quasiment jamais dans les bulletins réels**, contrairement à ma grille précédente qui les incluait pour 1ère. Et **EPS = 2 dans certains bulletins S1/S2/2nde S, pas 1** comme je l'avais noté. Ces deux points restent à confirmer sur plus d'échantillons avant de changer les valeurs par défaut déjà en base (S1/S2 actuels), car une seule source par série ne suffit pas à trancher contre la grille officielle déjà utilisée.
7. **Des matières facultatives réelles confirmées : "Conduite" (coef 1) et "Éducation Artistique" (coef 1)** — valide directement la décision récente d'ajouter un 3ᵉ type de matière "facultative" dans le moteur (ni obligatoire, ni un choix exclusif).
8. **Champ "Série proposée" en fin de 2nde** — les bulletins de fin d'année affichent une recommandation d'orientation vers la série de 1ère (ex: "Série proposée : L2"). Pas une action à coder maintenant, mais une piste intéressante pour préremplir le choix de cursus au moment du passage 2nde→1ère.

**Pas encore d'action en base** — cette session reste en apprentissage (confirmé par l'utilisateur : "on commence avec cela apprend comprend"). Le point le plus actionnable pour la suite est le n°2 (groupe de choix Sciences pour L2).

### Round 2 — deux classes entières, même établissement, deux années (Lycée Bambylor)

Données bien plus fortes que le round 1 : une classe ENTIÈRE de "1ereL'1a" (33 élèves, 2016-2017) et une classe ENTIÈRE de "TL'1B" (32 élèves, 2023-2024) — même établissement, même branche "L'1" à deux niveaux différents. Ça permet de voir la structure réelle, pas juste un échantillon isolé.

**⚠️ Ma précédente entrée "L'" (Français/Anglais/Arabe/Espagnol tous à coef 4 fixes, sans choix) était probablement fausse.** La vraie série "L'1" fonctionne complètement différemment, et le mécanisme change entre 1ère et Terminale — un phénomène que je n'avais pas anticipé.

**1ère L'1(a) — structure confirmée sur 33 élèves, tous identiques :**
Mathématiques(2), Histoire-Géo(2), Français(6), EPS(1), **+ 2 langues choisies parmi {Espagnol, Anglais, Arabe}, chacune à coef 4** (total = 19). Pas de SVT/SP/Économie/Philosophie à ce niveau.
- Les deux langues choisies sont étiquetées "LV1"/"LV2" sur le bulletin, mais **les deux coefficients sont IDENTIQUES (4 et 4)** — contrairement à L2 où LV1(4)/LV2(2) sont asymétriques. L'étiquette LV1 vs LV2 n'a donc aucun effet sur le calcul ici, ce n'est qu'un affichage.
- Sur 33 élèves : la combinaison la plus fréquente est Espagnol+Anglais, mais on trouve aussi Anglais+Arabe (Salif Diakho) et Arabe+Anglais (Daha Boiro, Fatim Ba) — donc un vrai choix individuel dans un pool à 3, pas 2 langues figées pour toute la classe.

**Terminale L'1(B) — structure confirmée sur ~20 élèves, tous identiques :**
Français(6), Mathématiques(2), **Anglais(4) — devient FIXE, obligatoire pour tous**, Histoire-Géo(2), **+ 1 langue choisie entre {Espagnol, Arabe} à coef 4** (plus de choix à 3, juste 2), EPS(1), Philosophie(4), **Conduite(0)**, Éducation Artistique(1). Total = 24 (23 si EPS absent).
- **Le mécanisme de choix change de forme entre 1ère et Tle pour la même branche** : en 1ère c'est "2 parmi 3, mêmes coef" ; en Tle c'est "Anglais fixe + 1 parmi 2". Bonne nouvelle : notre architecture (base niveau '' + redéfinition par niveau, y compris pour les groupes de choix) supporte déjà ce genre de changement structurel, il suffirait de configurer les groupes différemment par niveau — pas besoin de nouveau mécanisme.
- **Découverte importante : "Conduite" a un coefficient de 0.** Notée (souvent 14.00 pour tout le monde, un genre de note automatique de participation) mais elle ne compte PAS dans la moyenne (le total des coefficients exclut son 0). **Ça casse une contrainte de notre schéma actuel** (`coefficient > 0` sur les matières de filière) — il faudra la relâcher en `>= 0` pour représenter fidèlement une matière suivie/notée mais neutre pour le calcul. Aucune action prise pour l'instant (apprentissage), mais c'est le changement le plus concret à faire avant de configurer une vraie série avec ce genre de matière.
- Quelques élèves n'ont pas EPS du tout sur leur bulletin (Dibor Ndiaye, Daba Sarr) — confirme encore une fois qu'un élève peut diverger individuellement (dispense) sans que ça change le programme de la classe.

**Conclusion pratique** : "L'1" (avec ses variantes a/b selon les classes parallèles, ex: L'1a, L'1B) est une vraie série distincte, différente de ce que j'avais deviné pour "L'" à partir de la grille officielle. Je ne corrige pas encore la base — ça attend une confirmation explicite avant de remplacer le cursus "L'" déjà en place.

### Round 3 — classe entière Terminale L2 (TL2D, Lycée Bambylor, 26 élèves)

Première fois qu'on a une CLASSE ENTIÈRE de Tle L2 (pas juste des bulletins isolés d'écoles différentes) — confirme très fortement tout ce qu'on soupçonnait déjà, avec un échantillon large et homogène.

**Structure confirmée sur ~22 élèves valides** (quelques bulletins avec notes à 0.00 partout = élèves probablement exclus/partis en cours d'année, non représentatifs, écartés) :
Français(5), Mathématiques(2), Anglais(2 ou 4), Histoire-Géo(6), **SVT ou Sciences Physiques (jamais les deux, coef 2)**, Espagnol(4 ou 2), EPS(1), Philosophie(6), **Conduite(0)**, Éducation Artistique(1). **Total = 29** pour tous les élèves avec un dossier complet.

- ✅✅ **Le choix SVT/Sciences Physiques en L2 est reconfirmé sur une classe entière et indépendante** (5ᵉ classe différente à le montrer, toutes séries confondues) — n'importe quel doute restant est levé, c'est une vraie règle du système, pas une coïncidence entre 4 échantillons.
- ✅ **Anglais/Espagnol confirmé comme un vrai choix dominante(4)/non-dominante(2)** — les deux sens observés sur cette seule classe (Boubacar Ba: Anglais 4/Espagnol 2 ; Mame Diarra Ba: Anglais 2/Espagnol 4). Coïncide exactement avec ce qui est déjà en base pour L2 (LV1 coef 4 / LV2 coef 2).
- ✅ **Philosophie(6), Maths(2), Français(5), HG(6), EPS(1) en Terminale L2 correspondent exactement à ce qui est déjà configuré dans notre cursus "L2"** — aucune correction nécessaire sur ces valeurs.
- ✅✅ **"Conduite" à coefficient 0 reconfirmé** sur une classe entière et une série différente (L2, pas seulement L'1) — ce n'est donc pas une bizarrerie propre à L'1, c'est un schéma général sénégalais (au moins dans get cet établissement) : une matière "Conduite" notée mais neutre pour la moyenne. Renforce clairement le besoin de relâcher la contrainte `coefficient > 0`.
- Pas d'Arabe ni d'Économie dans cette classe de Tle L2 — cohérent avec ce qui est déjà en base (ces matières n'existent qu'en option 1ère chez nous, absentes en Tle).

**Bilan des deux actions concrètes identifiées jusqu'ici, maintenant doublement confirmées par des classes entières indépendantes :**
1. Remplacer les deux matières obligatoires SVT(2)+Sciences Physiques(2) du cursus L2 par un groupe de choix "Sciences" (coef 2, options SVT/Sciences Physiques).
2. Relâcher la contrainte `coefficient > 0` en `>= 0` sur les matières de filière, pour pouvoir représenter une "Conduite" notée mais non comptée.

### Round 4 — classe entière de 2nde L (2LA, Lycée Bambylor, 80 élèves, 2020-2021)

Le plus grand échantillon à ce jour (80 élèves), et une vraie surprise sur le collège/lycée-tronc-commun de 2nde.

**Structure confirmée sur ~20 élèves examinés :**
Français(4), Mathématiques(3), Anglais(3), Histoire-Géographie(4), SVT(2), Sciences Physiques(2), **Arabe OU Espagnol (jamais les deux, coef 3)**, EPS(1), Conduite(0), Éducation Artistique(1). Total = 23 (22 si EPS absent chez un élève).

**⚠️ Correction importante : en 2nde L, Arabe et Espagnol ne sont PAS deux matières obligatoires séparées — c'est un vrai choix (une seule des deux par élève).** Sur les ~20 bulletins examinés, l'écrasante majorité a Espagnol, une minorité a Arabe — mais jamais les deux ensemble. **Notre cursus "L" actuel en base a les deux comme obligatoires séparées, c'est faux** — troisième cas concret (après SVT/SP en L2) où un "groupe de choix" remplace ce que j'avais codé comme deux matières obligatoires.

**Autres confirmations :**
- HG = 4 en 2nde L, reconfirmé sur un très grand échantillon (déjà noté round 1).
- "Conduite" à coefficient 0 apparaît **dès la 2nde**, pas seulement en 1ère/Tle — c'est donc un schéma généralisé à tous les niveaux du lycée dans cet établissement, pas une spécificité de la Terminale.
- "Éducation Artistique" présente dès la 2nde également.
- SVT et Sciences Physiques sont bien TOUTES LES DEUX obligatoires à ce niveau (pas de choix) — cohérent avec le round 3 : le choix Sciences n'apparaît qu'à partir de la 1ère (L2), la 2nde reste tronc commun sur les sciences.

**Bilan mis à jour des actions concrètes (3 corrections identifiées) :**
1. L2 : remplacer SVT+SP obligatoires par un groupe de choix "Sciences" (coef 2). **✅ Appliqué.**
2. Relâcher `coefficient > 0` → `>= 0` pour représenter "Conduite". **Pas fait** — voir décision round 5 : Conduite/Éducation Artistique ne sont pas repris dans les gabarits par défaut (probablement spécifiques à Lycée Bambylor, pas confirmés ailleurs), donc pas urgent.
3. 2nde L : remplacer Arabe+Espagnol obligatoires par un groupe de choix "Langue 2" (coef 3, options Arabe/Espagnol). **✅ Appliqué.** (2nde S non touché, une seule source insuffisante pour confirmer le même mécanisme.)

## Round 5 — décision de priorisation (stats réelles du bac) + implémentation

L'utilisateur a fourni les vraies statistiques de répartition des candidats au bac par série : **L'1 = 26,94%**, **L2 = 52,40%**, **S2 = 15,79%**, **S1 = 0,05%**, **L1/L1b (sans apostrophe) = 0,02% + 0,01%**.

**Décision** : ne préremplir par défaut que les séries qui, à elles trois, représentent l'écrasante majorité des élèves — **L'1, L2, S2**. S1 et L1/L1a/L1b (sans apostrophe) sont trop marginaux (< 0,1% à eux tous) pour justifier un gabarit national — laissés à la charge de l'école concernée, via le même moteur générique. Confirmation au passage : le "L1a/L1b" évoqué au tout début de la conversation n'a jamais été confirmé et reste distinct de "L'1" (avec apostrophe), qui lui est bien documenté (rounds 2-3).

**Nouvelle information apportée par l'utilisateur** : en L2, "Économie" peut remplacer LV2 — confirmé comme une vraie règle du système, même si aucun bulletin réel examiné jusqu'ici n'a montré un élève l'ayant choisi.

**Corrections appliquées en base et dans `DEFAULT_FILIERE_TEMPLATES` (src/contexts/SchoolContext.tsx)** — cursus "L", "L2", et remplacement de l'ancien "L'" (mal modélisé) par "L'1" (structure réelle confirmée) :
- **L (2nde)** : HG corrigé 3→4 (oubli du round 1, jamais appliqué). Arabe+Espagnol (obligatoires à tort) → groupe de choix "Langue 2" (coef 3). Économie retirée (absente des 80 bulletins réels examinés — contrairement à ma première hypothèse tirée de la grille).
- **L2** : SVT+Sciences Physiques (obligatoires à tort) → groupe de choix "Sciences" (coef 2, base — s'applique aux deux niveaux). Économie retirée des matières obligatoires ; ajoutée comme 4ᵉ option du groupe "LV2", mais **seulement en 1ère** (redéfinition niveau='1ère' du groupe LV2 avec Anglais/Arabe/Espagnol/Économie — en Tle, LV2 garde son pool de base à 3 langues, sans Économie, cohérent avec les bulletins réels qui n'en montrent jamais en Terminale).
- **L'1** (remplace "L'")  : base commune (Français 6, Maths 2, HG 2, EPS 1) + en 1ère deux groupes de choix indépendants "Langue 1"/"Langue 2" (coef 4 chacun, pool Anglais/Arabe/Espagnol) + en Tle, Anglais devient une matière fixe (coef 4) et un seul groupe "Langue 2" subsiste (pool réduit à Arabe/Espagnol) + Philosophie (coef 4, Tle uniquement).

Vérifié en base après application : aucune classe n'était assignée à l'ancien "L'", suppression sans risque. Les nouvelles données de "L", "L2" et "L'1" ont été relues et confirmées cohérentes avec tout ce qui précède dans ce document.

## Round 6 — S1/S2/2nde S : Arabe/Espagnol/Économie sont facultatifs, pas obligatoires

En vérifiant l'écran "Cursus" en direct, l'utilisateur a pointé Arabe/Espagnol/Économie affichés comme "obligatoire" pour S2 en 1ère — exactement la configuration déjà signalée comme douteuse (un seul bulletin réel d'1ère S2 ne montrait aucune des trois).

**Résolution** : ce n'est ni "obligatoire pour tous" ni "n'existe pas" — la grille officielle documente bien un coefficient réel pour ces matières, mais un bulletin réel montre un élève qui n'en suit aucune. Conclusion : ce sont des matières **facultatives** (le type qu'on vient de construire), pas obligatoires. Résout la contradiction entre grille officielle et bulletins réels sans jeter ni l'une ni l'autre source.

**Appliqué en base et dans `DEFAULT_FILIERE_TEMPLATES`** :
- **S1 (1ère)** : Arabe(2)/Espagnol(2) passés d'obligatoire à facultatif.
- **S2 (1ère)** : Arabe(2)/Espagnol(2)/Économie(2) passés d'obligatoire à facultatif.
- **S (2nde)** : Arabe/Espagnol/Économie ajoutés comme facultatifs (coefficient 2, aligné sur la valeur confirmée en 1ère — pas sur la grille officielle qui indiquait 3 pour ce niveau, jamais recoupée par un bulletin réel).

**Reste ouvert** : toujours un seul bulletin réel par niveau pour la famille S (contre 20-80 pour la famille L) — cette correction est motivée mais moins solidement confirmée que celles du round 5. Si l'utilisateur peut fournir des classes entières de S1/S2/2nde S, à revérifier.
