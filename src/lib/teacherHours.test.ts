import { describe, it, expect } from 'vitest';
import { computeMonthlyHours, calcDuration, timeToMinutes } from './teacherHours';
import type { AttendanceSession, TeacherAttendance, TeacherAttendanceStatus } from '@/types/attendance';

// ════════════════════════════════════════════════════════════════════════════
// SALAIRE D'UN PROF PAYÉ À L'HEURE = heures effectives × taux horaire.
// Règle de sécurité financière : une séance non pointée ne rapporte RIEN.
// ════════════════════════════════════════════════════════════════════════════

const TEACHER = 'prof-1';

const session = (id: string, date: string, startTime = '08:00', endTime = '10:00',
                 over: Partial<AttendanceSession> = {}): AttendanceSession => ({
  id, scheduleEventId: `ev-${id}`, date, dayIndex: 0, startTime, endTime,
  classId: 'cls-1', className: '6ème A', teacherId: TEACHER, teacherName: 'M. Diop',
  subjectName: 'Maths', groupId: '', groupName: '',
  studentAttendanceComplete: false, teacherAttendanceComplete: false, ...over,
});

const att = (sessionId: string, status: TeacherAttendanceStatus,
             effectiveMinutes: number, theoreticalMinutes = 120): TeacherAttendance => ({
  id: `a-${sessionId}`, sessionId, teacherId: TEACHER, status,
  effectiveMinutes, theoreticalMinutes, recordedAt: new Date(), isLocked: false,
});

const run = (sessions: AttendanceSession[], atts: TeacherAttendance[]) =>
  computeMonthlyHours(TEACHER, 5, 2026, 'M. Diop', sessions, atts);

describe('timeToMinutes / calcDuration', () => {
  it('convertit une heure en minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('19:00')).toBe(1140);
  });

  it('mesure la durée d\'un créneau', () => {
    expect(calcDuration('08:00', '10:00')).toBe(120);
    expect(calcDuration('08:15', '09:00')).toBe(45);
  });

  it('ne rend JAMAIS une durée négative (heures saisies à l\'envers)', () => {
    // Une durée négative retrancherait des heures payées aux autres séances.
    expect(calcDuration('10:00', '08:00')).toBe(0);
  });

  it('vaut 0 plutôt que NaN sur une heure illisible', () => {
    expect(calcDuration('', '10:00')).toBe(600);
    expect(calcDuration('08:00', 'midi')).toBe(0);
    expect(Number.isNaN(calcDuration('x', 'y'))).toBe(false);
  });
});

describe('computeMonthlyHours', () => {
  it('additionne théorique et effectif des séances validées', () => {
    const r = run(
      [session('s1', '2026-05-04'), session('s2', '2026-05-11', '08:00', '09:30')],
      [att('s1', 'present', 120), att('s2', 'present', 90, 90)],
    );
    expect(r.totalTheoreticalMinutes).toBe(120 + 90);
    expect(r.totalEffectiveMinutes).toBe(210);
    expect(r.validatedSessions).toBe(2);
  });

  it('NE PAIE PAS une séance non pointée — l\'horaire théorique ne suffit pas', () => {
    const r = run([session('s1', '2026-05-04')], []);
    expect(r.totalTheoreticalMinutes).toBe(120);
    expect(r.totalEffectiveMinutes).toBe(0);
    expect(r.undefinedSessions).toBe(1);
  });

  it('traite un pointage explicitement "undefined" comme non pointé', () => {
    const r = run([session('s1', '2026-05-04')], [att('s1', 'undefined', 120)]);
    expect(r.totalEffectiveMinutes).toBe(0);
    expect(r.undefinedSessions).toBe(1);
  });

  it('ne paie rien pour une absence, mais la compte', () => {
    const r = run([session('s1', '2026-05-04')], [att('s1', 'absent', 0)]);
    expect(r.totalEffectiveMinutes).toBe(0);
    expect(r.absentSessions).toBe(1);
    expect(r.validatedSessions).toBe(0);
  });

  it('paie les minutes réellement faites en cas de retard ou de cours écourté', () => {
    const r = run(
      [session('s1', '2026-05-04'), session('s2', '2026-05-05')],
      [att('s1', 'late', 90), att('s2', 'incomplete', 60)],
    );
    expect(r.totalEffectiveMinutes).toBe(150);   // et non 240 théoriques
    expect(r.totalTheoreticalMinutes).toBe(240);
    expect(r.validatedSessions).toBe(2);
  });

  it('ne compte que le mois demandé', () => {
    const r = run(
      [session('s1', '2026-05-31'), session('s2', '2026-06-01'), session('s3', '2026-04-30')],
      [att('s1', 'present', 120), att('s2', 'present', 120), att('s3', 'present', 120)],
    );
    expect(r.totalSessions).toBe(1);
    expect(r.totalEffectiveMinutes).toBe(120);
  });

  it('ne confond pas les mois à un chiffre (mai ≠ 2026-05 vs 2026-5)', () => {
    const r = computeMonthlyHours(TEACHER, 5, 2026, 'M. Diop',
      [session('s1', '2026-05-04')], [att('s1', 'present', 120)]);
    expect(r.totalSessions).toBe(1);
  });

  it('ne compte que les séances de CE prof', () => {
    const r = run(
      [session('s1', '2026-05-04'), session('s2', '2026-05-05', '08:00', '10:00', { teacherId: 'autre' })],
      [att('s1', 'present', 120), { ...att('s2', 'present', 120), teacherId: 'autre' }],
    );
    expect(r.totalSessions).toBe(1);
    expect(r.totalEffectiveMinutes).toBe(120);
  });

  it('ignore un pointage d\'un autre prof sur la même séance', () => {
    const r = run(
      [session('s1', '2026-05-04')],
      [{ ...att('s1', 'present', 120), teacherId: 'remplacant' }],
    );
    expect(r.totalEffectiveMinutes).toBe(0);
    expect(r.undefinedSessions).toBe(1);
  });

  it('rend un bilan vide et non NaN pour un mois sans séance', () => {
    const r = run([], []);
    expect(r).toMatchObject({
      totalTheoreticalMinutes: 0, totalEffectiveMinutes: 0,
      totalSessions: 0, validatedSessions: 0, undefinedSessions: 0, absentSessions: 0,
    });
  });

  it('le total des séances se répartit exactement entre validées, absentes et non pointées', () => {
    const r = run(
      [session('s1', '2026-05-04'), session('s2', '2026-05-05'), session('s3', '2026-05-06')],
      [att('s1', 'present', 120), att('s2', 'absent', 0)],
    );
    expect(r.validatedSessions + r.absentSessions + r.undefinedSessions).toBe(r.totalSessions);
  });

  it('sert de base au salaire : heures × taux', () => {
    const r = run(
      [session('s1', '2026-05-04'), session('s2', '2026-05-05', '08:00', '11:00')],
      [att('s1', 'present', 120), att('s2', 'present', 180, 180)],
    );
    const heures = r.totalEffectiveMinutes / 60;
    expect(heures).toBe(5);
    expect(heures * 3_000).toBe(15_000); // 3 000 FCFA/h
  });
});
