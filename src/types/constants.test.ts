import { describe, it, expect } from 'vitest';
import {
  STUDENT_STATUS_LABELS, TEACHER_STATUS_LABELS,
  STUDENT_STATUS_COLORS, TEACHER_STATUS_COLORS,
  SESSION_ENTRY_STATUS,
  type StudentAttendanceStatus, type TeacherAttendanceStatus,
} from './attendance';
import {
  PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, SERVICE_FREQUENCY_LABELS,
  TUITION_BILLING_TIMING_LABELS, DEFAULT_TUITION_BILLING_TIMING,
  type PaymentMethod, type ServiceFrequency, type TuitionBillingTiming,
} from './payment';
import { PAYROLL_PAYMENT_TYPE_LABELS, type PayrollPaymentType } from './payroll';
import { DAYS, GROUP_OPTIONS, EVENT_COLORS } from './schedule';
import { methodKey } from '@/pages/portal/portalHelpers';

// ════════════════════════════════════════════════════════════════════════════
// TABLES DE LIBELLÉS — tout ce qui manque ici s'affiche « undefined » dans une
// pastille, sur un écran vu par une famille ou un comptable. C'est le genre de
// trou qu'on ne voit qu'en production, sur le statut le plus rare.
// ════════════════════════════════════════════════════════════════════════════

const STUDENT_STATUSES: StudentAttendanceStatus[] = ['present', 'absent', 'late', 'expelled'];
const TEACHER_STATUSES: TeacherAttendanceStatus[] = ['undefined', 'present', 'absent', 'late', 'incomplete'];
const METHODS: PaymentMethod[] = ['especes', 'wave', 'orange_money', 'virement', 'cheque'];
const FREQUENCIES: ServiceFrequency[] = ['monthly', 'annual', 'one_time'];

describe('présences', () => {
  it('chaque statut élève a un libellé ET une couleur', () => {
    for (const s of STUDENT_STATUSES) {
      expect(STUDENT_STATUS_LABELS[s], s).toBeTruthy();
      expect(STUDENT_STATUS_COLORS[s], s).toBeTruthy();
    }
  });

  it('chaque statut professeur a un libellé ET une couleur', () => {
    for (const s of TEACHER_STATUSES) {
      expect(TEACHER_STATUS_LABELS[s], s).toBeTruthy();
      expect(TEACHER_STATUS_COLORS[s], s).toBeTruthy();
    }
  });

  it('le statut "non saisi" du prof est nommé explicitement — c\'est lui qui bloque la paie', () => {
    expect(TEACHER_STATUS_LABELS.undefined).toBe('Non saisi');
  });

  it('les quatre états de saisie du calendrier sont tous habillés', () => {
    for (const key of ['not_entered', 'complete', 'incident', 'partial'] as const) {
      const s = SESSION_ENTRY_STATUS[key];
      expect(s.label && s.color && s.textColor, key).toBeTruthy();
    }
  });

  it('aucun libellé de statut n\'est dupliqué (deux états indiscernables à l\'écran)', () => {
    const labels = Object.values(TEACHER_STATUS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('paiements', () => {
  it('chaque moyen de paiement a un libellé et une icône', () => {
    for (const m of METHODS) {
      expect(PAYMENT_METHOD_LABELS[m], m).toBeTruthy();
      expect(PAYMENT_METHOD_ICONS[m], m).toBeTruthy();
    }
  });

  it('TOUT moyen de paiement enregistrable est reconnu par le portail', () => {
    // Le bug attrapé par les tests : la base stocke 'especes'/'cheque' sans
    // accent, le portail ne cherchait que les formes accentuées et affichait
    // un badge gris « autre » sur le reçu de la famille.
    for (const m of METHODS) {
      expect(methodKey(m), m).not.toBe('other');
    }
  });

  it('chaque fréquence de service a un libellé', () => {
    for (const f of FREQUENCIES) expect(SERVICE_FREQUENCY_LABELS[f], f).toBeTruthy();
  });

  it('les deux modes de facturation sont nommés, et le défaut en fait partie', () => {
    for (const t of ['advance', 'arrears'] as TuitionBillingTiming[]) {
      expect(TUITION_BILLING_TIMING_LABELS[t], t).toBeTruthy();
    }
    expect(TUITION_BILLING_TIMING_LABELS[DEFAULT_TUITION_BILLING_TIMING]).toBeTruthy();
  });
});

describe('salaires', () => {
  it('les deux modes de rémunération sont nommés', () => {
    for (const t of ['hourly', 'fixed'] as PayrollPaymentType[]) {
      expect(PAYROLL_PAYMENT_TYPE_LABELS[t], t).toBeTruthy();
    }
  });
});

describe('emploi du temps', () => {
  it('la semaine d\'école va du lundi au samedi', () => {
    expect(DAYS).toHaveLength(6);
    expect(DAYS[0]).toMatchObject({ index: 0, name: 'Lundi' });
    expect(DAYS[5]).toMatchObject({ index: 5, name: 'Samedi' });
  });

  it('les index de jours sont continus et sans trou', () => {
    expect(DAYS.map(d => d.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('chaque jour a un nom court pour l\'affichage mobile', () => {
    for (const d of DAYS) expect(d.short, d.name).toBeTruthy();
  });

  it('le premier groupe proposé est la classe entière', () => {
    expect(GROUP_OPTIONS[0].id).toBe('all');
    expect(GROUP_OPTIONS.map(g => g.id)).toEqual(['all', 'group_a', 'group_b', 'group_c']);
  });

  it('chaque groupe a un identifiant unique et un nom', () => {
    const ids = GROUP_OPTIONS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GROUP_OPTIONS) expect(g.name, g.id).toBeTruthy();
  });

  it('la palette de cours ne contient que des couleurs hexadécimales distinctes', () => {
    expect(EVENT_COLORS.length).toBeGreaterThan(3);
    for (const c of EVENT_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(EVENT_COLORS).size).toBe(EVENT_COLORS.length);
  });
});
