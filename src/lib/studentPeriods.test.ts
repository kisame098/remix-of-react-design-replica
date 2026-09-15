import { describe, it, expect } from 'vitest';
import { periodesDeLEleve, periodeParDefaut, type LiaisonPeriodeClasse } from './studentPeriods';

// ════════════════════════════════════════════════════════════════════════════
// LES PÉRIODES VUES PAR L'ÉLÈVE.
//
// Le bug à éviter : afficher une période où sa classe n'est pas inscrite. Il
// ouvre l'onglet, ne voit rien, et en conclut que ses notes ont disparu ou que
// le professeur ne les a pas saisies. Ni l'un ni l'autre n'est vrai.
// ════════════════════════════════════════════════════════════════════════════

const p = (id: string, ordering: number) => ({ id, name: `Période ${ordering + 1}`, ordering });

const PERIODES = [p('t1', 0), p('t2', 1), p('t3', 2), p('exam', 3)];

const lier = (...couples: [string, string][]): LiaisonPeriodeClasse[] =>
  couples.map(([periodId, classId]) => ({ periodId, classId }));

describe('periodesDeLEleve', () => {
  it('ne montre QUE les périodes où sa classe est inscrite', () => {
    const liaisons = lier(['t1', 'cls-A'], ['t2', 'cls-A'], ['t3', 'cls-B']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'cls-A').map(x => x.id)).toEqual(['t1', 't2']);
  });

  it('ne mélange pas deux classes de la même école', () => {
    // Le collège sur 3 trimestres, le lycée sur 2 : chacun voit les siens.
    const liaisons = lier(
      ['t1', 'college'], ['t2', 'college'], ['t3', 'college'],
      ['t1', 'lycee'], ['t3', 'lycee'],
    );
    expect(periodesDeLEleve(PERIODES, liaisons, 'college').map(x => x.id)).toEqual(['t1', 't2', 't3']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'lycee').map(x => x.id)).toEqual(['t1', 't3']);
  });

  it('montre une période d\'examen seulement aux classes concernées', () => {
    const liaisons = lier(['t1', 'cls-A'], ['exam', 'cls-B']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'cls-A').map(x => x.id)).toEqual(['t1']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'cls-B').map(x => x.id)).toEqual(['exam']);
  });

  it('rend les périodes DANS L\'ORDRE, quel que soit l\'ordre reçu', () => {
    const desordre = [p('t3', 2), p('t1', 0), p('t2', 1)];
    const liaisons = lier(['t1', 'A'], ['t2', 'A'], ['t3', 'A']);
    expect(periodesDeLEleve(desordre, liaisons, 'A').map(x => x.id)).toEqual(['t1', 't2', 't3']);
  });

  it('ne rend RIEN pour une classe qui n\'est inscrite nulle part', () => {
    expect(periodesDeLEleve(PERIODES, lier(['t1', 'autre']), 'cls-A')).toEqual([]);
  });

  it('ne rend rien pour un élève sans classe', () => {
    // Mieux vaut un « aucune période » franc qu'une rangée d'onglets vides.
    const liaisons = lier(['t1', 'cls-A']);
    expect(periodesDeLEleve(PERIODES, liaisons, null)).toEqual([]);
    expect(periodesDeLEleve(PERIODES, liaisons, undefined)).toEqual([]);
    expect(periodesDeLEleve(PERIODES, liaisons, '')).toEqual([]);
  });

  it('RETOMBE SUR TOUTES LES PÉRIODES quand l\'école n\'a déclaré aucune liaison', () => {
    // Base antérieure à grade_period_classes : on n'ampute pas l'écran de
    // toutes les écoles qui n'ont jamais touché ce réglage.
    expect(periodesDeLEleve(PERIODES, [], 'cls-A').map(x => x.id))
      .toEqual(['t1', 't2', 't3', 'exam']);
    expect(periodesDeLEleve(PERIODES, [], null).map(x => x.id)).toHaveLength(4);
  });

  it('ne plante pas sans aucune période', () => {
    expect(periodesDeLEleve([], lier(['t1', 'A']), 'A')).toEqual([]);
  });

  it('ignore une liaison qui pointe vers une période disparue', () => {
    const liaisons = lier(['t1', 'A'], ['periode-supprimee', 'A']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'A').map(x => x.id)).toEqual(['t1']);
  });

  it('ne duplique pas une période liée deux fois', () => {
    const liaisons = lier(['t1', 'A'], ['t1', 'A']);
    expect(periodesDeLEleve(PERIODES, liaisons, 'A')).toHaveLength(1);
  });
});

describe('periodeParDefaut', () => {
  it('ouvre la DERNIÈRE période — l\'élève veut ses notes récentes', () => {
    const liaisons = lier(['t1', 'A'], ['t2', 'A'], ['t3', 'A']);
    const siennes = periodesDeLEleve(PERIODES, liaisons, 'A');
    expect(periodeParDefaut(siennes)?.id).toBe('t3');
  });

  it('rend undefined quand l\'élève n\'a aucune période', () => {
    expect(periodeParDefaut([])).toBeUndefined();
  });

  it('la période ouverte par défaut fait toujours partie des siennes', () => {
    const liaisons = lier(['t2', 'A'], ['exam', 'A']);
    const siennes = periodesDeLEleve(PERIODES, liaisons, 'A');
    const defaut = periodeParDefaut(siennes)!;
    expect(siennes.map(x => x.id)).toContain(defaut.id);
  });
});
