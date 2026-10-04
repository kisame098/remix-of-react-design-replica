import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classesAvecNotes, estPrescolaire, libelleParDefautNiveau, NIVEAUX_PRESCOLAIRE } from '@/lib/prescolaire';
import { NIVEAUX } from '@/contexts/SchoolContext';
import { cycleDuNiveau, estDernierePeriodeDeLAnnee, CONFIG_PAR_DEFAUT } from '@/lib/configScolarite';
import { baremeDuNiveau, decisionDePassage, seuilDePassage } from '@/lib/decisionPassage';
import { resolveNiveauLabel } from '@/lib/programmeCards';
import { planifierImport } from '@/lib/importProgramme';

describe('préscolaire : Petite, Moyenne et Grande Section', () => {
  it('les trois sections existent, AVANT le CI, dans la liste des niveaux', () => {
    expect([...NIVEAUX_PRESCOLAIRE]).toEqual(['PS', 'MS', 'GS']);
    expect(NIVEAUX.slice(0, 4)).toEqual(['PS', 'MS', 'GS', 'CI']);
  });

  it('reconnaît la maternelle, et seulement elle', () => {
    for (const n of ['PS', 'MS', 'GS']) expect(estPrescolaire(n)).toBe(true);
    for (const n of ['CI', 'CM2', '6ème', 'Tle', '', undefined, null]) expect(estPrescolaire(n)).toBe(false);
  });

  it('affiche le nom complet, sauf si l\'école l\'a renommé', () => {
    expect(libelleParDefautNiveau('PS')).toBe('Petite Section');
    expect(libelleParDefautNiveau('GS')).toBe('Grande Section');
    expect(libelleParDefautNiveau('CE1')).toBe('CE1');
    expect(resolveNiveauLabel({}, 'MS')).toBe('Moyenne Section');
    expect(resolveNiveauLabel({ MS: 'Moyens' }, 'MS')).toBe('Moyens');
  });

  it('les classes de maternelle sont écartées des notes', () => {
    const classes = [{ niveau: 'PS' }, { niveau: 'CI' }, { niveau: undefined }, { niveau: 'GS' }, { niveau: 'Tle' }];
    expect(classesAvecNotes(classes)).toEqual([{ niveau: 'CI' }, { niveau: undefined }, { niveau: 'Tle' }]);
  });

  it('pas de cycle noté : ni trimestres, ni fin d\'année — et non plus « collège » par défaut', () => {
    expect(cycleDuNiveau('PS')).toBeUndefined();
    expect(estDernierePeriodeDeLAnnee(3, 'GS', CONFIG_PAR_DEFAUT)).toBe(false);
  });

  it('jamais de décision de passage, de seuil ni de barème', () => {
    expect(seuilDePassage('MS')).toBeUndefined();
    expect(baremeDuNiveau('MS')).toBeUndefined();
    expect(decisionDePassage({ niveau: 'GS', estDernierePeriode: true, moyenneAnnuelle: 3 })).toBeUndefined();
  });

  it('l\'import du Cursus refuse une matière de maternelle, en le disant', () => {
    const plan = planifierImport(
      { niveauDefaults: [{ niveau: 'PS', name: 'Graphisme', coefficient: 1 }] },
      { niveauDefaults: [], elementaire: [], filieres: [] },
    );
    expect(plan.niveauAjouts).toEqual([]);
    expect(plan.ignores.join(' ')).toContain('maternelle');
  });
});

describe('garde-fou : une classe de maternelle n\'entre jamais dans une période de notes', () => {
  // Sans période, aucune matière ne peut naître pour elle : ni à la main, ni
  // par les synchronisations automatiques (sync_period_*), qui partent de
  // grade_period_classes.
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');

  it('ni à la création de la classe, ni à la création d\'une période', () => {
    const ctx = lire('src/contexts/SchoolContext.tsx');
    expect(ctx).toContain('gradePeriods.length > 0 && !estPrescolaire(newClass.niveau)');
    expect(ctx).toContain('const classesNotees = classesAvecNotes(classes);');
    expect(ctx).not.toMatch(/insert\(classes\.map\(c => \(\{ school_id: schoolId, period_id: row\.id/);
  });

  it('Gestion Notes ne montre que les classes notées', () => {
    expect(lire('src/pages/GradeManagement.tsx')).toContain('classesNotees.filter(c => isClassInPeriod(');
  });
});
