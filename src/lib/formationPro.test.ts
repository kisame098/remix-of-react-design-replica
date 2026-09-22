import { describe, it, expect } from 'vitest';
import {
  totauxBloc, nomBlocValide, coefficientValide, volumeHoraireValide, nomMatiereDejaPris,
  libelleBloc, triBlocs, construireExport, analyserImport, peutGererMatieres,
  grouperBlocsParFormation, nomsDeMatieresConnus,
  type FormationBloc, type FormationMatiere, type FormationChoixGroup,
} from './formationPro';

// ════════════════════════════════════════════════════════════════════════════
// FORMATION PROFESSIONNELLE — catalogue des formations (étape 1). Un bloc =
// le programme d'UNE année d'UNE formation, jamais partagé entre années.
// ════════════════════════════════════════════════════════════════════════════

const bloc = (o: Partial<FormationBloc> = {}): FormationBloc =>
  ({ id: 'b1', formationName: 'CAP Restauration', anneeLabel: 'Année 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z', ...o });

const matiere = (o: Partial<FormationMatiere> = {}): FormationMatiere =>
  ({ id: 'm1', blocId: 'b1', type: 'obligatoire', name: 'Français', coefficient: 1, nature: 'theorique', ordering: 0, ...o });

const choix = (o: Partial<FormationChoixGroup> = {}): FormationChoixGroup =>
  ({ id: 'c1', blocId: 'b1', label: 'Option', coefficient: 2, ordering: 0, options: [], ...o });

describe('totauxBloc — vérifié sur la maquette CAP Restauration transmise par IFHO', () => {
  // Relevé de notes officiel DECPC (session 2022) : 20 coefficients à l'examen
  // + « Conduite professionnelle » propre à l'école = 21 coefficients, 750 h.
  const CAP = [
    ['Français', 1, 60], ['Mathématiques', 1, 60], ['Anglais', 1, 45],
    ['Nutrition-Alimentation', 2, 60], ['Technologie du matériel', 2, 45], ['Entretien', 2, 60],
    ['TP / Technologie Pâtisserie', 3, 90], ['TP Cuisine', 4, 150], ['TP Restaurant', 4, 150],
    ['Conduite professionnelle', 1, 30],
  ] as const;
  const matieresCAP = CAP.map(([name, coefficient, volumeHoraire], i) =>
    matiere({ id: `cap-${i}`, name, coefficient, volumeHoraire, ordering: i }));

  it('10 matières, 21 coefficients, 750 heures', () => {
    const t = totauxBloc(matieresCAP, []);
    expect(t.nbMatieres).toBe(10);
    expect(t.totalCoef).toBe(21);
    expect(t.totalHeures).toBe(750);
    expect(t.heuresIncompletes).toBe(false);
  });

  it('un volume horaire manquant est signalé, jamais compté comme 0', () => {
    const t = totauxBloc([matiere({ coefficient: 2, volumeHoraire: 60 }), matiere({ id: 'm2', coefficient: 1 })], []);
    expect(t.totalHeures).toBe(60);
    expect(t.heuresIncompletes).toBe(true);
  });

  it('un créneau au choix compte un seul coefficient, quel que soit son nombre d\'options', () => {
    const t = totauxBloc([], [choix({ coefficient: 2, options: [{ id: 'o1', subjectName: 'Cuisine' }, { id: 'o2', subjectName: 'Pâtisserie' }] })]);
    expect(t.nbMatieres).toBe(1);
    expect(t.totalCoef).toBe(2);
  });

  it('bloc vide : tout à zéro, sans planter', () => {
    expect(totauxBloc([], [])).toEqual({ nbMatieres: 0, totalCoef: 0, totalHeures: 0, heuresIncompletes: false });
  });
});

describe('validation', () => {
  it('un bloc a besoin d\'une formation ET d\'un libellé d\'année', () => {
    expect(nomBlocValide('CAP Restauration', 'Année 1')).toBe(true);
    expect(nomBlocValide('  ', 'Année 1')).toBe(false);
    expect(nomBlocValide('CAP Restauration', ' ')).toBe(false);
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
    expect(volumeHoraireValide(150)).toBe(true);
    expect(volumeHoraireValide(-5)).toBe(false);
  });

  it('deux matières ne peuvent pas porter le même nom dans le même bloc (insensible à la casse)', () => {
    const existantes = [matiere({ id: 'a', name: 'TP Cuisine', blocId: 'b1' })];
    expect(nomMatiereDejaPris(existantes, 'tp cuisine', 'b1')).toBe(true);
    expect(nomMatiereDejaPris(existantes, 'TP Cuisine', 'b2')).toBe(false);            // bloc différent : autorisé
    expect(nomMatiereDejaPris(existantes, 'TP Cuisine', 'b1', 'a')).toBe(false);        // on modifie la matière elle-même
    expect(nomMatiereDejaPris(existantes, 'TP Pâtisserie', 'b1')).toBe(false);
  });
});

