# Système de tests — SenClass

But : **aucune régression silencieuse sur l'argent, les notes et les accès**, surtout
maintenant que des écoles réelles utilisent le produit. Une erreur de facturation ne
se voit pas à l'écran : elle se découvre en fin de mois, quand il est trop tard.

## Commandes

```bash
npm run verify
```

Au quotidien : types + lint + tests, en quelques secondes. **Vert = on peut pousser.**

```bash
npm run campagne
```

**Avant une mise en production** : une campagne autonome de 2 heures. On la lance,
on laisse l'ordinateur travailler, et on lit le rapport. Aucune intervention
pendant l'exécution, et elle finit toujours dans le temps imparti.

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` | Lance toute la suite une fois (≈ 2 s) |
| `npm run test:watch` | Relance automatiquement le test du fichier qu'on modifie |
| `npm run test:coverage` | Rapport de couverture (`coverage/index.html`) |
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit` |
| `npm run verify` | Les trois d'un coup — à lancer avant chaque push |
| `npm run campagne` | Campagne autonome complète (2 h par défaut, `-- --minutes 30` pour plus court) |
| `npm run audit:securite` | Seul l'audit de l'API (≈ 30 s) |
| `npm run mutations` | Seul le test de mutation |

En plus, c'est automatique à deux endroits :

- **Avant chaque push** : hook `.githooks/pre-push`. À activer une fois par machine :
  `git config core.hooksPath .githooks` (déjà fait sur cette machine).
- **Sur GitHub** : `.github/workflows/ci.yml` rejoue tout, plus le build de production,
  à chaque push et pull request.

## Ce qui est couvert

### 1. L'argent (priorité absolue)

| Fichier testé | Ce qui est verrouillé |
|---|---|
| `src/types/payment.ts` | Mois de l'année scolaire, mois décochés par l'école, **proratisation à la date d'inscription**, mois d'arrivée offert à partir du jour X, retards, QR de paiement |
| `src/lib/dueItems.ts` | « Que doit cet élève ? » — vue caisse (`buildPayableItems`) et vue portail (`computeDueItems`) : verrou séquentiel des mois, services mensuels/annuels, **un paiement annulé redevient dû**, **un mois payé reste visible même s'il n'est plus facturable** |
| `src/lib/paymentQueries.ts` | « A-t-il payé ? », « est-il inscrit à ce service ? » — **un paiement annulé ne solde rien**, **la scolarité de l'an dernier ne paie pas celle de cette année**, périmètres de classes, fenêtres de souscription |
| `src/lib/teacherHours.ts` | Heures d'un prof = base de son salaire. **Une séance non pointée ne rapporte rien** |
| `src/lib/subscription.ts` | **Le système ne coupe jamais un abonnement payant échu** — seule la période d'essai s'arrête d'elle-même. Et **parité client/serveur** : le test lit `docs/sql/subscription_enforcement.sql` pour vérifier que le blocage en base dit la même chose que le routeur React |
| `src/lib/payroll.ts` | Ce que l'école SORT : dû = heures effectives × taux, ou salaire fixe. **`null` (à saisir) n'est pas `0` (rien à payer)**, un versement annulé ne compte plus, un trop-versé se voit |
| `src/pages/portal/portalHelpers.ts` | Ce que la famille lit : montants, mois, moyens de paiement, références de reçu |
| `src/lib/schoolYears.ts` | Report des frais sur l'année **immédiatement** précédente — jamais une grille vieille de cinq ans |

### 2. Les notes et les bulletins

| Fichier testé | Ce qui est verrouillé |
|---|---|
| `src/hooks/useClassRanking.ts` | Formule μ_dev → μ_mat → moyenne pondérée, modes top2/top3, dispenses, coefficients personnalisés, **matière non notée exclue au lieu de compter 0**, examen interne à note unique, ex æquo |
| `src/hooks/useElementaryClassRanking.ts` | Barème de points sur 10 (CI–CM2), dispenses par élève, discipline non saisie exclue des deux sommes |
| `src/hooks/useElementaryBulletinData.ts` | Décision de passage : jamais affichée hors dernière période, jamais inventée pour le CM2 (CFEE) |
| `src/lib/bacMention.ts` | Seuils de mention 10/12/14/16 aux bornes exactes |
| `src/lib/elementaryDefaults.ts` | **La somme des points de chaque niveau tombe exactement sur le total de son étape**, sous-totaux Compétence/Ressources compris, options jamais actives par défaut |
| `src/contexts/filiereMerge.test.ts` | Filières : le niveau l'emporte sur la base (Philosophie en Tle, coefficient redéfini) — décide quelles matières entrent dans la moyenne |
| `src/lib/programmeCards.ts` | Blocs du cursus : source unique partagée par la page Cursus et la création de classe |
| `src/lib/academicProfile.ts` | **Quelles matières l'élève suit vraiment** : obligatoire active par défaut, choix et facultative inactifs tant qu'ils ne sont pas posés, coefficient personnalisé, créneaux de choix non tranchés |
| `src/lib/cumulativeAverage.ts` | Moyenne cumulée / annuelle : **jamais « annuelle » tant qu'on ne sait pas que c'est la dernière période**, s'auto-corrige si un trimestre est créé après coup, une période sans note n'est pas comptée 0 |

