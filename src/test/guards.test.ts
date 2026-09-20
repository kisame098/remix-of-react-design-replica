import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROUTE_PERMISSIONS } from '@/lib/permissions';

// ════════════════════════════════════════════════════════════════════════════
// GARDE-FOUS D'ARCHITECTURE
//
// Ces tests ne vérifient pas un calcul mais une RÈGLE DE CONSTRUCTION : ils
// lisent le code source et tombent quand quelqu'un (nous, dans six mois)
// ajoute un écran qui contourne une règle capitale — un écran de paiement qui
// oublie la proratisation, une suppression d'écriture comptable, une route
// sensible qui perd son verrou de permission.
//
// C'est le filet contre les régressions SILENCIEUSES : celles qu'aucun test
// unitaire existant ne peut voir, parce qu'elles arrivent dans du code neuf.
// ════════════════════════════════════════════════════════════════════════════

const SRC = join(process.cwd(), 'src');

const walk = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
};

const SOURCES = walk(SRC).map(path => ({
  path: relative(process.cwd(), path),
  code: readFileSync(path, 'utf8'),
}));

// ── 1. Chemin de l'argent ───────────────────────────────────────────────────

describe('garde-fou : tout écran de facturation passe par les règles de facturation', () => {
  // Fichiers autorisés à manipuler la liste COMPLÈTE des mois — chacun avec sa
  // raison. Ajouter une entrée ici doit être un acte conscient, pas un réflexe.
  const ALLOWED = new Map([
    ['src/types/payment.ts', 'définit les règles elles-mêmes'],
    ['src/pages/Settings.tsx', 'écran où l\'école COCHE les mois : doit tous les afficher'],
    ['src/pages/Caisse.tsx', 'affiche le libellé d\'un mois déjà encaissé — jamais une dette'],
    ['src/hooks/useRecus.tsx',
     'écrit le nom du mois sur un REÇU d\'un paiement déjà encaissé — jamais une dette ni un solde'],
    ['src/components/payment/ServiceRoster.tsx',
     'fenêtres d\'abonnement stockées en INDEX de mois : filtrer décalerait les index'],
  ]);

  const consumers = SOURCES.filter(f => f.code.includes('getAcademicMonths('));

  it('trouve bien les écrans concernés (le garde-fou n\'est pas vide)', () => {
    expect(consumers.length).toBeGreaterThan(3);
  });

  it.each(consumers.map(f => f.path))(
    '%s filtre les mois facturables (ou est explicitement dispensé)',
    (path) => {
      const file = consumers.find(f => f.path === path)!;
      const filtre = file.code.includes('getBillableMonthsFor')
        || file.code.includes('getSchoolBillableMonths')
        || file.code.includes('getStudentBillableMonths');
      if (!filtre && !ALLOWED.has(path)) {
        throw new Error(
          `${path} calcule des mois de scolarité sans passer par getBillableMonthsFor : ` +
          'les mois décochés par l\'école et les mois d\'avant l\'inscription de l\'élève ' +
          'seraient facturés à tort. Utilisez getBillableMonthsFor, ou ajoutez ce fichier ' +
          'à la liste ALLOWED de ce test avec la raison.',
        );
      }
      expect(true).toBe(true);
    },
  );

  it('la dispense d\'un écran reste justifiée par écrit', () => {
    for (const [path, raison] of ALLOWED) {
      expect(raison.length, `${path} sans raison`).toBeGreaterThan(20);
      // Une dispense qui ne correspond plus à aucun fichier doit être retirée.
      expect(SOURCES.some(f => f.path === path), `${path} n'existe plus`).toBe(true);
    }
  });
});

// ── 2. Immuabilité comptable ────────────────────────────────────────────────

describe('garde-fou : aucune écriture comptable n\'est supprimable', () => {
  // Décision produit : « l'historique est capital ». Un paiement s'annule
  // (status = 'cancelled'), il ne se supprime jamais — la trace écrite reste,
  // même si le dossier de l'école est purgé.
  const LEDGERS = [
    'payments',
    'salary_payments',
    'billing_transactions',
    'platform_payment_claims',
  ];

  it.each(LEDGERS)('personne ne supprime de ligne dans %s', (table) => {
    const offenders = SOURCES.filter(f =>
      // .from('payments')  …  .delete()   (avec ou sans retours à la ligne)
      new RegExp(`from\\(['"\`]${table}['"\`]\\)[\\s\\S]{0,200}?\\.delete\\(`).test(f.code),
    );
    expect(
      offenders.map(o => o.path),
      `Suppression détectée sur ${table} : une pièce comptable s'annule (status), ne se supprime pas.`,
    ).toEqual([]);
  });

  it('l\'annulation d\'un paiement passe bien par un statut, pas par une suppression', () => {
    const paymentCtx = SOURCES.find(f => f.path.endsWith('contexts/PaymentContext.tsx'));
    expect(paymentCtx).toBeDefined();
    expect(paymentCtx!.code).toMatch(/status:\s*'cancelled'|cancelled/);
  });
});

