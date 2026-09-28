import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireMontantsParMois, mensualiteDuMois, personnalisationsAEnregistrer } from './mensualites';
import { buildPayableItems, computeDueItems } from './dueItems';
import { getAcademicMonths } from '@/types/payment';

// Une classe à 15 000 F par mois, octobre à 20 000 F et décembre offert (0 F).
const cfg = { inscriptionFee: 25_000, monthlyFee: 15_000, montantsParMois: { '2025-10': 20_000, '2025-12': 0 } };
const MONTHS = getAcademicMonths('2025-10-01', '2026-06-30');

describe('mensualité propre à chaque mois', () => {
  it('un mois personnalisé a son montant ; les autres suivent la mensualité', () => {
    expect(mensualiteDuMois(cfg, '2025-10')).toBe(20_000);
    expect(mensualiteDuMois(cfg, '2025-11')).toBe(15_000);
    expect(mensualiteDuMois({ monthlyFee: 15_000 }, '2025-10')).toBe(15_000);
  });

  it('seuls les mois différents de la mensualité sont enregistrés', () => {
    const r = personnalisationsAEnregistrer(15_000, { '2025-10': '20000', '2025-11': '15000', '2025-12': '' });
    expect(r).toEqual({ ok: true, montants: { '2025-10': 20_000 } });
    expect(personnalisationsAEnregistrer(15_000, { '2025-10': '-5' }, () => 'Octobre').erreur).toBe('Octobre : montant invalide');
  });

  it('lecture de la base : ignore ce qui n’est pas un mois et un montant valides', () => {
    expect(lireMontantsParMois({ '2025-10': 20000, 'x': 5, '2025-11': 'abc', '2025-12': -1 })).toEqual({ '2025-10': 20_000 });
    expect(lireMontantsParMois(null)).toEqual({});
  });
});

describe('caisse et portail appliquent le montant du mois', () => {
  it('caisse : octobre 20 000 F, novembre 15 000 F, décembre offert (absent, ne bloque rien)', () => {
    const items = buildPayableItems({
      academicMonths: MONTHS, billableKeys: new Set(MONTHS.map(m => m.key)), tuitionConfig: cfg, services: [],
      hasPaidInscription: () => true,
      hasPaidTuitionMonth: k => k === '2025-10' || k === '2025-11',
      hasPaidService: () => false, isEnrolledInService: () => false,
    });
    const t = items.filter(i => i.type === 'tuition');
    expect(t.find(i => i.monthKey === '2025-10')!.amount).toBe(20_000);
    expect(t.find(i => i.monthKey === '2025-12')).toBeUndefined();
    // Novembre payé, décembre offert : janvier est encaissable.
    expect(t.find(i => i.monthKey === '2026-01')).toMatchObject({ amount: 15_000, blocked: false });
  });

  it('portail : même montant par mois', () => {
    const items = computeDueItems([], { classId: 'c1', ...cfg }, [], [], 'c1', MONTHS, 0).filter(i => i.type === 'tuition');
    expect(items[0]).toMatchObject({ monthKey: '2025-10', amount: 20_000 });
    expect(items.some(i => i.monthKey === '2025-12')).toBe(false);
  });

  it('SQL : les tarifs existants gardent la même mensualité partout', () => {
    expect(readFileSync('docs/sql/mensualites_par_mois.sql', 'utf8')).toMatch(/monthly_fees jsonb not null default '\{\}'::jsonb/);
  });
});