### 3. Les accès et l'organisation

| Fichier testé | Ce qui est verrouillé |
|---|---|
| `src/lib/permissions.ts` | Un compte élève/prof n'obtient jamais une permission du dashboard, même en trichant côté client |
| `src/lib/scheduleConflicts.ts` | Un prof ne peut pas être sur deux cours simultanés ; deux groupes différents peuvent travailler en parallèle |
| `src/lib/schoolYearBounds.ts` | Aucune séance hors de l'année scolaire — elle gonflerait les heures du prof sans être visible nulle part |
| `src/lib/accountUtils.ts` | Emails valides sur les noms accentués et composés ; mots de passe sans caractères ambigus (O/0, I/l) |
| `src/lib/linkedAccounts.ts` | Comptes liés d'un parent : jamais mélangés, jamais plantés sur un stockage corrompu |
| `src/lib/attendanceStatus.ts` | Pastille du calendrier : un incident l'emporte sur une saisie inachevée, une séance non pointée côté prof n'est jamais « complète » |
| `src/lib/csvExport.ts` | Exports Excel : **une virgule dans une adresse ne décale plus les colonnes**, BOM UTF-8 pour les accents ; à l'import, une date ou un sexe ambigu est refusé plutôt que deviné |
| `src/lib/schoolYears.ts` | Identifiants : les élèves et profs des années passées ne traînent plus dans l'écran |
| `src/types/constants.test.ts` | Aucun statut, moyen de paiement ou fréquence sans libellé — sinon « undefined » s'affiche dans une pastille |

### 4. La campagne autonome — `npm run campagne`

Ce que `verify` ne peut pas faire en trois secondes, la campagne le fait en deux
heures pendant qu'on dort. Neuf phases, de la moins chère à la plus chère ; chacune
a son budget, et une phase qui déborde est coupée proprement.

| Phase | Ce qu'elle cherche |
|---|---|
| 0. Réparation | Un fichier laissé modifié par une exécution interrompue |
| 1-5. Fondations | Types, lint, tests, seuils de couverture, build de production |
| 6. **Audit de l'API** | Ce qu'un inconnu muni de la seule clé publique peut lire ou écrire — sur **chaque** table et **chaque** RPC. Le routeur React n'existe pas pour `curl` |
| 7. **Propriétés** | Les mêmes règles rejouées sur 2 000, puis 20 000, puis 100 000 situations tirées au hasard (`src/test/proprietes.test.ts`) |
| 8. **Mutation** | Abîme volontairement le code critique et vérifie que les tests s'en aperçoivent. C'est le seul contrôle qui juge les **tests** |
| 9. Contrôle final | Les sources sont bien revenues à leur état d'origine |

Le rapport arrive dans `rapports/campagne-<date>.md`, avec un verdict en tête :
**DÉPLOYABLE** ou **NE PAS DÉPLOYER**, et le détail des échecs s'il y en a.

#### Tests par propriétés

Les tests écrits à la main vérifient les cas auxquels on a pensé. Ceux-ci génèrent
des situations au hasard et vérifient qu'une règle tient **toujours**. Exemples de
règles ainsi éprouvées sur des centaines de milliers de cas :

- les mois facturés sont toujours un sous-ensemble des mois de l'année, sans doublon ;
- **ajouter une matière non notée ne change jamais une moyenne** ;
- offrir le mois d'arrivée ne peut que réduire une facture ;
- un CSV exporté se relit à l'identique, guillemets et virgules compris ;
- les heures payées ne dépassent jamais les heures théoriques.

#### Test de mutation

Le principe : on remplace un `>=` par un `>`, un `&&` par un `||`… puis on relance
les tests. S'ils **échouent**, tant mieux : ils surveillent cette ligne. S'ils
**passent**, la mutation a « survécu » — du code peut être cassé là sans que rien
ne s'en aperçoive.

Le score actuel est de **84 %** sur les modules critiques. Une mutation survivante
n'est pas toujours un bug (certaines ne changent rien au comportement), mais elle se
lit comme « à cet endroit, aucun test ne regarde ».

Ce testeur **écrit dans les fichiers sources**. Il a donc deux filets : il refuse de
s'exécuter s'il est simplement importé, et il écrit une copie de secours sur disque
avant chaque mutation. Si la machine est arrêtée en pleine campagne :

```bash
node scripts/mutations.mjs --restaurer
```

### 5. Garde-fous d'architecture — `src/test/guards.test.ts`

