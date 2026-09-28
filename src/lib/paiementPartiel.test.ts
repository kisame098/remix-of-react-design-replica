import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deciderVersement, resteAPayer } from './paiementPartiel';
import { acomptesVerses, hasPaidInscription, hasPaidTuitionMonth, getTotalCollectedForYear } from './paymentQueries';
import { buildPayableItems, computeDueItems, type DuePayment } from './dueItems';
import { libellePaiement } from './historiquePaiements';
import { getAcademicMonths, type Payment } from '@/types/payment';

// ════════════════════════════════════════════════════════════════════════════
// PAIEMENTS PARTIELS — argent réel. Un scénario de guichet par test :
// scolarité à 15 000 F, la famille paie 10 000 F puis 5 000 F.
// ════════════════════════════════════════════════════════════════════════════

const YEAR = '2025-2026';
const ELEVE = 'enr-1';
const OCT = '2025-10';
const pay = (over: Partial<Payment>): Payment => ({
  id: `p-${Math.random()}`, studentId: ELEVE, studentUniqueId: 'ETU-1', academicYearLabel: YEAR,
  type: 'tuition', monthKey: OCT, amount: 15_000, method: 'especes',
  paidAt: '2025-10-05T10:00:00Z', status: 'confirmed', ...over,
});

describe('montant saisi à la caisse', () => {
  it('moins que le reste = acompte ; exactement le reste = solde', () => {
    expect(deciderVersement('10000', 15_000)).toMatchObject({ ok: true, montant: 10_000, partiel: true });
    expect(deciderVersement('15 000', 15_000)).toMatchObject({ ok: true, montant: 15_000, partiel: false });
  });

  it('refuse plus que le reste, zéro, les centimes, et un élément déjà soldé', () => {
    expect(deciderVersement('20000', 15_000).ok).toBe(false);
    expect(deciderVersement('0', 15_000).ok).toBe(false);
    expect(deciderVersement('', 15_000).ok).toBe(false);
    expect(deciderVersement('100,5', 15_000).ok).toBe(false);
    expect(deciderVersement('100', 0).ok).toBe(false);
  });

  it('le reste ne descend jamais sous zéro', () => {
    expect(resteAPayer(15_000, 10_000)).toBe(5_000);
    expect(resteAPayer(15_000, 20_000)).toBe(0);
  });
});

describe('un acompte ne solde pas le mois ; le solde, oui', () => {
  const acompte = pay({ amount: 10_000, partiel: true });

  it('après un acompte de 10 000 F : mois non payé, 10 000 F versés, 5 000 F restants', () => {
    expect(hasPaidTuitionMonth([acompte], YEAR, ELEVE, OCT)).toBe(false);
    expect(acomptesVerses([acompte], YEAR, ELEVE, { type: 'tuition', monthKey: OCT })).toBe(10_000);
  });

  it('le versement qui complète le reste solde le mois', () => {
    const solde = pay({ amount: 5_000 });
    expect(hasPaidTuitionMonth([acompte, solde], YEAR, ELEVE, OCT)).toBe(true);
  });

  it('TOUT paiement existant (sans marque d’acompte) reste un paiement qui solde', () => {
    // Même si le tarif a changé depuis : jamais un mois payé ne redevient dû.
    expect(hasPaidTuitionMonth([pay({ amount: 12_000 })], YEAR, ELEVE, OCT)).toBe(true);
    expect(hasPaidInscription([pay({ type: 'inscription', monthKey: undefined })], YEAR, ELEVE)).toBe(true);
  });

  it('un acompte annulé ne compte plus ; l’argent encaissé compte les acomptes', () => {
    const annule = pay({ amount: 10_000, partiel: true, status: 'cancelled' });
    expect(acomptesVerses([annule], YEAR, ELEVE, { type: 'tuition', monthKey: OCT })).toBe(0);
    expect(getTotalCollectedForYear([acompte, annule, pay({ amount: 5_000 })], YEAR)).toBe(15_000);
  });

  it('les acomptes d’un autre mois, d’un autre élève ou de l’an dernier ne comptent pas', () => {
    const autres = [
      pay({ amount: 3_000, partiel: true, monthKey: '2025-11' }),
      pay({ amount: 3_000, partiel: true, studentId: 'enr-2' }),
      pay({ amount: 3_000, partiel: true, academicYearLabel: '2024-2025' }),
    ];
    expect(acomptesVerses(autres, YEAR, ELEVE, { type: 'tuition', monthKey: OCT })).toBe(0);
  });
});

