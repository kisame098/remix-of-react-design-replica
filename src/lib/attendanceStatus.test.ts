import { describe, it, expect } from 'vitest';
import { getSessionEntryStatus } from './attendanceStatus';
import type {
  AttendanceSession, StudentAttendance, TeacherAttendance,
  StudentAttendanceStatus, TeacherAttendanceStatus,
} from '@/types/attendance';

// ════════════════════════════════════════════════════════════════════════════
// PASTILLE DE SAISIE DU CALENDRIER DES PRÉSENCES — ce que le surveillant lit
// d'un coup d'œil pour savoir ce qu'il lui reste à faire. Une séance montrée
// « complète » alors qu'elle ne l'est pas, ce sont des absences jamais
// signalées aux parents et des heures de prof jamais validées.
// ════════════════════════════════════════════════════════════════════════════

const session = (over: Partial<AttendanceSession> = {}): AttendanceSession => ({
  id: 's1', scheduleEventId: 'ev1', date: '2026-05-04', dayIndex: 0,
  startTime: '08:00', endTime: '10:00', classId: 'cls-1', className: '6ème A',
  teacherId: 'prof-1', teacherName: 'M. Diop', subjectName: 'Maths',
  groupId: 'all', groupName: 'Classe Entière',
  studentAttendanceComplete: true, teacherAttendanceComplete: true, ...over,
});

const student = (status: StudentAttendanceStatus, id = 'a1'): StudentAttendance => ({
  id, sessionId: 's1', studentId: 'enr-1', status,
  isJustified: false, recordedAt: new Date(),
});

const teacher = (status: TeacherAttendanceStatus): TeacherAttendance => ({
  id: 't1', sessionId: 's1', teacherId: 'prof-1', status,
  effectiveMinutes: status === 'present' ? 120 : 0, theoreticalMinutes: 120,
  recordedAt: new Date(), isLocked: false,
});

describe('getSessionEntryStatus', () => {
  it('« non saisi » tant que rien n\'a été pointé', () => {
    expect(getSessionEntryStatus(session(), [], undefined)).toBe('not_entered');
  });

  it('« non saisi » aussi quand le prof est explicitement à "non saisi"', () => {
    expect(getSessionEntryStatus(session(), [], teacher('undefined'))).toBe('not_entered');
  });

  it('« complète » quand tout le monde est présent et les deux volets validés', () => {
    expect(getSessionEntryStatus(session(), [student('present')], teacher('present'))).toBe('complete');
  });

  it('« incident » dès qu\'un élève est absent, en retard ou renvoyé', () => {
    for (const s of ['absent', 'late', 'expelled'] as StudentAttendanceStatus[]) {
      expect(getSessionEntryStatus(session(), [student(s)], teacher('present')), s).toBe('incident');
    }
  });

  it('« incident » quand le prof est absent, en retard ou a écourté son cours', () => {
    for (const s of ['absent', 'late', 'incomplete'] as TeacherAttendanceStatus[]) {
      expect(getSessionEntryStatus(session(), [student('present')], teacher(s)), s).toBe('incident');
    }
  });

  it('L\'INCIDENT L\'EMPORTE sur une saisie inachevée — un problème doit se voir', () => {
    const incomplete = session({ studentAttendanceComplete: false });
    expect(getSessionEntryStatus(incomplete, [student('absent')], teacher('present'))).toBe('incident');
  });

  it('« partielle » quand la saisie élèves n\'est pas validée', () => {
    const s = session({ studentAttendanceComplete: false });
    expect(getSessionEntryStatus(s, [student('present')], teacher('present'))).toBe('partial');
  });

  it('« partielle » quand le pointage du prof n\'est pas validé — c\'est sa paie', () => {
    const s = session({ teacherAttendanceComplete: false });
    expect(getSessionEntryStatus(s, [student('present')], teacher('present'))).toBe('partial');
  });

  it('une séance où seul le prof est pointé n\'est PAS « non saisi »', () => {
    // Quelque chose a été fait : la pastille doit le montrer.
    expect(getSessionEntryStatus(session(), [], teacher('present'))).toBe('complete');
    expect(getSessionEntryStatus(session(), [], teacher('absent'))).toBe('incident');
  });

  it('une séance où seuls les élèves sont pointés remonte aussi un incident', () => {
    expect(getSessionEntryStatus(session(), [student('absent')], undefined)).toBe('incident');
  });

  it('« non saisi » pour une séance inconnue, plutôt que de planter', () => {
    expect(getSessionEntryStatus(undefined, [student('absent')], teacher('absent'))).toBe('not_entered');
  });

  it('un seul élève absent suffit à signaler l\'incident sur toute la classe', () => {
    const atts = [student('present', 'a1'), student('present', 'a2'), student('absent', 'a3')];
    expect(getSessionEntryStatus(session(), atts, teacher('present'))).toBe('incident');
  });

  it('rend toujours l\'un des quatre états attendus', () => {
    const cases: [StudentAttendance[], TeacherAttendance | undefined][] = [
      [[], undefined], [[student('present')], undefined],
      [[], teacher('present')], [[student('late')], teacher('incomplete')],
    ];
    for (const [atts, t] of cases) {
      expect(['not_entered', 'complete', 'incident', 'partial'])
        .toContain(getSessionEntryStatus(session(), atts, t));
    }
  });
});