Ceux-là ne testent pas un calcul : ils **lisent le code source** et tombent quand du
code NEUF contourne une règle capitale. C'est le seul filet contre les régressions
qu'aucun test unitaire ne peut prévoir, parce qu'elles n'existent pas encore.

1. **Tout écran qui calcule des mois de scolarité passe par `getBillableMonthsFor`.**
   Si quelqu'un ajoute un écran de paiement et itère directement sur `getAcademicMonths`,
   le test échoue en nommant le fichier. Les quatre exceptions légitimes sont listées
   dans le test avec leur raison écrite.
2. **Aucune écriture comptable n'est supprimable** (`payments`, `salary_payments`,
   `billing_transactions`, `platform_payment_claims`) : un paiement s'annule par son
   statut, il ne se supprime jamais.
3. **Chaque route sensible garde sa permission** dans `App.tsx` — `/paiements`,
   `/identifiants`, `/salaires`… Renommer une route sans son verrou fait tomber le test.
4. **Un paiement annulé n'est jamais compté comme encaissé**, partout où on additionne.
5. **Les calculs sensibles restent testables** : chaque module critique doit avoir son
   fichier de test à côté, et rester pur — aucun import de React ni du client Supabase.
   Rapatrier un de ces calculs dans un composant fait échouer le test.
6. **Personne ne réassemble un CSV à la main** : tout export passe par `buildCsv`,
   sinon un guillemet oublié décale les colonnes dans Excel.
7. **Une dispense élémentaire s'applique partout à la fois** : moyenne, bulletin,
   saisie de notes et taux de complétion.

## La couverture est un garde-fou, pas une décoration

`npm run test:coverage` **échoue** si la couverture d'un fichier du chemin de l'argent
descend sous son seuil (déclarés dans `vitest.config.ts`) :

| Fichier | Seuil (instructions) |
|---|---|
| `src/lib/subscription.ts` | 100 % |
| `src/lib/permissions.ts` | 100 % |
| `src/lib/paymentQueries.ts` | 100 % |
| `src/lib/schoolYearBounds.ts` | 100 % |
| `src/lib/payroll.ts` | 100 % |
| `src/lib/csvExport.ts` | 100 % |
| `src/lib/cumulativeAverage.ts` | 100 % |
| `src/lib/attendanceStatus.ts` | 100 % |
| `src/lib/academicProfile.ts` | 95 % |
| `src/types/payment.ts` | 95 % |
| `src/lib/teacherHours.ts` | 95 % |
| `src/lib/dueItems.ts` | 85 % |

Ajouter une règle de facturation sans son test fait donc tomber la commande. La mesure
ne porte volontairement que sur la logique métier (≈ 91 % aujourd'hui) : mesurer aussi
les écrans et les PDF produirait un chiffre flatteur qui ne protège de rien.

## Écrire un nouveau test

Le fichier vit **à côté du code** qu'il teste : `src/lib/truc.ts` → `src/lib/truc.test.ts`.

Deux règles de style, visibles dans les fichiers existants :

- Le nom du test décrit la **règle métier en français**, pas la fonction :
  `'ne facture rien avant le mois d\'arrivée'` plutôt que `'test getStudentBillableMonths'`.
  Quand il tombe, on comprend ce qui est cassé sans lire le code.
- Les règles les plus coûteuses à casser sont écrites EN MAJUSCULES dans le nom
  (`'UN PAIEMENT ANNULÉ REDEVIENT DÛ'`) — ce sont des décisions produit, pas des détails.

## Ce qui n'est pas couvert (assumé)

- **Le rendu des composants React.** Tester les écrans demanderait de simuler Supabase et
  tous les contextes : beaucoup de mécanique, des tests fragiles, peu de bugs attrapés.
  La logique a été extraite des composants et des contextes (`dueItems.ts`,
  `paymentQueries.ts`, `payroll.ts`, `teacherHours.ts`, `scheduleConflicts.ts`,
  `schoolYearBounds.ts`, `academicProfile.ts`, `cumulativeAverage.ts`, `csvExport.ts`,
  `attendanceStatus.ts`) précisément pour être testable sans eux — et le garde-fou n°5
  l'y maintient.
- **Tout ce qui parle au réseau** : `addLinkedAccount`, la création de comptes Supabase,
  la publication des bulletins. Seule la partie locale (stockage, formats) est couverte.
- **Les policies RLS de Supabase.** Le blocage d'abonnement, lui, a sa parité vérifiée
  automatiquement (voir `subscription.test.ts`) ; les autres policies se vérifient
  directement en base, avec une transaction annulée qui simule chaque rôle :
  ```sql
  BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL request.jwt.claim.sub = '<uuid de l utilisateur>';
  SELECT count(*) FROM public.<table>;   -- doit être vide pour une autre école
  ROLLBACK;
  ```
- **Les PDF** (bulletins, export de classement) : le contenu vient des hooks déjà testés,
  seule la mise en page ne l'est pas.
