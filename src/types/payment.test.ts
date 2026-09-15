import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAcademicMonths,
  getSchoolBillableMonths,
  getStudentBillableMonths,
  getBillableMonthsFor,
  readBillingRules,
  readExcludedBillingMonths,
  isMonthOverdue,
  getCurrentMonthIndex,
  encodePaymentIntent,
  decodePaymentIntent,
  paymentIntentToItemId,
  EXCLUDED_BILLING_MONTHS_KEY,
  ARRIVAL_MONTH_WAIVE_DAY_KEY,
  type AcademicMonth,
} from './payment';

// ════════════════════════════════════════════════════════════════════════════
// CHEMIN DE L'ARGENT — c'est ici qu'une régression coûte cher et ne se voit
// qu'en fin de mois. Chaque règle métier écrite dans les commentaires de
// payment.ts a son test ci-dessous ; si une règle change, un test doit tomber.
// ════════════════════════════════════════════════════════════════════════════

const keys = (months: AcademicMonth[]) => months.map(m => m.key);

/** Année type : octobre 2025 → juin 2026 (9 mois). */
const YEAR = () => getAcademicMonths('2025-10-01', '2026-06-30');

describe('getAcademicMonths', () => {
  it('produit un mois par mois calendaire, bornes incluses', () => {
    expect(keys(YEAR())).toEqual([
      '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ]);
  });

  it('indexe les mois dans l\'ordre de l\'année scolaire, pas de l\'année civile', () => {
    const m = YEAR();
    expect(m[0]).toMatchObject({ key: '2025-10', index: 0, label: 'Octobre 2025' });
    expect(m[3]).toMatchObject({ key: '2026-01', index: 3, label: 'Janvier 2026' });
  });

  it('inclut le mois de fin même si l\'année se termine en plein milieu', () => {
    // Fin le 3 juin : juin reste un mois facturé entier.
    expect(keys(getAcademicMonths('2026-05-01', '2026-06-03'))).toEqual(['2026-05', '2026-06']);
  });

  it('échéance = 1er du mois en facturation à l\'avance', () => {
    const [oct] = getAcademicMonths('2025-10-01', '2025-10-31', 'advance');
    expect(oct.dueDate).toBe('2025-10-01');
  });

  it('échéance = dernier jour du mois à terme échu (défaut), février bissextile compris', () => {
    const [fev] = getAcademicMonths('2024-02-01', '2024-02-29');
    expect(fev.dueDate).toBe('2024-02-29');
    const [fevNormal] = getAcademicMonths('2026-02-01', '2026-02-28');
    expect(fevNormal.dueDate).toBe('2026-02-28');
  });

  it('rend une liste vide plutôt que de planter sur des dates invalides ou inversées', () => {
    expect(getAcademicMonths('n\'importe quoi', '2026-06-30')).toEqual([]);
    expect(getAcademicMonths('2025-10-01', 'pas une date')).toEqual([]);
    expect(getAcademicMonths('2026-06-30', '2025-10-01')).toEqual([]); // fin avant début
  });

  it('accepte une année d\'un seul mois', () => {
    expect(keys(getAcademicMonths('2026-01-05', '2026-01-20'))).toEqual(['2026-01']);
  });
});

describe('getSchoolBillableMonths — mois décochés par l\'école', () => {
  it('retire les mois exclus', () => {
    expect(keys(getSchoolBillableMonths(YEAR(), ['2025-12', '2026-04'])))
      .toEqual(['2025-10', '2025-11', '2026-01', '2026-02', '2026-03', '2026-05', '2026-06']);
  });

  it('ne touche à rien quand aucune exclusion n\'est configurée', () => {
    expect(keys(getSchoolBillableMonths(YEAR()))).toEqual(keys(YEAR()));
    expect(keys(getSchoolBillableMonths(YEAR(), []))).toEqual(keys(YEAR()));
  });

  it('ignore une clé exclue qui ne correspond à aucun mois de l\'année', () => {
    expect(keys(getSchoolBillableMonths(YEAR(), ['2030-01']))).toEqual(keys(YEAR()));
  });

  it('peut tout exclure (école qui ne facture aucune scolarité)', () => {
    expect(getSchoolBillableMonths(YEAR(), keys(YEAR()))).toEqual([]);
  });
});

describe('getStudentBillableMonths — proratisation à la date d\'inscription', () => {
  it('ne facture rien avant le mois d\'arrivée', () => {
    // Arrivé le 12 janvier : septembre→décembre ne le concernent pas.
    expect(keys(getStudentBillableMonths(YEAR(), '2026-01-12')))
      .toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('facture le mois d\'arrivée en entier par défaut, même arrivé le 31', () => {
    // Règle par défaut (waiveFromDay = null) : le mois d'arrivée est toujours dû.
    expect(keys(getStudentBillableMonths(YEAR(), '2026-01-31'))[0]).toBe('2026-01');
  });

  it('offre le mois d\'arrivée à partir du jour seuil configuré par l\'école', () => {
    // Seuil à 20 : arrivé le 24 janvier → il commence à payer en février.
    expect(keys(getStudentBillableMonths(YEAR(), '2026-01-24', 20))[0]).toBe('2026-02');
    // Arrivé le 19, juste avant le seuil → janvier reste dû.
    expect(keys(getStudentBillableMonths(YEAR(), '2026-01-19', 20))[0]).toBe('2026-01');
    // Le jour du seuil lui-même est offert (>=).
    expect(keys(getStudentBillableMonths(YEAR(), '2026-01-20', 20))[0]).toBe('2026-02');
  });

  it('passe correctement à l\'année suivante quand le mois offert est décembre', () => {
    // Arrivé le 28 décembre avec seuil 20 → premier mois dû = janvier N+1.
    expect(keys(getStudentBillableMonths(YEAR(), '2025-12-28', 20))[0]).toBe('2026-01');
  });

  it('ne facture plus rien si le report tombe après la fin de l\'année', () => {
    // Arrivé le 25 juin (dernier mois) avec seuil 20 → plus aucun mois à payer.
    expect(getStudentBillableMonths(YEAR(), '2026-06-25', 20)).toEqual([]);
  });

  it('facture toute l\'année pour un élève inscrit avant l\'ouverture', () => {
    expect(keys(getStudentBillableMonths(YEAR(), '2025-08-15'))).toEqual(keys(YEAR()));
  });

  it('facture toute l\'année quand la date d\'inscription est absente ou illisible', () => {
    // Sûreté : sans date fiable on ne retire RIEN — mieux vaut un mois de trop
    // à discuter au guichet qu'un mois silencieusement jamais facturé.
    expect(keys(getStudentBillableMonths(YEAR(), undefined))).toEqual(keys(YEAR()));
    expect(keys(getStudentBillableMonths(YEAR(), null))).toEqual(keys(YEAR()));
    expect(keys(getStudentBillableMonths(YEAR(), ''))).toEqual(keys(YEAR()));
    expect(keys(getStudentBillableMonths(YEAR(), 'jamais inscrit'))).toEqual(keys(YEAR()));
  });

  it('accepte un timestamp complet et pas seulement une date ISO courte', () => {
    expect(keys(getStudentBillableMonths(YEAR(), '2026-02-03T09:12:45.000Z'))[0]).toBe('2026-02');
  });
});

describe('readBillingRules — lecture des réglages école', () => {
  it('lit les deux règles ensemble', () => {
    expect(readBillingRules({
      [EXCLUDED_BILLING_MONTHS_KEY]: ['2026-04'],
      [ARRIVAL_MONTH_WAIVE_DAY_KEY]: 20,
    })).toEqual({ excludedMonths: ['2026-04'], waiveArrivalMonthFromDay: 20 });
  });

  it('retombe sur des règles neutres quand rien n\'est configuré', () => {
    expect(readBillingRules(undefined)).toEqual({ excludedMonths: [], waiveArrivalMonthFromDay: null });
    expect(readBillingRules(null)).toEqual({ excludedMonths: [], waiveArrivalMonthFromDay: null });
    expect(readBillingRules({})).toEqual({ excludedMonths: [], waiveArrivalMonthFromDay: null });
  });

  it('rejette un jour seuil hors bornes ou du mauvais type plutôt que de l\'appliquer', () => {
    const day = (v: unknown) => readBillingRules({ [ARRIVAL_MONTH_WAIVE_DAY_KEY]: v }).waiveArrivalMonthFromDay;
    expect(day(0)).toBeNull();
    expect(day(32)).toBeNull();
    expect(day(-5)).toBeNull();
    expect(day('20')).toBeNull();   // saisie texte non convertie
    expect(day(null)).toBeNull();
    expect(day(20.7)).toBe(20);     // tronqué, jamais arrondi au-dessus
    expect(day(1)).toBe(1);
    expect(day(31)).toBe(31);
  });

  it('ignore une liste de mois exclus corrompue', () => {
    expect(readExcludedBillingMonths({ [EXCLUDED_BILLING_MONTHS_KEY]: 'pas un tableau' })).toEqual([]);
    expect(readExcludedBillingMonths({ [EXCLUDED_BILLING_MONTHS_KEY]: ['2026-04', 42, null] })).toEqual(['2026-04']);
  });
});

describe('getBillableMonthsFor — composition des deux filtres', () => {
  it('applique exclusion école ET date d\'inscription', () => {
    const rules = { excludedMonths: ['2026-04'], waiveArrivalMonthFromDay: null };
    expect(keys(getBillableMonthsFor(YEAR(), rules, '2026-02-10')))
      .toEqual(['2026-02', '2026-03', '2026-05', '2026-06']);
  });

  it('un mois décoché ne redevient jamais dû, même pour un élève présent toute l\'année', () => {
    const rules = { excludedMonths: ['2025-12'], waiveArrivalMonthFromDay: null };
    expect(keys(getBillableMonthsFor(YEAR(), rules))).not.toContain('2025-12');
  });

  it('cas complet : décembre décoché + arrivée le 24 novembre avec seuil à 20', () => {
    const rules = { excludedMonths: ['2025-12'], waiveArrivalMonthFromDay: 20 };
    // Novembre offert (24 >= 20), décembre décoché → il commence en janvier.
    expect(keys(getBillableMonthsFor(YEAR(), rules, '2025-11-24')))
      .toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('ne facture rien du tout à un élève arrivé après la fin de l\'année', () => {
    const rules = { excludedMonths: [], waiveArrivalMonthFromDay: null };
    expect(getBillableMonthsFor(YEAR(), rules, '2026-09-01')).toEqual([]);
  });
});

describe('isMonthOverdue', () => {
  afterEach(() => vi.useRealTimers());

  it('un mois payé n\'est jamais en retard, même très ancien', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    const [oct] = YEAR();
    expect(isMonthOverdue(oct, true)).toBe(false);
  });

  it('un mois impayé bascule en retard une fois l\'échéance passée', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    const [oct] = YEAR();
    expect(isMonthOverdue(oct, false)).toBe(true);
  });

  it('un mois impayé dont l\'échéance est à venir n\'est pas en retard', () => {
    vi.setSystemTime(new Date('2025-10-05T10:00:00Z'));
    const months = YEAR();
    expect(isMonthOverdue(months[5], false)).toBe(false); // mars 2026
  });
});

describe('getCurrentMonthIndex', () => {
  afterEach(() => vi.useRealTimers());

  it('trouve le mois courant dans l\'année', () => {
    vi.setSystemTime(new Date('2026-02-14T08:00:00Z'));
    expect(getCurrentMonthIndex(YEAR())).toBe(4); // 2026-02
  });

  it('retombe sur le premier mois avant l\'ouverture de l\'année', () => {
    vi.setSystemTime(new Date('2025-08-14T08:00:00Z'));
    expect(getCurrentMonthIndex(YEAR())).toBe(0);
  });

  it('retombe sur le dernier mois après la fermeture (grandes vacances)', () => {
    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'));
    expect(getCurrentMonthIndex(YEAR())).toBe(8); // 2026-06
  });

  it('ne plante pas sur une année vide', () => {
    expect(getCurrentMonthIndex([])).toBe(0);
  });

  it('retombe sur le dernier mois FACTURABLE quand le mois courant est décoché', () => {
    // Régression : la liste passée est déjà filtrée, l'index doit rester valide.
    vi.setSystemTime(new Date('2025-12-10T08:00:00Z'));
    const filtered = getSchoolBillableMonths(YEAR(), ['2025-12']);
    const idx = getCurrentMonthIndex(filtered);
    expect(filtered.some(m => m.index === idx)).toBe(true);
  });
});

describe('QR de paiement direct (élève → caisse)', () => {
  it('fait l\'aller-retour sans perte pour chaque type', () => {
    const cases = [
      { enrollmentId: 'e1', type: 'inscription' as const },
      { enrollmentId: 'e1', type: 'tuition' as const, monthKey: '2026-01' },
      { enrollmentId: 'e1', type: 'service' as const, serviceId: 's1', monthKey: '2026-01' },
      { enrollmentId: 'e1', type: 'service' as const, serviceId: 's1' },
    ];
    for (const intent of cases) {
      expect(decodePaymentIntent(encodePaymentIntent(intent))).toEqual(intent);
    }
  });

  it('tolère les espaces autour du code scanné', () => {
    expect(decodePaymentIntent('  PAY|e1|inscription \n')).toEqual({ enrollmentId: 'e1', type: 'inscription' });
  });

  it('refuse tout code qui n\'est pas une intention de paiement valide', () => {
    expect(decodePaymentIntent('')).toBeNull();
    expect(decodePaymentIntent('bonjour')).toBeNull();
    expect(decodePaymentIntent('PAY|e1')).toBeNull();              // trop court
    expect(decodePaymentIntent('AUTRE|e1|tuition|2026-01')).toBeNull(); // mauvais préfixe
    expect(decodePaymentIntent('PAY||tuition|2026-01')).toBeNull();  // pas d'élève
    expect(decodePaymentIntent('PAY|e1|tuition')).toBeNull();        // mois manquant
    expect(decodePaymentIntent('PAY|e1|service')).toBeNull();        // service manquant
    expect(decodePaymentIntent('PAY|e1|cadeau')).toBeNull();         // type inconnu
  });

  it('reconstruit l\'identifiant d\'élément attendu par la caisse', () => {
    expect(paymentIntentToItemId({ enrollmentId: 'e', type: 'inscription' })).toBe('inscription');
    expect(paymentIntentToItemId({ enrollmentId: 'e', type: 'tuition', monthKey: '2026-01' })).toBe('tuition_2026-01');
    expect(paymentIntentToItemId({ enrollmentId: 'e', type: 'service', serviceId: 's1', monthKey: '2026-01' }))
      .toBe('service_s1_2026-01');
    expect(paymentIntentToItemId({ enrollmentId: 'e', type: 'service', serviceId: 's1' })).toBe('service_s1');
  });
});