// ── 3. Verrous de permission sur les routes ─────────────────────────────────

describe('garde-fou : les routes sensibles gardent leur permission', () => {
  const app = SOURCES.find(f => f.path.endsWith('src/App.tsx'))!;

  it('App.tsx est bien lu', () => {
    expect(app.code).toContain('<Route');
  });

  it.each(Object.entries(ROUTE_PERMISSIONS))(
    'la route %s est protégée par la permission "%s"',
    (route, key) => {
      // On isole la ligne de la route exacte (pas ses sous-routes) …
      const line = app.code
        .split('\n')
        .find(l => l.includes(`path="${route}"`));
      expect(line, `route ${route} absente de App.tsx`).toBeDefined();
      // … et on vérifie qu'elle est enveloppée dans RequirePermission avec LA bonne clé.
      expect(line!, `route ${route} sans verrou`).toContain('RequirePermission');
      expect(line!, `route ${route} avec la mauvaise permission`).toContain(`permission="${key}"`);
    },
  );

  it('les écrans réservés à l\'administrateur le restent', () => {
    for (const route of ['/parametres', '/abonnement']) {
      const line = app.code.split('\n').find(l => l.includes(`path="${route}"`));
      expect(line, `route ${route} absente`).toBeDefined();
      expect(line!, `route ${route} ouverte au personnel`).toContain('adminOnly');
    }
  });

  it('l\'espace du chef du système reste derrière son propre verrou', () => {
    const platform = app.code.split('\n').filter(l => l.includes('path="/platform'));
    expect(platform.length).toBeGreaterThan(0);
    expect(app.code).toContain('PlatformAdminRoute');
  });
});

// ── 4. Un paiement annulé n'est jamais compté comme encaissé ───────────────

describe('garde-fou : un paiement annulé ne compte jamais comme payé', () => {
  // Règle transversale : partout où on additionne ou on teste un paiement, le
  // statut 'cancelled' doit être écarté. L'oublier fait apparaître un élève
  // comme à jour alors que son paiement a été annulé — et gonfle la recette.
  const MUST_FILTER_CANCELLED = [
    'src/lib/paymentQueries.ts',
    'src/lib/dueItems.ts',
    'src/components/payment/PaymentOverview.tsx',
  ];

  it.each(MUST_FILTER_CANCELLED)('%s écarte les paiements annulés', (path) => {
    const file = SOURCES.find(f => f.path === path);
    expect(file, `${path} introuvable`).toBeDefined();
    expect(file!.code).toMatch(/cancelled/);
  });
});

// ── 5. Le calcul métier reste hors des composants ──────────────────────────

describe('garde-fou : les calculs sensibles restent testables', () => {
  // Chacun de ces modules a été extrait d'un composant POUR pouvoir être testé.
  // Un module sans test à côté est un module qui va silencieusement dériver.
  const CRITICAL = [
    'src/lib/dueItems.ts',
    'src/lib/paymentQueries.ts',
    'src/lib/payroll.ts',
    'src/lib/teacherHours.ts',
    'src/lib/scheduleConflicts.ts',
    'src/lib/schoolYearBounds.ts',
    'src/lib/schoolYears.ts',
    'src/lib/attendanceStatus.ts',
    'src/lib/academicProfile.ts',
    'src/lib/cumulativeAverage.ts',
    'src/lib/csvExport.ts',
    'src/lib/routeAccess.ts',
    'src/lib/studentPeriods.ts',
    'src/lib/subscriptionPlans.ts',
    'src/lib/subscription.ts',
    'src/lib/permissions.ts',
    'src/types/payment.ts',
  ];

  it.each(CRITICAL)('%s a son fichier de test', (path) => {
    const testPath = path.replace(/\.ts$/, '.test.ts');
    expect(
      SOURCES.some(f => f.path === path),
      `${path} a disparu — retirez-le aussi de ce garde-fou`,
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), testPath)),
      `${testPath} manquant : ce calcul décide d'argent ou d'accès, il doit être testé.`,
    ).toBe(true);
  });

  it.each(CRITICAL)('%s reste pur : pas de hook React ni d\'appel Supabase', (path) => {
    const file = SOURCES.find(f => f.path === path)!;
    // Un import de hook ou du client Supabase rendrait le module intestable
    // sans monter tout React — c'est exactement ce qu'on vient de défaire.
    expect(file.code, `${path} importe React`).not.toMatch(/from 'react'/);
    expect(file.code, `${path} importe le client Supabase`)
      .not.toMatch(/integrations\/supabase\/client/);
  });
});

