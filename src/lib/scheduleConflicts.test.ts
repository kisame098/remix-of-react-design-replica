import { describe, it, expect } from 'vitest';
import { findScheduleConflicts, doTimesIntersect, validateTimeRange } from './scheduleConflicts';
import { generateTimeSlots, DEFAULT_MIN_HOUR, DEFAULT_MAX_HOUR } from '@/types/schedule';
import type { ScheduleEvent } from '@/types/schedule';

// ════════════════════════════════════════════════════════════════════════════
// EMPLOI DU TEMPS — un prof placé sur deux cours en même temps désorganise une
// journée entière, puis fausse les présences et la paie horaire.
// ════════════════════════════════════════════════════════════════════════════

const ev = (over: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id: 'e1', dayIndex: 0, startTime: '08:00', endTime: '10:00',
  classId: 'cls-1', className: '6ème A', teacherId: 'prof-1', teacherName: 'M. Diop',
  subjectName: 'Maths', groupId: 'all', groupName: 'Classe Entière', color: '#3b82f6',
  ...over,
} as ScheduleEvent);

describe('doTimesIntersect', () => {
  it('reconnaît un chevauchement partiel des deux côtés', () => {
    expect(doTimesIntersect('08:00', '10:00', '09:00', '11:00')).toBe(true);
    expect(doTimesIntersect('09:00', '11:00', '08:00', '10:00')).toBe(true);
  });

  it('reconnaît un créneau entièrement contenu dans l\'autre', () => {
    expect(doTimesIntersect('08:00', '12:00', '09:00', '10:00')).toBe(true);
  });

  it('NE considère PAS deux cours bout à bout comme un chevauchement', () => {
    // 10h-11h puis 11h-12h : c'est une journée normale, pas un conflit.
    expect(doTimesIntersect('10:00', '11:00', '11:00', '12:00')).toBe(false);
  });

  it('ignore deux créneaux disjoints', () => {
    expect(doTimesIntersect('08:00', '09:00', '14:00', '15:00')).toBe(false);
  });
});

describe('validateTimeRange', () => {
  it('exige une fin strictement après le début', () => {
    expect(validateTimeRange('08:00', '10:00')).toBe(true);
    expect(validateTimeRange('10:00', '08:00')).toBe(false);
    expect(validateTimeRange('08:00', '08:00')).toBe(false);
  });

  it('accepte les horaires tardifs (cours du soir jusqu\'à 19h et au-delà)', () => {
    expect(validateTimeRange('18:00', '19:00')).toBe(true);
    expect(validateTimeRange('19:00', '20:30')).toBe(true);
  });
});

describe('findScheduleConflicts — professeur', () => {
  it('refuse de placer un prof sur deux cours qui se chevauchent', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', classId: 'cls-2', className: '5ème B' })],
      ev({ id: 'nouveau', classId: 'cls-3', startTime: '09:00', endTime: '11:00' }),
    );
    expect(c.some(x => x.type === 'teacher' && x.severity === 'hard')).toBe(true);
  });

  it('laisse le même prof enchaîner deux cours bout à bout', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', startTime: '08:00', endTime: '10:00' })],
      ev({ id: 'nouveau', classId: 'cls-2', startTime: '10:00', endTime: '12:00' }),
    );
    expect(c).toEqual([]);
  });

  it('laisse le même prof travailler à la même heure un autre jour', () => {
    const c = findScheduleConflicts([ev({ id: 'existant', dayIndex: 0 })], ev({ id: 'nouveau', dayIndex: 1, classId: 'cls-2' }));
    expect(c).toEqual([]);
  });

  it('ne crée pas de conflit prof quand le nouveau cours n\'a pas de prof assigné', () => {
    const c = findScheduleConflicts([ev({ id: 'existant' })], ev({ id: 'nouveau', classId: 'cls-2', teacherId: undefined }));
    expect(c.some(x => x.type === 'teacher')).toBe(false);
  });
});

