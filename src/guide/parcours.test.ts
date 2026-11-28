import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPITRES } from './parcours';
import { pageOuAller, parcoursPour, trouver } from '@/lib/guide';
import { SIGNAUX_GUIDE } from '@/lib/signauxGuide';
import { menuPourMode } from '@/lib/modeGestion';

// Le guide désigne des éléments d'écrans qui vivent ailleurs : si l'un change
// de nom, le guide se perdrait en silence. Ces tests lisent le vrai code.
const fichiers = (dossier: string): string[] => readdirSync(dossier).flatMap(n => {
  const p = join(dossier, n);
  return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});
const code = fichiers('src').filter(f => !f.includes('src/guide/') && !f.endsWith('lib/guide.ts')).map(f => readFileSync(f, 'utf8')).join('\n');
const menus = [...menuPourMode('classique', { siteWeb: true, financements: true }), ...menuPourMode('formation_pro', { siteWeb: true, financements: true })].map(m => m.url);

const existe = (cible: string): boolean => {
  if (cible.startsWith('menu:/')) return menus.includes(cible.slice(5)) && code.includes('data-guide={`menu:${item.url}`}');
  if (cible.startsWith('paiements:')) return new RegExp(`id: '${cible.slice(10)}'`).test(code) && code.includes('data-guide={`paiements:${tab.id}`}');
  return code.includes(`data-guide="${cible}"`);
};
const etapes = CHAPITRES.flatMap(c => c.etapes.map(e => ({ c, e })));

describe('le parcours colle aux écrans', () => {
  it('chaque élément désigné existe dans le code', () => {
    const cibles = etapes.flatMap(({ e }) => [...(e.champs ?? []).map(x => x.cible), ...(e.condition.type === 'visible' ? [e.condition.cible] : []), ...(e.dejaFait ? [e.dejaFait] : [])]);
    expect([...new Set(cibles)].filter(c => !existe(c))).toEqual([]);
  });
  it('chaque signal attendu est émis par un écran, et chaque signal connu sert', () => {
    const attendus = [...new Set(etapes.flatMap(({ e }) => (e.condition.type === 'signal' ? [e.condition.nom] : [])))];
    expect(attendus.filter(s => !code.includes(`signalerGuide('${s}')`))).toEqual([]);
    expect([...SIGNAUX_GUIDE].sort()).toEqual([...attendus].sort());
  });
  it('chaque page existe dans l\'application', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const pages = [...new Set(etapes.map(({ e }) => pageOuAller(e)).filter((p): p is string => p !== null))];
    expect(pages.filter(p => !app.includes(`path="${p}"`))).toEqual([]);
  });
});

describe('on ne peut pas rester coincé', () => {
  it('identifiants uniques, renvois dans le même chapitre', () => {
    const ids = etapes.map(x => x.e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { c, e } of etapes) {
      const rang = c.etapes.indexOf(e);
      if (e.siAbsent) expect(c.etapes.findIndex(x => x.id === e.siAbsent), e.id).toBeLessThan(rang);
      if (e.siAbsent) expect(c.etapes.some(x => x.id === e.siAbsent), e.id).toBe(true);
      if (e.passerVers && e.passerVers !== 'fin') expect(c.etapes.findIndex(x => x.id === e.passerVers), e.id).toBeGreaterThan(rang);
    }
  });
  it('« déjà fait » ne sert qu\'aux étapes qui ont un « Passer » où aller', () => {
    for (const { e } of etapes) if (e.dejaFait) expect(e.passerVers, e.id).toBeDefined();
  });
  it('une étape qui ouvre quelque chose peut être passée sans revenir en boucle', () => {
    for (const { c, e } of etapes) {
      if (e.condition.type !== 'visible') continue;
      const dependantes = c.etapes.filter(x => x.siAbsent === e.id);
      if (dependantes.length === 0) continue;
      expect(e.passerVers, e.id).toBeDefined();
      const arrivee = c.etapes.find(x => x.id === e.passerVers);
      expect(arrivee?.siAbsent === e.id, `${e.id} → ${e.passerVers}`).toBe(false);
    }
  });
  it('une étape « rempli » désigne des champs avec un nom lisible', () => {
    for (const { e } of etapes) if (e.condition.type === 'rempli') {
      expect(e.champs?.length, e.id).toBeGreaterThan(0);
      expect(e.champs?.every(x => x.libelle), e.id).toBe(true);
    }
  });
  it('les renvois restent valables dans chaque mode et pour chaque compte', () => {
    for (const mode of ['classique', 'formation_pro'] as const) for (const [role, perms] of [['admin', []], ['staff', ['students']], ['staff', ['payroll', 'credentials']]] as const) {
      for (const c of parcoursPour(CHAPITRES, { mode, accountRole: role, staffPermissions: [...perms] })) for (const e of c.etapes) {
        for (const cible of [e.siAbsent, e.passerVers].filter(x => x && x !== 'fin')) {
          // Une étape d'un autre mode : « Passer » va simplement à la suivante.
          if (!c.etapes.some(x => x.id === cible)) expect(e.siAbsent === cible, `${e.id} → ${cible}`).toBe(false);
        }
      }
    }
  });
  it('les deux modes ont de quoi créer un groupe puis inscrire un élève', () => {
    const ids = (mode: 'classique' | 'formation_pro') => parcoursPour(CHAPITRES, { mode, accountRole: 'admin', staffPermissions: [] }).map(c => c.id);
    expect(ids('classique')).toEqual(expect.arrayContaining(['parametres', 'classes', 'inscrire-eleve', 'gerer-eleves', 'inscrire-prof', 'notes']));
    expect(ids('formation_pro')).toEqual(expect.arrayContaining(['parametres', 'formations', 'promotions', 'inscrire-eleve', 'inscrire-prof', 'evaluations', 'examens', 'stages', 'documents-pro', 'financements']));
    expect(ids('classique')).not.toContain('promotions');
    expect(ids('formation_pro')).not.toContain('classes');
  });
  it('un élément caché n\'est pas « trouvé »', () => {
    document.body.innerHTML = '<div data-guide="a"></div>';
    expect(trouver('a', () => false)).toBeNull();
  });
});