// ── 6. La connexion survit à un abonnement bloqué ──────────────────────────

describe('garde-fou : une école bloquée peut toujours se connecter et voir pourquoi', () => {
  // Régression vécue : la connexion identifiait le membre via get_my_school_id(),
  // qui renvoie NULL dès que l'abonnement bloque. L'admin d'une école dont
  // l'essai venait d'expirer était alors pris pour un inconnu — l'app le
  // cherchait parmi les élèves (406 en boucle) et il restait coincé sur
  // « Chargement du profil… », sans jamais atteindre l'écran qui lui annonce
  // la fin de son essai. Le blocage doit fermer les DONNÉES, jamais la porte.
  const auth = SOURCES.find(f => f.path === 'src/contexts/AuthContext.tsx');

  it('la connexion identifie le membre par son appartenance BRUTE', () => {
    expect(auth, 'AuthContext.tsx introuvable').toBeDefined();
    expect(auth.code).toContain("rpc('get_my_membership_school_id')");
    expect(auth.code, 'la connexion dépend de la fonction gâtée par l\'abonnement')
      .not.toMatch(/rpc\(\s*'get_my_school_id'\s*\)/);
  });

  it('une école bloquée ne déclenche aucun amorçage de données par défaut', () => {
    // « 0 ligne » ne veut PAS dire « école neuve » : quand l'abonnement bloque,
    // les policies renvoient des listes vides. Sans cette distinction, l'app
    // croyait devoir tout initialiser et enchaînait une rafale d'INSERT tous
    // refusés en 403 — plusieurs secondes d'attente avant le moindre affichage.
    const amorceurs = [
      'src/contexts/SchoolContext.tsx',
      'src/contexts/SchoolYearContext.tsx',
    ];
    for (const path of amorceurs) {
      const f = SOURCES.find(s => s.path === path);
      expect(f, `${path} introuvable`).toBeDefined();
      expect(f.code, `${path} amorce sans vérifier l'abonnement`)
        .toContain('isSchoolAccessBlocked');
    }
  });

  it('aucune requête de connexion n\'exige une ligne unique', () => {
    // `.single()` répond 406 quand il n'y a pas exactement une ligne — or
    // « pas de ligne » est un cas normal ici (membre sans compte portail,
    // profil pas encore créé). Un 406 au démarrage bloque toute l'application.
    const bloc = auth.code.slice(0, auth.code.indexOf('const signUp'));
    expect(bloc, 'un .single() subsiste dans le chargement de session')
      .not.toMatch(/\.single\(\)/);
  });
});

// ── 7. L'élémentaire a les mêmes droits que le collège ─────────────────────

