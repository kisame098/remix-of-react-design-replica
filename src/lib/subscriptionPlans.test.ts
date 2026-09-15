import { describe, it, expect } from 'vitest';
import {
  FORMULES, TARIF_MENSUEL, FORMULE_PAR_DEFAUT, trouverFormule,
  prixPlein, economie, remisePourcent, prixParMois, nomDuPlan,
} from './subscriptionPlans';

// ════════════════════════════════════════════════════════════════════════════
// GRILLE D'ABONNEMENT — c'est ce que l'école paie. Une remise mal calculée se
// voit immédiatement (une école qui paie 12 mois et en reçoit 6), et une
// remise affichée qui ne correspond pas au prix débité est un mensonge
// commercial.
// ════════════════════════════════════════════════════════════════════════════

describe('cohérence de la grille', () => {
  it('propose bien toutes les durées annoncées, de 1 mois à 1 an', () => {
    expect(FORMULES.map(f => f.mois)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
  });

  it('le mois seul est au tarif de référence, sans remise', () => {
    const un = trouverFormule(1)!;
    expect(un.prix).toBe(TARIF_MENSUEL);
    expect(remisePourcent(un)).toBe(0);
    expect(economie(un)).toBe(0);
  });

  it('PAYER PLUS LONGTEMPS NE COÛTE JAMAIS PLUS CHER AU MOIS', () => {
    // L'erreur qui ruinerait la grille : une formule longue plus chère au mois
    // qu'une courte. Le prix au mois doit décroître, sans exception.
    for (let i = 1; i < FORMULES.length; i++) {
      expect(prixParMois(FORMULES[i]),
        `${FORMULES[i].libelle} coûte plus cher au mois que ${FORMULES[i - 1].libelle}`)
        .toBeLessThan(prixParMois(FORMULES[i - 1]));
    }
  });

  it('la remise grandit avec la durée, sans jamais reculer', () => {
    for (let i = 1; i < FORMULES.length; i++) {
      expect(remisePourcent(FORMULES[i]), FORMULES[i].libelle)
        .toBeGreaterThan(remisePourcent(FORMULES[i - 1]));
    }
  });

  it('le prix total grandit avec la durée — payer plus longtemps coûte plus cher', () => {
    for (let i = 1; i < FORMULES.length; i++) {
      expect(FORMULES[i].prix, FORMULES[i].libelle).toBeGreaterThan(FORMULES[i - 1].prix);
    }
  });

  it('LA REMISE RESTE MESURÉE — 20 % au maximum, jamais du bradage', () => {
    for (const f of FORMULES) {
      expect(remisePourcent(f), f.libelle).toBeLessThanOrEqual(20);
      expect(remisePourcent(f), f.libelle).toBeGreaterThanOrEqual(0);
    }
    expect(remisePourcent(trouverFormule(12)!)).toBe(20);
  });

  it('aucune formule ne coûte plus que le plein tarif', () => {
    for (const f of FORMULES) {
      expect(f.prix, f.libelle).toBeLessThanOrEqual(prixPlein(f.mois));
    }
  });

  it('tous les prix sont ronds — on n\'affiche pas 134 999 F à une école', () => {
    for (const f of FORMULES) {
      expect(f.prix % 500, `${f.libelle} : ${f.prix} F n'est pas un multiple de 500`).toBe(0);
    }
  });

  it('chaque durée n\'apparaît qu\'une fois et porte un libellé', () => {
    expect(new Set(FORMULES.map(f => f.mois)).size).toBe(FORMULES.length);
    for (const f of FORMULES) expect(f.libelle.length, String(f.mois)).toBeGreaterThan(0);
  });
});

describe('calculs affichés à l\'école', () => {
  it('la remise annoncée correspond exactement au prix débité', () => {
    // Le point capital : le pourcentage est DÉDUIT du prix, il ne peut donc
    // pas s'en écarter. On vérifie la cohérence dans les deux sens.
    for (const f of FORMULES) {
      const attendu = prixPlein(f.mois) - f.prix;
      expect(economie(f), f.libelle).toBe(attendu);
      expect(remisePourcent(f), f.libelle).toBe(Math.round((attendu / prixPlein(f.mois)) * 100));
    }
  });

  it('l\'année complète revient à environ deux mois offerts', () => {
    const an = trouverFormule(12)!;
    expect(economie(an)).toBe(60_000);                    // 300 000 − 240 000
    expect(economie(an) / TARIF_MENSUEL).toBeCloseTo(2.4, 1);
  });

  it('six mois économisent un demi-mois et demi', () => {
    const six = trouverFormule(6)!;
    expect(prixPlein(6)).toBe(150_000);
    expect(six.prix).toBe(135_000);
    expect(remisePourcent(six)).toBe(10);
  });

  it('le prix au mois reste un montant plausible', () => {
    for (const f of FORMULES) {
      expect(prixParMois(f), f.libelle).toBeGreaterThan(TARIF_MENSUEL * 0.75);
      expect(prixParMois(f), f.libelle).toBeLessThanOrEqual(TARIF_MENSUEL);
    }
  });
});

describe('recherche d\'une formule', () => {
  it('retrouve une durée proposée', () => {
    expect(trouverFormule(6)?.prix).toBe(135_000);
    expect(trouverFormule(12)?.libelle).toBe('1 an');
  });

  it('ne retourne RIEN pour une durée non proposée', () => {
    // Un client qui enverrait « 11 mois » ou « 99 mois » ne doit pas obtenir
    // un tarif inventé.
    for (const mois of [0, 11, 13, 99, -1, 1.5]) {
      expect(trouverFormule(mois), String(mois)).toBeUndefined();
    }
  });

  it('la formule par défaut existe dans la grille', () => {
    expect(trouverFormule(FORMULE_PAR_DEFAUT)).toBeDefined();
  });

  it('le nom de plan stocké est lisible sans décodeur', () => {
    expect(nomDuPlan(trouverFormule(1)!)).toBe('1 mois');
    expect(nomDuPlan(trouverFormule(12)!)).toBe('1 an');
  });
});
