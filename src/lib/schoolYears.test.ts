import { describe, it, expect } from 'vitest';
import { findPreviousSchoolYear, filterAccountsToCurrentYear } from './schoolYears';

// ════════════════════════════════════════════════════════════════════════════
// PASSAGE D'UNE ANNÉE SCOLAIRE À L'AUTRE. Deux dégâts possibles :
//   • reporter la mauvaise grille tarifaire (des frais vieux de cinq ans) ;
//   • laisser traîner les comptes des élèves et profs partis, qu'on ne peut ni
//     gérer ni supprimer, et qui laissent croire qu'ils ont encore accès.
// ════════════════════════════════════════════════════════════════════════════

const year = (id: string, startDate: string) => ({ id, startDate });

const YEARS = [
  year('2023-2024', '2023-10-01'),
  year('2024-2025', '2024-10-01'),
  year('2025-2026', '2025-10-01'),
  year('2026-2027', '2026-10-01'),
];

describe('findPreviousSchoolYear', () => {
  it('rend l\'année IMMÉDIATEMENT précédente, pas la plus ancienne', () => {
    // Reporter les tarifs de 2023 sur 2026 serait invisible et coûteux.
    expect(findPreviousSchoolYear(YEARS, year('2026-2027', '2026-10-01'))?.id).toBe('2025-2026');
  });

  it('ne rend rien pour la toute première année de l\'école', () => {
    expect(findPreviousSchoolYear(YEARS, year('2023-2024', '2023-10-01'))).toBeUndefined();
  });

  it('ne se laisse pas influencer par l\'ordre de la liste', () => {
    const desordre = [YEARS[2], YEARS[0], YEARS[3], YEARS[1]];
    expect(findPreviousSchoolYear(desordre, year('2026-2027', '2026-10-01'))?.id).toBe('2025-2026');
  });

  it('IGNORE les années futures', () => {
    expect(findPreviousSchoolYear(YEARS, year('2024-2025', '2024-10-01'))?.id).toBe('2023-2024');
  });

  it('saute un trou dans l\'historique (une année sans exercice)', () => {
    const avecTrou = [year('2021-2022', '2021-10-01'), year('2025-2026', '2025-10-01')];
    expect(findPreviousSchoolYear(avecTrou, year('2025-2026', '2025-10-01'))?.id).toBe('2021-2022');
  });

  it('ne plante pas sans année courante ni sans historique', () => {
    expect(findPreviousSchoolYear(YEARS, null)).toBeUndefined();
    expect(findPreviousSchoolYear(YEARS, undefined)).toBeUndefined();
    expect(findPreviousSchoolYear([], year('2025-2026', '2025-10-01'))).toBeUndefined();
  });

  it('n\'inclut jamais l\'année courante elle-même', () => {
    const prev = findPreviousSchoolYear(YEARS, year('2025-2026', '2025-10-01'));
    expect(prev?.id).not.toBe('2025-2026');
  });
});

describe('filterAccountsToCurrentYear', () => {
  const account = (role: 'student' | 'teacher', enrollmentId: string | null, id = 'a') =>
    ({ id, role,
       studentEnrollmentId: role === 'student' ? enrollmentId : null,
       teacherEnrollmentId: role === 'teacher' ? enrollmentId : null });

  it('garde les comptes inscrits cette année', () => {
    const accounts = [account('student', 'enr-1'), account('teacher', 'tea-1', 'b')];
    expect(filterAccountsToCurrentYear(accounts, ['enr-1'], ['tea-1'])).toHaveLength(2);
  });

  it('RETIRE l\'élève d\'une année passée — le compte fantôme signalé', () => {
    const accounts = [account('student', 'enr-vieux')];
    expect(filterAccountsToCurrentYear(accounts, ['enr-1'], [])).toEqual([]);
  });

  it('fait réapparaître une personne réinscrite (nouvelle inscription)', () => {
    const accounts = [account('student', 'enr-2026')];
    expect(filterAccountsToCurrentYear(accounts, ['enr-2026'], [])).toHaveLength(1);
  });

  it('retire aussi les professeurs des années passées', () => {
    expect(filterAccountsToCurrentYear([account('teacher', 'tea-vieux')], [], ['tea-1'])).toEqual([]);
  });

  it('retire un compte sans inscription rattachée', () => {
    expect(filterAccountsToCurrentYear([account('student', null)], ['enr-1'], [])).toEqual([]);
  });

  it('NE CONFOND PAS les identifiants d\'élève et de professeur', () => {
    // Même valeur des deux côtés : chaque rôle doit regarder SA liste.
    const accounts = [account('student', 'id-partage'), account('teacher', 'id-partage', 'b')];
    const gardes = filterAccountsToCurrentYear(accounts, ['id-partage'], []);
    expect(gardes.map(a => a.role)).toEqual(['student']);
  });

  it('ne garde rien quand aucune inscription n\'existe pour l\'année', () => {
    const accounts = [account('student', 'enr-1'), account('teacher', 'tea-1', 'b')];
    expect(filterAccountsToCurrentYear(accounts, [], [])).toEqual([]);
  });

  it('préserve l\'ordre des comptes restants', () => {
    const accounts = [
      account('student', 'e1', 'a'), account('student', 'vieux', 'b'), account('student', 'e2', 'c'),
    ];
    expect(filterAccountsToCurrentYear(accounts, ['e1', 'e2'], []).map(a => a.id)).toEqual(['a', 'c']);
  });
});
