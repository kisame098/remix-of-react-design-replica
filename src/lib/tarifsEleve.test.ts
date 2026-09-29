import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  appliquerAjustement, cleElement, decrireAjustement, developperAjustement, indexerAjustements,
  manqueAGagner, montantEleve, tarifNormalDe, verifierAjustement,
  type AjustementTarif, type ElementFrais, type ModeAjustement,
} from './tarifsEleve';
import { buildPayableItems, computeDueItems, type DuePayment } from './dueItems';
import { mensualiteDuMois } from './mensualites';
import { deciderVersement, resteAPayer } from './paiementPartiel';
import { getAcademicMonths } from '@/types/payment';

// ════════════════════════════════════════════════════════════════════════════
// TARIF PERSONNALISÉ D'UN ÉLÈVE — argent réel, plus de 1 000 cas.
//
//  1. Chaque formule, sur une grille de tarifs et de valeurs (tables).
//  2. Les saisies refusées.
//  3. Des centaines d'élèves tirés au hasard (graine fixe, donc reproductible) :
//     la caisse et le portail doivent dire EXACTEMENT la même chose, un frais
//     payé ne bouge jamais, un frais à 0 F ne bloque rien.
//  4. Les garde-fous de la base (droits, journal).
// ════════════════════════════════════════════════════════════════════════════

const TARIFS = [0, 500, 1_000, 2_500, 5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 50_000, 75_000, 100_000];
const POURCENTAGES = [1, 5, 10, 15, 20, 25, 30, 33, 40, 50, 60, 66, 75, 80, 90, 99, 100];
const REDUCTIONS = [100, 500, 1_000, 2_500, 5_000, 10_000, 15_000, 20_000, 50_000, 100_000];
const MONTANTS = [0, 1_000, 5_000, 10_000, 15_000, 25_000];

const croise = <A, B>(as: A[], bs: B[]) => as.flatMap(a => bs.map(b => [a, b] as [A, B]));

// ─── 1. Les formules ─────────────────────────────────────────────────────────
describe('réduction en % : l’élève paie le reste, arrondi au franc, jamais plus que le tarif', () => {
  it.each(croise(TARIFS, POURCENTAGES))('tarif %i F, −%i %%', (base, p) => {
    const du = appliquerAjustement(base, { mode: 'pourcentage', valeur: p });
    expect(Number.isInteger(du)).toBe(true);
    expect(du).toBeGreaterThanOrEqual(0);
    expect(du).toBeLessThanOrEqual(base);
    expect(du).toBe(Math.round((base * (100 - p)) / 100));
    if (p === 100) expect(du).toBe(0);
  });
});

describe('réduction en francs : tarif moins la réduction, jamais sous 0', () => {
  it.each(croise(TARIFS, REDUCTIONS))('tarif %i F, −%i F', (base, r) => {
    const du = appliquerAjustement(base, { mode: 'reduction', valeur: r });
    expect(du).toBe(Math.max(0, base - r));
    expect(du).toBeLessThanOrEqual(base);
  });
});

describe('montant fixe : l’élève paie ce montant, quel que soit le tarif', () => {
  it.each(croise(TARIFS, MONTANTS))('tarif %i F, fixé à %i F', (base, m) => {
    expect(appliquerAjustement(base, { mode: 'montant', valeur: m })).toBe(m);
  });
});

describe('une réduction en % suit le tarif ; un montant fixe, non', () => {
  it.each(POURCENTAGES)('−%i %% : tarif doublé, dû doublé (à l’arrondi près)', p => {
    const a = appliquerAjustement(10_000, { mode: 'pourcentage', valeur: p });
    const b = appliquerAjustement(20_000, { mode: 'pourcentage', valeur: p });
    expect(Math.abs(b - 2 * a)).toBeLessThanOrEqual(1);
  });
  it.each(MONTANTS)('montant fixe %i F : le tarif ne change rien', m => {
    expect(appliquerAjustement(10_000, { mode: 'montant', valeur: m })).toBe(appliquerAjustement(99_000, { mode: 'montant', valeur: m }));
  });
});