describe('findScheduleConflicts — classe et groupes', () => {
  it('refuse un cours "Classe Entière" par-dessus un cours de groupe', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', groupId: 'group_a', groupName: 'Groupe A', teacherId: 'prof-2' })],
      ev({ id: 'nouveau', groupId: 'all', teacherId: 'prof-3' }),
    );
    expect(c.some(x => x.type === 'class')).toBe(true);
  });

  it('refuse un cours de groupe par-dessus un cours "Classe Entière"', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', groupId: 'all', teacherId: 'prof-2' })],
      ev({ id: 'nouveau', groupId: 'group_a', teacherId: 'prof-3' }),
    );
    expect(c.some(x => x.type === 'class')).toBe(true);
  });

  it('refuse deux cours pour LE MÊME groupe', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', groupId: 'group_a', teacherId: 'prof-2' })],
      ev({ id: 'nouveau', groupId: 'group_a', teacherId: 'prof-3' }),
    );
    expect(c.some(x => x.type === 'class')).toBe(true);
  });

  it('AUTORISE deux groupes différents en parallèle — c\'est l\'intérêt des groupes', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', groupId: 'group_a', teacherId: 'prof-2' })],
      ev({ id: 'nouveau', groupId: 'group_b', teacherId: 'prof-3' }),
    );
    expect(c).toEqual([]);
  });

  it('n\'oppose pas deux classes différentes', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', classId: 'cls-1', teacherId: 'prof-2' })],
      ev({ id: 'nouveau', classId: 'cls-2', teacherId: 'prof-3' }),
    );
    expect(c).toEqual([]);
  });
});

describe('findScheduleConflicts — cas limites', () => {
  it('refuse un créneau dont la fin précède le début, sans regarder les autres cours', () => {
    const c = findScheduleConflicts([], ev({ startTime: '11:00', endTime: '09:00' }));
    expect(c).toHaveLength(1);
    expect(c[0].message).toContain('doit être après');
  });

  it('ignore le cours qu\'on est en train de modifier (excludeEventId)', () => {
    const existing = ev({ id: 'e1' });
    expect(findScheduleConflicts([existing], { ...existing, endTime: '11:00' }, 'e1')).toEqual([]);
    // …mais le signale si on ne l'exclut pas.
    expect(findScheduleConflicts([existing], { ...existing, id: 'autre', endTime: '11:00' }).length).toBeGreaterThan(0);
  });

  it('ne conclut rien tant que le créneau est incomplet', () => {
    expect(findScheduleConflicts([ev()], { classId: 'cls-1' })).toEqual([]);
    expect(findScheduleConflicts([ev()], { dayIndex: 0, startTime: '08:00' })).toEqual([]);
  });

  it('cumule conflit prof ET conflit classe quand les deux se produisent', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'existant', groupId: 'all' })],
      ev({ id: 'nouveau', groupId: 'all' }),
    );
    expect(c.map(x => x.type).sort()).toEqual(['class', 'teacher']);
  });

  it('signale tous les cours en conflit, pas seulement le premier', () => {
    const c = findScheduleConflicts(
      [ev({ id: 'a', classId: 'cls-9', teacherId: 'prof-1' }), ev({ id: 'b', classId: 'cls-8', teacherId: 'prof-1' })],
      ev({ id: 'nouveau', classId: 'cls-7' }),
    );
    expect(c.filter(x => x.type === 'teacher')).toHaveLength(2);
  });
});

describe('generateTimeSlots', () => {
  it('produit un créneau par heure entre les bornes de l\'école', () => {
    const slots = generateTimeSlots('08:00', '11:00');
    expect(slots.map(s => s.label)).toEqual(['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00']);
  });

  it('couvre les horaires par défaut de 7h à 18h', () => {
    const slots = generateTimeSlots();
    expect(slots[0].start).toBe(DEFAULT_MIN_HOUR);
    expect(slots[slots.length - 1].end).toBe(DEFAULT_MAX_HOUR);
    expect(slots).toHaveLength(11);
  });

  it('permet les cours du soir quand l\'école étend ses horaires', () => {
    const slots = generateTimeSlots('07:00', '20:00');
    expect(slots.some(s => s.start === '19:00')).toBe(true);
  });

  it('retombe sur les horaires par défaut si les bornes sont absurdes', () => {
    expect(generateTimeSlots('18:00', '08:00')).toEqual(generateTimeSlots());
    expect(generateTimeSlots('abc', 'def')).toEqual(generateTimeSlots());
    expect(generateTimeSlots('10:00', '10:00')).toEqual(generateTimeSlots());
  });
});
