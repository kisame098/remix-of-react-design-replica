import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  menuPourMode, modeDeLEcole, estFormationPro, RUBRIQUES_FORMATION_PRO, URLS_CLASSIQUES_MASQUEES,
  urlMenuActive,
} from './modeGestion';
import { ALL_PERMISSION_KEYS } from './permissions';

describe('mode de gestion', () => {
  it('une école sans mode (ancienne donnée, cache) reste classique', () => {
    expect(modeDeLEcole(undefined)).toBe('classique');
    expect(modeDeLEcole(null)).toBe('classique');
    expect(modeDeLEcole({})).toBe('classique');
    expect(modeDeLEcole({ management_mode: 'n\'importe quoi' })).toBe('classique');
    expect(estFormationPro({ management_mode: 'formation_pro' })).toBe(true);
    expect(estFormationPro({ management_mode: 'classique' })).toBe(false);
  });
});

describe('menu par mode', () => {
  const classique = menuPourMode('classique');
  const formation = menuPourMode('formation_pro');

  it('le menu classique est INCHANGÉ (13 rubriques, même ordre)', () => {
    expect(classique.map(i => i.url)).toEqual([
      '/dashboard', '/inscription', '/eleves', '/inscription-prof', '/professeurs', '/classes', '/notes',
      '/filieres', '/emplois-du-temps', '/presences', '/paiements', '/salaires', '/identifiants',
    ]);
    expect(classique.some(i => i.bientot || i.groupe)).toBe(false);
  });

  it('le mode formation retire les pages classiques et ajoute ses 7 rubriques', () => {
    for (const url of URLS_CLASSIQUES_MASQUEES) expect(formation.map(i => i.url)).not.toContain(url);
    expect(formation.filter(i => i.groupe === 'formation_pro')).toHaveLength(7);
    expect(formation.map(i => i.title)).toEqual(expect.arrayContaining(
      ["Vue d'ensemble", 'Formations', 'Promotions', 'Évaluations', 'Examens', 'Stages', 'Documents']));
  });

  it('le mode formation garde les outils partagés (élèves, profs, emplois du temps, présences, paiements…)', () => {
    for (const url of ['/dashboard', '/inscription', '/eleves', '/professeurs', '/emplois-du-temps', '/presences', '/paiements', '/salaires', '/identifiants']) {
      expect(formation.map(i => i.url), url).toContain(url);
    }
  });

  it('chaque rubrique formation a une description ; « Formations » est développée, les autres encore « en dév. »', () => {
    for (const r of RUBRIQUES_FORMATION_PRO) expect(r.description.length).toBeGreaterThan(20);
    const parTitre = new Map(RUBRIQUES_FORMATION_PRO.map(r => [r.title, r]));
    expect(parTitre.get('Formations')?.bientot).toBeUndefined();
    expect(parTitre.get('Promotions')?.bientot).toBeUndefined();
    expect(parTitre.get('Évaluations')?.bientot).toBeUndefined();
    expect(parTitre.get('Examens')?.bientot).toBeUndefined();
    for (const t of ['Stages', 'Documents']) expect(parTitre.get(t)?.bientot).toBe(true);
  });

  it('adresses uniques, permissions valides', () => {
    for (const menu of [classique, formation]) {
      const urls = menu.map(i => i.url);
      expect(new Set(urls).size).toBe(urls.length);
      for (const i of menu) if (i.permission) expect(ALL_PERMISSION_KEYS).toContain(i.permission);
    }
  });
});

describe('garde-fous — routes', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  it('chaque rubrique du mode formation a sa route, réservée à ce mode', () => {
    for (const r of RUBRIQUES_FORMATION_PRO) expect(app, r.url).toContain(`"${r.url}"`);
    expect(app).toContain('<ModeRoute mode="formation_pro">');
  });
  it('les pages classiques (classes, notes, cursus) sont réservées au mode classique', () => {
    for (const chemin of ['/classes', '/notes', '/notes/:periodId/:classId/:subjectId', '/filieres', '/filieres/:filiereId']) {
      const ligne = app.split('\n').find(l => l.includes(`path="${chemin}"`));
      expect(ligne, chemin).toBeDefined();
      expect(ligne, chemin).toContain('<ModeRoute mode="classique">');
    }
  });
  it('seul le chef du système change le mode : SQL et écran', () => {
    const sql = readFileSync('docs/sql/platform_mode_gestion.sql', 'utf8');
    expect(sql).toContain('get_is_platform_admin()');
    expect(sql).toContain('revoke all on function public.platform_set_school_mode(uuid, text) from public, anon');
    const ecole = readFileSync('src/pages/platform/PlatformSchools.tsx', 'utf8') + readFileSync('src/pages/platform/PlatformSchoolDetail.tsx', 'utf8');
    expect(ecole).toContain("rpc('platform_set_school_mode'");
    // aucune autre page ne l'écrit, en particulier pas par updateSchoolSettings
    const AUTRES = ['src/pages/Settings.tsx', 'src/contexts/AuthContext.tsx'];
    for (const f of AUTRES) expect(readFileSync(f, 'utf8')).not.toMatch(/management_mode\s*[:=]\s*['"]/);
  });
});

describe('urlMenuActive — une seule rubrique allumée, même quand deux URLs se chevauchent', () => {
  const formation = menuPourMode('formation_pro');

  it('sur une page profonde du module Formations, seule « Formations » s\'allume (pas « Vue d\'ensemble »)', () => {
    // /formation/formations/f1/niveaux/n1 matche par préfixe à la fois
    // « Vue d'ensemble » (/formation) et « Formations » (/formation/formations) :
    // avant ce correctif, les DEUX s'allumaient en même temps.
    expect(urlMenuActive(formation, '/formation/formations/f1/niveaux/n1')).toBe('/formation/formations');
    expect(urlMenuActive(formation, '/formation/formations')).toBe('/formation/formations');
  });

  it('sur /formation seul (Vue d\'ensemble), c\'est bien elle qui s\'allume', () => {
    expect(urlMenuActive(formation, '/formation')).toBe('/formation');
  });

  it('une sous-page garde sa rubrique allumée (comportement déjà correct, préservé)', () => {
    const classique = menuPourMode('classique');
    expect(urlMenuActive(classique, '/notes/p1/c1')).toBe('/notes');
  });

  it('adresse hors menu → rien d\'allumé', () => {
    expect(urlMenuActive(menuPourMode('classique'), '/autre-chose')).toBeNull();
  });
});