describe('garde-fou : l\'élémentaire n\'est pas un citoyen de seconde zone', () => {
  // Le produit a été bâti pour le collège, et l'élémentaire ajouté ensuite :
  // chaque fonctionnalité doit être portée des DEUX côtés, sinon les écoles
  // primaires découvrent au fil de l'eau ce qui leur manque.
  const paires: [string, string, string][] = [
    ['publication des bulletins au portail',
     'src/components/ClassRankingModal.tsx', 'src/components/ElementaryRankingModal.tsx'],
  ];

  it.each(paires)('%s existe aussi à l\'élémentaire', (_quoi, college, elementaire) => {
    const c = SOURCES.find(f => f.path === college);
    const e = SOURCES.find(f => f.path === elementaire);
    expect(c, `${college} introuvable`).toBeDefined();
    expect(e, `${elementaire} introuvable`).toBeDefined();
    for (const geste of ['publishBulletins', 'unpublishBulletins', 'getBulletinPublishStatus']) {
      expect(c.code, `${college} : ${geste}`).toContain(geste);
      expect(e.code, `${elementaire} : ${geste} manquant`).toContain(geste);
    }
  });

  it('la publication est réservée à qui a la permission « bulletins »', () => {
    for (const f of ['src/components/ClassRankingModal.tsx', 'src/components/ElementaryRankingModal.tsx']) {
      const src = SOURCES.find(x => x.path === f)!;
      expect(src.code, `${f} publie sans vérifier la permission`)
        .toMatch(/hasPermission\([^)]*'bulletins'\)/);
    }
  });

  it('l\'élève d\'élémentaire peut télécharger son bulletin publié', () => {
    const portail = SOURCES.find(f => f.path.endsWith('portal/PortalNotesElementary.tsx'));
    expect(portail, 'PortalNotesElementary.tsx introuvable').toBeDefined();
    expect(portail.code).toContain('published_bulletins');
    expect(portail.code).toContain('generateElementaryBulletinsPdf');
  });

  it('les deux portails filtrent les périodes sur la classe de l\'élève', () => {
    for (const f of ['src/pages/portal/PortalNotes.tsx', 'src/pages/portal/PortalNotesElementary.tsx']) {
      const src = SOURCES.find(x => x.path === f);
      expect(src, `${f} introuvable`).toBeDefined();
      expect(src.code, `${f} montre des périodes où la classe n'est pas inscrite`)
        .toContain('periodesDeLEleve');
    }
  });
});

// ── 8. Élèves protégés, professeurs bloqués ────────────────────────────────

