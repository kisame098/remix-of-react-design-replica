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
