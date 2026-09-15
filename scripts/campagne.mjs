#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CAMPAGNE DE TEST AUTONOME — à lancer avant une mise en production, puis à
// laisser tourner. Aucune intervention humaine pendant l'exécution.
//
//   npm run campagne              # 2 heures par défaut
//   npm run campagne -- --minutes 30
//
// À la fin : un rapport Markdown dans rapports/, et un verdict clair —
// DÉPLOYABLE ou NE PAS DÉPLOYER.
//
// Les phases vont du moins cher au plus cher, et chacune a son budget de
// temps. Une phase qui déborde est coupée proprement : la campagne finit
// TOUJOURS dans le temps imparti, avec un rapport.
// ═══════════════════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const racine = process.cwd();
if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== import.meta.url) {
  throw new Error('campagne.mjs doit être exécuté, pas importé.');
}

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};

const TOTAL_MIN = Number(arg('--minutes', '120'));
const debut = Date.now();
const restantMin = () => Math.max(0, TOTAL_MIN - (Date.now() - debut) / 60_000);

const DOSSIER = join(racine, 'rapports');
mkdirSync(DOSSIER, { recursive: true });
const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RAPPORT = join(DOSSIER, `campagne-${horodatage}.md`);
const journal = [];

const trace = (ligne = '') => { console.log(ligne); journal.push(ligne); };

function lancer(titre, commande, args, { budgetMin, env = {}, obligatoire = false } = {}) {
  const t0 = Date.now();
  // Une phase obligatoire s'exécute même hors budget : on ne conclut jamais
  // sans elle.
  const budget = obligatoire
    ? (budgetMin ?? 10)
    : Math.min(budgetMin ?? restantMin(), restantMin());
  if (budget <= 0.2) {
    trace(`⏭  ${titre} — sautée (plus de temps)`);
    return { titre, verdict: 'SAUTÉE', minutes: 0, sortie: '' };
  }
  const r = spawnSync(commande, args, {
    cwd: racine, encoding: 'utf8', timeout: Math.round(budget * 60_000),
    maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env },
  });
  const minutes = (Date.now() - t0) / 60_000;
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const coupee = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
  const verdict = coupee ? 'BUDGET ÉPUISÉ' : r.status === 0 ? 'OK' : 'ÉCHEC';
  trace(`${verdict === 'OK' ? '✓' : verdict === 'ÉCHEC' ? '✗' : '⏱'} ${titre.padEnd(42)} ${minutes.toFixed(1)} min`);
  return { titre, verdict, minutes, sortie };
}

const extraire = (sortie, regex, defaut = '—') => (sortie.match(regex)?.[0] ?? defaut).trim();

trace(`Campagne de test — budget ${TOTAL_MIN} min — démarrée à ${new Date().toLocaleTimeString('fr-FR')}`);
trace('');

const phases = [];

// ── Phase 0 : le poste de travail est-il propre ? ──────────────────────────
// Une campagne lancée sur un code déjà abîmé par une exécution interrompue
// donnerait un verdict faux. On répare d'abord.
lancer('0. Réparation d\'une exécution interrompue', 'node',
  ['scripts/mutations.mjs', '--restaurer'], { budgetMin: 1 });

// ── Phase 1 : fondations ───────────────────────────────────────────────────
phases.push(lancer('1. Types (tsc)', 'npm', ['run', 'typecheck'], { budgetMin: 5 }));
phases.push(lancer('2. Lint', 'npm', ['run', 'lint'], { budgetMin: 5 }));
phases.push(lancer('3. Tests unitaires', 'npx', ['vitest', 'run'], { budgetMin: 10 }));
phases.push(lancer('4. Couverture et seuils', 'npm', ['run', 'test:coverage'], { budgetMin: 10 }));
phases.push(lancer('5. Build de production', 'npm', ['run', 'build'], { budgetMin: 10 }));

// ── Phase 2 : sécurité de l'API ────────────────────────────────────────────
phases.push(lancer('6. Audit sécurité API (anonyme)', 'node',
  ['scripts/audit-securite.mjs', '--json', join(DOSSIER, `securite-${horodatage}.json`)],
  { budgetMin: 10 }));

