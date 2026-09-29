import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FICHIER_INVALIDE, compterAjouts, messageErreur, planifierImport, type EtatProgramme } from './importProgramme';

// ════════════════════════════════════════════════════════════════════════════
// Import du programme : on AJOUTE ce qui manque, on ne recrée jamais un cursus
// existant (la base refuse deux cursus du même nom), on n'écrase rien.
// Cas réel : le fichier modifié par une IA qui provoquait « [object Object] ».
// ════════════════════════════════════════════════════════════════════════════

const vide: EtatProgramme = { niveauDefaults: [], elementaire: [], filieres: [] };
const fichier = (x: Record<string, unknown>) => ({ type: 'teranga_school_programme_export', version: 1, ...x });

describe('fichier', () => {
  it.each([null, 42, 'texte', {}, { type: 'x' }, { niveauDefaults: 'pas une liste' }])('refuse ce qui n’est pas un export SenClass (%j)', d => {
    expect(() => planifierImport(d, vide)).toThrow(FICHIER_INVALIDE);
  });
  it('le mode d’emploi « _LISEZ_MOI » est ignoré', () => {
    const p = planifierImport(fichier({ _LISEZ_MOI: ['…'], niveauDefaults: [] }), vide);
    expect(compterAjouts(p)).toBe(0);
    expect(p.ignores).toEqual([]);
  });
});

describe('matières de niveau (collège, lycée)', () => {
  const etat: EtatProgramme = { ...vide, niveauDefaults: [{ niveau: '4ème', name: 'Français' }] };
  it('ajoute ce qui manque, laisse l’existant (même avec un autre coefficient ou une autre casse)', () => {
    const p = planifierImport(fichier({ niveauDefaults: [
      { niveau: '4ème', name: 'Français', coefficient: 9 },
      { niveau: '4ème', name: 'français', coefficient: 9 },
      { niveau: '4ème', name: 'Latin', coefficient: 2, isFacultative: true },
      { niveau: '4ème', name: 'Latin', coefficient: 2 },
    ] }), etat);
    expect(p.niveauAjouts).toEqual([{ niveau: '4ème', name: 'Latin', coefficient: 2, isFacultative: true }]);
    expect(p.dejaPresents).toBe(3);
  });
  it.each(['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'])('%s dans niveauDefaults : ignoré et expliqué (l’élémentaire a son barème)', n => {
    const p = planifierImport(fichier({ niveauDefaults: [{ niveau: n, name: 'Anglais', coefficient: 1 }] }), vide);
    expect(p.niveauAjouts).toEqual([]);
    expect(p.ignores[0]).toMatch(/elementaireDefaults/);
  });
  it.each(['4eme', 'Terminale', 'seconde', ''])('niveau inconnu « %s » : ignoré, jamais envoyé à la base', n => {
    const p = planifierImport(fichier({ niveauDefaults: [{ niveau: n, name: 'X' }] }), vide);
    expect(p.niveauAjouts).toEqual([]);
    expect(p.ignores).toHaveLength(1);
  });
  it.each([0, -2, 'abc', null])('coefficient invalide (%j) : 1 par défaut (la base refuse ≤ 0)', c => {
    const p = planifierImport(fichier({ niveauDefaults: [{ niveau: '6ème', name: 'Latin', coefficient: c }] }), vide);
    expect(p.niveauAjouts[0].coefficient).toBe(1);
  });
});

