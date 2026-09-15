#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TEST DE MUTATION — « mes tests servent-ils vraiment à quelque chose ? »
//
// Le principe : on abîme volontairement le code source (un `>=` devient `>`,
// un `&&` devient `||`, un montant change de 1…) puis on relance les tests.
//
//   • les tests ÉCHOUENT  → la mutation est « tuée » : les tests font leur
//     travail sur cette ligne ;
//   • les tests PASSENT   → la mutation a « survécu » : du code peut être
//     cassé sans que rien ne s'en aperçoive. C'est un angle mort.
//
// C'est le seul contrôle qui juge les TESTS et pas le code. Il est lent par
// nature (une exécution de tests par mutation), donc idéal à laisser tourner
// pendant qu'on fait autre chose — voir scripts/campagne.mjs.
//
//   node scripts/mutations.mjs [--minutes 60] [--json rapport.json]
//
// Le fichier source est TOUJOURS remis en état, y compris sur Ctrl-C.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = process.cwd();

// ── Filet de sécurité n°1 : ne jamais s'exécuter sur un simple import ───────
// Un `import('./mutations.mjs')` (diagnostic, éditeur, outil tiers) lancerait
// sinon une campagne de mutation en tâche de fond, qui abîmerait les sources
// d'un projet en cours d'édition. Vécu.
const EST_POINT_D_ENTREE = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (!EST_POINT_D_ENTREE) {
  console.warn('[mutations] importé et non exécuté : aucune mutation lancée.');
}

// ── Filet de sécurité n°2 : une copie SUR DISQUE avant toute mutation ───────
// Les gestionnaires `process.on('exit')` ne tournent pas sur un SIGKILL. La
// copie de secours, elle, survit à tout — et la prochaine exécution la
// restaure automatiquement.
const ABRI = join(racine, '.mutations-en-cours');

const cheminAbri = (cible) => join(ABRI, cible.replace(/[/\\]/g, '__'));

function restaurerAbandons({ silencieux = false } = {}) {
  if (!existsSync(ABRI)) return 0;
  let n = 0;
  for (const nom of readdirSync(ABRI)) {
    const cible = nom.replace(/__/g, '/');
    const sauvegarde = join(ABRI, nom);
    const destination = join(racine, cible);
    if (existsSync(destination)) {
      writeFileSync(destination, readFileSync(sauvegarde, 'utf8'));
      if (!silencieux) console.log(`↺  ${cible} restauré depuis une exécution interrompue`);
      n++;
    }
    rmSync(sauvegarde, { force: true });
  }
  rmSync(ABRI, { recursive: true, force: true });
  return n;
}

// Mode réparation seule : `node scripts/mutations.mjs --restaurer`
if (EST_POINT_D_ENTREE && process.argv.includes('--restaurer')) {
  const n = restaurerAbandons();
  console.log(n === 0 ? '✓ Aucun fichier à restaurer.' : `✓ ${n} fichier(s) restauré(s).`);
  process.exit(0);
}
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};

const BUDGET_MS = Number(arg('--minutes', '45')) * 60_000;

// Modules critiques uniquement : muter du code de présentation n'apprendrait
// rien, et chaque mutation coûte une exécution de tests.
const CIBLES = [
  'src/types/payment.ts',
  'src/lib/dueItems.ts',
  'src/lib/paymentQueries.ts',
  'src/lib/payroll.ts',
  'src/lib/teacherHours.ts',
  'src/lib/subscription.ts',
  'src/lib/permissions.ts',
  'src/lib/scheduleConflicts.ts',
  'src/lib/schoolYearBounds.ts',
  'src/lib/schoolYears.ts',
  'src/lib/attendanceStatus.ts',
  'src/lib/cumulativeAverage.ts',
  'src/lib/academicProfile.ts',
  'src/lib/csvExport.ts',
  'src/lib/bacMention.ts',
  'src/hooks/useClassRanking.ts',
  'src/hooks/useElementaryClassRanking.ts',
].filter(f => existsSync(join(racine, f)));

// Opérateurs de mutation : de petites bêtises réalistes, du genre qu'on écrit
// vraiment à 2 h du matin.
const OPERATEURS = [
  { de: '>=', vers: '>' }, { de: '<=', vers: '<' },
  { de: '>', vers: '>=' }, { de: '<', vers: '<=' },
  { de: '===', vers: '!==' }, { de: '!==', vers: '===' },
  { de: '&&', vers: '||' }, { de: '||', vers: '&&' },
  { de: '??', vers: '||' },
  { de: 'true', vers: 'false' }, { de: 'false', vers: 'true' },
  { de: '+', vers: '-' }, { de: '*', vers: '/' },
  { de: '.filter(', vers: '.map(' },
  { de: '.every(', vers: '.some(' }, { de: '.some(', vers: '.every(' },
];