// ── Phase 3 : propriétés, en montant progressivement ───────────────────────
// Chaque palier rejoue les mêmes règles sur DIX FOIS plus de situations
// aléatoires. Une règle qui tient à 100 000 tirages tient en production.
// On réserve la moitié du temps restant à la phase de mutation, qui est la
// plus lente — mais on fait toujours au moins un palier de propriétés.
for (const runs of [2_000, 20_000, 100_000]) {
  if (restantMin() < 2) break;
  const budget = Math.max(1.5, Math.min(20, restantMin() / 4));
  phases.push(lancer(`7. Propriétés × ${runs.toLocaleString('fr-FR')} tirages`, 'npx',
    ['vitest', 'run', 'src/test/proprietes.test.ts'],
    { budgetMin: budget, env: { FC_RUNS: String(runs) } }));
}

// ── Phase 4 : mutation — occupe tout le temps restant ──────────────────────
// C'est la phase qui juge les TESTS eux-mêmes. Elle est lente : on lui laisse
// ce qui reste, en gardant 2 minutes pour écrire le rapport.
const budgetMutation = Math.max(0, restantMin() - 2);
if (budgetMutation >= 3) {
  phases.push(lancer(`8. Mutation (${budgetMutation.toFixed(0)} min)`, 'node',
    ['scripts/mutations.mjs', '--minutes', String(Math.floor(budgetMutation)),
     '--json', join(DOSSIER, `mutations-${horodatage}.json`)],
    { budgetMin: budgetMutation + 1 }));
}

// ── Phase 5 : le code est-il revenu à son état d'origine ? ─────────────────
// Contrôle final INDISPENSABLE : le testeur de mutation écrit dans les
// sources. Cette phase s'exécute TOUJOURS, même si le budget est dépassé —
// c'est la seule qui ne peut pas être sautée, puisque c'est elle qui garantit
// qu'on ne laisse pas du code volontairement abîmé derrière soi.
//
// (Une campagne a déjà rendu « DÉPLOYABLE » en ayant justement sauté ce
// contrôle faute de temps. C'est exactement ce qu'il ne faut pas faire.)
const abriRestant = existsSync(join(racine, '.mutations-en-cours'));
const testsFinaux = lancer('9. Contrôle final — sources intactes', 'npx',
  ['vitest', 'run'], { budgetMin: 10, obligatoire: true });
phases.push(testsFinaux);

// ── Rapport ────────────────────────────────────────────────────────────────
const echecs = phases.filter(p => p.verdict === 'ÉCHEC');
const coupees = phases.filter(p => p.verdict === 'BUDGET ÉPUISÉ');
const sautees = phases.filter(p => p.verdict === 'SAUTÉE');

const sortieTests = phases.find(p => p.titre.startsWith('3.'))?.sortie ?? '';
const sortieMutation = phases.find(p => p.titre.startsWith('8.'))?.sortie ?? '';
const sortieSecurite = phases.find(p => p.titre.startsWith('6.'))?.sortie ?? '';
const sortieCouverture = phases.find(p => p.titre.startsWith('4.'))?.sortie ?? '';

const nbTests = extraire(sortieTests, /Tests\s+\d+ passed[^\n]*/);
const scoreMutation = extraire(sortieMutation, /Score de mutation global : \d+%[^\n]*/);
const fuites = extraire(sortieSecurite, /Fuites : \d+[^\n]*/);
const couverture = extraire(sortieCouverture, /Statements\s+:\s+[\d.]+%[^\n]*/);

// Une phase de SÛRETÉ coupée ou sautée interdit le vert : on ne sait pas, donc
// on ne dit pas « déployable ». Les phases d'exploration (mutation, paliers de
// propriétés) peuvent, elles, être écourtées sans invalider le verdict.
const PHASES_DE_SURETE = ['1.', '2.', '3.', '4.', '5.', '6.', '9.'];
const sureteIncomplete = phases.filter(p =>
  PHASES_DE_SURETE.some(n => p.titre.startsWith(n)) && p.verdict !== 'OK');

const deployable = echecs.length === 0 && !abriRestant && sureteIncomplete.length === 0;

