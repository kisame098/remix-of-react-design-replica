import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLE_GUIDE, guideProgrammeJson } from './guideProgrammeJson';
import { NIVEAUX } from '@/contexts/SchoolContext';

// Le mode d'emploi du JSON de programme doit dire la vérité sur le code.
describe("mode d'emploi du fichier de programme", () => {
  const guide = guideProgrammeJson().join('\n');
  const page = readFileSync('src/pages/Filieres.tsx', 'utf8');

  it('est placé en tête de l’export, sous une clé que l’import ignore', () => {
    expect(page).toMatch(/\[CLE_GUIDE\]: guideProgrammeJson\(\),\s*type: 'teranga_school_programme_export'/);
    expect(page).not.toMatch(/data\._LISEZ_MOI|data\[CLE_GUIDE\]/); // l'import ne le lit pas
    expect(CLE_GUIDE).toBe('_LISEZ_MOI');
  });

  it('cite exactement le type et la version de l’export', () => {
    expect(page).toMatch(/type: 'teranga_school_programme_export',\s*version: 1,/);
    expect(guide).toContain('"type": "teranga_school_programme_export" et "version": 1');
  });

  it('liste tous les niveaux reconnus par SenClass, orthographe exacte', () => {
    for (const n of NIVEAUX) expect(guide).toContain(n);
  });

  it('décrit chaque champ que l’import utilise', () => {
    for (const champ of ['niveauDefaults', 'elementaireDefaults', 'filieres', 'niveaux', 'mandatorySubjects', 'facultativeSubjects', 'choiceGroups', 'options', 'coefficient', 'isFacultative']) {
      expect(guide, champ).toContain(`"${champ}"`);
      expect(page, champ).toContain(champ);
    }
  });

  it('dit la vérité sur l’import : un cursus existant est complété, rien n’est écrasé', () => {
    expect(page).toMatch(/planifierImport\(/);
    expect(guide).toMatch(/cursus qui existe déjà \(même nom\) est COMPLÉTÉ/);
    expect(guide).toMatch(/rien n'est supprimé/);
  });

  it('explique l’élémentaire avec ses domaines et registres exacts', () => {
    for (const code of ['LC', 'MATH', 'ESVS', 'EPSA', 'RESSOURCES', 'COMPETENCE', '"elementaireDefaults"', '"pointMax"']) expect(guide).toContain(code);
    expect(page).toMatch(/elementaireDefaults: elementaryDefaultLines\.map/);
  });

  it('reste un JSON valide une fois exporté (lignes de texte simples)', () => {
    const fichier = JSON.parse(JSON.stringify({ [CLE_GUIDE]: guideProgrammeJson(), type: 'teranga_school_programme_export', version: 1, niveauDefaults: [], filieres: [] }));
    expect(Array.isArray(fichier[CLE_GUIDE])).toBe(true);
    expect(fichier[CLE_GUIDE].every((l: unknown) => typeof l === 'string')).toBe(true);
  });
});
