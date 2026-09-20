import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { moyennePubliee } from './moyennePubliee';

const periodes = [
  { id: 't1', name: '1er Trimestre', ordering: 1 },
  { id: 't2', name: '2e Trimestre', ordering: 2 },
  { id: 't3', name: '3e Trimestre', ordering: 3 },
];
const college = (m: number) => ({ ranking: { averageGeneral: m } });
const primaire = (m: number | undefined) => ({ ranking: { average: m } });

describe('moyennePubliee — moyenne de l\'accueil élève', () => {
  it('rien de publié → aucune moyenne (même si des notes existent)', () => {
    expect(moyennePubliee([], periodes)).toBeNull();
  });

  it('lit la moyenne du bulletin publié (collège, sur 20)', () => {
    expect(moyennePubliee([{ periodId: 't1', data: college(13.456) }], periodes))
      .toEqual({ moyenne: 13.456, sur: 20, periodName: '1er Trimestre' });
  });

  it('lit la moyenne d\'un bulletin d\'élémentaire (sur 10)', () => {
    expect(moyennePubliee([{ periodId: 't1', data: primaire(7.5) }], periodes))
      .toEqual({ moyenne: 7.5, sur: 10, periodName: '1er Trimestre' });
  });

  it('prend la période la plus récente, pas la dernière publiée', () => {
    const r = moyennePubliee([
      { periodId: 't2', data: college(12) },
      { periodId: 't1', data: college(9) },
    ], periodes);
    expect(r?.periodName).toBe('2e Trimestre');
  });

  it('garde une moyenne de 0 (zéro n\'est pas « absent »)', () => {
    expect(moyennePubliee([{ periodId: 't1', data: college(0) }], periodes)?.moyenne).toBe(0);
  });

  it('ignore un instantané sans moyenne et retombe sur la période précédente', () => {
    const r = moyennePubliee([
      { periodId: 't2', data: primaire(undefined) },
      { periodId: 't1', data: primaire(6) },
    ], periodes);
    expect(r?.periodName).toBe('1er Trimestre');
  });

  it('ne plante pas et ne renvoie rien sur des données abîmées', () => {
    expect(moyennePubliee([
      { periodId: 't1', data: null },
      { periodId: 't2', data: { ranking: 'x' } },
      { periodId: 't3', data: { ranking: { averageGeneral: NaN } } },
    ], periodes)).toBeNull();
  });

  it('ignore un bulletin dont la période n\'existe plus', () => {
    expect(moyennePubliee([{ periodId: 'zz', data: college(15) }], periodes)).toBeNull();
  });
});

describe('accueil élève — garde-fou', () => {
  const src = readFileSync('src/pages/portal/PortalAccueil.tsx', 'utf8');
  it('ne télécharge que la moyenne du bulletin, pas l\'instantané complet (logo, classement)', () => {
    expect(src).toContain('data->ranking->averageGeneral');
    expect(src).not.toMatch(/select\('period_id, data'\)/);
  });
  it('ne calcule plus la moyenne à partir des notes en cours de saisie', () => {
    expect(src).not.toMatch(/weightedAvg\s*\(/);
    expect(src).toContain("from('published_bulletins')");
  });
});

describe('moyennePubliee — valeur nulle renvoyée par le serveur', () => {
  it('collège : averageGeneral présent, average nul → sur 20', () => {
    expect(moyennePubliee([{ periodId: 't1', data: { ranking: { averageGeneral: 12.5, average: null } } }], periodes))
      .toMatchObject({ moyenne: 12.5, sur: 20 });
  });
  it('élémentaire : averageGeneral nul, average présent → sur 10', () => {
    expect(moyennePubliee([{ periodId: 't1', data: { ranking: { averageGeneral: null, average: 7 } } }], periodes))
      .toMatchObject({ moyenne: 7, sur: 10 });
  });
});
