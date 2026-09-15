import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPayableItems, computeDueItems, totalExigible, prochainPayable,
  type PayableItemsInput, type DueItem, type DuePayment, type DueService, type DueTuitionConfig,
} from './dueItems';
import { getAcademicMonths, getBillableMonthsFor, type AcademicMonth, type AnnexService } from '@/types/payment';

// ════════════════════════════════════════════════════════════════════════════
// « Que doit cet élève ? » — vue caisse et vue portail.
// Argent réel : chaque scénario décrit une situation de guichet concrète.
// ════════════════════════════════════════════════════════════════════════════

const MONTHS = getAcademicMonths('2025-10-01', '2026-06-30'); // oct → juin, 9 mois
const ALL_KEYS = new Set(MONTHS.map(m => m.key));
const TUITION = { inscriptionFee: 25_000, monthlyFee: 15_000 };

const svc = (over: Partial<AnnexService> = {}): AnnexService => ({
  id: 'svc-cantine', name: 'Cantine', amount: 5_000, frequency: 'monthly',
  isObligatory: false, scope: 'all', classIds: [], academicYearLabel: '2025-2026',
  createdAt: '2025-09-01', ...over,
});

const build = (over: Partial<PayableItemsInput> = {}) => buildPayableItems({
  academicMonths: MONTHS,
  billableKeys: ALL_KEYS,
  tuitionConfig: TUITION,
  className: 'CM2 A',
  services: [],
  hasPaidInscription: () => false,
  hasPaidTuitionMonth: () => false,
  hasPaidService: () => false,
  isEnrolledInService: () => false,
  ...over,
});

const ids = (items: { id: string }[]) => items.map(i => i.id);