// ─── 2. Saisies ──────────────────────────────────────────────────────────────
describe('saisie d’une personnalisation', () => {
  const ok = { motif: 'Enfant du personnel' };
  it.each([
    ['pourcentage', 50], ['pourcentage', 1], ['pourcentage', 100],
    ['reduction', 1], ['reduction', 5_000], ['reduction', 1_000_000],
    ['montant', 0], ['montant', 10_000], ['montant', 250_000],
  ] as [ModeAjustement, number][])('accepte %s = %i', (mode, valeur) => {
    expect(verifierAjustement({ mode, valeur, ...ok })).toBeUndefined();
  });

  it.each([
    ['pourcentage', 0, 'entre 1 et 100'], ['pourcentage', 101, 'entre 1 et 100'], ['pourcentage', -5, 'entre 1 et 100'],
    ['pourcentage', 12.5, 'entier'], ['reduction', 0, 'supérieure à 0'], ['reduction', -100, 'supérieure à 0'],
    ['reduction', 99.9, 'entier'], ['montant', -1, 'négatif'], ['montant', 10.5, 'entier'],
    ['montant', Number.NaN, 'invalide'], ['reduction', Number.POSITIVE_INFINITY, 'invalide'],
  ] as [ModeAjustement, number, string][])('refuse %s = %s', (mode, valeur, attendu) => {
    expect(verifierAjustement({ mode, valeur, ...ok })).toMatch(attendu);
  });

  it.each(['', ' ', 'ab', '  a '])('motif obligatoire (refuse « %s »)', motif => {
    expect(verifierAjustement({ mode: 'pourcentage', valeur: 50, motif })).toMatch(/motif/);
  });

  it('formule inconnue refusée', () => {
    expect(verifierAjustement({ mode: 'gratuit' as ModeAjustement, valeur: 1, motif: 'Bourse' })).toMatch(/inconnue/);
  });
});

// ─── Clés, index, développement, manque à gagner ────────────────────────────
describe('chaque frais a sa propre clé', () => {
  const elements: ElementFrais[] = [
    { type: 'inscription' },
    ...['2025-10', '2025-11', '2026-06'].map(m => ({ type: 'tuition' as const, monthKey: m })),
    { type: 'service', serviceId: 's1' }, { type: 'service', serviceId: 's2' },
    { type: 'service', serviceId: 's1', monthKey: '2025-10' }, { type: 'service', serviceId: 's1', monthKey: '2025-11' },
  ];
  it.each(elements.map(e => [cleElement(e), e] as const))('%s', (cle, e) => {
    expect(elements.filter(x => cleElement(x) === cle)).toEqual([e]);
  });
});

describe('développer une formule sur plusieurs frais', () => {
  const MOIS = getAcademicMonths('2025-10-01', '2026-06-30').map(m => m.key);
  it.each(MOIS.map((_, i) => i + 1))('les %i premiers mois : une personnalisation par mois, sans doublon', n => {
    const cibles = MOIS.slice(0, n).map(m => ({ type: 'tuition' as const, monthKey: m }));
    const lignes = developperAjustement({ studentId: 'e', mode: 'pourcentage', valeur: 50, motif: '  Bourse  ' }, [...cibles, ...cibles]);
    expect(lignes).toHaveLength(n);
    expect(lignes.every(l => l.motif === 'Bourse' && l.mode === 'pourcentage' && l.valeur === 50)).toBe(true);
  });

  it('inscription + mois + service, chacun une fois', () => {
    const lignes = developperAjustement({ studentId: 'e', mode: 'montant', valeur: 0, motif: 'Bourse totale' }, [
      { type: 'inscription' }, { type: 'tuition', monthKey: '2025-10' }, { type: 'service', serviceId: 's1' }, { type: 'inscription' },
    ]);
    expect(lignes.map(cleElement)).toEqual(['inscription', 'tuition:2025-10', 'service:s1']);
  });
});

describe('deux personnalisations sur le même frais : la plus récente l’emporte', () => {
  it.each([
    ['2026-01-01', '2026-02-01', 20], ['2026-02-01', '2026-01-01', 10], ['2026-01-01', '2026-01-01', 20],
  ])('%s puis %s', (d1, d2, attendu) => {
    const a = (valeur: number, le: string): AjustementTarif => ({ studentId: 'e', type: 'tuition', monthKey: '2025-10', mode: 'pourcentage', valeur, motif: 'x', accordeLe: le });
    const idx = indexerAjustements([a(10, d1), a(20, d2)]);
    expect(idx.get('tuition:2025-10')?.valeur).toBe(attendu);
  });
});

