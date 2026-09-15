import { describe, it, expect } from 'vitest';
import {
  mergeFiliereMandatorySubjects,
  mergeFiliereFacultativeSubjects,
  mergeFiliereChoiceGroups,
  type FiliereMandatorySubject,
  type FiliereFacultativeSubject,
  type FiliereChoiceGroup,
} from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// FILIÈRES (2nde → Terminale) — une filière (S1, S2, L2…) porte des matières
// communes à tous ses niveaux (niveau '' = base) et quelques exceptions par
// niveau : la Philosophie n'existe qu'en Terminale, un coefficient change en
// 1ère, etc.
//
// Ce qui sort d'ici décide QUELLES MATIÈRES existent pour une classe — donc ce
// qui entre dans la moyenne générale et sur le bulletin. Une fusion ratée fait
// disparaître une matière d'un bulletin, ou lui donne le coefficient d'un autre
// niveau.
// ════════════════════════════════════════════════════════════════════════════

const BASE = '';
const F = 'filiere-S1';

const mand = (name: string, niveau: string, coefficient: number, ordering = 0): FiliereMandatorySubject =>
  ({ id: `${name}-${niveau}`, filiereId: F, niveau, name, coefficient, ordering });

const fac = (name: string, niveau: string, coefficient: number, ordering = 0): FiliereFacultativeSubject =>
  ({ id: `${name}-${niveau}`, filiereId: F, niveau, name, coefficient, ordering } as FiliereFacultativeSubject);

const group = (label: string, niveau: string, coefficient: number, ordering = 0): FiliereChoiceGroup =>
  ({ id: `${label}-${niveau}`, filiereId: F, niveau, label, coefficient, ordering, options: [] });

describe('mergeFiliereMandatorySubjects', () => {
  it('applique les matières de base à tous les niveaux', () => {
    const all = [mand('Maths', BASE, 5), mand('Français', BASE, 3)];
    for (const niveau of ['2nde', '1ère', 'Tle']) {
      expect(mergeFiliereMandatorySubjects(all, F, niveau).map(m => m.name).sort())
        .toEqual(['Français', 'Maths']);
    }
  });

  it('AJOUTE une matière qui n\'existe qu\'à un niveau (Philosophie en Terminale)', () => {
    const all = [mand('Maths', BASE, 5), mand('Philosophie', 'Tle', 2)];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle').map(m => m.name)).toContain('Philosophie');
    expect(mergeFiliereMandatorySubjects(all, F, '1ère').map(m => m.name)).not.toContain('Philosophie');
  });

  it('REDÉFINIT le coefficient de base quand le niveau en donne un autre', () => {
    const all = [mand('Maths', BASE, 5), mand('Maths', 'Tle', 7)];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle')[0].coefficient).toBe(7);
    expect(mergeFiliereMandatorySubjects(all, F, '1ère')[0].coefficient).toBe(5);
  });

  it('ne garde qu\'une seule ligne par matière après redéfinition', () => {
    const all = [mand('Maths', BASE, 5), mand('Maths', 'Tle', 7)];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle')).toHaveLength(1);
  });

  it('applique la redéfinition quel que soit l\'ordre des lignes en entrée', () => {
    // Le niveau doit gagner même s'il est lu AVANT la base.
    const inverse = [mand('Maths', 'Tle', 7), mand('Maths', BASE, 5)];
    expect(mergeFiliereMandatorySubjects(inverse, F, 'Tle')[0].coefficient).toBe(7);
  });

  it('ignore les matières d\'une autre filière', () => {
    const all = [mand('Maths', BASE, 5), { ...mand('Latin', BASE, 2), filiereId: 'filiere-L2' }];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle').map(m => m.name)).toEqual(['Maths']);
  });

  it('ignore les matières d\'un autre niveau', () => {
    const all = [mand('SVT', '2nde', 4)];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle')).toEqual([]);
  });

  it('respecte l\'ordre d\'affichage demandé', () => {
    const all = [mand('Anglais', BASE, 2, 3), mand('Maths', BASE, 5, 1), mand('Français', BASE, 3, 2)];
    expect(mergeFiliereMandatorySubjects(all, F, 'Tle').map(m => m.name))
      .toEqual(['Maths', 'Français', 'Anglais']);
  });

  it('rend une liste vide pour une filière sans matière', () => {
    expect(mergeFiliereMandatorySubjects([], F, 'Tle')).toEqual([]);
  });
});

describe('mergeFiliereFacultativeSubjects', () => {
  it('fusionne base et niveau comme les matières obligatoires', () => {
    const all = [fac('Latin', BASE, 1), fac('Latin', 'Tle', 2), fac('Informatique', 'Tle', 1)];
    const merged = mergeFiliereFacultativeSubjects(all, F, 'Tle');
    expect(merged.map(m => m.name).sort()).toEqual(['Informatique', 'Latin']);
    expect(merged.find(m => m.name === 'Latin')!.coefficient).toBe(2);
  });

  it('ne fait pas remonter une option d\'un niveau supérieur', () => {
    const all = [fac('Informatique', 'Tle', 1)];
    expect(mergeFiliereFacultativeSubjects(all, F, '2nde')).toEqual([]);
  });
});

describe('mergeFiliereChoiceGroups', () => {
  it('fusionne les créneaux de choix par LIBELLÉ (LV2, LV1…)', () => {
    const all = [group('LV2', BASE, 2), group('LV2', 'Tle', 3), group('LV1', BASE, 4)];
    const merged = mergeFiliereChoiceGroups(all, F, 'Tle');
    expect(merged).toHaveLength(2);
    expect(merged.find(g => g.label === 'LV2')!.coefficient).toBe(3);
  });

  it('ne confond pas deux créneaux de libellés différents', () => {
    const all = [group('LV1', BASE, 4, 1), group('LV2', BASE, 2, 2)];
    expect(mergeFiliereChoiceGroups(all, F, '1ère').map(g => g.label)).toEqual(['LV1', 'LV2']);
  });

  it('conserve les options du créneau retenu', () => {
    const withOptions: FiliereChoiceGroup = {
      ...group('LV2', 'Tle', 3),
      options: [
        { id: 'o1', choiceGroupId: 'LV2-Tle', subjectName: 'Espagnol', ordering: 1 },
        { id: 'o2', choiceGroupId: 'LV2-Tle', subjectName: 'Allemand', ordering: 2 },
      ],
    };
    const merged = mergeFiliereChoiceGroups([group('LV2', BASE, 2), withOptions], F, 'Tle');
    expect(merged[0].options.map(o => o.subjectName)).toEqual(['Espagnol', 'Allemand']);
  });

  it('rend une liste vide quand la filière n\'a aucun créneau', () => {
    expect(mergeFiliereChoiceGroups([], F, 'Tle')).toEqual([]);
  });
});

describe('cohérence des trois fusions', () => {
  it('les trois appliquent la même règle "le niveau l\'emporte sur la base"', () => {
    const niveau = '1ère';
    expect(mergeFiliereMandatorySubjects([mand('X', BASE, 1), mand('X', niveau, 9)], F, niveau)[0].coefficient).toBe(9);
    expect(mergeFiliereFacultativeSubjects([fac('X', BASE, 1), fac('X', niveau, 9)], F, niveau)[0].coefficient).toBe(9);
    expect(mergeFiliereChoiceGroups([group('X', BASE, 1), group('X', niveau, 9)], F, niveau)[0].coefficient).toBe(9);
  });
});
