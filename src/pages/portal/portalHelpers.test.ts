import { describe, it, expect } from 'vitest';
import {
  weightedAvg, fmtGrade, gradeLevel, GP,
  fmtTime, fmtDateFull, fmtDateTimeFull, slotDuration, initials,
  monthKeyLabel, paymentLabel, paymentRef, fmtAmount,
  methodKey, methodLabel, methodColorCls,
  MONTHS_FULL, DAYS_LONG, DAYS_SHORT,
  type SubjectGrade, type Payment, type AnnexSvc,
} from './portalHelpers';

// ════════════════════════════════════════════════════════════════════════════
// PORTAIL ÉLÈVE / PARENT — tout ce qui est affiché ici est lu par une famille,
// souvent sur un téléphone. Un montant mal formaté, un mois faux ou un « NaN »
// sur un reçu, et c'est un appel au secrétariat.
// ════════════════════════════════════════════════════════════════════════════

const grade = (note: number | null, coefficient: number): SubjectGrade =>
  ({ id: 'g', subjectId: 's', subjectName: 'Maths', coefficient, periodId: 'p',
     devoir1: null, devoir2: null, devoir3: null, devoir4: null, devoir5: null,
     note } as unknown as SubjectGrade);

describe('weightedAvg — moyenne affichée à la famille', () => {
  it('pondère par les coefficients', () => {
    expect(weightedAvg([grade(10, 1), grade(16, 3)])).toBeCloseTo(14.5, 10);
  });

  it('IGNORE une matière non notée au lieu de la compter 0', () => {
    expect(weightedAvg([grade(12, 2), grade(null, 8)])).toBeCloseTo(12, 10);
  });

  it('rend null quand rien n\'est noté — pas 0, qui se lirait comme un zéro pointé', () => {
    expect(weightedAvg([])).toBeNull();
    expect(weightedAvg([grade(null, 3)])).toBeNull();
  });

  it('ne divise pas par zéro quand tous les coefficients sont nuls', () => {
    expect(weightedAvg([grade(12, 0)])).toBeNull();
  });
});

describe('fmtGrade / gradeLevel', () => {
  it('affiche deux décimales, et un tiret quand il n\'y a pas de note', () => {
    expect(fmtGrade(12.456)).toBe('12.46');
    expect(fmtGrade(12)).toBe('12.00');
    expect(fmtGrade(null)).toBe('—');
  });

  it('classe la note aux bons seuils', () => {
    expect(gradeLevel(16)).toBe('excellent');
    expect(gradeLevel(15.99)).toBe('bien');
    expect(gradeLevel(14)).toBe('bien');
    expect(gradeLevel(13.99)).toBe('passable');
    expect(gradeLevel(10)).toBe('passable');
    expect(gradeLevel(9.99)).toBe('insuffisant');
    expect(gradeLevel(0)).toBe('insuffisant');
    expect(gradeLevel(null)).toBe('none');
  });

  it('chaque niveau a une palette complète (aucune classe CSS vide à l\'écran)', () => {
    for (const level of ['excellent', 'bien', 'passable', 'insuffisant', 'none'] as const) {
      const p = GP[level];
      expect(p.bar && p.text && p.bg && p.border && p.mention, level).toBeTruthy();
    }
  });
});

describe('formats de date et d\'heure', () => {
  it('coupe les secondes d\'une heure', () => {
    expect(fmtTime('08:30:00')).toBe('08:30');
    expect(fmtTime('')).toBe('—');
  });

  it('écrit la date en toutes lettres', () => {
    expect(fmtDateFull('2026-09-02')).toBe('2 septembre 2026');
    expect(fmtDateFull('')).toBe('—');
  });

  it('ajoute l\'heure exacte pour l\'audit d\'un paiement', () => {
    const iso = new Date(2026, 8, 2, 18, 52).toISOString();
    expect(fmtDateTimeFull(iso)).toBe('2 septembre 2026 à 18:52');
  });

  it('zéro-pade les heures du matin', () => {
    const iso = new Date(2026, 0, 5, 7, 5).toISOString();
    expect(fmtDateTimeFull(iso)).toBe('5 janvier 2026 à 07:05');
  });

  it('les douze mois et les six jours d\'école sont nommés', () => {
    expect(MONTHS_FULL).toHaveLength(12);
    expect(DAYS_LONG).toHaveLength(6);
    expect(DAYS_SHORT).toHaveLength(6);
    expect(DAYS_LONG[0]).toBe('Lundi');
    expect(DAYS_LONG[5]).toBe('Samedi'); // l'école tourne le samedi au Sénégal
  });
});

describe('slotDuration', () => {
  it('écrit la durée d\'un cours', () => {
    expect(slotDuration('08:00', '10:00')).toBe('2h');
    expect(slotDuration('08:00', '09:30')).toBe('1h30');
    expect(slotDuration('08:00', '08:45')).toBe('45 min');
  });

  it('n\'affiche rien plutôt qu\'une durée négative ou nulle', () => {
    expect(slotDuration('10:00', '08:00')).toBe('');
    expect(slotDuration('10:00', '10:00')).toBe('');
  });
});