/** Positions mutables, hors commentaires et hors chaînes de caractères. */
function pointsDeMutation(code) {
  // Les commentaires sont neutralisés EN PREMIER, et remplacés par des espaces
  // de même longueur pour que les index restent valides. Sans cela, une
  // apostrophe française dans un commentaire (« l'élève ») ouvrirait une fausse
  // chaîne de caractères qui masquerait tout le code jusqu'à la suivante —
  // c'est ce qui rendait ce script presque aveugle.
  const blanc = (s) => ' '.repeat(s.length);
  let masque = code
    .replace(/\/\/[^\n]*/g, blanc)
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

  const zonesMortes = [];
  const marquer = (regex) => { for (const m of masque.matchAll(regex)) zonesMortes.push([m.index, m.index + m[0].length]); };
  marquer(/'(?:[^'\\\n]|\\.)*'/g);    // chaîne simple (jamais multi-ligne)
  marquer(/"(?:[^"\\\n]|\\.)*"/g);    // chaîne double
  marquer(/`(?:[^`\\]|\\.)*`/g);      // gabarit
  marquer(/\/(?:[^/\\\n[]|\\.|\[[^\]\n]*\])+\/[gimsuy]*/g); // littéral d'expression régulière

  // Un commentaire est mort lui aussi : on le reconnaît à l'espace du masque.
  const dansCommentaire = (i) => code[i] !== masque[i];
  const mort = (i, fin) => dansCommentaire(i) || zonesMortes.some(([a, b]) => i >= a && fin <= b);

  const points = [];
  for (const op of OPERATEURS) {
    let i = code.indexOf(op.de);
    while (i !== -1) {
      const fin = i + op.de.length;
      const avant = code[i - 1] ?? '', apres = code[fin] ?? '';
      // L'opérateur ne doit pas être le morceau d'un plus long : le `=` de
      // `===` ne doit pas être vu comme un `=`, ni le `>` de `=>` comme une
      // comparaison.
      const symbolique = /^[^a-z]+$/.test(op.de);
      const colle = symbolique && (/[=<>&|!+\-*/?]/.test(avant) || /[=<>&|]/.test(apres));
      // `true` / `false` ne comptent que comme mots entiers.
      const motEntier = symbolique || (!/[\w$]/.test(avant) && !/[\w$]/.test(apres));
      if (!mort(i, fin) && !colle && motEntier) {
        points.push({ index: i, ...op, ligne: code.slice(0, i).split('\n').length });
      }
      i = code.indexOf(op.de, i + 1);
    }
  }
  return points;
}

const FICHIER_PROPRIETES = 'src/test/proprietes.test.ts';

/**
 * On lance le test jumeau du module ET les tests par propriétés, dans UNE
 * seule exécution de vitest : les propriétés couvrent précisément ces modules
 * et tuent beaucoup de mutations que les cas écrits à la main laissent passer.
 * Une seule exécution = un seul démarrage, le coût reste raisonnable.
 */
function lancerTests(fichierTest) {
  const fichiers = existsSync(join(racine, FICHIER_PROPRIETES))
    ? [fichierTest, FICHIER_PROPRIETES] : [fichierTest];
  try {
    execFileSync('npx', ['vitest', 'run', ...fichiers, '--silent', '--reporter=dot'],
      { cwd: racine, stdio: 'pipe', timeout: 180_000, env: { ...process.env, FC_RUNS: '60' } });
    return 'passe';   // les tests n'ont rien vu → mutation survivante
  } catch {
    return 'echoue';  // mutation tuée
  }
}

if (!EST_POINT_D_ENTREE) {
  // Importé : on s'arrête ici, sans rien toucher.
} else {

const rapport = [];
const debut = Date.now();
let restaurer = null;

const remettreEnEtat = () => {
  if (restaurer) { writeFileSync(restaurer.chemin, restaurer.original); restaurer = null; }
  rmSync(ABRI, { recursive: true, force: true });
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { remettreEnEtat(); process.exit(130); });
}
process.on('exit', remettreEnEtat);
process.on('uncaughtException', (e) => { remettreEnEtat(); console.error(e); process.exit(1); });

// Une exécution précédente a-t-elle été tuée en laissant du code muté ?
const recuperes = restaurerAbandons();
if (recuperes > 0) console.log(`(${recuperes} fichier(s) récupérés d'une exécution précédente)\n`);

console.log(`Test de mutation — ${CIBLES.length} modules, budget ${Math.round(BUDGET_MS / 60000)} min\n`);

// ── Préparation : tous les candidats, module par module ────────────────────
// Ordre mélangé de façon DÉTERMINISTE (même graine → même ordre) : les
// premiers passages échantillonnent tout le fichier au lieu de s'entasser en
// haut, et une campagne reste reproductible.
let graine = 42;
const hasard = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;

const modules = [];
for (const cible of CIBLES) {
  const fichierTest = cible.replace(/\.ts$/, '.test.ts');
  if (!existsSync(join(racine, fichierTest))) {
    console.log(`—  ${basename(cible).padEnd(28)} pas de fichier de test, ignoré`);
    continue;
  }
  const chemin = join(racine, cible);
  const original = readFileSync(chemin, 'utf8');
  const points = pointsDeMutation(original);
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  modules.push({ cible, chemin, fichierTest, original, points, curseur: 0, tuees: 0, survivantes: [] });
}

const totalCandidats = modules.reduce((n, m) => n + m.points.length, 0);
console.log(`   ${totalCandidats} mutations possibles au total — on en teste autant que le budget le permet.\n`);

// ── Passages successifs, en tourniquet entre les modules ───────────────────
// Le budget est consommé jusqu'au bout : au lieu de s'arrêter à N mutations
// par module, on repasse sur chacun tant qu'il reste du temps ET des
// candidats. Chaque mutation n'est testée qu'une fois.
const LOT = 6;   // mutations d'affilée sur un module avant de passer au suivant
let passage = 0;

while (Date.now() - debut < BUDGET_MS && modules.some(m => m.curseur < m.points.length)) {
  passage++;
  const actifs = modules.filter(m => m.curseur < m.points.length);
  if (actifs.length === 0) break;
  console.log(`— passage ${passage} —`);

  for (const m of actifs) {
    if (Date.now() - debut > BUDGET_MS) break;
    const lot = m.points.slice(m.curseur, m.curseur + LOT);
    if (lot.length === 0) continue;
    process.stdout.write(`   ${basename(m.cible).padEnd(28)} `);

    for (const p of lot) {
      if (Date.now() - debut > BUDGET_MS) break;
      const mute = m.original.slice(0, p.index) + p.vers + m.original.slice(p.index + p.de.length);
      // Copie de secours sur disque AVANT d'écrire : si le processus est tué
      // brutalement, la prochaine exécution (ou --restaurer) remet le fichier.
      mkdirSync(ABRI, { recursive: true });
      writeFileSync(cheminAbri(m.cible), m.original);
      restaurer = { chemin: m.chemin, original: m.original };
      writeFileSync(m.chemin, mute);
      const verdict = lancerTests(m.fichierTest);
      writeFileSync(m.chemin, m.original);
      restaurer = null;
      rmSync(cheminAbri(m.cible), { force: true });

      m.curseur++;
      if (verdict === 'echoue') { m.tuees++; process.stdout.write('·'); }
      else { m.survivantes.push(p); process.stdout.write('!'); }
    }

    const faites = m.tuees + m.survivantes.length;
    console.log(`  ${m.tuees}/${faites} tuées · ${m.points.length - m.curseur} restantes`);
  }
}

if (modules.some(m => m.curseur < m.points.length)) {
  console.log('\n⏱  Budget épuisé, arrêt propre.');
} else {
  console.log('\n✓ Toutes les mutations possibles ont été testées.');
}

console.log('');
for (const m of modules) {
  const total = m.tuees + m.survivantes.length;
  if (total === 0) continue;
  const score = Math.round((m.tuees / total) * 100);
  console.log(`   ${basename(m.cible).padEnd(30)} ${String(m.tuees).padStart(3)}/${String(total).padEnd(3)} (${score}%)`);
  for (const s of m.survivantes) {
    console.log(`        survivante ligne ${s.ligne} : ${s.de} → ${s.vers}`);
  }
  rapport.push({
    module: m.cible, testees: total, tuees: m.tuees, score,
    candidats: m.points.length,
    survivantes: m.survivantes.map(s => ({ ligne: s.ligne, de: s.de, vers: s.vers })),
  });
}

const totalTestees = rapport.reduce((s, r) => s + r.testees, 0);
const totalTuees = rapport.reduce((s, r) => s + r.tuees, 0);
const scoreGlobal = totalTestees > 0 ? Math.round((totalTuees / totalTestees) * 100) : 0;

console.log(`\nScore de mutation global : ${scoreGlobal}% (${totalTuees}/${totalTestees})`);
console.log(`Durée ${((Date.now() - debut) / 60000).toFixed(1)} min`);
console.log('\nUne mutation survivante n\'est pas forcément un bug : certaines sont');
console.log('équivalentes (le code mute mais fait la même chose). Elles se lisent');
console.log('comme « à cet endroit, aucun test ne regarde ».');

const iJson = process.argv.indexOf('--json');
if (iJson !== -1 && process.argv[iJson + 1]) {
  writeFileSync(process.argv[iJson + 1], JSON.stringify({
    date: new Date().toISOString(), scoreGlobal, totalTuees, totalTestees, modules: rapport,
  }, null, 2));
}

}