describe('élémentaire (barème de points)', () => {
  const etat: EtatProgramme = { ...vide, elementaire: [{ niveau: 'CM1', registre: 'COMPETENCE', name: 'Anglais' }] };
  it('ajoute l’Anglais sur 10 là où il manque, pas en double en CM1', () => {
    const lignes = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].map(niveau => ({ niveau, domaine: 'LC', registre: 'COMPETENCE', name: 'Anglais', pointMax: 10 }));
    const p = planifierImport(fichier({ elementaireDefaults: lignes }), etat);
    expect(p.elementaireAjouts.map(l => l.niveau)).toEqual(['CI', 'CP', 'CE1', 'CE2', 'CM2']);
    expect(p.elementaireAjouts.every(l => l.pointMax === 10 && l.domaine === 'LC')).toBe(true);
    expect(p.dejaPresents).toBe(1);
  });
  it.each([
    [{ niveau: '6ème', domaine: 'LC', registre: 'COMPETENCE', name: 'A', pointMax: 10 }, /élémentaire/],
    [{ niveau: 'CI', domaine: 'ANGLAIS', registre: 'COMPETENCE', name: 'A', pointMax: 10 }, /domaine/],
    [{ niveau: 'CI', domaine: 'LC', registre: 'ORAL', name: 'A', pointMax: 10 }, /registre/],
    [{ niveau: 'CI', domaine: 'LC', registre: 'COMPETENCE', name: 'A', pointMax: 0 }, /pointMax/],
    [{ niveau: 'CI', domaine: 'LC', registre: 'COMPETENCE', name: '', pointMax: 10 }, /sans nom/],
  ])('ligne invalide ignorée et expliquée : %j', (l, raison) => {
    const p = planifierImport(fichier({ elementaireDefaults: [l] }), vide);
    expect(p.elementaireAjouts).toEqual([]);
    expect(p.ignores[0]).toMatch(raison);
  });
});

