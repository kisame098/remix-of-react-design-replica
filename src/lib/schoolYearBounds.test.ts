import { describe, it, expect } from 'vitest';
import {
  isDateInSchoolYear, clampDateToSchoolYear, clampDateObjToSchoolYear,
  type YearBounds,
} from './schoolYearBounds';

// ════════════════════════════════════════════════════════════════════════════
// BORNES DE L'ANNÉE SCOLAIRE. Une séance créée un jour de vacances serait quand
// même estampillée de l'année courante : elle gonflerait les heures du prof
// (donc sa paie) et les stats d'assiduité, sans être visible nulle part.
// ════════════════════════════════════════════════════════════════════════════

const YEAR: YearBounds = { startDate: '2025-10-01', endDate: '2026-06-30' };

describe('isDateInSchoolYear', () => {
  it('accepte un jour d\'école', () => {
    expect(isDateInSchoolYear('2026-01-15', YEAR)).toBe(true);
  });

  it('accepte les deux bornes elles-mêmes — le jour de la rentrée et celui de la fermeture', () => {
    expect(isDateInSchoolYear('2025-10-01', YEAR)).toBe(true);
    expect(isDateInSchoolYear('2026-06-30', YEAR)).toBe(true);
  });

  it('REFUSE la veille de la rentrée et le lendemain de la fermeture', () => {
    expect(isDateInSchoolYear('2025-09-30', YEAR)).toBe(false);
    expect(isDateInSchoolYear('2026-07-01', YEAR)).toBe(false);
  });

  it('refuse les grandes vacances', () => {
    expect(isDateInSchoolYear('2026-08-15', YEAR)).toBe(false);
  });

  it('ne compare pas les dates comme des nombres mal cadrés (9 < 10 en texte)', () => {
    // Piège classique : "2025-9-30" n'est pas zéro-paddé. Les dates de l'app le
    // sont toujours ; on vérifie ici que le format attendu se comporte bien.
    expect(isDateInSchoolYear('2025-11-05', YEAR)).toBe(true);
    expect(isDateInSchoolYear('2026-02-09', YEAR)).toBe(true);
  });

  it('ne bloque rien non plus quand l\'année n\'est configurée QU\'À MOITIÉ', () => {
    // Trou révélé par le test de mutation : seul le cas « les deux dates
    // manquent » était couvert. Une école qui a saisi sa rentrée mais pas
    // encore sa fermeture ne doit pas se retrouver avec une borne à sens
    // unique qui interdit la moitié de l'année.
    expect(isDateInSchoolYear('2026-01-15', { startDate: '2025-10-01', endDate: '' })).toBe(true);
    expect(isDateInSchoolYear('2020-01-15', { startDate: '2025-10-01', endDate: '' })).toBe(true);
    expect(isDateInSchoolYear('2026-01-15', { startDate: '', endDate: '2026-06-30' })).toBe(true);
    expect(isDateInSchoolYear('2099-01-15', { startDate: '', endDate: '2026-06-30' })).toBe(true);
  });

  it('ne ramène rien non plus sur une année à moitié configurée', () => {
    expect(clampDateToSchoolYear('2020-01-01', { startDate: '2025-10-01', endDate: '' })).toBe('2020-01-01');
    expect(clampDateToSchoolYear('2099-01-01', { startDate: '', endDate: '2026-06-30' })).toBe('2099-01-01');
  });

  it('NE BLOQUE RIEN quand l\'année n\'est pas encore configurée', () => {
    // Sûreté : mieux vaut laisser travailler une école qui n'a pas rempli ses
    // dates que de lui interdire toute saisie de présence.
    expect(isDateInSchoolYear('2026-01-15', null)).toBe(true);
    expect(isDateInSchoolYear('2026-01-15', undefined)).toBe(true);
    expect(isDateInSchoolYear('2026-01-15', { startDate: '', endDate: '' })).toBe(true);
  });
});

describe('clampDateToSchoolYear', () => {
  it('laisse une date valide intacte', () => {
    expect(clampDateToSchoolYear('2026-01-15', YEAR)).toBe('2026-01-15');
  });

  it('ramène une date trop tôt sur le jour de la rentrée', () => {
    expect(clampDateToSchoolYear('2025-08-01', YEAR)).toBe('2025-10-01');
  });

  it('ramène une date trop tard sur le dernier jour de l\'année', () => {
    // Le cas réel : on ouvre l'écran Présences en plein mois d'août.
    expect(clampDateToSchoolYear('2026-08-20', YEAR)).toBe('2026-06-30');
  });

  it('ne touche à rien sans année configurée', () => {
    expect(clampDateToSchoolYear('2026-08-20', null)).toBe('2026-08-20');
  });

  it('ce qui sort est toujours dans l\'année', () => {
    for (const d of ['2020-01-01', '2025-10-01', '2026-03-12', '2026-06-30', '2099-12-31']) {
      expect(isDateInSchoolYear(clampDateToSchoolYear(d, YEAR), YEAR), d).toBe(true);
    }
  });
});

describe('clampDateObjToSchoolYear (sélecteur de calendrier)', () => {
  const bounds = { start: new Date('2025-10-01T00:00:00'), end: new Date('2026-06-30T00:00:00') };

  it('laisse passer une date valide', () => {
    const d = new Date('2026-01-15T00:00:00');
    expect(clampDateObjToSchoolYear(d, bounds)).toBe(d);
  });

  it('ramène sur la borne la plus proche', () => {
    expect(clampDateObjToSchoolYear(new Date('2025-07-01T00:00:00'), bounds)).toBe(bounds.start);
    expect(clampDateObjToSchoolYear(new Date('2026-09-01T00:00:00'), bounds)).toBe(bounds.end);
  });

  it('ne touche à rien sans bornes', () => {
    const d = new Date('2026-09-01T00:00:00');
    expect(clampDateObjToSchoolYear(d, null)).toBe(d);
  });

  it('s\'accorde avec la version texte utilisée par la garde d\'enregistrement', () => {
    // Les deux implémentations doivent donner le même verdict, sinon l'écran
    // proposerait une date que la base refuserait ensuite.
    const cases = ['2025-09-30', '2025-10-01', '2026-03-01', '2026-06-30', '2026-07-01'];
    for (const iso of cases) {
      const viaTexte = clampDateToSchoolYear(iso, YEAR);
      const viaDate = clampDateObjToSchoolYear(new Date(`${iso}T00:00:00`), bounds);
      const isoFromDate = `${viaDate.getFullYear()}-${String(viaDate.getMonth() + 1).padStart(2, '0')}-${String(viaDate.getDate()).padStart(2, '0')}`;
      expect(isoFromDate, iso).toBe(viaTexte);
    }
  });
});
