import { describe, expect, it } from 'vitest';
import {
  CONFIG_PAR_DEFAUT, cycleDuNiveau, estDernierePeriodeDeLAnnee, lireConfigScolarite, rangDeLaPeriode,
} from './configScolarite';

describe('configuration scolaire par cycle', () => {
  it('valeurs par défaut : élémentaire 3 trimestres à 5/10, collège et lycée 2 semestres à 10/20', () => {
    expect(lireConfigScolarite({})).toEqual({
      elementaire: { periodes: 3, seuil: 5 },
      college: { periodes: 2, seuil: 10 },
      lycee: { periodes: 2, seuil: 10 },
    });
    expect(lireConfigScolarite(null)).toEqual(CONFIG_PAR_DEFAUT);
  });

  it('reprend les réglages de l’école, et le défaut pour toute valeur invalide', () => {
    const c = lireConfigScolarite({ configScolarite: {
      elementaire: { periodes: 2, seuil: 6 },
      college: { periodes: 4, seuil: 25 },      // 4 périodes et 25/20 : impossibles
      lycee: { periodes: 3, seuil: 'dix' },
    } });
    expect(c.elementaire).toEqual({ periodes: 2, seuil: 6 });
    expect(c.college).toEqual({ periodes: 2, seuil: 10 });
    expect(c.lycee).toEqual({ periodes: 3, seuil: 10 });
  });

  it('cycle de chaque niveau', () => {
    expect(cycleDuNiveau('CI')).toBe('elementaire');
    expect(cycleDuNiveau('CM2')).toBe('elementaire');
    expect(cycleDuNiveau('6ème')).toBe('college');
    expect(cycleDuNiveau('3ème')).toBe('college');
    expect(cycleDuNiveau('2nde')).toBe('lycee');
    expect(cycleDuNiveau('Tle')).toBe('lycee');
    expect(cycleDuNiveau(undefined)).toBeUndefined();
  });

  it('rang de la période dans l’ordre de l’année, quel que soit l’ordre de la liste', () => {
    const periodes = [{ id: 'T3', ordering: 3 }, { id: 'T1', ordering: 1 }, { id: 'T2', ordering: 2 }];
    expect(rangDeLaPeriode('T1', periodes)).toBe(1);
    expect(rangDeLaPeriode('T3', periodes)).toBe(3);
    expect(rangDeLaPeriode('X', periodes)).toBeUndefined();
  });

  it('la décision finale tombe sur le 3e trimestre en élémentaire, le 2e semestre au collège et au lycée', () => {
    const c = CONFIG_PAR_DEFAUT;
    expect(estDernierePeriodeDeLAnnee(1, 'CE1', c)).toBe(false);
    expect(estDernierePeriodeDeLAnnee(2, 'CE1', c)).toBe(false);
    expect(estDernierePeriodeDeLAnnee(3, 'CE1', c)).toBe(true);
    expect(estDernierePeriodeDeLAnnee(1, '4ème', c)).toBe(false);
    expect(estDernierePeriodeDeLAnnee(2, '4ème', c)).toBe(true);
    expect(estDernierePeriodeDeLAnnee(2, 'Tle', c)).toBe(true);
    // Un lycée réglé en trimestres : le 2e n'est plus le dernier.
    const trimestres = { ...c, lycee: { periodes: 3 as const, seuil: 10 } };
    expect(estDernierePeriodeDeLAnnee(2, 'Tle', trimestres)).toBe(false);
    expect(estDernierePeriodeDeLAnnee(3, 'Tle', trimestres)).toBe(true);
    // Sans niveau ou hors des périodes de la classe : jamais de décision.
    expect(estDernierePeriodeDeLAnnee(3, undefined, c)).toBe(false);
    expect(estDernierePeriodeDeLAnnee(undefined, 'CE1', c)).toBe(false);
  });
});
