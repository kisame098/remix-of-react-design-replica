import { describe, it, expect } from 'vitest';
import { resolveAcademicProfile, getUnresolvedChoiceGroups } from './academicProfile';
import type {
  Subject, SubjectSettingsData, StudentSubjectSetting, GradePeriod, SchoolClass,
  FiliereChoiceGroup, ClassFiliereAssignment, FiliereStudentChoice,
} from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// PROFIL ACADÉMIQUE — quelles matières l'élève suit réellement, avec quel
// coefficient. Une matière active en trop pèse de son coefficient dans la
// moyenne ; une matière manquante disparaît du bulletin. Les deux se voient
// seulement au moment d'imprimer les bulletins, en fin de semestre.
// ════════════════════════════════════════════════════════════════════════════

const YEAR = '2025-2026';
const CLASS = 'cls-1';
const STUDENT = 'enr-1';

const period = (id: string, over: Partial<GradePeriod> = {}): GradePeriod => ({
  id, name: id, type: 'semester', academicYearLabel: YEAR, ordering: 0,
  createdAt: new Date('2025-09-01'), ...over,
});

const PERIODS = [period('p1'), period('p2', { ordering: 1 })];

const subject = (id: string, name: string, over: Partial<Subject> = {}): Subject => ({
  id, name, coefficient: 2, classId: CLASS, periodId: 'p1', ordering: 0,
  subjectType: 'obligatoire', ...over,
});

/** Construit un lecteur de réglages : subjectId → réglage de CET élève. */
const settingsFor = (map: Record<string, StudentSubjectSetting>) =>
  (subjectId: string): SubjectSettingsData | undefined => {
    const s = map[subjectId];
    if (!s) return undefined;
    return {
      id: '', subjectId,
      devoir1Active: true, devoir2Active: true, devoir3Active: true,
      devoir4Active: false, devoir5Active: false,
      studentSettings: { [STUDENT]: s },
    };
  };

const none = () => undefined;

const run = (
  subjects: Subject[],
  getSettings = none as (id: string) => SubjectSettingsData | undefined,
  opts?: { activeOnly?: boolean },
) => resolveAcademicProfile(subjects, PERIODS, getSettings, STUDENT, CLASS, YEAR, opts);

