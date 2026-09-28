import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// La case « dernier trimestre/semestre » des bulletins se coche d'après
// Paramètres → Scolarité : la décision finale tombe sur le bon bulletin, et
// jamais sur le 1er trimestre d'une année dont les suivants n'existent pas encore.
// ════════════════════════════════════════════════════════════════════════════

let settings: Record<string, unknown> = {};
let liaisons: { periodId: string; classId: string }[] = [];
const periode = (id: string, ordering: number, type = 'semester', annee = '2026-2027') =>
  ({ id, name: id, type, ordering, academicYearLabel: annee, createdAt: new Date() });
const periodes = [
  periode('T1', 1), periode('T2', 2), periode('T3', 3),
  periode('EXAM', 4, 'exam'),
  periode('ANCIEN', 9, 'semester', '2025-2026'),
];
const classes = [
  { id: 'ce1', name: 'CE1 A', niveau: 'CE1', studentLimit: 30, createdAt: new Date() },
  { id: '4e', name: '4ème A', niveau: '4ème', studentLimit: 30, createdAt: new Date() },
  { id: 'mat', name: 'Maternelle', studentLimit: 30, createdAt: new Date() },
];

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { settings } }) }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    classes, gradePeriods: periodes,
    isClassInPeriod: (p: string, c: string) => liaisons.some(l => l.periodId === p && l.classId === c),
  }),
}));

import { useFinDAnnee } from './useConfigScolarite';

const fin = (periodId: string, classId: string) => renderHook(() => useFinDAnnee(periodId, classId)).result.current;

beforeEach(() => {
  settings = {};
  liaisons = [
    ...['T1', 'T2', 'T3'].map(p => ({ periodId: p, classId: 'ce1' })),
    ...['T1', 'T2'].map(p => ({ periodId: p, classId: '4e' })),
  ];
});

describe('bulletins : fin d’année selon Paramètres → Scolarité', () => {
  it('élémentaire (3 trimestres par défaut) : décision au 3e trimestre seulement, à 5/10', () => {
    expect(fin('T1', 'ce1')).toMatchObject({ rang: 1, total: 3, nom: 'trimestre', estDerniere: false, seuil: 5, bareme: 10 });
    expect(fin('T2', 'ce1')?.estDerniere).toBe(false);
    expect(fin('T3', 'ce1')).toMatchObject({ rang: 3, estDerniere: true });
  });

  it('collège (2 semestres par défaut) : décision au 2e semestre, à 10/20', () => {
    expect(fin('T1', '4e')).toMatchObject({ rang: 1, total: 2, nom: 'semestre', estDerniere: false, seuil: 10, bareme: 20 });
    expect(fin('T2', '4e')?.estDerniere).toBe(true);
  });

  it('suit la configuration enregistrée : collège passé en 3 trimestres à 12/20', () => {
    settings = { configScolarite: { college: { periodes: 3, seuil: 12 } } };
    expect(fin('T2', '4e')).toMatchObject({ rang: 2, total: 3, estDerniere: false, seuil: 12 });
  });

  it('le rang ne compte que les périodes de CETTE classe, de CETTE année, hors examens', () => {
    // La 4ème ne suit que T1 et T2 ; T3, l'examen et l'année passée ne comptent pas.
    liaisons.push({ periodId: 'EXAM', classId: '4e' }, { periodId: 'ANCIEN', classId: '4e' });
    expect(fin('T2', '4e')).toMatchObject({ rang: 2, estDerniere: true });
  });

  it('pas de décision pour une période d’examen ni pour une classe sans niveau', () => {
    expect(fin('EXAM', 'ce1')).toBeNull();
    expect(fin('T3', 'mat')).toBeNull();
  });
});