describe('libellé et tri', () => {
  it('libelleBloc combine la formation et l\'année', () => {
    expect(libelleBloc({ formationName: 'CAP Restauration', anneeLabel: 'Année 1' })).toBe('CAP Restauration — Année 1');
  });
  it('triBlocs : par formation puis par ordre de création (années dans l\'ordre)', () => {
    const b = [
      bloc({ id: '1', formationName: 'DQP', anneeLabel: 'Cycle unique', ordering: 0 }),
      bloc({ id: '2', formationName: 'CAP Restauration', anneeLabel: 'Année 2', ordering: 1 }),
      bloc({ id: '3', formationName: 'CAP Restauration', anneeLabel: 'Année 1', ordering: 0 }),
    ];
    expect(triBlocs(b).map(x => x.id)).toEqual(['3', '2', '1']);
  });
});

describe('export / import — aller-retour sans perte', () => {
  it('un export puis import redonne exactement les mêmes matières et créneaux', () => {
    const b = [bloc()];
    const m = [matiere({ name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' })];
    const c = [choix({ label: 'Spécialité', coefficient: 2, options: [{ id: 'o1', subjectName: 'Cuisine' }, { id: 'o2', subjectName: 'Pâtisserie' }] })];

    const exporté = construireExport(b, m, c, new Date('2026-09-22T00:00:00Z'));
    expect(exporté.type).toBe('senclass_formation_pro_export');
    expect(exporté.blocs).toHaveLength(1);
    expect(exporté.blocs[0].matieres).toEqual([{ type: 'obligatoire', name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' }]);
    expect(exporté.blocs[0].choixGroups).toEqual([{ label: 'Spécialité', coefficient: 2, options: ['Cuisine', 'Pâtisserie'] }]);

    const relu = analyserImport(JSON.parse(JSON.stringify(exporté)));
    expect(relu).toEqual(exporté);
  });

  it('analyserImport refuse un fichier qui n\'est manifestement pas un export de ce type', () => {
    expect(analyserImport(null)).toBeNull();
    expect(analyserImport({})).toBeNull();
    expect(analyserImport({ type: 'autre_chose', blocs: [] })).toBeNull();
    expect(analyserImport({ type: 'senclass_formation_pro_export' })).toBeNull();   // blocs manquant
    expect(analyserImport('texte')).toBeNull();
    expect(analyserImport(42)).toBeNull();
  });

  it('un bloc sans matière ni créneau s\'exporte quand même (formation vide, en cours de construction)', () => {
    const exporté = construireExport([bloc()], [], []);
    expect(exporté.blocs[0]).toMatchObject({ matieres: [], choixGroups: [] });
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

describe('grouperBlocsParFormation — lisibilité de la liste pour une école à plusieurs formations', () => {
  it('rassemble les blocs d\'une même formation, dans l\'ordre du tri', () => {
    const b = [
      bloc({ id: '1', formationName: 'BEP Hôtellerie', anneeLabel: 'Année 1', ordering: 0 }),
      bloc({ id: '2', formationName: 'CAP Restauration', anneeLabel: 'Année 2', ordering: 1 }),
      bloc({ id: '3', formationName: 'CAP Restauration', anneeLabel: 'Année 1', ordering: 0 }),
    ];
    const groupes = grouperBlocsParFormation(b);
    expect(groupes.map(g => g.formationName)).toEqual(['BEP Hôtellerie', 'CAP Restauration']);
    expect(groupes[1].blocs.map(x => x.id)).toEqual(['3', '2']);   // Année 1 avant Année 2
  });

  it('une seule formation avec un seul bloc donne un seul groupe', () => {
    expect(grouperBlocsParFormation([bloc()])).toEqual([{ formationName: 'CAP Restauration', blocs: [bloc()] }]);
  });

  it('liste vide → aucun groupe, sans planter', () => {
    expect(grouperBlocsParFormation([])).toEqual([]);
  });
});

describe('nomsDeMatieresConnus — autocomplétion, sans catalogue séparé', () => {
  it('renvoie les noms uniques, triés, sans les vider deux fois', () => {
    const m = [
      matiere({ id: 'a', name: 'Anglais' }),
      matiere({ id: 'b', name: 'Français' }),
      matiere({ id: 'c', name: 'anglais' }),   // même nom, casse différente : PAS dédoublonné ici (c'est nomMatiereDejaPris qui l'empêche à la saisie)
    ];
    expect(nomsDeMatieresConnus(m)).toEqual(['anglais', 'Anglais', 'Français'].sort((a, b) => a.localeCompare(b, 'fr')));
  });
  it('ignore les noms vides et ne plante pas sur une liste vide', () => {
    expect(nomsDeMatieresConnus([matiere({ name: '   ' })])).toEqual([]);
    expect(nomsDeMatieresConnus([])).toEqual([]);
  });
});

describe('duplication d\'une formation entière — export/import garde le niveau d\'entrée', () => {
  it('niveauEntree traverse un export puis un import sans perte', () => {
    const b = [bloc({ niveauEntree: 'CM2 à 4e secondaire' })];
    const exporté = construireExport(b, [], []);
    expect(exporté.blocs[0].niveauEntree).toBe('CM2 à 4e secondaire');
    const relu = analyserImport(JSON.parse(JSON.stringify(exporté)));
    expect(relu?.blocs[0].niveauEntree).toBe('CM2 à 4e secondaire');
  });
});