describe('buildPayableItems — vue caisse', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-01-15T10:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('propose l\'inscription puis chaque mois de scolarité', () => {
    const items = build();
    expect(ids(items)).toEqual([
      'inscription',
      ...MONTHS.map(m => `tuition_${m.key}`),
    ]);
    expect(items[0].amount).toBe(25_000);
    expect(items[1].amount).toBe(15_000);
  });

  it('ne propose rien sans tarif configuré pour la classe', () => {
    expect(build({ tuitionConfig: undefined })).toEqual([]);
  });

  // ── Verrou séquentiel ────────────────────────────────────────────────────
  it('verrouille les mois suivants tant que le premier mois impayé n\'est pas réglé', () => {
    const items = build().filter(i => i.type === 'tuition');
    expect(items[0].blocked).toBe(false);          // octobre encaissable
    expect(items.slice(1).every(i => i.blocked)).toBe(true);
  });

  it('déverrouille le mois suivant dès que le précédent est payé', () => {
    const items = build({ hasPaidTuitionMonth: (k) => k === '2025-10' })
      .filter(i => i.type === 'tuition');
    expect(items[0]).toMatchObject({ monthKey: '2025-10', paid: true, blocked: false });
    expect(items[1]).toMatchObject({ monthKey: '2025-11', paid: false, blocked: false });
    expect(items[2].blocked).toBe(true);
  });

  it('ne verrouille jamais un mois déjà payé (régularisation tardive)', () => {
    // Novembre payé mais pas octobre : novembre reste marqué payé, non bloqué.
    const items = build({ hasPaidTuitionMonth: (k) => k === '2025-11' })
      .filter(i => i.type === 'tuition');
    expect(items[1]).toMatchObject({ monthKey: '2025-11', paid: true, blocked: false });
  });

  // ── Mois facturables ─────────────────────────────────────────────────────
  it('masque les mois que l\'élève ne doit pas (arrivée tardive, mois décochés)', () => {
    const billable = new Set(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
    const months = build({ billableKeys: billable }).filter(i => i.type === 'tuition');
    expect(months.map(i => i.monthKey)).toEqual([...billable]);
  });

  it('GARDE VISIBLE un mois non facturable mais déjà encaissé — trace comptable', () => {
    // Règle de sûreté : on ne fait jamais disparaître un paiement reçu, même
    // si la règle de facturation change après coup (mois décoché a posteriori).
    const items = build({
      billableKeys: new Set(['2026-01']),
      hasPaidTuitionMonth: (k) => k === '2025-10',
    }).filter(i => i.type === 'tuition');
    expect(items.map(i => i.monthKey)).toEqual(['2025-10', '2026-01']);
    expect(items[0].paid).toBe(true);
  });

  it('n\'affiche aucun mois de scolarité pour un élève arrivé après la fin de l\'année', () => {
    expect(build({ billableKeys: new Set() }).filter(i => i.type === 'tuition')).toEqual([]);
  });

  // ── Retard ───────────────────────────────────────────────────────────────
  it('signale en retard les mois échus impayés, jamais les mois payés ni à venir', () => {
    const items = build().filter(i => i.type === 'tuition');
    expect(items.find(i => i.monthKey === '2025-10')?.overdue).toBe(true);   // échu
    expect(items.find(i => i.monthKey === '2026-05')?.overdue).toBe(false);  // à venir
    const paid = build({ hasPaidTuitionMonth: () => true }).filter(i => i.type === 'tuition');
    expect(paid.every(i => i.overdue === false)).toBe(true);
  });

  // ── Services ─────────────────────────────────────────────────────────────
  it('ne facture un service mensuel que sur les mois de souscription', () => {
    const items = build({
      services: [svc()],
      isEnrolledInService: (_id, idx) => idx >= 2 && idx <= 4, // déc → fév
    }).filter(i => i.type === 'service');
    expect(items.map(i => i.monthKey)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(items.every(i => i.amount === 5_000)).toBe(true);
  });

  it('un service optionnel ne bloque jamais la suite, un service obligatoire si', () => {
    const optional = build({ services: [svc()], isEnrolledInService: () => true })
      .filter(i => i.type === 'service');
    expect(optional.every(i => i.blocked === false)).toBe(true);

    const mandatory = build({
      services: [svc({ id: 'svc-frais', name: 'Frais divers', isObligatory: true })],
      isEnrolledInService: () => true,
    }).filter(i => i.type === 'service');
    expect(mandatory[0].blocked).toBe(false);
    expect(mandatory[1].blocked).toBe(true);
  });

  it('une interruption de souscription ne laisse pas un verrou derrière elle', () => {
    // Inscrit oct-nov, pause en déc, reprise en jan : janvier doit être
    // encaissable même si novembre n'a pas été payé (période distincte).
    const items = build({
      services: [svc({ isObligatory: true })],
      isEnrolledInService: (_id, idx) => idx !== 2,
    }).filter(i => i.type === 'service');
    expect(items.find(i => i.monthKey === '2026-01')?.blocked).toBe(false);
  });

  it('un service annuel ou ponctuel donne une seule ligne, jamais mensualisée', () => {
    const items = build({
      services: [svc({ id: 'svc-assur', name: 'Assurance', frequency: 'annual', amount: 3_000 })],
      isEnrolledInService: () => true,
    }).filter(i => i.type === 'service');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'service_svc-assur', amount: 3_000, blocked: false });
    expect(items[0].monthKey).toBeUndefined();
  });

  it('marque payé un service annuel déjà réglé', () => {
    const items = build({
      services: [svc({ id: 'svc-assur', frequency: 'one_time' })],
      hasPaidService: (id) => id === 'svc-assur',
    }).filter(i => i.type === 'service');
    expect(items[0].paid).toBe(true);
  });

  it('chaque identifiant d\'élément est unique — sinon la caisse encaisserait deux fois', () => {
    const items = build({
      services: [svc(), svc({ id: 'svc-bus', name: 'Transport' }), svc({ id: 'svc-assur', frequency: 'annual' })],
      isEnrolledInService: () => true,
    });
    expect(new Set(ids(items)).size).toBe(items.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════

const tuitionCfg: DueTuitionConfig = { classId: 'cls-1', inscriptionFee: 25_000, monthlyFee: 15_000 };

const dueSvc = (over: Partial<DueService> = {}): DueService =>
  ({ id: 'svc-cantine', name: 'Cantine', amount: 5_000, frequency: 'monthly', ...over });

const paid = (over: Partial<DuePayment>): DuePayment =>
  ({ type: 'tuition', status: 'confirmed', ...over });

/** Index du mois courant = janvier 2026 (index 3) dans l'année de référence. */
const CURRENT = 3;

describe('computeDueItems — vue élève (portail)', () => {
  const mois = (items: { monthKey?: string }[]) => items.map(i => i.monthKey);
  const scolarite = (items: DueItem[]) => items.filter(i => i.type === 'tuition');

  // ── Payer d'avance : le besoin métier ────────────────────────────────────
  // Dans le privé sénégalais, une famille qui en a les moyens règle plusieurs
  // mois au guichet. Le portail doit donc lui montrer TOUTE l'année, pas
  // seulement ce qui est échu — sinon elle ne peut pas générer le QR du mois
  // suivant.
  it('montre TOUS les mois de l\'année, pas seulement les mois échus', () => {
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT));
    expect(mois(items)).toEqual(MONTHS.map(m => m.key));
  });

  it('distingue ce qui est DÛ aujourd\'hui de ce qui est payable D\'AVANCE', () => {
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT));
    expect(mois(items.filter(i => i.echeance === 'du')))
      .toEqual(['2025-10', '2025-11', '2025-12', '2026-01']);
    expect(mois(items.filter(i => i.echeance === 'avance')))
      .toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('LE TOTAL EN DETTE NE COMPTE QUE L\'ÉCHU — on n\'alarme pas une famille à jour', () => {
    const items = computeDueItems([], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT);
    // 25 000 (inscription) + 4 mois échus × 15 000
    expect(totalExigible(items)).toBe(25_000 + 60_000);
    // …alors que la liste complète, elle, va bien jusqu'en juin.
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(25_000 + 9 * 15_000);
  });

  // ── Le paiement dans l'ordre ─────────────────────────────────────────────
  it('SEUL LE PREMIER MOIS IMPAYÉ est payable : les suivants sont verrouillés', () => {
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT));
    expect(items[0]).toMatchObject({ monthKey: '2025-10', verrouille: false });
    expect(items.slice(1).every(i => i.verrouille)).toBe(true);
  });

  it('payer un mois OUVRE le suivant — c\'est ainsi qu\'on règle l\'année entière', () => {
    // Le parcours décrit : on paie octobre, ce qui ouvre novembre, etc.
    let payments: DuePayment[] = [];
    const ordre = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
    for (const attendu of ordre) {
      const ouvert = prochainPayable(
        scolarite(computeDueItems(payments, tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT)));
      expect(ouvert?.monthKey, `après ${payments.length} paiement(s)`).toBe(attendu);
      payments = [...payments, paid({ monthKey: attendu })];
    }
  });

  it('un mois payé disparaît et ne verrouille plus rien', () => {
    const items = scolarite(computeDueItems(
      [paid({ monthKey: '2025-10' })], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT));
    expect(mois(items)[0]).toBe('2025-11');
    expect(items[0].verrouille).toBe(false);
  });

  it('un paiement en avance ne déverrouille PAS par-dessus un trou', () => {
    // La famille a réglé février d'avance mais doit toujours octobre :
    // octobre reste le seul payable, novembre reste fermé.
    const items = scolarite(computeDueItems(
      [paid({ monthKey: '2026-02' })], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT));
    expect(prochainPayable(items)?.monthKey).toBe('2025-10');
    expect(items.find(i => i.monthKey === '2025-11')?.verrouille).toBe(true);
  });

  it('une famille parfaitement à jour ne doit plus rien et n\'a plus rien à ouvrir', () => {
    const payments = [
      paid({ type: 'inscription' }),
      ...MONTHS.map(m => paid({ monthKey: m.key })),
    ];
    const items = computeDueItems(payments, tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT);
    expect(items).toEqual([]);
    expect(totalExigible(items)).toBe(0);
    expect(prochainPayable(items)).toBeUndefined();
  });

  // ── L'inscription reste libre ────────────────────────────────────────────
  it('l\'inscription est payable à tout moment, sans bloquer la scolarité', () => {
    const items = computeDueItems([], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT);
    const inscription = items.find(i => i.type === 'inscription')!;
    expect(inscription).toMatchObject({ echeance: 'du', verrouille: false });
    // Et octobre reste ouvert même sans avoir réglé l'inscription.
    expect(scolarite(items)[0].verrouille).toBe(false);
  });

  it('PAYER LA SCOLARITÉ NE SOLDE PAS LES FRAIS D\'INSCRIPTION', () => {
    const items = computeDueItems(
      [paid({ type: 'tuition', monthKey: '2025-10' })], tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT);
    expect(items.some(i => i.type === 'inscription')).toBe(true);
  });

  // ── Périmètre : ce que l'élève ne doit pas ───────────────────────────────
  it('ne montre RIEN pour les mois d\'avant son inscription', () => {
    const billable = getBillableMonthsFor(MONTHS, { excludedMonths: [], waiveArrivalMonthFromDay: null }, '2026-01-05');
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', billable, CURRENT));
    expect(mois(items)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('ne montre pas un mois décoché par l\'école, même en avance', () => {
    const billable = getBillableMonthsFor(MONTHS, { excludedMonths: ['2026-03'], waiveArrivalMonthFromDay: null });
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', billable, CURRENT));
    expect(mois(items)).not.toContain('2026-03');
  });

  it('offre le mois d\'arrivée selon le seuil de l\'école', () => {
    const billable = getBillableMonthsFor(MONTHS, { excludedMonths: [], waiveArrivalMonthFromDay: 20 }, '2025-11-25');
    const items = scolarite(computeDueItems([], tuitionCfg, [], [], 'cls-1', billable, CURRENT));
    expect(mois(items)[0]).toBe('2025-12');
  });

  it('ne montre rien quand le tarif appartient à une autre classe', () => {
    expect(computeDueItems([], tuitionCfg, [], [], 'cls-AUTRE', MONTHS, CURRENT)).toEqual([]);
    expect(computeDueItems([], null, [], [], 'cls-1', MONTHS, CURRENT)).toEqual([]);
  });

  it('n\'exige ni inscription ni scolarité quand le tarif est à zéro', () => {
    expect(computeDueItems([], { ...tuitionCfg, inscriptionFee: 0 }, [], [], 'cls-1', MONTHS, CURRENT)
      .some(i => i.type === 'inscription')).toBe(false);
    expect(computeDueItems([], { ...tuitionCfg, monthlyFee: 0 }, [], [], 'cls-1', MONTHS, CURRENT)
      .some(i => i.type === 'tuition')).toBe(false);
  });

  it('UN PAIEMENT ANNULÉ REDEVIENT DÛ — une annulation ne solde rien', () => {
    const items = computeDueItems(
      [{ type: 'tuition', monthKey: '2025-10', status: 'cancelled' }],
      tuitionCfg, [], [], 'cls-1', MONTHS, CURRENT);
    expect(mois(scolarite(items))).toContain('2025-10');
  });

  // ── Services annexes ─────────────────────────────────────────────────────
  it('un service mensuel se règle aussi d\'avance, dans sa fenêtre de souscription', () => {
    const items = computeDueItems(
      [], tuitionCfg, [dueSvc()], [{ serviceId: 'svc-cantine', startMonthIndex: 1 }],
      'cls-1', MONTHS, CURRENT,
    ).filter(i => i.type === 'service');
    expect(mois(items)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
    expect(items[0].verrouille).toBe(false);
    expect(items[1].verrouille).toBe(true);
  });

  it('arrête le service après sa date de fin, même pour les mois à venir', () => {
    const items = computeDueItems(
      [], tuitionCfg, [dueSvc()],
      [{ serviceId: 'svc-cantine', startMonthIndex: 0, endMonthIndex: 2 }],
      'cls-1', MONTHS, CURRENT,
    ).filter(i => i.type === 'service');
    expect(mois(items)).toEqual(['2025-10', '2025-11', '2025-12']);
  });

  it('un service mensuel PAYÉ disparaît, et ouvre le mois suivant', () => {
    const items = computeDueItems(
      [paid({ type: 'service', serviceId: 'svc-cantine', monthKey: '2025-10' })],
      tuitionCfg, [dueSvc()], [{ serviceId: 'svc-cantine', startMonthIndex: 0 }],
      'cls-1', MONTHS, CURRENT,
    ).filter(i => i.type === 'service');
    expect(mois(items)[0]).toBe('2025-11');
    expect(items[0].verrouille).toBe(false);
  });

  it('payer un AUTRE service, ou un autre mois, ne solde pas celui-ci', () => {
    const autreService = computeDueItems(
      [paid({ type: 'service', serviceId: 'svc-bus', monthKey: '2025-10' })],
      tuitionCfg, [dueSvc()], [{ serviceId: 'svc-cantine', startMonthIndex: 0 }],
      'cls-1', MONTHS, CURRENT).filter(i => i.type === 'service');
    expect(mois(autreService)).toContain('2025-10');

    const autreMois = computeDueItems(
      [paid({ type: 'service', serviceId: 'svc-cantine', monthKey: '2026-01' })],
      tuitionCfg, [dueSvc()], [{ serviceId: 'svc-cantine', startMonthIndex: 0 }],
      'cls-1', MONTHS, CURRENT).filter(i => i.type === 'service');
    expect(mois(autreMois)).toContain('2025-10');
  });

  it('un service annuel donne une seule ligne, exigible et jamais verrouillée', () => {
    const items = computeDueItems(
      [], tuitionCfg, [dueSvc({ id: 'svc-assur', name: 'Assurance', frequency: 'annual', amount: 3_000 })],
      [{ serviceId: 'svc-assur', startMonthIndex: 0 }], 'cls-1', MONTHS, CURRENT,
    ).filter(i => i.type === 'service');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ amount: 3_000, echeance: 'du', verrouille: false });
  });

  it('un service annuel payé disparaît', () => {
    const items = computeDueItems(
      [paid({ type: 'service', serviceId: 'svc-assur' })], tuitionCfg,
      [dueSvc({ id: 'svc-assur', frequency: 'annual' })],
      [{ serviceId: 'svc-assur', startMonthIndex: 0 }], 'cls-1', MONTHS, CURRENT);
    expect(items.some(i => i.serviceId === 'svc-assur')).toBe(false);
  });

  it('ignore une souscription dont le service n\'existe plus', () => {
    const items = computeDueItems(
      [], tuitionCfg, [], [{ serviceId: 'svc-supprime', startMonthIndex: 0 }],
      'cls-1', MONTHS, CURRENT);
    expect(items.some(i => i.type === 'service')).toBe(false);
  });

  it('ne plante pas sur une année scolaire vide (dates non configurées)', () => {
    const items = computeDueItems([], tuitionCfg, [], [], 'cls-1', [], 0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'inscription', echeance: 'du', verrouille: false });
  });

  it('chaque clé d\'élément est unique — sinon un QR en désignerait deux', () => {
    const items = computeDueItems(
      [], tuitionCfg, [dueSvc(), dueSvc({ id: 'svc-bus', name: 'Transport' })],
      [{ serviceId: 'svc-cantine', startMonthIndex: 0 }, { serviceId: 'svc-bus', startMonthIndex: 0 }],
      'cls-1', MONTHS, CURRENT);
    expect(new Set(items.map(i => i.key)).size).toBe(items.length);
  });
});
