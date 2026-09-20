import { describe, it, expect } from 'vitest';
import {
  resolveAcademicProfile, getUnresolvedChoiceGroups, occurrencesDeLaMatiere,
  lignesReglageManuel, appliquerReglageLocal,
} from './academicProfile';
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
  opts?: { activeOnly?: boolean; inclureDesactivees?: boolean },
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

// ════════════════════════════════════════════════════════════════════════════
// LE BUG : on désactivait l'EPS pour un élève, et la matière DISPARAISSAIT de son
// profil — impossible de la réactiver. Le profil ne listait que les matières
// actives : celle qu'on venait d'éteindre sortait de la liste avec son interrupteur.
// ════════════════════════════════════════════════════════════════════════════
describe('resolveAcademicProfile — une matière désactivée reste réactivable', () => {
  const eps = subject('m1', 'EPS');

  it('LE CAS RÉEL : l\'EPS dispensé RESTE dans la liste, marqué désactivé', () => {
    const rows = run([eps, subject('m2', 'Maths')], settingsFor({ m1: { active: false, overrideReason: 'manual' } }),
      { inclureDesactivees: true });
    expect(rows.map(r => r.subject.name)).toEqual(['EPS', 'Maths']);
    const ligne = rows.find(r => r.subject.name === 'EPS')!;
    expect(ligne.active).toBe(false);
    expect(ligne.desactivee).toBe(true);
  });

  it('… même sans trace « manuelle » : une obligatoire inactive est forcément une dispense', () => {
    const rows = run([eps], settingsFor({ m1: { active: false } }), { inclureDesactivees: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].desactivee).toBe(true);
  });

  it('une fois réactivée, elle redevient une ligne ordinaire', () => {
    const rows = run([eps], settingsFor({ m1: { active: true, overrideReason: 'manual' } }), { inclureDesactivees: true });
    expect(rows[0].active).toBe(true);
    expect(rows[0].desactivee).toBe(false);
  });

  it('en revanche, une facultative JAMAIS souscrite ne s\'affiche pas parmi les « désactivées »', () => {
    // Sinon le profil listerait tout le catalogue de la classe, et un clic
    // activerait Latin, Grec, Espagnol, Allemand pour un élève qui n\'y a pas droit.
    const rows = run([subject('m1', 'Latin', { subjectType: 'facultative' }), subject('m2', 'Espagnol', { subjectType: 'choix' })],
      none, { inclureDesactivees: true });
    expect(rows).toEqual([]);
  });

  it('une facultative souscrite puis éteinte à la main, elle, reste réactivable', () => {
    const rows = run([subject('m1', 'Latin', { subjectType: 'facultative' })],
      settingsFor({ m1: { active: false, overrideReason: 'manual' } }), { inclureDesactivees: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].desactivee).toBe(true);
  });

  it('sans l\'option, le comportement historique est inchangé (les autres écrans n\'y voient rien)', () => {
    const rows = run([eps, subject('m2', 'Maths')], settingsFor({ m1: { active: false } }));
    expect(rows.map(r => r.subject.name)).toEqual(['Maths']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// UNE MATIÈRE EXISTE UNE FOIS PAR PÉRIODE. Éteindre l'EPS pour un élève doit
// l'éteindre partout ; sinon elle reste comptée dans les autres bulletins.
// ════════════════════════════════════════════════════════════════════════════
describe('resolveAcademicProfile — toutes les périodes', () => {
  const eps1 = subject('m1', 'EPS');
  const eps2 = subject('m2', 'EPS', { periodId: 'p2' });

  it('active seulement si elle l\'est dans TOUTES les périodes', () => {
    const rows = run([eps1, eps2], settingsFor({ m2: { active: false } }), { inclureDesactivees: true });
    expect(rows[0].active).toBe(false);
  });

  it('un réglage posé sur la SECONDE période seulement n\'est pas ignoré (avant, seule la première comptait)', () => {
    const rows = run([eps1, eps2], settingsFor({ m2: { active: false, overrideReason: 'manual' } }), { inclureDesactivees: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].desactivee || rows[0].partielle).toBe(true);
  });

  it('signale un réglage DIFFÉRENT selon les périodes, pour que l\'école le voie', () => {
    const rows = run([eps1, eps2], settingsFor({ m1: { active: true }, m2: { active: false } }), { inclureDesactivees: true });
    expect(rows[0].partielle).toBe(true);
  });

  it('cohérent partout : pas signalé', () => {
    const tout = run([eps1, eps2], settingsFor({ m1: { active: false }, m2: { active: false } }), { inclureDesactivees: true });
    expect(tout[0].partielle).toBe(false);
    const rien = run([eps1, eps2], none, { inclureDesactivees: true });
    expect(rien[0].partielle).toBe(false);
  });

  it('expose toutes les occurrences, pour que le réglage les atteigne toutes', () => {
    const rows = run([eps1, eps2], none, { inclureDesactivees: true });
    expect(rows[0].occurrenceIds.sort()).toEqual(['m1', 'm2']);
  });
});

describe('occurrencesDeLaMatiere', () => {
  const subjects = [
    subject('m1', 'EPS'), subject('m2', 'EPS', { periodId: 'p2' }),
    subject('m3', 'Maths'),
    subject('m4', 'EPS', { classId: 'autre' }),                         // autre classe
    subject('m5', 'EPS', { periodId: 'p9' }),                           // autre année
  ];
  const periodes = [...PERIODS, period('p9', { academicYearLabel: '2024-2025' })];

  it('toutes les périodes de la MÊME classe et de la MÊME année', () => {
    expect(occurrencesDeLaMatiere(subjects, periodes, 'm1').map(s => s.id).sort()).toEqual(['m1', 'm2']);
    expect(occurrencesDeLaMatiere(subjects, periodes, 'm2').map(s => s.id).sort()).toEqual(['m1', 'm2']);
  });

  it('jamais une autre classe, ni une autre année', () => {
    const ids = occurrencesDeLaMatiere(subjects, periodes, 'm1').map(s => s.id);
    expect(ids).not.toContain('m4');
    expect(ids).not.toContain('m5');
  });

  it('une matière inconnue : liste vide, sans lever', () => {
    expect(occurrencesDeLaMatiere(subjects, periodes, 'inconnue')).toEqual([]);
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

// ════════════════════════════════════════════════════════════════════════════
// L'ÉCRITURE : désactiver / réactiver doit atteindre TOUTES les périodes, et un
// coefficient personnalisé ne doit pas disparaître au passage.
// ════════════════════════════════════════════════════════════════════════════
describe('lignesReglageManuel', () => {
  const base = { schoolId: 's1', studentEnrollmentId: STUDENT, occurrenceIds: ['m1', 'm2', 'm3'], active: false, maintenant: '2026-09-20T10:00:00Z' };

  it('UNE ligne par occurrence : le réglage atteint toutes les périodes', () => {
    const lignes = lignesReglageManuel(base);
    expect(lignes.map(l => l.subject_id)).toEqual(['m1', 'm2', 'm3']);
    for (const l of lignes) expect(l).toMatchObject({ school_id: 's1', student_enrollment_id: STUDENT, active: false, override_reason: 'manual' });
  });

  it('sans coefficient fourni : la colonne n\'est PAS envoyée, donc un coefficient personnalisé survit', () => {
    for (const l of lignesReglageManuel(base)) expect('custom_coefficient' in l).toBe(false);
  });

  it('coefficient fourni : posé, décimal accepté', () => {
    expect(lignesReglageManuel({ ...base, customCoef: '1.5' })[0].custom_coefficient).toBe(1.5);
  });

  it('coefficient vidé : retiré (retour à celui de la matière)', () => {
    expect(lignesReglageManuel({ ...base, customCoef: '' })[0].custom_coefficient).toBeNull();
  });

  it('réactiver ne touche pas non plus au coefficient', () => {
    const lignes = lignesReglageManuel({ ...base, active: true });
    expect(lignes.every(l => l.active && !('custom_coefficient' in l))).toBe(true);
  });
});

describe('appliquerReglageLocal', () => {
  const ligne = (subjectId: string, studentSettings: Record<string, StudentSubjectSetting> = {}): SubjectSettingsData => ({
    id: 'x', subjectId, devoir1Active: true, devoir2Active: true, devoir3Active: true,
    devoir4Active: false, devoir5Active: false, studentSettings,
  });

  it('pose le réglage sur CHAQUE occurrence, existante ou non', () => {
    const suite = appliquerReglageLocal([ligne('m1')], ['m1', 'm2'], STUDENT, false);
    expect(suite.map(s => s.subjectId)).toEqual(['m1', 'm2']);
    for (const s of suite) expect(s.studentSettings[STUDENT]).toMatchObject({ active: false, overrideReason: 'manual' });
  });

  it('CONSERVE le coefficient personnalisé quand on n\'en fournit pas', () => {
    const avant = [ligne('m1', { [STUDENT]: { active: true, customCoef: '3', overrideReason: 'manual' } })];
    const apres = appliquerReglageLocal(avant, ['m1'], STUDENT, false);
    expect(apres[0].studentSettings[STUDENT].customCoef).toBe('3');
    // … et réactiver le retrouve intact.
    expect(appliquerReglageLocal(apres, ['m1'], STUDENT, true)[0].studentSettings[STUDENT])
      .toMatchObject({ active: true, customCoef: '3' });
  });

  it('un coefficient fourni remplace l\'ancien', () => {
    const avant = [ligne('m1', { [STUDENT]: { active: true, customCoef: '3' } })];
    expect(appliquerReglageLocal(avant, ['m1'], STUDENT, true, '1.5')[0].studentSettings[STUDENT].customCoef).toBe('1.5');
  });

  it('ne touche PAS aux réglages des autres élèves', () => {
    const avant = [ligne('m1', { 'enr-autre': { active: false, customCoef: '2' } })];
    const apres = appliquerReglageLocal(avant, ['m1'], STUDENT, false);
    expect(apres[0].studentSettings['enr-autre']).toEqual({ active: false, customCoef: '2' });
  });

  it('ne modifie pas l\'état précédent (React compare les références)', () => {
    const avant = [ligne('m1')];
    const copie = JSON.stringify(avant);
    appliquerReglageLocal(avant, ['m1', 'm2'], STUDENT, false);
    expect(JSON.stringify(avant)).toBe(copie);
  });

  it('garde l\'ordre d\'origine, les nouvelles entrées à la fin', () => {
    const suite = appliquerReglageLocal([ligne('b'), ligne('a')], ['a', 'c'], STUDENT, false);
    expect(suite.map(s => s.subjectId)).toEqual(['b', 'a', 'c']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Le cycle complet que l'école vit : désactiver, retrouver la matière, réactiver.
// ════════════════════════════════════════════════════════════════════════════
describe('le cycle complet : désactiver l\'EPS, la retrouver, la réactiver', () => {
  const subjects = [subject('e1', 'EPS'), subject('e2', 'EPS', { periodId: 'p2' }), subject('m1', 'Maths')];

  it('elle reste dans le profil à chaque étape, à toutes les périodes', () => {
    let reglages: SubjectSettingsData[] = [];
    const lecteur = (id: string) => reglages.find(r => r.subjectId === id);
    const profil = () => resolveAcademicProfile(subjects, PERIODS, lecteur, STUDENT, CLASS, YEAR, { inclureDesactivees: true });

    expect(profil().find(r => r.subject.name === 'EPS')!.active).toBe(true);

    // 1. on la désactive (comme l'interrupteur du profil)
    reglages = appliquerReglageLocal(reglages, ['e1', 'e2'], STUDENT, false);
    const eteinte = profil().find(r => r.subject.name === 'EPS');
    expect(eteinte, 'la matière a DISPARU du profil').toBeDefined();
    expect(eteinte!.active).toBe(false);
    expect(eteinte!.desactivee).toBe(true);
    expect(eteinte!.partielle).toBe(false);

    // 2. les autres matières ne bougent pas
    expect(profil().find(r => r.subject.name === 'Maths')!.active).toBe(true);

    // 3. on la réactive : c'est possible, puisqu'elle est encore là
    reglages = appliquerReglageLocal(reglages, eteinte!.occurrenceIds, STUDENT, true);
    const retrouvee = profil().find(r => r.subject.name === 'EPS')!;
    expect(retrouvee.active).toBe(true);
    expect(retrouvee.desactivee).toBe(false);
  });

  it('la liste « active seulement » (autres écrans) ne montre plus la matière éteinte, et la retrouve réactivée', () => {
    let reglages: SubjectSettingsData[] = [];
    const lecteur = (id: string) => reglages.find(r => r.subjectId === id);
    const actives = () => resolveAcademicProfile(subjects, PERIODS, lecteur, STUDENT, CLASS, YEAR).map(r => r.subject.name);
    reglages = appliquerReglageLocal(reglages, ['e1', 'e2'], STUDENT, false);
    expect(actives()).toEqual(['Maths']);
    reglages = appliquerReglageLocal(reglages, ['e1', 'e2'], STUDENT, true);
    expect(actives()).toEqual(['EPS', 'Maths']);
  });
});
