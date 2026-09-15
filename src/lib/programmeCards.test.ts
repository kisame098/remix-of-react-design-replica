import { describe, it, expect } from 'vitest';
import {
  buildProgrammeCards, niveauOrder, isCompanionFiliere,
  getNiveauLabels, resolveNiveauLabel, programmeCardLabel, programmeCardKey,
  type ProgrammeCard,
} from './programmeCards';
import { NIVEAUX, type Filiere, type NiveauDefaultSubject } from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// BLOCS DU CURSUS — source unique de vérité pour « quels blocs existent ».
// Elle sert à la fois à la page Cursus et à la création de classe : si les deux
// divergent, une classe peut être créée sur un niveau qui n'existe pas dans le
// cursus (le bug qui a justifié cette fonction).
// ════════════════════════════════════════════════════════════════════════════

const filiere = (id: string, name: string, niveaux: string[]): Filiere => ({ id, name, niveaux });

const defaultSubject = (niveau: string): NiveauDefaultSubject =>
  ({ id: `s-${niveau}`, niveau, name: 'Maths', coefficient: 4, ordering: 0, isFacultative: false });

describe('niveauOrder', () => {
  it('ordonne du CI à la Terminale, dans l\'ordre de la scolarité', () => {
    const ordered = [...NIVEAUX].sort((a, b) => niveauOrder(a) - niveauOrder(b));
    expect(ordered).toEqual([...NIVEAUX]);
    expect(niveauOrder('CI')).toBeLessThan(niveauOrder('CM2'));
    expect(niveauOrder('CM2')).toBeLessThan(niveauOrder('6ème'));
    expect(niveauOrder('3ème')).toBeLessThan(niveauOrder('2nde'));
    expect(niveauOrder('2nde')).toBeLessThan(niveauOrder('Tle'));
  });

  it('relègue en fin de liste un niveau inconnu au lieu de le placer en tête', () => {
    expect(niveauOrder('Maternelle')).toBe(99);
    expect(niveauOrder('')).toBe(99);
  });
});

describe('isCompanionFiliere', () => {
  it('reconnaît un cursus compagnon (même nom que son unique niveau)', () => {
    expect(isCompanionFiliere({ name: '6ème', niveaux: ['6ème'] })).toBe(true);
  });

  it('ne confond pas une vraie filière avec un compagnon', () => {
    expect(isCompanionFiliere({ name: 'S1', niveaux: ['Tle'] })).toBe(false);
    expect(isCompanionFiliere({ name: 'Tle', niveaux: ['1ère', 'Tle'] })).toBe(false);
    expect(isCompanionFiliere({ name: 'S', niveaux: [] })).toBe(false);
  });
});

describe('buildProgrammeCards', () => {
  it('propose les six niveaux d\'élémentaire et les quatre de collège, même sans donnée', () => {
    const cards = buildProgrammeCards([], []);
    const niveaux = cards.filter(c => c.type === 'niveau').map(c => c.niveau);
    expect(niveaux).toEqual(['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème']);
  });

  it('crée une carte par couple (filière, niveau) — S1 en 1ère ET en Tle', () => {
    const cards = buildProgrammeCards([filiere('f1', 'S1', ['1ère', 'Tle'])], []);
    const s1 = cards.filter(c => c.type === 'filiere');
    expect(s1.map(c => c.type === 'filiere' ? c.niveau : '')).toEqual(['1ère', 'Tle']);
  });

  it('EXCLUT les cursus compagnons — ils ne sont pas des blocs à part', () => {
    const cards = buildProgrammeCards([filiere('f1', '6ème', ['6ème'])], []);
    expect(cards.filter(c => c.type === 'filiere')).toEqual([]);
    // …mais le niveau 6ème reste proposé une seule fois.
    expect(cards.filter(c => c.niveau === '6ème')).toHaveLength(1);
  });

  it('ne duplique pas un niveau qui a déjà des matières par défaut', () => {
    const cards = buildProgrammeCards([], [defaultSubject('6ème'), defaultSubject('6ème')]);
    expect(cards.filter(c => c.niveau === '6ème')).toHaveLength(1);
  });

  it('classe les blocs dans l\'ordre de la scolarité, niveau avant filière', () => {
    const cards = buildProgrammeCards(
      [filiere('f2', 'S2', ['Tle']), filiere('f1', 'L2', ['Tle'])],
      [],
    );
    const tle = cards.filter(c => c.niveau === 'Tle');
    // Les filières de Terminale sont triées alphabétiquement entre elles.
    expect(tle.map(c => c.type === 'filiere' ? c.filiereName : 'niveau')).toEqual(['L2', 'S2']);
    // Et la Terminale vient après le collège.
    expect(cards.findIndex(c => c.niveau === 'Tle'))
      .toBeGreaterThan(cards.findIndex(c => c.niveau === '3ème'));
  });

  it('accepte un niveau hors liste ajouté par l\'école, sans le perdre', () => {
    const cards = buildProgrammeCards([], [defaultSubject('Petite Section')]);
    expect(cards.map(c => c.niveau)).toContain('Petite Section');
  });
});

describe('noms personnalisés de niveaux', () => {
  it('lit la table de renommage, ou rend une table vide', () => {
    expect(getNiveauLabels({ niveauLabels: { '6ème': 'Sixième' } })).toEqual({ '6ème': 'Sixième' });
    expect(getNiveauLabels({})).toEqual({});
    expect(getNiveauLabels(null)).toEqual({});
    expect(getNiveauLabels(undefined)).toEqual({});
  });

  it('affiche le nom choisi par l\'école, sinon le niveau technique', () => {
    expect(resolveNiveauLabel({ '6ème': 'Sixième' }, '6ème')).toBe('Sixième');
    expect(resolveNiveauLabel({}, '6ème')).toBe('6ème');
  });

  it('ignore un renommage vide ou fait d\'espaces — jamais d\'étiquette blanche', () => {
    expect(resolveNiveauLabel({ '6ème': '' }, '6ème')).toBe('6ème');
    expect(resolveNiveauLabel({ '6ème': '   ' }, '6ème')).toBe('6ème');
  });

  it('compose le libellé d\'une carte de filière avec le nom du niveau', () => {
    const card: ProgrammeCard = { type: 'filiere', filiereId: 'f1', filiereName: 'S1', niveau: 'Tle' };
    expect(programmeCardLabel(card)).toBe('Tle S1');
    expect(programmeCardLabel(card, { Tle: 'Terminale' })).toBe('Terminale S1');
  });
});

describe('programmeCardKey', () => {
  it('donne une clé distincte à chaque bloc', () => {
    const cards = buildProgrammeCards(
      [filiere('f1', 'S1', ['1ère', 'Tle']), filiere('f2', 'S2', ['Tle'])],
      [],
    );
    const keys = cards.map(programmeCardKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('distingue la même filière sur deux niveaux différents', () => {
    expect(programmeCardKey({ type: 'filiere', filiereId: 'f1', filiereName: 'S1', niveau: '1ère' }))
      .not.toBe(programmeCardKey({ type: 'filiere', filiereId: 'f1', filiereName: 'S1', niveau: 'Tle' }));
  });

  it('n\'est pas affecté par le renommage d\'un niveau (clé technique)', () => {
    expect(programmeCardKey({ type: 'niveau', niveau: '6ème' })).toBe('niveau:6ème');
  });
});
