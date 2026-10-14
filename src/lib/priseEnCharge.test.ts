import { describe, it, expect } from 'vitest';
import { fraisCouvert, partager, type PriseEnCharge } from './priseEnCharge';

// ════════════════════════════════════════════════════════════════════════════
// Prise en charge par un organisme : un PARTAGE du frais, jamais une réduction.
// Les deux parts font toujours exactement ce qui est dû à l'école.
// ════════════════════════════════════════════════════════════════════════════

const fpt: PriseEnCharge = { organisme: '3FPT', pourcentage: 90, frais: { inscription: true, mensualites: true, services: ['cantine'] } };

describe('partager un frais', () => {
  it('3FPT : l\'organisme paie 90 %, l\'apprenant 10 %, la somme reste due en entier', () => {
    expect(partager(25_000, fpt, { type: 'tuition' })).toEqual({ apprenant: 2_500, organisme: 22_500 });
    expect(partager(50_000, fpt, { type: 'inscription' })).toEqual({ apprenant: 5_000, organisme: 45_000 });
  });

  it('arrondi au franc : les deux parts font toujours le total exact', () => {
    const p = partager(15_333, fpt, { type: 'tuition' });
    expect(p.organisme).toBe(13_800);
    expect(p.apprenant + p.organisme).toBe(15_333);
  });

  it('un frais non coché reste entièrement à l\'apprenant', () => {
    expect(partager(8_000, fpt, { type: 'service', serviceId: 'tenue' })).toEqual({ apprenant: 8_000, organisme: 0 });
    expect(partager(8_000, undefined, { type: 'tuition' })).toEqual({ apprenant: 8_000, organisme: 0 });
  });

  it('prise en charge totale : l\'apprenant ne paie rien', () => {
    expect(partager(25_000, { ...fpt, pourcentage: 100 }, { type: 'tuition' })).toEqual({ apprenant: 0, organisme: 25_000 });
  });

  it('frais couverts : inscription, mensualités, services cochés', () => {
    const sansMois = { ...fpt, frais: { inscription: true, mensualites: false, services: [] } };
    expect(fraisCouvert(sansMois, { type: 'inscription' })).toBe(true);
    expect(fraisCouvert(sansMois, { type: 'tuition' })).toBe(false);
    expect(fraisCouvert(fpt, { type: 'service', serviceId: 'cantine' })).toBe(true);
    expect(fraisCouvert(fpt, { type: 'service' })).toBe(false);
  });
});