describe('caisse et portail affichent le reste', () => {
  const MONTHS = getAcademicMonths('2025-10-01', '2026-06-30');

  it('caisse : le mois d’octobre affiche 5 000 F à payer et reste le prochain à régler', () => {
    const items = buildPayableItems({
      academicMonths: MONTHS, billableKeys: new Set(MONTHS.map(m => m.key)),
      tuitionConfig: { inscriptionFee: 25_000, monthlyFee: 15_000 }, services: [],
      hasPaidInscription: () => true, hasPaidTuitionMonth: () => false, hasPaidService: () => false,
      isEnrolledInService: () => false,
      acomptes: e => (e.type === 'tuition' && e.monthKey === OCT ? 10_000 : 0),
    });
    const oct = items.find(i => i.id === `tuition_${OCT}`)!;
    expect(oct).toMatchObject({ amount: 5_000, dejaVerse: 10_000, paid: false, blocked: false });
    // Novembre reste bloqué : octobre n'est pas soldé.
    expect(items.find(i => i.id === 'tuition_2025-11')!.blocked).toBe(true);
  });

  it('portail : même reste, et le mois n’est soldé qu’après le complément', () => {
    const cfg = { classId: 'c1', inscriptionFee: 0, monthlyFee: 15_000 };
    const acompte: DuePayment = { type: 'tuition', monthKey: OCT, status: 'confirmed', partiel: true, amount: 10_000 };
    const avant = computeDueItems([acompte], cfg, [], [], 'c1', MONTHS, 0);
    expect(avant[0]).toMatchObject({ monthKey: OCT, amount: 5_000, dejaVerse: 10_000 });
    const apres = computeDueItems([acompte, { type: 'tuition', monthKey: OCT, status: 'confirmed', amount: 5_000 }], cfg, [], [], 'c1', MONTHS, 0);
    expect(apres[0].monthKey).toBe('2025-11');
  });

  it('historique et reçu écrivent « (acompte) »', () => {
    const mois = () => 'Octobre 2025';
    expect(libellePaiement({ type: 'tuition', monthKey: OCT, partiel: true }, [], mois)).toBe('Scolarité — Octobre 2025 (acompte)');
    expect(libellePaiement({ type: 'tuition', monthKey: OCT }, [], mois)).toBe('Scolarité — Octobre 2025');
  });
});

describe('garde-fous', () => {
  const sql = readFileSync('docs/sql/paiements_partiels.sql', 'utf8');
  const contexte = readFileSync('src/contexts/PaymentContext.tsx', 'utf8');

  it('les paiements existants restent des soldes (défaut false)', () => {
    expect(sql).toMatch(/add column if not exists partiel boolean not null default false/);
  });

  it('la protection anti-double encaissement reste sur les 3 index, pour le solde', () => {
    for (const idx of ['idx_payments_inscription_uniq', 'idx_payments_tuition_uniq', 'idx_payments_service_annual_uniq']) {
      const def = sql.split(`create unique index ${idx}`)[1]?.split(';')[0] ?? '';
      expect(def, idx).toMatch(/status = 'confirmed' and not partiel/);
    }
  });

  it('un encaissement ordinaire n’envoie pas la colonne (rien ne change sans acompte)', () => {
    expect(contexte).toMatch(/\.\.\.\(data\.partiel \? \{ partiel: true \} : \{\}\)/);
  });
});