describe('argent en moins pour l’école', () => {
  it.each(croise([5_000, 15_000, 25_000], POURCENTAGES))('tarif %i F, −%i %% sur 9 mois', (base, p) => {
    const lignes = Array.from({ length: 9 }, () => ({ tarifNormal: base, du: appliquerAjustement(base, { mode: 'pourcentage', valeur: p }) }));
    expect(manqueAGagner(lignes)).toBe(9 * (base - appliquerAjustement(base, { mode: 'pourcentage', valeur: p })));
  });
  it('un montant fixe plus cher que le tarif ne compte pas comme argent en moins', () => {
    expect(manqueAGagner([{ tarifNormal: 10_000, du: 12_000 }, { tarifNormal: 10_000, du: 4_000 }])).toBe(6_000);
  });
});

describe('libellés', () => {
  it.each([
    [{ mode: 'pourcentage', valeur: 50 }, '−50 %'],
    [{ mode: 'reduction', valeur: 5000 }, '5'],
    [{ mode: 'montant', valeur: 0 }, 'Montant fixe'],
  ] as [Pick<AjustementTarif, 'mode' | 'valeur'>, string][])('%j', (a, attendu) => {
    expect(decrireAjustement(a)).toContain(attendu);
  });

  it('tarif normal de chaque frais', () => {
    const cfg = { inscriptionFee: 25_000, monthlyFee: 15_000, montantsParMois: { '2025-10': 20_000 } };
    expect(tarifNormalDe({ type: 'inscription' }, cfg, [])).toBe(25_000);
    expect(tarifNormalDe({ type: 'tuition', monthKey: '2025-10' }, cfg, [])).toBe(20_000);
    expect(tarifNormalDe({ type: 'tuition', monthKey: '2025-11' }, cfg, [])).toBe(15_000);
    expect(tarifNormalDe({ type: 'service', serviceId: 's1' }, cfg, [{ id: 's1', amount: 3_000 }])).toBe(3_000);
    expect(tarifNormalDe({ type: 'tuition', monthKey: '2025-10' }, undefined, [])).toBe(0);
  });
});

// ─── Réduction + acompte ─────────────────────────────────────────────────────
describe('réduction puis paiement en plusieurs fois', () => {
  it.each(croise([10_000, 15_000, 25_000], [10, 25, 50, 75]))('tarif %i F, −%i %% : acompte puis solde exact', (base, p) => {
    const du = appliquerAjustement(base, { mode: 'pourcentage', valeur: p });
    const acompte = Math.floor(du / 2);
    if (acompte > 0) expect(deciderVersement(acompte, du)).toMatchObject({ ok: true, partiel: true });
    const reste = resteAPayer(du, acompte);
    expect(deciderVersement(reste, reste)).toMatchObject({ ok: true, partiel: false });
    expect(deciderVersement(reste + 1, reste).ok).toBe(false); // jamais plus que le dû réduit
  });
});

// ─── 3. Élèves tirés au hasard : caisse = portail ────────────────────────────
// Générateur à graine fixe : chaque exécution rejoue exactement les mêmes élèves.
const graine = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const MOIS = getAcademicMonths('2025-10-01', '2026-06-30');

const scenario = (n: number) => {
  const r = graine(n * 7919 + 17);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const cfg = {
    inscriptionFee: pick([0, 10_000, 25_000, 50_000]),
    monthlyFee: pick([5_000, 12_500, 15_000, 25_000]),
    montantsParMois: Object.fromEntries(MOIS.filter(() => r() < 0.25).map(m => [m.key, pick([0, 7_500, 20_000, 30_000])])),
  };
  const ajustements: AjustementTarif[] = [];
  const ajoute = (e: ElementFrais) => {
    if (r() < 0.4) {
      const mode = pick<ModeAjustement>(['pourcentage', 'reduction', 'montant']);
      const valeur = mode === 'pourcentage' ? pick(POURCENTAGES) : mode === 'reduction' ? pick(REDUCTIONS) : pick(MONTANTS);
      ajustements.push({ studentId: 'e', ...e, mode, valeur, motif: 'Cas particulier' });
    }
  };
  ajoute({ type: 'inscription' });
  MOIS.forEach(m => ajoute({ type: 'tuition', monthKey: m.key }));
  const payes = new Set(MOIS.filter(() => r() < 0.3).map(m => m.key));
  const acomptes = new Map(MOIS.filter(m => !payes.has(m.key) && r() < 0.25).map(m => [m.key, pick([1_000, 2_500, 5_000])]));
  return { cfg, ajustements, payes, acomptes, inscriptionPayee: r() < 0.5 };
};