describe('initials', () => {
  it('prend les deux premières initiales', () => {
    expect(initials('Fatou Diop')).toBe('FD');
    expect(initials('Ndèye Fatou Diop')).toBe('NF'); // les deux PREMIERS mots
    expect(initials('Diop')).toBe('D');
  });

  it('ne rend jamais une pastille vide', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('montants et références', () => {
  it('formate un montant à la française avec la devise', () => {
    expect(fmtAmount(150000)).toMatch(/^150\s?000 FCFA$/);
    expect(fmtAmount(0)).toBe('0 FCFA');
  });

  it('dérive une référence courte et stable de l\'identifiant du paiement', () => {
    expect(paymentRef('a1b2c3d4-0000-0000-0000-000000000000')).toBe('A1B2C3D4');
    expect(paymentRef('')).toBe('—');
  });
});

describe('monthKeyLabel', () => {
  it('traduit une clé de mois en libellé lisible', () => {
    expect(monthKeyLabel('2025-11')).toBe('Novembre 2025');
    expect(monthKeyLabel('2026-01')).toBe('Janvier 2026');
  });

  it('n\'affiche rien quand il n\'y a pas de mois', () => {
    expect(monthKeyLabel(null)).toBe('');
    expect(monthKeyLabel(undefined)).toBe('');
  });

  it('affiche une donnée ancienne non migrée telle quelle, sans planter', () => {
    expect(monthKeyLabel('septembre')).toBe('septembre');
    expect(monthKeyLabel('2025-13')).toBe('2025-13'); // mois inexistant
  });
});

describe('paymentLabel — ligne de reçu', () => {
  const svc: AnnexSvc[] = [{ id: 'svc-1', name: 'Cantine', amount: 5000, frequency: 'monthly' }];
  const p = (over: Partial<Payment>): Payment =>
    ({ id: 'p1', type: 'tuition', serviceId: null, monthKey: null, amount: 0, paidAt: '',
       method: 'especes', reference: null, note: null, receivedBy: null,
       status: 'confirmed', cancelledAt: null, cancelledBy: null, ...over });

  it('nomme chaque type de paiement', () => {
    expect(paymentLabel(p({ type: 'inscription' }), svc)).toBe("Frais d'inscription");
    expect(paymentLabel(p({ type: 'tuition', monthKey: '2025-11' }), svc)).toBe('Scolarité — Novembre 2025');
    expect(paymentLabel(p({ type: 'service', serviceId: 'svc-1', monthKey: '2025-11' }), svc))
      .toBe('Cantine — Novembre 2025');
  });

  it('reste lisible quand le service a été supprimé depuis', () => {
    expect(paymentLabel(p({ type: 'service', serviceId: 'disparu' }), svc)).toBe('Service');
  });

  it('omet le mois pour un service annuel', () => {
    expect(paymentLabel(p({ type: 'service', serviceId: 'svc-1' }), svc)).toBe('Cantine');
  });

  it('n\'affiche pas "undefined" sur un type inconnu', () => {
    expect(paymentLabel(p({ type: 'bizarre' }), svc)).toBe('bizarre');
  });
});

describe('moyens de paiement', () => {
  it('reconnaît les moyens sénégalais quelle que soit l\'écriture', () => {
    expect(methodKey('especes')).toBe('cash');
    expect(methodKey('Espèces')).toBe('cash');
    expect(methodKey('Wave')).toBe('mobile');
    expect(methodKey('orange_money')).toBe('mobile');
    expect(methodKey('Orange Money')).toBe('mobile');
    expect(methodKey('virement')).toBe('bank');
    expect(methodKey('Chèque')).toBe('cheque');
  });

  it('ne classe pas au hasard un moyen inconnu', () => {
    expect(methodKey('bitcoin')).toBe('other');
    expect(methodKey('')).toBe('other');
  });

  it('garde le nom exact du service mobile (Wave ≠ Orange Money pour le rapprochement)', () => {
    expect(methodLabel('Wave')).toBe('Wave');
    expect(methodLabel('Orange Money')).toBe('Orange Money');
  });

  it('donne un libellé propre aux autres moyens', () => {
    expect(methodLabel('especes')).toBe('Espèces');
    expect(methodLabel('virement')).toBe('Virement');
    expect(methodLabel('cheque')).toBe('Chèque');
    expect(methodLabel('')).toBe('—');
  });

  it('donne toujours une couleur, y compris à un moyen inconnu', () => {
    for (const m of ['especes', 'wave', 'virement', 'cheque', 'inconnu', '']) {
      expect(methodColorCls(m), m).toBeTruthy();
    }
  });
});
