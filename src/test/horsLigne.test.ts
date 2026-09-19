import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ════════════════════════════════════════════════════════════════════════════
// GARDE-FOUS « HORS CONNEXION »
//
// Les écoles, les élèves et les professeurs doivent pouvoir consulter leurs
// données sans réseau. Deux règles rendent cela possible — et sûr :
//
//   1. un écran qui interroge la base passe par useDonneesHorsLigne, sinon il
//      redevient une page blanche dès que le réseau tombe ;
//   2. les données sont rangées PAR COMPTE et effacées à la déconnexion : sur
//      un téléphone partagé, un élève ne doit jamais voir celles d'un autre.
//
// Sans ces tests, un écran ajouté plus tard casserait la promesse en silence.
// ════════════════════════════════════════════════════════════════════════════

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const DOSSIER = 'src/pages/portal';
const ecrans = readdirSync(join(RACINE, DOSSIER))
  .filter(f => f.endsWith('.tsx') && !f.includes('.test.'));

/** Écrans dont les données sont disponibles hors connexion. */
const AVEC_CACHE = [
  'PortalAccueil.tsx', 'PortalNotes.tsx', 'PortalEmploi.tsx',
  'PortalPresences.tsx', 'PortalPaiements.tsx',
  'PortalSubjectDetail.tsx', 'PortalNotesElementary.tsx',
];

/** Écrans qui interrogent encore la base sans cache, avec leur raison. */
const SANS_CACHE = new Map([
  ['PortalFiliereChoice.tsx', 'écran d\'action : choisir ses matières exige le réseau'],
]);

describe('écrans du portail', () => {
  it.each(AVEC_CACHE)('%s garde ses données pour le hors connexion', (fichier) => {
    const code = lire(join(DOSSIER, fichier));
    expect(code).toContain('useDonneesHorsLigne');
    expect(code).toContain('BandeauDonneesEnregistrees');   // date affichée à l'écran
  });

  it('aucun écran n\'interroge la base sans cache en dehors des exceptions connues', () => {
    // Les requêtes s'écrivent souvent sur plusieurs lignes :
    //   await supabase
    //     .from('grades')
    const interroge = /supabase[\s\S]{0,60}?\.(from|rpc)\(/;
    const fautifs = ecrans.filter(f => {
      const code = lire(join(DOSSIER, f));
      return interroge.test(code) && !code.includes('useDonneesHorsLigne');
    });
    expect(fautifs.sort()).toEqual([...SANS_CACHE.keys()].sort());
  });

  it('chaque écran mis en cache affiche la date de ses données', () => {
    // Sans cette date, un élève croirait sa moyenne ou son solde à jour.
    for (const fichier of AVEC_CACHE) {
      expect(lire(join(DOSSIER, fichier)), fichier).toMatch(/enregistreLe=\{enregistreLe\}/);
    }
  });
});

describe('identité et cloisonnement', () => {
  const auth = lire('src/contexts/AuthContext.tsx');

  it('l\'identité du compte est gardée : l\'application s\'ouvre hors connexion', () => {
    expect(auth).toMatch(/enregistrer\(user\.id, 'identite'/);
    expect(auth).toContain("lire<IdentiteMemorisee>(userId, 'identite')");
  });

  it('la déconnexion efface les données de CE compte', () => {
    // Le téléphone peut être partagé : le compte suivant ne doit rien retrouver.
    expect(auth).toMatch(/effacerUtilisateur\(userIdRef\.current\)/);
  });

  it('rien n\'est mis en cache par le service worker côté Supabase', () => {
    // Le cache d'un service worker est rangé par adresse, pas par utilisateur.
    const motifs = [...lire('vite.config.ts').matchAll(/urlPattern:\s*([^,\n]+)/g)].map(m => m[1]);
    for (const m of motifs) expect(m, m).not.toMatch(/supabase/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Côté école : les écrans du tableau de bord lisent les contextes, jamais
// Supabase directement. C'est donc l'instantané des contextes qui rend
// l'application consultable sans réseau.
// ════════════════════════════════════════════════════════════════════════════

/** Contexte → voyant de chargement qu'il faut éteindre hors connexion. */
const CONTEXTES = [
  ['SchoolContext.tsx',     'setClassesLoading'],
  ['PaymentContext.tsx',    'setPaymentLoading'],
  ['AttendanceContext.tsx', 'setAttendanceLoading'],
  ['ScheduleContext.tsx',   'setScheduleLoading'],
  ['PayrollContext.tsx',    'setPayrollLoading'],
] as const;

describe('tableau de bord des écoles', () => {
  it.each(CONTEXTES)('%s garde un instantané de ses données', (fichier) => {
    expect(lire(join('src/contexts', fichier))).toContain('useInstantaneHorsLigne');
  });

  it.each(CONTEXTES)('%s éteint son voyant de chargement hors connexion', (fichier, voyant) => {
    // Sans cette garde, la requête n'aboutit jamais et l'école reste devant
    // une roue qui tourne à l'infini.
    const code = lire(join('src/contexts', fichier));
    expect(code).toMatch(new RegExp(`if \\(!enLigne\\) \\{ ${voyant}\\(false\\); return; \\}`));
  });

  it('l\'instantané n\'est jamais réinstallé tant qu\'il y a du réseau', () => {
    // Sinon un élève supprimé réapparaîtrait sous les yeux du directeur.
    expect(lire('src/hooks/useInstantaneHorsLigne.ts'))
      .toMatch(/if \(!utilisateurId \|\| enLigne \|\| dejaReinstalle/);
  });

  it('le tableau de bord annonce la date des données affichées', () => {
    const mise = lire('src/components/DashboardLayout.tsx');
    expect(mise).toContain('BandeauDonneesEnregistrees');
    expect(mise).toContain('instantaneLe');
  });
});