describe('garde-fou : l\'impayé de l\'école ne pénalise jamais l\'élève', () => {
  // Décision produit : l'élève garde TOUT son portail et voit un bandeau ; le
  // professeur, membre de l'équipe, est bloqué comme le personnel.
  const app = SOURCES.find(f => f.path.endsWith('src/App.tsx'));
  const notice = SOURCES.find(f => f.path.endsWith('portal/PortalSchoolNotice.tsx'));
  const acces = SOURCES.find(f => f.path === 'src/lib/routeAccess.ts');

  it('le bandeau couvre TOUTES les pages du portail, présentes et futures', () => {
    expect(notice, 'PortalSchoolNotice.tsx introuvable').toBeDefined();
    const debut = app.code.indexOf('<Route element={<PortalSchoolNotice />}>');
    expect(debut, 'le portail n\'est pas enveloppé par PortalSchoolNotice').toBeGreaterThan(-1);
    const fin = app.code.indexOf('Caisse mobile', debut);
    const couvertes = (app.code.slice(debut, fin).match(/path="\/portail/g) ?? []).length;
    const total = (app.code.match(/path="\/portail/g) ?? []).length;
    expect(couvertes, `${total - couvertes} page(s) de portail hors du bandeau`).toBe(total);
  });

  it('le bandeau ne s\'adresse qu\'à l\'élève', () => {
    // Le professeur bloqué est renvoyé vers l'écran d'abonnement : lui montrer
    // « tes notes restent accessibles » serait faux.
    expect(notice.code).toMatch(/accountRole === 'student'/);
  });

  it('la décision de routage distingue bien l\'élève du professeur', () => {
    expect(acces.code, 'l\'élève doit être traité à part').toMatch(/accountRole === 'student'/);
    expect(acces.code, 'le professeur doit être traité à part').toMatch(/accountRole === 'teacher'/);
  });

  it('le portail reçoit l\'état d\'abonnement de l\'école', () => {
    // Sans ces colonnes, ni le bandeau ni le blocage du prof ne peuvent agir.
    const auth = SOURCES.find(f => f.path === 'src/contexts/AuthContext.tsx');
    const bloc = auth.code.slice(auth.code.indexOf('setAccountRole(acct.role'));
    expect(bloc, 'le select du portail omet subscription_status')
      .toMatch(/subscription_status/);
  });
});

// ── 9. Vocabulaire partagé entre la base et les écrans ─────────────────────

describe('garde-fou : les statuts écrits en base sont ceux que les écrans affichent', () => {
  // Bug vécu : la fonction de rejet écrivait `status = 'rejected'`, mais la
  // contrainte de la table n'autorisait que pending/completed/failed/cancelled.
  // Chaque rejet échouait en silence, et le bouton « Rejeter » ne faisait rien
  // depuis toujours. Aucun test de logique pure ne pouvait le voir : le
  // désaccord était ENTRE le SQL et le composant.
  const sql = SOURCES.find(f => f.path === 'src/pages/platform/PlatformPaymentClaims.tsx');

  const statutsEcrits = (code) =>
    [...code.matchAll(/status\s*=\s*'([a-z_]+)'/g)].map(m => m[1]);

  it('tout statut écrit par une fonction SQL est accepté par la contrainte', () => {
    const correctif = join(process.cwd(), 'docs/sql/fix_rejet_paiement.sql');
    expect(existsSync(correctif), 'correctif de la contrainte absent').toBe(true);
    const contrainte = readFileSync(correctif, 'utf8');

    // Les statuts que les RPC de la plateforme écrivent réellement.
    for (const statut of ['pending', 'completed', 'rejected']) {
      expect(contrainte, `"${statut}" absent de la contrainte`).toContain(`'${statut}'`);
    }
    // Et les anciens, conservés : l'historique comptable ne se réécrit pas.
    for (const statut of ['failed', 'cancelled']) {
      expect(contrainte, `"${statut}" retiré : casserait des lignes existantes`).toContain(`'${statut}'`);
    }
  });

  it('l\'écran des paiements sait afficher CHAQUE statut possible', () => {
    expect(sql, 'PlatformPaymentClaims.tsx introuvable').toBeDefined();
    for (const statut of ['pending', 'completed', 'rejected', 'failed', 'cancelled']) {
      expect(sql.code, `statut "${statut}" non géré par l'écran`).toMatch(
        new RegExp(`${statut}\\s*:\\s*\\{`));
    }
  });

  it('un statut inconnu ne fait pas planter l\'écran', () => {
    // `STATUS_INFO[statut]` direct rendait `undefined`, puis `info.variant`
    // levait une exception et tout l'onglet « Tout l'historique » disparaissait.
    expect(sql.code).toMatch(/STATUS_INFO\[[^\]]+\]\s*\?\?/);
    expect(sql.code, 'accès direct sans repli').not.toMatch(/=\s*STATUS_INFO\[claim\.status\]/);
  });
});

// ── 10. Un seul assembleur de CSV ───────────────────────────────────────────

describe('garde-fou : personne ne réassemble un CSV à la main', () => {
  // Un export qui recolle ses champs lui-même oublie tôt ou tard d'échapper un
  // guillemet ou d'écrire le BOM : la ligne se décale dans Excel, ou les
  // accents deviennent illisibles. Tout passe par buildCsv (testé).
  it('aucun composant ne fabrique son propre échappement CSV', () => {
    const offenders = SOURCES.filter(f =>
      f.path !== 'src/lib/csvExport.ts' &&
      /replace\(\/"\/g,\s*'""'\)/.test(f.code),
    );
    expect(
      offenders.map(o => o.path),
      'Échappement CSV artisanal détecté : utilisez buildCsv de src/lib/csvExport.ts.',
    ).toEqual([]);
  });

  it('tout fichier CSV produit passe par l\'assembleur commun', () => {
    const producers = SOURCES.filter(f => f.code.includes("type: 'text/csv"));
    expect(producers.length).toBeGreaterThan(0);
    for (const f of producers) {
      const ok = f.code.includes('buildCsv') || f.code.includes('Papa.unparse');
      expect(ok, `${f.path} assemble un CSV sans buildCsv`).toBe(true);
    }
  });
});

// ── 11. Cohérence des dispenses élémentaires ────────────────────────────────

describe('garde-fou : une dispense s\'applique partout à la fois', () => {
  // Une dispense qui sortirait de la moyenne mais pas du bulletin (ou
  // l'inverse) produirait un document dont les sous-totaux contredisent la
  // moyenne — incompréhensible pour une famille.
  const MUST_READ_SETTINGS = [
    'src/hooks/useElementaryClassRanking.ts',
    'src/hooks/useElementaryBulletinData.ts',
    'src/pages/ElementaryLineGrades.tsx',
    'src/components/ElementaryClassLines.tsx',
  ];

  it.each(MUST_READ_SETTINGS)('%s tient compte des dispenses', (path) => {
    const file = SOURCES.find(f => f.path === path);
    expect(file, `${path} introuvable`).toBeDefined();
    expect(file!.code).toContain('elementaryLineSettings');
  });
});
