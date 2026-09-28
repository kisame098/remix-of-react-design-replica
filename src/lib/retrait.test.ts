import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { estRetire, separerRetires, STATUT_RETIRE } from './retrait';

describe('retirer un élève ou un professeur', () => {
  it('seul `withdrawn` est retiré ; sans statut (ancien instantané), on reste présent', () => {
    expect(estRetire(STATUT_RETIRE)).toBe(true);
    expect(estRetire('active')).toBe(false);
    expect(estRetire(undefined)).toBe(false);
    expect(estRetire(null)).toBe(false);
  });

  it('sépare présents et retirés sans en perdre', () => {
    const r = separerRetires([{ id: 'a', status: 'active' }, { id: 'b', status: 'withdrawn' }, { id: 'c' }]);
    expect(r.actifs.map(i => i.id)).toEqual(['a', 'c']);
    expect(r.retires.map(i => i.id)).toEqual(['b']);
  });
});

describe('garde-fous : retirer n’efface jamais (les paiements partiraient en cascade)', () => {
  const contexte = readFileSync('src/contexts/SchoolContext.tsx', 'utf8');
  const sql = readFileSync('docs/sql/retrait_eleves_profs.sql', 'utf8');

  it('aucune suppression d’inscription ni de fiche dans le contexte', () => {
    expect(contexte).not.toMatch(/from\('student_enrollments'\)\s*\.delete\(/);
    expect(contexte).not.toMatch(/from\('teacher_enrollments'\)\s*\.delete\(/);
    expect(contexte).not.toMatch(/from\('student_profiles'\)\s*\.delete\(/);
    expect(contexte).not.toMatch(/from\('teacher_profiles'\)\s*\.delete\(/);
  });

  it('le compte de connexion suit le retrait', () => {
    expect(contexte).toMatch(/from\('school_accounts'\)\s*\n?\s*\.update\(\{ is_active: !retirer \}\)/);
  });

  it('les fonctions d’accès du portail exigent un compte actif', () => {
    for (const fn of ['get_my_student_enrollment_id', 'get_my_student_class_id', 'get_my_account_school_id', 'get_my_teacher_enrollment_id', 'get_my_portal_school_id']) {
      const corps = sql.split(`function public.${fn}()`)[1]?.split('$$;')[0] ?? '';
      expect(corps, fn).toMatch(/is_active/);
    }
  });
});