describe('cursus', () => {
  const S: EtatProgramme['filieres'][number] = {
    id: 'f-s', name: 'S', niveaux: ['2nde'],
    obligatoires: [{ niveau: '2nde', name: 'Mathématiques' }],
    facultatives: [],
    groupes: [{ id: 'g-lv2', niveau: '2nde', label: 'Langue 2', options: ['Arabe'] }],
  };
  const etat: EtatProgramme = { ...vide, filieres: [S] };

  it('un cursus existant est COMPLÉTÉ, jamais recréé', () => {
    const p = planifierImport(fichier({ filieres: [{
      name: 'S', niveaux: ['2nde'],
      mandatorySubjects: [{ niveau: '2nde', name: 'Mathématiques', coefficient: 5 }, { niveau: '2nde', name: 'Informatique', coefficient: 2 }],
      choiceGroups: [{ niveau: '2nde', label: 'Langue 2', coefficient: 3, options: ['Arabe', 'Espagnol'] }],
    }] }), etat);
    expect(p.cursus).toHaveLength(1);
    expect(p.cursus[0].filiereId).toBe('f-s');
    expect(p.cursus[0].niveaux).toBeUndefined();          // niveaux inchangés
    expect(p.cursus[0].obligatoires).toEqual([{ niveau: '2nde', name: 'Informatique', coefficient: 2 }]);
    expect(p.cursus[0].groupes).toEqual([{ groupId: 'g-lv2', niveau: '2nde', label: 'Langue 2', coefficient: 3, options: ['Espagnol'] }]);
  });

  it('un cursus existant déjà complet : rien à faire', () => {
    const p = planifierImport(fichier({ filieres: [{ name: 's', niveaux: ['2nde'], mandatorySubjects: [{ niveau: '2nde', name: 'Mathématiques' }] }] }), etat);
    expect(p.cursus).toEqual([]);
  });

  it('niveaux ajoutés à un cursus existant', () => {
    const p = planifierImport(fichier({ filieres: [{ name: 'S', niveaux: ['2nde', '1ère'] }] }), etat);
    expect(p.cursus[0].niveaux).toEqual(['2nde', '1ère']);
  });

  it('un nouveau cursus est créé avec ses niveaux, matières et créneaux', () => {
    const p = planifierImport(fichier({ filieres: [{
      name: '4ème', description: 'Option', niveaux: ['4ème'],
      choiceGroups: [{ niveau: '', label: 'Option au choix', coefficient: 2, options: ['Espagnol', 'Arabe', 'Musique', 'Arabe'] }],
    }] }), vide);
    expect(p.cursus[0]).toEqual({
      name: '4ème', description: 'Option', niveaux: ['4ème'], obligatoires: [], facultatives: [],
      groupes: [{ niveau: '', label: 'Option au choix', coefficient: 2, options: ['Espagnol', 'Arabe', 'Musique'] }],
    });
  });

  it('matière à un niveau que le cursus n’a pas : ignorée et expliquée', () => {
    const p = planifierImport(fichier({ filieres: [{ name: 'S', niveaux: ['2nde'], mandatorySubjects: [{ niveau: 'Tle', name: 'Philosophie' }] }] }), etat);
    expect(p.cursus).toEqual([]);
    expect(p.ignores[0]).toMatch(/n'est pas un niveau du cursus/);
  });

  it('le même cursus deux fois dans le fichier : un seul plan, sans doublon', () => {
    const p = planifierImport(fichier({ filieres: [
      { name: 'X', niveaux: ['1ère'], mandatorySubjects: [{ niveau: '', name: 'A' }] },
      { name: 'x', niveaux: ['Tle'], mandatorySubjects: [{ niveau: '', name: 'A' }, { niveau: '', name: 'B' }] },
    ] }), vide);
    expect(p.cursus).toHaveLength(1);
    expect(p.cursus[0].niveaux).toEqual(['1ère', 'Tle']);
    expect(p.cursus[0].obligatoires.map(m => m.name)).toEqual(['A', 'B']);
  });
});

describe('cas réel : le fichier de l’IA qui affichait « [object Object] »', () => {
  const data = JSON.parse(readFileSync('src/lib/__fixtures__/programme-ia-v2.json', 'utf8'));
  // L'école a déjà ses cursus L, L'1, L2, S, S1, S2 (c'était un export d'elle-même).
  const etat: EtatProgramme = {
    niveauDefaults: data.niveauDefaults.filter((s: { niveau: string }) => !['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(s.niveau)),
    elementaire: [],
    filieres: data.filieres.filter((f: { name: string }) => !['3ème', '4ème'].includes(f.name)).map((f: { name: string; niveaux: string[] }, i: number) => ({
      id: `f${i}`, name: f.name, niveaux: f.niveaux, obligatoires: [], facultatives: [], groupes: [],
    })),
  };
  const plan = planifierImport(data, etat);

  it('aucun cursus existant n’est recréé (plus d’erreur de la base)', () => {
    const noms = etat.filieres.map(f => f.name);
    expect(plan.cursus.filter(c => noms.includes(c.name)).every(c => !!c.filiereId)).toBe(true);
    expect(plan.cursus.filter(c => !c.filiereId).map(c => c.name).sort()).toEqual(['3ème', '4ème']);
  });

  it('l’Anglais de l’élémentaire mis dans niveauDefaults est signalé, pas envoyé', () => {
    expect(plan.niveauAjouts).toEqual([]);
    expect(plan.ignores.filter(i => /Anglais/.test(i))).toHaveLength(6);
  });

  it('l’option 4ème/3ème (Espagnol, Arabe, Musique, coef 2) est créée', () => {
    for (const n of ['4ème', '3ème']) {
      const c = plan.cursus.find(x => x.name === n)!;
      expect(c.groupes[0]).toMatchObject({ coefficient: 2, options: ['Espagnol', 'Arabe', 'Musique'] });
    }
  });
});

describe('message d’erreur lisible', () => {
  it.each([
    [new Error('boum'), 'boum'],
    ['texte', 'texte'],
    [{ message: 'duplicate key value violates unique constraint "filieres_school_id_name_key"', details: 'Key (name)=(S)' }, 'duplicate key value violates unique constraint "filieres_school_id_name_key" — Key (name)=(S)'],
    [{}, 'Erreur inconnue'],
    [null, 'Erreur inconnue'],
  ])('%j → %s', (err, attendu) => {
    expect(messageErreur(err)).toBe(attendu);
    expect(messageErreur(err)).not.toBe('[object Object]');
  });
});