describe.each(Array.from({ length: 320 }, (_, i) => i + 1))('élève tiré au hasard n°%i', n => {
  const { cfg, ajustements, payes, acomptes, inscriptionPayee } = scenario(n);
  const index = indexerAjustements(ajustements);
  const caisse = buildPayableItems({
    academicMonths: MOIS, billableKeys: new Set(MOIS.map(m => m.key)), tuitionConfig: cfg, services: [],
    hasPaidInscription: () => inscriptionPayee, hasPaidTuitionMonth: k => payes.has(k),
    hasPaidService: () => false, isEnrolledInService: () => false,
    acomptes: e => (e.type === 'tuition' ? acomptes.get(e.monthKey!) ?? 0 : 0),
    ajustements: index,
  });
  const paiements: DuePayment[] = [
    ...[...payes].map(k => ({ type: 'tuition', monthKey: k, status: 'confirmed' })),
    ...[...acomptes].map(([k, a]) => ({ type: 'tuition', monthKey: k, status: 'confirmed', partiel: true, amount: a })),
    ...(inscriptionPayee ? [{ type: 'inscription', status: 'confirmed' }] : []),
  ];
  const portail = computeDueItems(paiements, { classId: 'c', ...cfg }, [], [], 'c', MOIS, 0, index);

  it('caisse et portail : même montant pour chaque frais à payer, calculé comme attendu', () => {
    for (const m of MOIS) {
      const du = montantEleve(mensualiteDuMois(cfg, m.key), { type: 'tuition', monthKey: m.key }, index).du;
      const attendu = resteAPayer(du, acomptes.get(m.key) ?? 0);
      const c = caisse.find(i => i.monthKey === m.key);
      const p = portail.find(i => i.monthKey === m.key);
      if (payes.has(m.key)) {
        expect(c?.paid).toBe(true);        // un mois payé reste affiché, payé
        expect(p).toBeUndefined();         // et n'est plus réclamé
      } else if (du <= 0) {
        expect(c).toBeUndefined();         // 0 F : rien à payer
        expect(p).toBeUndefined();
      } else {
        expect(c?.amount).toBe(attendu);
        expect(p?.amount).toBe(attendu);
        expect(c?.personnalise).toBe(index.has(`tuition:${m.key}`));
      }
    }
  });

  it('la chaîne des mois : un mois s’ouvre quand le précédent est soldé (caisse = portail)', () => {
    const aPayer = caisse.filter(i => i.type === 'tuition' && !i.paid);
    // Un mois bloqué a toujours, avant lui, un mois non soldé.
    // Un mois est bloqué exactement quand le mois à payer qui le précède n'est pas soldé.
    aPayer.forEach(i => {
      const avant = caisse.filter(x => x.type === 'tuition' && (x.monthKey ?? '') < (i.monthKey ?? ''));
      const precedent = avant[avant.length - 1];
      expect(i.blocked).toBe(!!precedent && !precedent.paid);
    });
    // Portail : même règle. Le mois précédent qui compte est le dernier mois
    // à payer (0 F exclu), soldé ou non.
    portail.filter(i => i.type === 'tuition').forEach(i => {
      const precedents = MOIS.filter(m => m.key < i.monthKey!
        && montantEleve(mensualiteDuMois(cfg, m.key), { type: 'tuition', monthKey: m.key }, index).du > 0);
      const precedent = precedents[precedents.length - 1];
      expect(i.verrouille).toBe(!!precedent && !payes.has(precedent.key));
    });
  });

  it('jamais de montant négatif ni non entier', () => {
    [...caisse.map(i => i.amount), ...portail.map(i => i.amount)].forEach(a => {
      expect(Number.isInteger(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── Services annexes : caisse = portail ─────────────────────────────────────
const CANTINE = { id: 'cantine', name: 'Cantine', amount: 5_000, frequency: 'monthly' as const, isObligatory: false, scope: 'all' as const, classIds: [], academicYearLabel: '2025-2026', createdAt: '' };
const TRANSPORT = { ...CANTINE, id: 'transport', name: 'Transport', amount: 60_000, frequency: 'annual' as const };

describe.each(Array.from({ length: 80 }, (_, i) => i + 1))('services, élève tiré au hasard n°%i', n => {
  const r = graine(n * 104729 + 3);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const ajustements: AjustementTarif[] = [];
  const cibles: ElementFrais[] = [
    { type: 'service', serviceId: 'transport' },
    ...MOIS.map(m => ({ type: 'service' as const, serviceId: 'cantine', monthKey: m.key })),
  ];
  cibles.forEach(e => {
    if (r() < 0.45) {
      const mode = pick<ModeAjustement>(['pourcentage', 'reduction', 'montant']);
      ajustements.push({ studentId: 'e', ...e, mode, valeur: mode === 'pourcentage' ? pick(POURCENTAGES) : mode === 'reduction' ? pick(REDUCTIONS) : pick(MONTANTS), motif: 'Cas' });
    }
  });
  const index = indexerAjustements(ajustements);
  const payes = new Set(MOIS.filter(() => r() < 0.3).map(m => m.key));
  const transportPaye = r() < 0.3;
  const caisse = buildPayableItems({
    academicMonths: MOIS, billableKeys: new Set(MOIS.map(m => m.key)), services: [CANTINE, TRANSPORT],
    hasPaidInscription: () => true, hasPaidTuitionMonth: () => true,
    hasPaidService: (id, k) => (id === 'transport' ? transportPaye : payes.has(k!)),
    isEnrolledInService: () => true, ajustements: index,
  });
  const paiements: DuePayment[] = [
    ...[...payes].map(k => ({ type: 'service', serviceId: 'cantine', monthKey: k, status: 'confirmed' })),
    ...(transportPaye ? [{ type: 'service', serviceId: 'transport', status: 'confirmed' }] : []),
  ];
  const portail = computeDueItems(paiements, { classId: 'c', inscriptionFee: 0, monthlyFee: 0 }, [CANTINE, TRANSPORT],
    [{ serviceId: 'cantine', startMonthIndex: 0 }, { serviceId: 'transport', startMonthIndex: 0 }], 'c', MOIS, 0, index);

  it('cantine de chaque mois et transport : même montant réduit des deux côtés', () => {
    for (const e of cibles) {
      const du = montantEleve(e.serviceId === 'transport' ? 60_000 : 5_000, e, index).du;
      const paye = e.serviceId === 'transport' ? transportPaye : payes.has(e.monthKey!);
      const c = caisse.find(i => i.serviceId === e.serviceId && i.monthKey === e.monthKey);
      const p = portail.find(i => i.serviceId === e.serviceId && i.monthKey === e.monthKey);
      if (paye) { expect(c?.paid).toBe(true); expect(p).toBeUndefined(); }
      else if (du <= 0) { expect(c).toBeUndefined(); expect(p).toBeUndefined(); }
      else { expect(c?.amount).toBe(du); expect(p?.amount).toBe(du); }
    }
  });
});

// ─── 4. Garde-fous de la base ────────────────────────────────────────────────
describe('garde-fous : base de données', () => {
  const sql = readFileSync('docs/sql/tarifs_eleve.sql', 'utf8');

  it('aucune écriture directe : seulement des règles de lecture sur les deux tables', () => {
    const politiques = sql.match(/create policy[^;]+;/g) ?? [];
    expect(politiques).toHaveLength(2);
    politiques.forEach(p => expect(p).toMatch(/for select/));
  });

  it('accorder et retirer : directeur ou permission « reductions », vérifié par la base', () => {
    expect(sql).toMatch(/role = 'admin_school' or 'reductions' = any\(permissions\)/);
    for (const fn of ['appliquer_tarifs_eleve', 'retirer_tarifs_eleve']) {
      const corps = sql.split(`function public.${fn}`)[1] ?? '';
      expect(corps, fn).toMatch(/not can_manage_reductions\(\)/);
      expect(corps, fn).toMatch(/student_fee_adjustments_journal/);
    }
  });

  it('valeurs impossibles refusées par la base elle-même', () => {
    expect(sql).toMatch(/valeur between 1 and 100/);
    expect(sql).toMatch(/length\(btrim\(motif\)\) >= 3/);
    expect(sql).toMatch(/valeur\s+integer not null check \(valeur >= 0\)/);
  });

  it('un seul tarif personnalisé par élève et par frais', () => {
    expect(sql).toMatch(/create unique index if not exists student_fee_adjustments_unique/);
  });

  it('seul l’élève lui-même (et le personnel) voit ses réductions', () => {
    expect(sql).toMatch(/school_id = get_my_school_id\(\) or student_enrollment_id = get_my_student_enrollment_id\(\)/);
  });

  it('la table des paiements n’est pas touchée', () => {
    expect(sql).not.toMatch(/\b(alter|update|delete from|insert into) (table )?public\.payments\b/);
  });
});