describe('resolveAcademicProfile — matières actives', () => {
  it('active les matières obligatoires par défaut', () => {
    expect(run([subject('m1', 'Maths'), subject('m2', 'Français')]).map(r => r.subject.name))
      .toEqual(['Français', 'Maths']);
  });

  it('N\'ACTIVE PAS une matière au choix tant que l\'élève n\'a pas choisi', () => {
    // Sinon LV2 Espagnol ET LV2 Allemand compteraient toutes les deux.
    expect(run([subject('m1', 'Espagnol', { subjectType: 'choix' })])).toEqual([]);
  });

  it('N\'ACTIVE PAS une facultative non souscrite', () => {
    expect(run([subject('m1', 'Latin', { subjectType: 'facultative' })])).toEqual([]);
  });

  it('active un choix une fois résolu, et une facultative une fois souscrite', () => {
    const subjects = [
      subject('m1', 'Espagnol', { subjectType: 'choix' }),
      subject('m2', 'Latin', { subjectType: 'facultative' }),
    ];
    const rows = run(subjects, settingsFor({ m1: { active: true }, m2: { active: true } }));
    expect(rows.map(r => r.subject.name)).toEqual(['Espagnol', 'Latin']);
  });

  it('RETIRE une matière obligatoire dont l\'élève est dispensé', () => {
    const rows = run([subject('m1', 'EPS'), subject('m2', 'Maths')],
      settingsFor({ m1: { active: false } }));
    expect(rows.map(r => r.subject.name)).toEqual(['Maths']);
  });

  it('peut rendre AUSSI les matières inactives quand on le demande (écran de réglage)', () => {
    const rows = run([subject('m1', 'EPS')], settingsFor({ m1: { active: false } }), { activeOnly: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(false);
  });
});

describe('resolveAcademicProfile — coefficients', () => {
  it('prend le coefficient de la matière par défaut', () => {
    expect(run([subject('m1', 'Maths', { coefficient: 5 })])[0].coefficient).toBe(5);
  });

  it('applique un coefficient personnalisé pour cet élève', () => {
    expect(run([subject('m1', 'Maths', { coefficient: 5 })],
      settingsFor({ m1: { active: true, customCoef: '7' } }))[0].coefficient).toBe(7);
  });

  it('retombe sur le coefficient de la matière si l\'exception est vide', () => {
    expect(run([subject('m1', 'Maths', { coefficient: 5 })],
      settingsFor({ m1: { active: true, customCoef: '' } }))[0].coefficient).toBe(5);
  });

  it('accepte un coefficient décimal (0,5)', () => {
    expect(run([subject('m1', 'Maths')],
      settingsFor({ m1: { active: true, customCoef: '0.5' } }))[0].coefficient).toBe(0.5);
  });
});

describe('resolveAcademicProfile — provenance affichée', () => {
  it('nomme la provenance de chaque ligne', () => {
    const subjects = [
      subject('m1', 'Maths'),
      subject('m2', 'Espagnol', { subjectType: 'choix' }),
      subject('m3', 'Latin', { subjectType: 'facultative' }),
      subject('m4', 'EPS'),
    ];
    const rows = run(subjects, settingsFor({
      m2: { active: true }, m3: { active: true },
      m4: { active: true, overrideReason: 'manual' },
    }));
    const bySubject = Object.fromEntries(rows.map(r => [r.subject.name, r.source]));
    expect(bySubject).toEqual({
      Maths: 'Hérité du cursus',
      Espagnol: 'Choix résolu',
      Latin: 'Facultative',
      EPS: 'Exception manuelle',
    });
  });

  it('une exception manuelle prime sur le type de la matière dans l\'affichage', () => {
    const rows = run([subject('m1', 'Latin', { subjectType: 'facultative' })],
      settingsFor({ m1: { active: true, overrideReason: 'manual' } }));
    expect(rows[0].source).toBe('Exception manuelle');
  });
});

describe('resolveAcademicProfile — périmètre', () => {
  it('N\'AFFICHE QU\'UNE FOIS une matière matérialisée dans chaque période', () => {
    // Maths existe en p1 ET p2 : le profil ne doit pas la lister deux fois.
    const rows = run([subject('m1', 'Maths'), subject('m2', 'Maths', { periodId: 'p2' })]);
    expect(rows).toHaveLength(1);
  });

  it('ignore les matières d\'une autre classe', () => {
    expect(run([subject('m1', 'Maths', { classId: 'autre' })])).toEqual([]);
  });

  it('ignore les matières d\'une autre année scolaire', () => {
    const vieille = [period('p9', { academicYearLabel: '2024-2025' })];
    const rows = resolveAcademicProfile(
      [subject('m1', 'Maths', { periodId: 'p9' })], vieille, none, STUDENT, CLASS, YEAR);
    expect(rows).toEqual([]);
  });

  it('ne rend rien pour un élève sans classe ou sans année', () => {
    expect(resolveAcademicProfile([subject('m1', 'Maths')], PERIODS, none, STUDENT, null, YEAR)).toEqual([]);
    expect(resolveAcademicProfile([subject('m1', 'Maths')], PERIODS, none, STUDENT, CLASS, null)).toEqual([]);
  });

  it('ne fait pas déborder le réglage d\'un élève sur un autre', () => {
    const getSettings = (subjectId: string): SubjectSettingsData | undefined =>
      subjectId === 'm1' ? {
        id: '', subjectId,
        devoir1Active: true, devoir2Active: true, devoir3Active: true,
        devoir4Active: false, devoir5Active: false,
        studentSettings: { 'un-autre-eleve': { active: false } },
      } : undefined;
    // L'élève courant n'a pas de dispense : la matière reste active pour lui.
    expect(run([subject('m1', 'EPS')], getSettings).map(r => r.subject.name)).toEqual(['EPS']);
  });

  it('classe les matières par ordre alphabétique', () => {
    const rows = run([subject('m1', 'SVT'), subject('m2', 'Anglais'), subject('m3', 'Maths')]);
    expect(rows.map(r => r.subject.name)).toEqual(['Anglais', 'Maths', 'SVT']);
  });
});

// ════════════════════════════════════════════════════════════════════════════

describe('getUnresolvedChoiceGroups', () => {
  const cls: SchoolClass = { id: CLASS, name: 'Tle S1', niveau: 'Tle', studentLimit: 40 } as SchoolClass;
  const assignment: ClassFiliereAssignment =
    { id: 'a1', classId: CLASS, academicYearLabel: YEAR, filiereId: 'f-S1' };

  const group = (id: string, label: string, niveau = ''): FiliereChoiceGroup =>
    ({ id, filiereId: 'f-S1', niveau, label, coefficient: 2, ordering: 0, options: [] });

  const choice = (choiceGroupId: string, studentEnrollmentId = STUDENT): FiliereStudentChoice =>
    ({ id: `c-${choiceGroupId}`, classFiliereAssignmentId: 'a1', choiceGroupId,
       studentEnrollmentId, chosenSubjectName: 'Espagnol', chosenBy: 'eleve' });

  const run = (groups: FiliereChoiceGroup[], choices: FiliereStudentChoice[]) =>
    getUnresolvedChoiceGroups([cls], [assignment], groups, choices, STUDENT, CLASS, YEAR);

  it('signale un créneau que l\'élève n\'a pas encore tranché', () => {
    expect(run([group('g1', 'LV2')], []).map(g => g.label)).toEqual(['LV2']);
  });

  it('ne signale plus un créneau une fois le choix posé', () => {
    expect(run([group('g1', 'LV2')], [choice('g1')])).toEqual([]);
  });

  it('ne considère PAS le choix d\'un autre élève comme le sien', () => {
    expect(run([group('g1', 'LV2')], [choice('g1', 'un-autre')]).map(g => g.label)).toEqual(['LV2']);
  });

  it('signale plusieurs créneaux restants à la fois', () => {
    const groups = [group('g1', 'LV2'), group('g2', 'Spécialité')];
    expect(run(groups, [choice('g1')]).map(g => g.label)).toEqual(['Spécialité']);
  });

  it('ne signale rien quand la classe n\'a pas de filière assignée', () => {
    expect(getUnresolvedChoiceGroups([cls], [], [group('g1', 'LV2')], [], STUDENT, CLASS, YEAR)).toEqual([]);
  });

  it('ne signale rien pour une classe sans niveau ou inconnue', () => {
    const sansNiveau = { ...cls, niveau: undefined } as SchoolClass;
    expect(getUnresolvedChoiceGroups([sansNiveau], [assignment], [group('g1', 'LV2')], [], STUDENT, CLASS, YEAR)).toEqual([]);
    expect(getUnresolvedChoiceGroups([], [assignment], [group('g1', 'LV2')], [], STUDENT, CLASS, YEAR)).toEqual([]);
  });

  it('applique la fusion base/niveau : un créneau redéfini en Tle remplace celui de base', () => {
    const groups = [group('g-base', 'LV2'), group('g-tle', 'LV2', 'Tle')];
    // Un seul créneau LV2 subsiste après fusion — celui du niveau.
    const unresolved = run(groups, []);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].id).toBe('g-tle');
  });

  it('ne signale rien pour une assignation d\'une autre année', () => {
    const vieille = { ...assignment, academicYearLabel: '2024-2025' };
    expect(getUnresolvedChoiceGroups([cls], [vieille], [group('g1', 'LV2')], [], STUDENT, CLASS, YEAR)).toEqual([]);
  });
});
