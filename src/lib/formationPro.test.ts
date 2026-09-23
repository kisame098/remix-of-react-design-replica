import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  totauxNiveau, resumeFormation, nomFormationValide, nomNiveauValide, coefficientValide, volumeHoraireValide,
  nomMatiereCatalogueDejaPris, matiereDejaAuNiveau, triFormations, triNiveaux, regrouperParCategorie,
  nomsDuCatalogue, construireExport, analyserImport, peutGererMatieres,
  type Formation, type Niveau, type MatiereCatalogue, type NiveauMatiere, type ChoixGroup,
} from './formationPro';

// ════════════════════════════════════════════════════════════════════════════
// FORMATION PROFESSIONNELLE — hiérarchie Formation → Niveau → Matières.
// « CAP Restauration » reste UNE formation ; « CAP 1 », « CAP 2 » sont ses
// niveaux. Personne n'inscrit un élève en « CAP Restauration Année 2 », on
// dit « il est en CAP 2 ».
// ════════════════════════════════════════════════════════════════════════════

const formation = (o: Partial<Formation> = {}): Formation =>
  ({ id: 'f1', name: 'CAP Restauration', active: true, ordering: 0, createdAt: '2026-01-01T00:00:00Z', ...o });
const niveau = (o: Partial<Niveau> = {}): Niveau =>
  ({ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z', ...o });
const matiereCat = (o: Partial<MatiereCatalogue> = {}): MatiereCatalogue => ({ id: 'm1', name: 'Français', ...o });
const niveauMatiere = (o: Partial<NiveauMatiere> = {}): NiveauMatiere =>
  ({ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'Français', type: 'obligatoire', coefficient: 1, nature: 'theorique', ordering: 0, ...o });
const choixGroup = (o: Partial<ChoixGroup> = {}): ChoixGroup =>
  ({ id: 'c1', niveauId: 'n1', label: 'Option', coefficient: 2, ordering: 0, options: [], ...o });

describe('totauxNiveau — vérifié sur la maquette CAP 1 transmise par IFHO', () => {
  // Relevé de notes officiel DECPC (session 2022) : 20 coefficients à
  // l'examen + « Conduite professionnelle » propre à l'école = 21, 750 h.
  const CAP = [
    ['Français', 1, 60], ['Mathématiques', 1, 60], ['Anglais', 1, 45],
    ['Nutrition-Alimentation', 2, 60], ['Technologie du matériel', 2, 45], ['Entretien', 2, 60],
    ['TP / Technologie Pâtisserie', 3, 90], ['TP Cuisine', 4, 150], ['TP Restaurant', 4, 150],
    ['Conduite professionnelle', 1, 30],
  ] as const;
  const matieresCAP = CAP.map(([name, coefficient, volumeHoraire], i) =>
    niveauMatiere({ id: `cap-${i}`, matiereName: name, coefficient, volumeHoraire, ordering: i }));

  it('10 matières, 21 coefficients, 750 heures', () => {
    const t = totauxNiveau(matieresCAP, []);
    expect(t.nbMatieres).toBe(10);
    expect(t.totalCoef).toBe(21);
    expect(t.totalHeures).toBe(750);
    expect(t.heuresIncompletes).toBe(false);
  });

  it('un volume horaire manquant est signalé, jamais compté comme 0', () => {
    const t = totauxNiveau([niveauMatiere({ coefficient: 2, volumeHoraire: 60 }), niveauMatiere({ id: 'm2', coefficient: 1 })], []);
    expect(t.totalHeures).toBe(60);
    expect(t.heuresIncompletes).toBe(true);
  });

  it('un créneau au choix compte un seul coefficient, quel que soit son nombre d\'options', () => {
    const t = totauxNiveau([], [choixGroup({ coefficient: 2, options: [{ id: 'o1', subjectName: 'Cuisine' }, { id: 'o2', subjectName: 'Pâtisserie' }] })]);
    expect(t.nbMatieres).toBe(1);
    expect(t.totalCoef).toBe(2);
  });

  it('niveau vide : tout à zéro, sans planter', () => {
    expect(totauxNiveau([], [])).toEqual({ nbMatieres: 0, totalCoef: 0, totalHeures: 0, heuresIncompletes: false });
  });
});

describe('resumeFormation — la carte de la formation, tous niveaux confondus', () => {
  it('additionne matières et heures de CAP 1 + CAP 2, sans compter les niveaux d\'une autre formation', () => {
    const niveaux = [niveau({ id: 'n1' }), niveau({ id: 'n2', name: 'CAP 2' }), niveau({ id: 'nAutre', formationId: 'fAutre' })];
    const mats = [
      niveauMatiere({ id: 'a', niveauId: 'n1', volumeHoraire: 60 }),
      niveauMatiere({ id: 'b', niveauId: 'n2', volumeHoraire: 45 }),
      niveauMatiere({ id: 'c', niveauId: 'nAutre', volumeHoraire: 999 }),   // ne doit PAS compter
    ];
    const r = resumeFormation([niveaux[0], niveaux[1]], mats, []);
    expect(r).toEqual({ nbNiveaux: 2, nbMatieres: 2, totalHeures: 105 });
  });
  it('formation sans niveau : résumé à zéro', () => {
    expect(resumeFormation([], [], [])).toEqual({ nbNiveaux: 0, nbMatieres: 0, totalHeures: 0 });
  });
});

describe('validation', () => {
  it('formation et niveau : un nom non vide', () => {
    expect(nomFormationValide('CAP Restauration')).toBe(true);
    expect(nomFormationValide('  ')).toBe(false);
    expect(nomNiveauValide('CAP 1')).toBe(true);
    expect(nomNiveauValide('')).toBe(false);
  });

  it('le coefficient doit être un nombre strictement positif', () => {
    expect(coefficientValide(1)).toBe(true);
    expect(coefficientValide(0.5)).toBe(true);
    expect(coefficientValide(0)).toBe(false);
    expect(coefficientValide(-1)).toBe(false);
    expect(coefficientValide(NaN)).toBe(false);
  });

  it('le volume horaire est optionnel, mais jamais négatif', () => {
    expect(volumeHoraireValide(undefined)).toBe(true);
    expect(volumeHoraireValide(0)).toBe(true);
    expect(volumeHoraireValide(-5)).toBe(false);
  });

  it('le catalogue de l\'école ne prend jamais deux fois le même nom (insensible à la casse)', () => {
    const cat = [matiereCat({ id: 'a', name: 'Anglais' })];
    expect(nomMatiereCatalogueDejaPris(cat, 'anglais')).toBe(true);
    expect(nomMatiereCatalogueDejaPris(cat, 'Anglais', 'a')).toBe(false);   // on modifie la ligne elle-même
    expect(nomMatiereCatalogueDejaPris(cat, 'Français')).toBe(false);
  });

  it('une matière ne peut pas être enseignée deux fois au même niveau, mais oui à deux niveaux différents (catalogue partagé)', () => {
    const mats = [niveauMatiere({ id: 'a', niveauId: 'n1', matiereId: 'm1' })];
    expect(matiereDejaAuNiveau(mats, 'm1', 'n1')).toBe(true);
    expect(matiereDejaAuNiveau(mats, 'm1', 'n1', 'a')).toBe(false);
    expect(matiereDejaAuNiveau(mats, 'm1', 'n2')).toBe(false);
  });
});

describe('tri et regroupement', () => {
  it('triFormations : alphabétique', () => {
    const f = [formation({ id: '1', name: 'DQP' }), formation({ id: '2', name: 'BEP' })];
    expect(triFormations(f).map(x => x.id)).toEqual(['2', '1']);
  });
  it('triNiveaux : par ordre de création (CAP 1 avant CAP 2)', () => {
    const n = [niveau({ id: '1', name: 'CAP 2', ordering: 1 }), niveau({ id: '2', name: 'CAP 1', ordering: 0 })];
    expect(triNiveaux(n).map(x => x.id)).toEqual(['2', '1']);
  });
  it('regrouperParCategorie : préserve l\'ordre d\'apparition, matières sans catégorie à part', () => {
    const m = [
      niveauMatiere({ id: 'a', categorie: 'Enseignement professionnel', ordering: 0 }),
      niveauMatiere({ id: 'b', categorie: 'Enseignement général', ordering: 1 }),
      niveauMatiere({ id: 'c', categorie: 'Enseignement professionnel', ordering: 2 }),
      niveauMatiere({ id: 'd', ordering: 3 }),
    ];
    const g = regrouperParCategorie(m);
    expect(g.map(x => x.categorie)).toEqual(['Enseignement professionnel', 'Enseignement général', 'Sans catégorie']);
    expect(g[0].matieres.map(x => x.id)).toEqual(['a', 'c']);
  });
});

describe('nomsDuCatalogue — autocomplétion sur le catalogue partagé', () => {
  it('trié, un nom par ligne de catalogue', () => {
    expect(nomsDuCatalogue([matiereCat({ id: 'a', name: 'Français' }), matiereCat({ id: 'b', name: 'Anglais' })])).toEqual(['Anglais', 'Français']);
  });
  it('catalogue vide → liste vide', () => {
    expect(nomsDuCatalogue([])).toEqual([]);
  });
});

describe('export / import — aller-retour sans perte, sur la hiérarchie complète', () => {
  it('formation → niveaux → matières/choix redonne exactement les mêmes données', () => {
    const f = [formation()];
    const n = [niveau({ id: 'n1' }), niveau({ id: 'n2', name: 'CAP 2', ordering: 1 })];
    const m = [
      niveauMatiere({ id: 'a', niveauId: 'n1', matiereName: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique', categorie: 'Enseignement professionnel' }),
      niveauMatiere({ id: 'b', niveauId: 'n2', matiereName: 'Français', coefficient: 1 }),
    ];
    const c = [choixGroup({ niveauId: 'n1', label: 'Spécialité', options: [{ id: 'o1', subjectName: 'Cuisine' }, { id: 'o2', subjectName: 'Pâtisserie' }] })];

    const exporté = construireExport(f, n, m, c, new Date('2026-09-22T00:00:00Z'));
    expect(exporté.type).toBe('senclass_formation_pro_export');
    expect(exporté.formations).toHaveLength(1);
    expect(exporté.formations[0].niveaux).toHaveLength(2);
    expect(exporté.formations[0].niveaux[0].matieres).toEqual([
      { name: 'TP Cuisine', type: 'obligatoire', coefficient: 4, volumeHoraire: 150, nature: 'pratique', categorie: 'Enseignement professionnel' },
    ]);
    expect(exporté.formations[0].niveaux[0].choixGroups).toEqual([{ label: 'Spécialité', coefficient: 2, options: ['Cuisine', 'Pâtisserie'] }]);

    const relu = analyserImport(JSON.parse(JSON.stringify(exporté)));
    expect(relu).toEqual(exporté);
  });

  it('analyserImport refuse un fichier qui n\'est manifestement pas de ce type (y compris l\'ancien format v1)', () => {
    expect(analyserImport(null)).toBeNull();
    expect(analyserImport({})).toBeNull();
    expect(analyserImport({ type: 'senclass_formation_pro_export', blocs: [] })).toBeNull();   // v1 : « blocs », pas « formations »
    expect(analyserImport({ type: 'autre_chose', formations: [] })).toBeNull();
    expect(analyserImport('texte')).toBeNull();
    expect(analyserImport(42)).toBeNull();
  });

  it('une formation sans niveau s\'exporte quand même (en cours de construction)', () => {
    const exporté = construireExport([formation()], [], [], []);
    expect(exporté.formations[0]).toMatchObject({ niveaux: [] });
  });
});

describe('peutGererMatieres — matières et coefficients réservés au directeur général', () => {
  it('seul le compte admin_school peut créer, modifier ou supprimer une matière (donc un coefficient)', () => {
    expect(peutGererMatieres('admin')).toBe(true);
    expect(peutGererMatieres('staff')).toBe(false);
    expect(peutGererMatieres('teacher')).toBe(false);
    expect(peutGererMatieres('student')).toBe(false);
    expect(peutGererMatieres(null)).toBe(false);
    expect(peutGererMatieres(undefined)).toBe(false);
  });
});

describe('garde-fous — sécurité entre écoles et isolation du module', () => {
  const sql = readFileSync('docs/sql/formation_pro_formations.sql', 'utf8');
  it('chaque table du module filtre par school_id (isolation entre écoles)', () => {
    for (const t of ['fp_formations', 'fp_niveaux', 'fp_matieres', 'fp_niveau_matieres', 'fp_choix', 'fp_choix_options']) {
      expect(sql, t).toContain(`create table if not exists public.${t}`);
      expect(sql, t).toContain(`school_id = get_my_school_id()`);
    }
  });
  it('le catalogue de matières est unique par école (aucun doublon de nom possible en base)', () => {
    expect(sql).toMatch(/unique \(school_id, name\)/);
  });
  it('une matière ne peut pas être enseignée deux fois au même niveau (contrainte en base)', () => {
    expect(sql).toMatch(/unique \(niveau_id, matiere_id\)/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PROMOTIONS (étape 2) — une promotion possède une classe classique (nom,
// effectif) pour que Paiements/Présences/Emploi du temps/Portail continuent
// de fonctionner sans rien savoir de Formation professionnelle.
// ════════════════════════════════════════════════════════════════════════════

import {
  nomPromotionValide, datesPromotionValides, suggererNomPromotion, triPromotions, grouperPromotions,
  LIBELLES_RYTHME, LIBELLES_STATUT_PROMOTION, type Promotion,
} from './formationPro';

const promotion = (o: Partial<Promotion> = {}): Promotion => ({
  id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30,
  rythme: 'jour', status: 'active', createdAt: '2026-01-01T00:00:00Z', ...o,
});

describe('validation de la promotion', () => {
  it('le nom ne peut pas être vide', () => {
    expect(nomPromotionValide('CAP 1A')).toBe(true);
    expect(nomPromotionValide('  ')).toBe(false);
  });

  it('la fin ne peut pas précéder le début, mais une date manquante ne bloque rien', () => {
    expect(datesPromotionValides('2026-09-01', '2027-06-30')).toBe(true);
    expect(datesPromotionValides('2027-06-30', '2026-09-01')).toBe(false);
    expect(datesPromotionValides(undefined, '2027-06-30')).toBe(true);
    expect(datesPromotionValides('2026-09-01', undefined)).toBe(true);
    expect(datesPromotionValides(undefined, undefined)).toBe(true);
  });
});

describe('suggererNomPromotion — une suggestion, jamais une obligation', () => {
  it('compose le niveau et le mois/année de la date de début', () => {
    expect(suggererNomPromotion('CAP 1', '2026-09-01')).toBe('CAP 1 — Promo Septembre 2026');
    expect(suggererNomPromotion('Cycle unique', '2027-01-15')).toBe('Cycle unique — Promo Janvier 2027');
  });
  it('sans date, ou avec une date illisible, on retombe sur le seul nom du niveau', () => {
    expect(suggererNomPromotion('CAP 1', undefined)).toBe('CAP 1');
    expect(suggererNomPromotion('CAP 1', 'pas-une-date')).toBe('CAP 1');
  });
});

describe('triPromotions — la plus récente d\'abord', () => {
  it('trie par date de début décroissante, puis par nom', () => {
    const p = [
      promotion({ id: 'a', startDate: '2025-09-01', name: 'CAP 1A' }),
      promotion({ id: 'b', startDate: '2026-09-01', name: 'CAP 1A' }),
      promotion({ id: 'c', startDate: '2026-09-01', name: 'CAP 1B' }),
    ];
    expect(triPromotions(p).map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('grouperPromotions — formation → niveau → promotions, pour l\'écran', () => {
  const formations = [
    { id: 'f1', name: 'CAP Restauration', active: true, ordering: 0, createdAt: '' },
    { id: 'f2', name: 'BEP Hôtellerie', active: true, ordering: 1, createdAt: '' },
  ];
  const niveaux = [
    { id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' },
    { id: 'n2', formationId: 'f1', name: 'CAP 2', ordering: 1, createdAt: '' },
    { id: 'n3', formationId: 'f2', name: 'BEP 1', ordering: 0, createdAt: '' },
  ];

  it('un niveau sans promotion n\'apparaît pas ; les formations sans promotion non plus', () => {
    const groupes = grouperPromotions([promotion({ niveauId: 'n1' })], niveaux, formations);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].formation.name).toBe('CAP Restauration');
    expect(groupes[0].niveaux).toHaveLength(1);
    expect(groupes[0].niveaux[0].niveau.name).toBe('CAP 1');
  });

  it('deux promotions du même niveau sont regroupées ensemble', () => {
    const groupes = grouperPromotions(
      [promotion({ id: 'a', niveauId: 'n1', name: 'CAP 1A' }), promotion({ id: 'b', niveauId: 'n1', name: 'CAP 1B' })],
      niveaux, formations,
    );
    expect(groupes[0].niveaux[0].promotions.map(p => p.id)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('deux formations différentes donnent deux groupes distincts', () => {
    const groupes = grouperPromotions(
      [promotion({ id: 'a', niveauId: 'n1' }), promotion({ id: 'b', niveauId: 'n3' })],
      niveaux, formations,
    );
    expect(groupes.map(g => g.formation.name)).toEqual(['BEP Hôtellerie', 'CAP Restauration']);
  });

  it('aucune promotion → aucun groupe', () => {
    expect(grouperPromotions([], niveaux, formations)).toEqual([]);
  });
});

describe('libellés', () => {
  it('rythme et statut ont un libellé pour chaque valeur', () => {
    expect(LIBELLES_RYTHME.jour).toBe('Jour');
    expect(LIBELLES_RYTHME.soir).toBe('Soir');
    expect(Object.keys(LIBELLES_STATUT_PROMOTION)).toEqual(['a_venir', 'active', 'terminee', 'archivee']);
  });
});

describe('garde-fous — promotions : isolation entre écoles et suppression sans perte', () => {
  const sql = readFileSync('docs/sql/formation_pro_promotions.sql', 'utf8');
  it('la table filtre par school_id (isolation entre écoles)', () => {
    expect(sql).toContain('create table if not exists public.fp_promotions');
    expect(sql).toContain('school_id = get_my_school_id()');
  });
  it('une promotion ne peut référencer qu\'une seule classe (unique), et un niveau utilisé ne se supprime pas', () => {
    expect(sql).toMatch(/class_id\s+uuid not null unique/);
    expect(sql).toMatch(/niveau_id\s+uuid not null references public\.fp_niveaux\(id\) on delete restrict/);
  });
  it('supprimer une promotion vérifie d\'abord qu\'elle n\'a plus d\'élève (comme une classe classique)', () => {
    const contexte = readFileSync('src/contexts/FormationProContext.tsx', 'utf8');
    expect(contexte).toContain('getStudentCountByClass(promo.classId) > 0');
  });
});

describe('garde-fous — inscription des élèves adaptée au mode formation professionnelle', () => {
  const source = readFileSync('src/pages/StudentRegistration.tsx', 'utf8');

  it('utilise estFormationPro pour distinguer « classe » et « promotion », sans dupliquer la logique de mode', () => {
    expect(source).toContain("import { estFormationPro } from '@/lib/modeGestion'");
    expect(source).toContain('modeFormationPro');
  });

  it('le vocabulaire « promotion » apparaît pour l\'école en formation professionnelle', () => {
    expect(source).toContain("'Formation professionnelle → Promotions'".replace(/'/g, '')); // tolère guillemets doubles
    expect(source).toMatch(/formation professionnelle.*Promotions/i);
  });

  it('le formulaire reste un simple `classId` — aucune nouvelle branche d\'écriture en base pour la formation pro', () => {
    // L'inscription elle-même n'a pas changé : une promotion EST une classe.
    expect(source).toContain('formData.classId');
    expect(source).not.toMatch(/promotionId/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ÉVALUATIONS (étape 3) — calcul à trois étages : catégorie → matière →
// moyenne générale. Une note absente/non évaluée n'est JAMAIS un 0.
// ════════════════════════════════════════════════════════════════════════════

import {
  nomCategorieValide, pourcentageValide, sommeBareme, baremeComplet, DEFAUT_BAREME_CATEGORIES,
  nomPeriodeValide, titreEvaluationValide, baremeValide, poidsValide,
  convertirSur20, moyenneCategorie, moyenneMatiere, moyenneGenerale, resumeEvaluation,
  triEvaluations, triPeriodes,
  type BaremeCategorie, type Evaluation, type Note, type MoyenneParMatiere,
} from './formationPro';

const categorie = (o: Partial<BaremeCategorie> = {}): BaremeCategorie =>
  ({ id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0, ...o });
const evaluation = (o: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc',
  type: 'Devoir', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '', ...o,
});
const note = (o: Partial<Note> = {}): Note => ({ id: 'n1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 15, statut: 'note', ...o });

describe('validation du barème et des évaluations', () => {
  it('un nom de catégorie ne peut pas être vide', () => {
    expect(nomCategorieValide('Contrôle continu')).toBe(true);
    expect(nomCategorieValide('  ')).toBe(false);
  });
  it('le pourcentage doit être entre 0 (exclu) et 100 (inclus)', () => {
    expect(pourcentageValide(30)).toBe(true);
    expect(pourcentageValide(100)).toBe(true);
    expect(pourcentageValide(0)).toBe(false);
    expect(pourcentageValide(101)).toBe(false);
    expect(pourcentageValide(-5)).toBe(false);
  });
  it('la formule par défaut appliquée à toute nouvelle formation fait bien 100 %', () => {
    expect(DEFAUT_BAREME_CATEGORIES.reduce((s, c) => s + c.pourcentage, 0)).toBe(100);
  });

  it('sommeBareme et baremeComplet — le barème IFHO (30/30/10/30) fait bien 100', () => {
    const bareme = [
      categorie({ id: 'cc', name: 'Contrôle continu', pourcentage: 30 }),
      categorie({ id: 'tp', name: 'TP', pourcentage: 30 }),
      categorie({ id: 'eb', name: 'Examen blanc', pourcentage: 10 }),
      categorie({ id: 'ef', name: 'Examen final', pourcentage: 30 }),
    ];
    expect(sommeBareme(bareme)).toBe(100);
    expect(baremeComplet(bareme)).toBe(true);
  });
  it('un barème incomplet ou vide n\'est jamais considéré complet', () => {
    expect(baremeComplet([categorie({ pourcentage: 30 }), categorie({ id: 'tp', pourcentage: 30 })])).toBe(false);
    expect(baremeComplet([])).toBe(false);
  });
  it('nom de période, titre, barème, poids', () => {
    expect(nomPeriodeValide('Semestre 1')).toBe(true);
    expect(nomPeriodeValide('')).toBe(false);
    expect(titreEvaluationValide('Contrôle pratique n°1')).toBe(true);
    expect(titreEvaluationValide(' ')).toBe(false);
    expect(baremeValide(20)).toBe(true);
    expect(baremeValide(0)).toBe(false);
    expect(poidsValide(1)).toBe(true);
    expect(poidsValide(-1)).toBe(false);
  });
});

describe('convertirSur20 — ramener n\'importe quel barème sur 20', () => {
  it('convertit proportionnellement', () => {
    expect(convertirSur20(15, 20)).toBe(15);
    expect(convertirSur20(8, 10)).toBe(16);
    expect(convertirSur20(75, 100)).toBe(15);
    expect(convertirSur20(4, 5)).toBe(16);
  });
});

describe('moyenneCategorie — pondérée par le poids de chaque évaluation, absents exclus', () => {
  it('deux évaluations de poids égal : moyenne simple', () => {
    const evals = [evaluation({ id: 'e1' }), evaluation({ id: 'e2', title: 'Devoir 2' })];
    const notes = [note({ id: 'n1', evaluationId: 'e1', valeur: 12 }), note({ id: 'n2', evaluationId: 'e2', valeur: 16 })];
    expect(moyenneCategorie(evals, notes, 'cc', 's1')).toBe(14);
  });

  it('un projet de poids 2 pèse deux fois plus qu\'un contrôle de poids 1', () => {
    const evals = [evaluation({ id: 'e1', poids: 1 }), evaluation({ id: 'e2', title: 'Projet', poids: 2 })];
    const notes = [note({ id: 'n1', evaluationId: 'e1', valeur: 10 }), note({ id: 'n2', evaluationId: 'e2', valeur: 16 })];
    // (10×1 + 16×2) / (1+2) = 42/3 = 14
    expect(moyenneCategorie(evals, notes, 'cc', 's1')).toBe(14);
  });

  it('une note sur un barème différent (/10) est ramenée sur 20 avant la moyenne', () => {
    const evals = [evaluation({ id: 'e1', bareme: 20 }), evaluation({ id: 'e2', bareme: 10 })];
    const notes = [note({ id: 'n1', evaluationId: 'e1', valeur: 10 }), note({ id: 'n2', evaluationId: 'e2', valeur: 8 })];
    // e1: 10/20; e2: 8/10 -> 16/20 ; moyenne (10+16)/2 = 13
    expect(moyenneCategorie(evals, notes, 'cc', 's1')).toBe(13);
  });

  it('un absent n\'est PAS compté comme 0 — il est exclu, la moyenne se fait sur ce qui reste', () => {
    const evals = [evaluation({ id: 'e1' }), evaluation({ id: 'e2' })];
    const notes = [note({ id: 'n1', evaluationId: 'e1', valeur: 16 }), note({ id: 'n2', evaluationId: 'e2', valeur: undefined, statut: 'absent' })];
    expect(moyenneCategorie(evals, notes, 'cc', 's1')).toBe(16);
  });

  it('aucune note dans la catégorie → null, jamais 0', () => {
    expect(moyenneCategorie([evaluation()], [], 'cc', 's1')).toBeNull();
    expect(moyenneCategorie([evaluation()], [note({ statut: 'non_evalue', valeur: undefined })], 'cc', 's1')).toBeNull();
  });

  it('n\'agrège que les évaluations de LA catégorie demandée', () => {
    const evals = [evaluation({ id: 'e1', categorieId: 'cc' }), evaluation({ id: 'e2', categorieId: 'tp' })];
    const notes = [note({ id: 'n1', evaluationId: 'e1', valeur: 10 }), note({ id: 'n2', evaluationId: 'e2', valeur: 20 })];
    expect(moyenneCategorie(evals, notes, 'cc', 's1')).toBe(10);
    expect(moyenneCategorie(evals, notes, 'tp', 's1')).toBe(20);
  });
});

describe('moyenneMatiere — pondérée par le barème, catégorie non notée jamais comptée 0', () => {
  const bareme = [
    categorie({ id: 'cc', name: 'Contrôle continu', pourcentage: 30 }),
    categorie({ id: 'tp', name: 'TP', pourcentage: 30 }),
    categorie({ id: 'eb', name: 'Examen blanc', pourcentage: 10 }),
    categorie({ id: 'ef', name: 'Examen final', pourcentage: 30 }),
  ];

  it('les quatre catégories notées, exemple à la main', () => {
    const evals = [
      evaluation({ id: 'e-cc', categorieId: 'cc' }), evaluation({ id: 'e-tp', categorieId: 'tp' }),
      evaluation({ id: 'e-eb', categorieId: 'eb' }), evaluation({ id: 'e-ef', categorieId: 'ef' }),
    ];
    const notes = [
      note({ id: 'n1', evaluationId: 'e-cc', valeur: 14 }), note({ id: 'n2', evaluationId: 'e-tp', valeur: 16 }),
      note({ id: 'n3', evaluationId: 'e-eb', valeur: 10 }), note({ id: 'n4', evaluationId: 'e-ef', valeur: 12 }),
    ];
    // (14×30 + 16×30 + 10×10 + 12×30) / 100 = (420+480+100+360)/100 = 1360/100 = 13.6
    expect(moyenneMatiere(bareme, evals, notes, 's1')).toBeCloseTo(13.6, 10);
  });

  it('l\'examen final pas encore passé : ignoré et redistribué, jamais compté 0', () => {
    const evals = [evaluation({ id: 'e-cc', categorieId: 'cc' }), evaluation({ id: 'e-tp', categorieId: 'tp' })];
    const notes = [note({ id: 'n1', evaluationId: 'e-cc', valeur: 14 }), note({ id: 'n2', evaluationId: 'e-tp', valeur: 16 })];
    // seules cc et tp ont des notes, pourcentages 30+30=60 : (14×30 + 16×30)/60 = 900/60 = 15
    expect(moyenneMatiere(bareme, evals, notes, 's1')).toBe(15);
  });

  it('rien de noté du tout → null', () => {
    expect(moyenneMatiere(bareme, [], [], 's1')).toBeNull();
  });
});

describe('moyenneGenerale — pondérée par le coefficient de chaque matière', () => {
  it('deux matières notées, coefficients différents', () => {
    const m: MoyenneParMatiere[] = [
      { niveauMatiereId: 'nm1', coefficient: 1, moyenne: 12 },
      { niveauMatiereId: 'nm2', coefficient: 4, moyenne: 16 },
    ];
    // (12×1 + 16×4)/5 = (12+64)/5 = 15.2
    expect(moyenneGenerale(m)).toBeCloseTo(15.2, 10);
  });

  it('une matière pas encore notée est ignorée, pas comptée 0', () => {
    const m: MoyenneParMatiere[] = [
      { niveauMatiereId: 'nm1', coefficient: 1, moyenne: 12 },
      { niveauMatiereId: 'nm2', coefficient: 4, moyenne: null },
    ];
    expect(moyenneGenerale(m)).toBe(12);
  });

  it('aucune matière notée → null', () => {
    expect(moyenneGenerale([{ niveauMatiereId: 'nm1', coefficient: 4, moyenne: null }])).toBeNull();
    expect(moyenneGenerale([])).toBeNull();
  });
});

describe('resumeEvaluation — la carte de la liste (effectif, notes saisies, absents, moyenne)', () => {
  it('compte les notes saisies, les absents, et calcule la moyenne sur les seuls présents notés', () => {
    const ev = evaluation({ bareme: 20 });
    const notes = [
      note({ id: 'n1', studentEnrollmentId: 's1', valeur: 15 }),
      note({ id: 'n2', studentEnrollmentId: 's2', valeur: 17 }),
      note({ id: 'n3', studentEnrollmentId: 's3', valeur: undefined, statut: 'absent' }),
    ];
    const r = resumeEvaluation(ev, notes, 28);
    expect(r).toEqual({ nbAttendus: 28, nbNotes: 3, nbAbsents: 1, moyenne: 16 });
  });
  it('aucune note saisie → moyenne null, pas 0', () => {
    expect(resumeEvaluation(evaluation(), [], 28).moyenne).toBeNull();
  });
});

describe('tri', () => {
  it('triEvaluations : la plus récente d\'abord', () => {
    const e = [evaluation({ id: 'a', date: '2026-09-01' }), evaluation({ id: 'b', date: '2026-09-18' })];
    expect(triEvaluations(e).map(x => x.id)).toEqual(['b', 'a']);
  });
  it('triPeriodes : dans l\'ordre de création', () => {
    const p = [{ id: 'a', promotionId: 'p1', name: 'Semestre 2', ordering: 1 }, { id: 'b', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }];
    expect(triPeriodes(p).map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('garde-fous — évaluations : isolation, catégorie du barème, historique', () => {
  const sql = readFileSync('docs/sql/formation_pro_evaluations.sql', 'utf8');
  it('chaque table filtre par school_id (isolation entre écoles)', () => {
    for (const t of ['fp_bareme_categories', 'fp_periodes', 'fp_evaluations', 'fp_notes', 'fp_notes_historique']) {
      expect(sql, t).toContain(`school_id`);
    }
  });
  it('une évaluation ne peut référencer qu\'une catégorie du barème de la formation (jamais une note orpheline)', () => {
    expect(sql).toContain('categorie_id      uuid not null references public.fp_bareme_categories(id) on delete restrict');
  });
  it('une note « absente » ou « non évaluée » n\'a jamais de valeur — la contrainte l\'empêche en base', () => {
    expect(sql).toContain("check ((statut = 'note') = (valeur is not null))");
  });
});

import {
  triEvaluationsChronologique, titreNouvelleEvaluation, analyserSaisieNote, texteDeLaNote, recapitulatifPeriode,
} from './formationPro';

describe('grille de saisie — colonnes d\'une catégorie', () => {
  it('se lisent de gauche à droite dans l\'ordre où les évaluations ont eu lieu', () => {
    const evs = [
      evaluation({ id: 'b', date: '2026-10-02', createdAt: '2' }),
      evaluation({ id: 'a', date: '2026-09-18', createdAt: '3' }),
      evaluation({ id: 'c', date: '2026-10-02', createdAt: '1' }),
    ];
    expect(triEvaluationsChronologique(evs).map(e => e.id)).toEqual(['a', 'c', 'b']);
  });
  it('une nouvelle colonne prend le premier numéro libre, jamais un nom déjà pris', () => {
    expect(titreNouvelleEvaluation('Contrôle continu', [])).toBe('Contrôle continu 1');
    expect(titreNouvelleEvaluation('TP', ['TP 1'])).toBe('TP 2');
    // TP 1 supprimé, TP 2 reste : on ne recrée pas un second « TP 2 »
    expect(titreNouvelleEvaluation('TP', ['TP 2'])).toBe('TP 3');
    expect(titreNouvelleEvaluation('TP', ['Pratique cuisine'])).toBe('TP 2');
  });
});

describe('analyserSaisieNote — ce qui est tapé dans une case', () => {
  it('accepte une note avec virgule ou point', () => {
    expect(analyserSaisieNote('12,5', 20)).toEqual({ kind: 'note', valeur: 12.5 });
    expect(analyserSaisieNote(' 14.25 ', 20)).toEqual({ kind: 'note', valeur: 14.25 });
    expect(analyserSaisieNote('0', 20)).toEqual({ kind: 'note', valeur: 0 });
    expect(analyserSaisieNote('20', 20)).toEqual({ kind: 'note', valeur: 20 });
  });
  it('refuse une note au-dessus du barème de l\'évaluation (pas seulement 20)', () => {
    expect(analyserSaisieNote('25', 20).kind).toBe('invalide');
    expect(analyserSaisieNote('11', 10).kind).toBe('invalide');
    expect(analyserSaisieNote('75', 100)).toEqual({ kind: 'note', valeur: 75 });
  });
  it('les codes A, AJ, NE donnent un statut, en majuscules ou minuscules — jamais une note de 0', () => {
    expect(analyserSaisieNote('A', 20)).toEqual({ kind: 'statut', statut: 'absent' });
    expect(analyserSaisieNote('aj', 20)).toEqual({ kind: 'statut', statut: 'absent_justifie' });
    expect(analyserSaisieNote('Ne', 20)).toEqual({ kind: 'statut', statut: 'non_evalue' });
  });
  it('une case vidée est « vide » (la note sera retirée), le reste est invalide', () => {
    expect(analyserSaisieNote('   ', 20)).toEqual({ kind: 'vide' });
    expect(analyserSaisieNote('-3', 20).kind).toBe('invalide');
    expect(analyserSaisieNote('abc', 20).kind).toBe('invalide');
    expect(analyserSaisieNote('12,', 20).kind).toBe('invalide');
  });
  it('texteDeLaNote fait l\'aller-retour avec la saisie', () => {
    expect(texteDeLaNote(undefined)).toBe('');
    expect(texteDeLaNote({ statut: 'note', valeur: 12.5 })).toBe('12,5');
    expect(texteDeLaNote({ statut: 'absent' })).toBe('A');
    expect(texteDeLaNote({ statut: 'absent_justifie' })).toBe('AJ');
    expect(texteDeLaNote({ statut: 'non_evalue' })).toBe('NE');
  });
});

describe('recapitulatifPeriode — moyennes par matière, moyenne générale et rang', () => {
  const cats = [categorie({ id: 'cc', pourcentage: 50 }), categorie({ id: 'ef', name: 'Examen final', pourcentage: 50 })];
  const matieres = [{ id: 'nm1', coefficient: 3 }, { id: 'nm2', coefficient: 1 }];
  const evs = [
    evaluation({ id: 'e1', niveauMatiereId: 'nm1', categorieId: 'cc' }),
    evaluation({ id: 'e2', niveauMatiereId: 'nm1', categorieId: 'ef' }),
    evaluation({ id: 'e3', niveauMatiereId: 'nm2', categorieId: 'cc' }),
  ];
  const notes = [
    note({ id: '1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 10 }),
    note({ id: '2', evaluationId: 'e2', studentEnrollmentId: 's1', valeur: 14 }),
    note({ id: '3', evaluationId: 'e3', studentEnrollmentId: 's1', valeur: 8 }),
    note({ id: '4', evaluationId: 'e1', studentEnrollmentId: 's2', valeur: 16 }),
    note({ id: '5', evaluationId: 'e3', studentEnrollmentId: 's2', statut: 'absent', valeur: undefined }),
  ];

  it('calcule chaque matière puis la générale pondérée par les coefficients', () => {
    const r = recapitulatifPeriode(['s1', 's2'], matieres, cats, evs, notes);
    const s1 = r.find(l => l.studentEnrollmentId === 's1')!;
    expect(s1.parMatiere.nm1).toBe(12);                 // (10×50 + 14×50) / 100
    expect(s1.parMatiere.nm2).toBe(8);
    expect(s1.generale).toBe(11);                        // (12×3 + 8×1) / 4
    const s2 = r.find(l => l.studentEnrollmentId === 's2')!;
    expect(s2.parMatiere.nm1).toBe(16);                 // examen final pas encore passé : ignoré, pas 0
    expect(s2.parMatiere.nm2).toBeNull();               // absent : rien de noté
    expect(s2.generale).toBe(16);
  });
  it('classe du meilleur au moins bon ; un élève sans note n\'a pas de rang et passe à la fin', () => {
    const r = recapitulatifPeriode(['s3', 's1', 's2'], matieres, cats, evs, notes);
    expect(r.map(l => [l.studentEnrollmentId, l.rang])).toEqual([['s2', 1], ['s1', 2], ['s3', null]]);
  });
  it('les ex æquo partagent le même rang', () => {
    const n = [
      note({ id: 'a', evaluationId: 'e1', studentEnrollmentId: 'x', valeur: 12 }),
      note({ id: 'b', evaluationId: 'e1', studentEnrollmentId: 'y', valeur: 12 }),
      note({ id: 'c', evaluationId: 'e1', studentEnrollmentId: 'z', valeur: 9 }),
    ];
    const r = recapitulatifPeriode(['x', 'y', 'z'], matieres, cats, evs, n);
    expect(r.map(l => l.rang)).toEqual([1, 1, 3]);
  });
});

import {
  etatCandidat, propositionJury, mentionPourMoyenne, decisionRetenue, mentionRetenue, bilanExamen,
  epreuvesDepuisProgramme, analyserSaisieNoteExamen, seuilEliminatoireValide, seuilAdmissionValide,
  type ExamenEpreuve, type ExamenNote,
} from './formationPro';

const epreuve = (o: Partial<ExamenEpreuve> = {}): ExamenEpreuve =>
  ({ id: 'ep1', tourId: 't1', nom: 'Cuisine', coefficient: 1, bareme: 20, ordering: 0, ...o });
const noteEx = (o: Partial<ExamenNote> = {}): ExamenNote =>
  ({ id: 'x', epreuveId: 'ep1', studentEnrollmentId: 's1', valeur: 12, statut: 'note', ...o });

describe('examens — validation', () => {
  it('seuil d\'admission entre 0 (exclu) et 20', () => {
    expect(seuilAdmissionValide(10)).toBe(true);
    expect(seuilAdmissionValide(0)).toBe(false);
    expect(seuilAdmissionValide(21)).toBe(false);
  });
  it('seuil éliminatoire facultatif, sinon sous le barème de l\'épreuve', () => {
    expect(seuilEliminatoireValide(undefined, 20)).toBe(true);
    expect(seuilEliminatoireValide(5, 20)).toBe(true);
    expect(seuilEliminatoireValide(20, 20)).toBe(false);
    expect(seuilEliminatoireValide(-1, 20)).toBe(false);
  });
  it('pas de « non évalué » à un examen, mais A et AJ oui', () => {
    expect(analyserSaisieNoteExamen('NE', 20).kind).toBe('invalide');
    expect(analyserSaisieNoteExamen('A', 20)).toEqual({ kind: 'statut', statut: 'absent' });
    expect(analyserSaisieNoteExamen('AJ', 20)).toEqual({ kind: 'statut', statut: 'absent_justifie' });
    expect(analyserSaisieNoteExamen('14', 20)).toEqual({ kind: 'note', valeur: 14 });
  });
});

describe('etatCandidat — moyenne pondérée par coefficient, tous tours confondus', () => {
  const eps = [
    epreuve({ id: 'ecrit', coefficient: 2, bareme: 20 }),
    epreuve({ id: 'prat', tourId: 't2', coefficient: 4, bareme: 40, seuilEliminatoire: 10 }),
  ];
  it('calcule la moyenne sur 20 (barèmes différents ramenés sur 20)', () => {
    const e = etatCandidat(eps, [noteEx({ epreuveId: 'ecrit', valeur: 11 }), noteEx({ epreuveId: 'prat', valeur: 30 })], 's1');
    expect(e.moyenne).toBe((11 * 2 + 15 * 4) / 6);
    expect(e.epreuvesEliminatoires).toEqual([]);
  });
  it('repère la note éliminatoire (sur le barème de l\'épreuve)', () => {
    const e = etatCandidat(eps, [noteEx({ epreuveId: 'ecrit', valeur: 18 }), noteEx({ epreuveId: 'prat', valeur: 9 })], 's1');
    expect(e.epreuvesEliminatoires).toEqual(['prat']);
  });
  it('une épreuve sans note ou une absence n\'est jamais comptée 0', () => {
    const e = etatCandidat(eps, [noteEx({ epreuveId: 'ecrit', valeur: 14 })], 's1');
    expect(e.moyenne).toBe(14);
    expect(e.epreuvesManquantes).toEqual(['prat']);
    const a = etatCandidat(eps, [noteEx({ epreuveId: 'ecrit', valeur: 14 }), noteEx({ epreuveId: 'prat', statut: 'absent', valeur: undefined })], 's1');
    expect(a.moyenne).toBe(14);
    expect(a.epreuvesAbsent).toEqual(['prat']);
  });
});

describe('propositionJury — ce que le logiciel propose, jamais imposé', () => {
  const base = { moyenne: 13, epreuvesEliminatoires: [], epreuvesManquantes: [], epreuvesAbsent: [] };
  it('admis au-dessus du seuil, avec la mention de la moyenne', () => {
    expect(propositionJury(base, 10)).toEqual({ decision: 'admis', mention: 'assez_bien' });
  });
  it('ajourné sous le seuil (le seuil de l\'examen, pas forcément 10)', () => {
    expect(propositionJury(base, 14)).toEqual({ decision: 'ajourne', mention: null });
  });
  it('une note éliminatoire donne Refusé même avec une bonne moyenne', () => {
    expect(propositionJury({ ...base, moyenne: 17, epreuvesEliminatoires: ['x'] }, 10).decision).toBe('refuse');
  });
  it('aucune proposition tant qu\'une épreuve n\'est pas saisie, ou en cas d\'absence', () => {
    expect(propositionJury({ ...base, epreuvesManquantes: ['x'] }, 10).decision).toBeNull();
    const abs = propositionJury({ ...base, epreuvesAbsent: ['x'] }, 10);
    expect(abs.decision).toBeNull();
    expect(abs.motif).toMatch(/jury/);
  });
  it('mentions : bandes habituelles', () => {
    expect(mentionPourMoyenne(9.99)).toBeNull();
    expect(mentionPourMoyenne(10)).toBe('passable');
    expect(mentionPourMoyenne(12)).toBe('assez_bien');
    expect(mentionPourMoyenne(14)).toBe('bien');
    expect(mentionPourMoyenne(16)).toBe('tres_bien');
  });
  it('le choix du jury l\'emporte sur la proposition ; pas de mention si non admis', () => {
    const prop = { decision: 'admis' as const, mention: 'bien' as const };
    expect(decisionRetenue(undefined, prop)).toBe('admis');
    expect(decisionRetenue({ decision: 'ajourne' }, prop)).toBe('ajourne');
    expect(mentionRetenue({ decision: 'ajourne' }, prop)).toBeNull();
    expect(mentionRetenue({ decision: 'admis', mention: 'tres_bien' }, prop)).toBe('tres_bien');
    expect(mentionRetenue(undefined, prop)).toBe('bien');
  });
});

describe('bilanExamen et épreuves proposées', () => {
  it('compte les décisions ; le taux de réussite ne porte que sur les candidats décidés', () => {
    const b = bilanExamen(['admis', 'admis', 'ajourne', 'refuse', null]);
    expect(b).toMatchObject({ candidats: 5, admis: 2, ajournes: 1, refuses: 1, sansDecision: 1, tauxReussite: 50 });
    expect(bilanExamen([null]).tauxReussite).toBeNull();
  });
  it('théorique → Écrit, pratique/projet → Pratique, stage exclu, coefficient du programme repris', () => {
    const r = epreuvesDepuisProgramme([
      { id: 'a', matiereName: 'Français', coefficient: 2, nature: 'theorique', ordering: 1 },
      { id: 'b', matiereName: 'TP Cuisine', coefficient: 4, nature: 'pratique', ordering: 0 },
      { id: 'c', matiereName: 'Stage', coefficient: 3, nature: 'stage', ordering: 2 },
      { id: 'd', matiereName: 'Projet pro', coefficient: 1, nature: 'projet', ordering: 3 },
    ]);
    expect(r).toEqual([
      { tour: 'Écrit', epreuves: [{ niveauMatiereId: 'a', nom: 'Français', coefficient: 2 }] },
      { tour: 'Pratique', epreuves: [
        { niveauMatiereId: 'b', nom: 'TP Cuisine', coefficient: 4 },
        { niveauMatiereId: 'd', nom: 'Projet pro', coefficient: 1 },
      ] },
    ]);
  });
});

describe('garde-fous — examens : isolation et verrouillage tenus par la base', () => {
  const sql = readFileSync('docs/sql/formation_pro_examens.sql', 'utf8');
  it('les 6 tables sont filtrées par école (RLS)', () => {
    for (const t of ['fp_examens', 'fp_examen_tours', 'fp_examen_epreuves', 'fp_examen_candidats', 'fp_examen_notes', 'fp_examen_resultats']) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toContain('school_id = get_my_school_id()');
  });
  it('une absence n\'a jamais de valeur', () => {
    expect(sql).toContain("check ((statut = 'note') = (valeur is not null))");
  });
  it('seul le directeur verrouille, et rien ne bouge dans un examen verrouillé', () => {
    expect(sql).toContain('new.verrouille is distinct from old.verrouille and not is_school_admin()');
    expect(sql).toContain("array['fp_examen_tours','fp_examen_epreuves','fp_examen_candidats','fp_examen_notes','fp_examen_resultats']");
  });
});