const md = [
  `# Campagne de test — ${new Date().toLocaleString('fr-FR')}`,
  '',
  `**Verdict : ${deployable ? '✅ DÉPLOYABLE' : '🛑 NE PAS DÉPLOYER'}**`,
  '',
  `Durée réelle : ${((Date.now() - debut) / 60_000).toFixed(1)} min sur ${TOTAL_MIN} alloués.`,
  '',
  '## Résumé',
  '',
  '| Indicateur | Résultat |',
  '|---|---|',
  `| Tests unitaires | ${nbTests} |`,
  `| Couverture (logique métier) | ${couverture} |`,
  `| Sécurité API anonyme | ${fuites} |`,
  `| Score de mutation | ${scoreMutation} |`,
  `| Sources laissées modifiées | ${abriRestant ? '⚠️ OUI — lancer `node scripts/mutations.mjs --restaurer`' : 'non'} |`,
  '',
  '## Phases',
  '',
  '| Phase | Verdict | Durée |',
  '|---|---|---|',
  ...phases.map(p => `| ${p.titre} | ${p.verdict} | ${p.minutes.toFixed(1)} min |`),
  '',
];

if (echecs.length > 0) {
  md.push('## Échecs — à corriger avant de déployer', '');
  for (const e of echecs) {
    md.push(`### ${e.titre}`, '', '```', e.sortie.split('\n').slice(-60).join('\n').trim(), '```', '');
  }
}

if (coupees.length > 0 || sautees.length > 0) {
  md.push('## Phases non terminées', '',
    'Elles n\'invalident pas le verdict : elles n\'ont simplement pas eu le temps.', '',
    ...[...coupees, ...sautees].map(p => `- ${p.titre} — ${p.verdict}`), '');
}

// Les angles morts se lisent dans le JSON écrit par le testeur, jamais dans sa
// sortie console : quand le processus est coupé par le budget, cette sortie est
// tronquée et le rapport annoncerait « aucun angle mort » — un mensonge.
const cheminMutations = join(DOSSIER, `mutations-${horodatage}.json`);
if (existsSync(cheminMutations)) {
  const m = JSON.parse(readFileSync(cheminMutations, 'utf8'));
  const survivantes = m.modules.flatMap(mod =>
    mod.survivantes.map(s => `${mod.module}:${s.ligne}  ${s.de} → ${s.vers}`));
  md.push('## Angles morts des tests (mutations survivantes)', '',
    `Score : **${m.scoreGlobal}%** (${m.totalTuees}/${m.totalTestees} mutations détectées).`, '',
    survivantes.length === 0
      ? 'Aucune : chaque modification du code critique a été détectée.'
      : 'Là où une mutation survit, aucun test ne regarde. Certaines sont inoffensives (le code change mais fait la même chose) — les autres méritent un test.',
    '', '| Module | Score | Testées / possibles |', '|---|---|---|',
    ...m.modules.slice().sort((a, b) => a.score - b.score)
      .map(mod => `| ${mod.module} | ${mod.score}% | ${mod.testees}/${mod.candidats ?? '?'} |`),
    '', '```', survivantes.join('\n') || '(aucune)', '```', '');
} else if (sortieMutation) {
  md.push('## Angles morts des tests', '',
    '⚠️ La phase de mutation n\'a pas écrit son rapport : résultat inconnu.', '');
}

md.push('## Détail complet', '', '```', journal.join('\n'), '```', '');

writeFileSync(RAPPORT, md.join('\n'));

trace('');
trace('─'.repeat(64));
trace(deployable ? '✅ DÉPLOYABLE' : '🛑 NE PAS DÉPLOYER');
trace(`   ${nbTests}`);
trace(`   ${couverture}`);
trace(`   ${fuites}`);
trace(`   ${scoreMutation}`);
if (abriRestant) trace('   ⚠️  sources modifiées : node scripts/mutations.mjs --restaurer');
for (const p of sureteIncomplete) trace(`   ⚠️  phase de sûreté non terminée : ${p.titre} (${p.verdict})`);
if (Date.now() - debut > TOTAL_MIN * 60_000 * 1.2) {
  trace(`   ⚠️  durée réelle ${((Date.now() - debut) / 60_000).toFixed(0)} min pour ${TOTAL_MIN} alloués`);
  trace('       (la machine s\'est probablement mise en veille pendant la campagne)');
}
trace(`   Rapport : ${RAPPORT.replace(racine + '/', '')}`);
trace('─'.repeat(64));

process.exit(deployable ? 0 : 1);
