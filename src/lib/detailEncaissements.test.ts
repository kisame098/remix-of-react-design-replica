import { describe, it, expect } from 'vitest';
import type { Payment } from '@/types/payment';
import {
  FILTRES_VIDES, filtrerEncaissements, lignesEncaissement, parClasse, parFrais, parMois, repartition,
} from './detailEncaissements';

// ════════════════════════════════════════════════════════════════════════════
// D'où vient l'argent encaissé : chaque franc doit tomber dans la bonne case.
// ════════════════════════════════════════════════════════════════════════════

const p = (id: string, eleve: string, over: Partial<Payment>): Payment => ({
  id, studentId: eleve, studentUniqueId: eleve, academicYearLabel: '2026-2027', type: 'tuition', amount: 0,
  method: 'especes', paidAt: '2026-10-05T10:00:00Z', status: 'confirmed', ...over,
} as Payment);

const paiements = [
  p('1', 'a', { type: 'inscription', amount: 25000 }),
  p('2', 'a', { type: 'tuition', monthKey: '2026-10', amount: 15000 }),
  p('3', 'b', { type: 'tuition', monthKey: '2026-10', amount: 15000, method: 'wave', paidAt: '2026-11-02T09:00:00Z' }),
  p('4', 'b', { type: 'service', serviceId: 'cantine', amount: 5000, paidAt: '2026-11-03T09:00:00Z' }),
  p('5', 'c', { type: 'inscription', amount: 30000 }),
  p('6', 'a', { type: 'tuition', monthKey: '2026-11', amount: 15000, status: 'cancelled' }),
];
const classes: Record<string, string> = { a: '6A', b: '6A', c: 'TleS' };
const cycles: Record<string, string> = { '6A': 'college', TleS: 'lycee' };
const lignes = lignesEncaissement(paiements, e => classes[e], c => cycles[c]);

describe('détail des encaissements', () => {
  it('un paiement annulé ne compte pas ; répartition par rubrique', () => {
    expect(lignes).toHaveLength(5);
    expect(repartition(lignes)).toEqual({ inscription: 55000, tuition: 30000, service: 5000, total: 90000 });
  });

  it('la classe 6A a payé 30 000 de mensualités (filtres combinés)', () => {
    const f = filtrerEncaissements(lignes, { ...FILTRES_VIDES, classe: '6A', rubrique: 'tuition' });
    expect(repartition(f).total).toBe(30000);
    expect(filtrerEncaissements(lignes, { ...FILTRES_VIDES, frais: 'tuition:2026-10', methode: 'wave' }).map(l => l.id)).toEqual(['3']);
    expect(repartition(filtrerEncaissements(lignes, { ...FILTRES_VIDES, groupe: 'lycee' })).total).toBe(30000);
  });

  it('filtre par période, bornes comprises', () => {
    expect(filtrerEncaissements(lignes, { ...FILTRES_VIDES, du: '2026-11-01', au: '2026-11-02' }).map(l => l.id)).toEqual(['3']);
  });

  it('par mois, par classe (élèves distincts), par frais', () => {
    expect(parMois(lignes).map(m => [m.mois, m.total])).toEqual([['2026-10', 70000], ['2026-11', 20000]]);
    expect(parClasse(lignes).get('6A')).toEqual({ inscription: 25000, tuition: 30000, service: 5000, total: 60000, eleves: 2 });
    expect(parFrais(lignes)[0]).toEqual({ frais: 'inscription', rubrique: 'inscription', total: 55000, paiements: 2 });
  });
});
