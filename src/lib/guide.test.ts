import { afterEach, describe, expect, it } from 'vitest';
import {
  accesGuide, chapitreSuivant, correspond, estRempli, etapeApresPasser, etapeApresSignal, etapeDeReprise, lireEtat, lireProgression,
  marquerTermine, parcoursPour, placerBulle, plusRecente, reunir, statutChapitre, PROGRESSION_VIDE, type Chapitre, type Etape,
} from './guide';

const visible = () => true;
const e = (id: string, reste: Partial<Etape> = {}): Etape => ({ id, titre: id, texte: id, condition: { type: 'lire' }, ...reste });
const chap = (id: string, etapes: Etape[], reste: Partial<Chapitre> = {}): Chapitre => ({ id, titre: id, description: '', icone: 'autres', etapes, ...reste });

afterEach(() => { document.body.innerHTML = ''; });

describe('qui a droit au guide', () => {
  it('écoles bêta-testeuses seulement', () => {
    expect(accesGuide({ beta_testeur: true }, 'admin', [])).toBe(true);
    expect(accesGuide({ beta_testeur: false }, 'admin', [])).toBe(false);
    expect(accesGuide({}, 'admin', [])).toBe(false);
    expect(accesGuide(null, 'admin', [])).toBe(false);
  });
  it('directeur et personnel, jamais la caisse mobile ni le portail', () => {
    expect(accesGuide({ beta_testeur: true }, 'staff', ['students'])).toBe(true);
    expect(accesGuide({ beta_testeur: true }, 'staff', ['cashier'])).toBe(false);
    expect(accesGuide({ beta_testeur: true }, 'teacher', [])).toBe(false);
    expect(accesGuide({ beta_testeur: true }, 'student', [])).toBe(false);
  });
});

describe('le parcours de chacun', () => {
  const tout = [
    chap('libre', [e('a')]), chap('direction', [e('b')], { adminOnly: true }),
    chap('eleves', [e('c')], { permission: 'students' }), chap('classes', [e('d')], { mode: 'classique' }),
    chap('mixte', [e('f', { permission: 'payroll' }), e('g', { adminOnly: true })]),
  ];
  const ids = (mode: 'classique' | 'formation_pro', role: string, perms: string[]) =>
    parcoursPour(tout, { mode, accountRole: role, staffPermissions: perms }).map(c => c.id);
  it('le directeur voit tout ce qui est de son mode', () => {
    expect(ids('classique', 'admin', [])).toEqual(['libre', 'direction', 'eleves', 'classes', 'mixte']);
    expect(ids('formation_pro', 'admin', [])).toEqual(['libre', 'direction', 'eleves', 'mixte']);
  });
  it('le personnel ne voit que ses droits ; un chapitre vidé disparaît', () => {
    expect(ids('classique', 'staff', ['students'])).toEqual(['libre', 'eleves', 'classes']);
    expect(ids('classique', 'staff', ['payroll'])).toEqual(['libre', 'classes', 'mixte']);
  });
});

describe('lire l\'écran', () => {
  it('rempli : tous les champs désignés, texte, liste et date', () => {
    document.body.innerHTML = `<div data-guide="nom"><input value="  "></div><div data-guide="sexe"><button role="combobox" data-placeholder=""></button></div>`;
    const etape = e('x', { champs: [{ cible: 'nom', libelle: 'Nom' }, { cible: 'sexe', libelle: 'Sexe' }], condition: { type: 'rempli' } });
    expect(lireEtat(etape, '/', visible)).toMatchObject({ satisfaite: false, champs: [{ libelle: 'Nom', rempli: false }, { libelle: 'Sexe', rempli: false }] });
    (document.querySelector('input') as HTMLInputElement).value = 'Diop';
    expect(lireEtat(etape, '/', visible).satisfaite).toBe(false);
    document.querySelector('button')!.removeAttribute('data-placeholder');
    expect(lireEtat(etape, '/', visible).satisfaite).toBe(true);
  });
  it('un champ absent n\'est jamais « rempli »', () => {
    const etape = e('x', { champs: [{ cible: 'rien', libelle: 'Rien' }], condition: { type: 'rempli' } });
    expect(lireEtat(etape, '/', visible)).toMatchObject({ satisfaite: false, absente: true });
  });
  it('un fichier (photo) ne compte pas comme champ à remplir', () => {
    document.body.innerHTML = '<div id="d"><input type="file"><input value="ok"></div>';
    expect(estRempli(document.getElementById('d')!)).toBe(true);
  });
  it('page et visible', () => {
    expect(lireEtat(e('x', { condition: { type: 'page', chemin: '/classes' } }), '/classes', visible).satisfaite).toBe(true);
    expect(lireEtat(e('x', { condition: { type: 'page', chemin: /^\/notes\/[^/]+$/ } }), '/notes', visible).satisfaite).toBe(false);
    const ouvrir = e('x', { condition: { type: 'visible', cible: 'fenetre' } });
    expect(lireEtat(ouvrir, '/', visible).satisfaite).toBe(false);
    document.body.innerHTML = '<div data-guide="fenetre"></div>';
    expect(lireEtat(ouvrir, '/', visible).satisfaite).toBe(true);
    expect(lireEtat(ouvrir, '/', () => false).satisfaite).toBe(false);
  });
  it('un enregistrement n\'est jamais supposé fait', () => {
    expect(lireEtat(e('x', { condition: { type: 'signal', nom: 'classe-creee' } }), '/', visible).satisfaite).toBe(false);
  });
  it('le geste : un champ à la fois, dans l\'ordre, et plus rien quand c\'est rempli', () => {
    document.body.innerHTML = `<div data-guide="nom"><input></div><div data-guide="sexe"><button role="combobox" data-placeholder=""></button></div>`;
    const etape = e('x', { champs: [{ cible: 'nom', libelle: 'Nom' }, { cible: 'sexe', libelle: 'Sexe' }], condition: { type: 'rempli' } });
    const geste = () => lireEtat(etape, '/', visible).geste;
    expect(geste()).toMatchObject({ type: 'ecrire', etiquette: 'Écrivez ici', libelle: 'Nom' });
    (document.querySelector('input') as HTMLInputElement).value = 'Diop';
    expect(geste()).toMatchObject({ type: 'choisir', etiquette: 'Choisissez ici', libelle: 'Sexe' });
    document.querySelector('button')!.removeAttribute('data-placeholder');
    expect(geste()).toBeNull();
  });
  it('rien à faire sur une étape à lire, ni sur une autre page', () => {
    expect(lireEtat(e('x'), '/', visible).geste).toBeNull();
    expect(lireEtat(e('x', { page: '/a', condition: { type: 'visible', cible: 'z' } }), '/b', visible).geste).toBeNull();
    expect(lireEtat(e('x', { condition: { type: 'signal', nom: 'classe-creee' }, action: 'Cochez' }), '/', visible).geste).toMatchObject({ etiquette: 'Cochez' });
  });
  it('hors page : on ne dit pas en plus que l\'élément manque', () => {
    expect(lireEtat(e('x', { page: '/classes', champs: [{ cible: 'z' }] }), '/eleves', visible)).toMatchObject({ horsPage: true, absente: false });
    expect(correspond('/notes', '/notes/1')).toBe(false);
  });
});

describe('avancer', () => {
  const c = chap('c', [
    e('ouvrir', { condition: { type: 'page', chemin: '/classes' } }),
    e('bouton', { condition: { type: 'visible', cible: 'f' }, passerVers: 'liste' }),
    e('nom', { siAbsent: 'bouton' }),
    e('creer', { condition: { type: 'signal', nom: 'classe-creee' } }),
    e('liste', { page: /^\/x\/[^/]+$/ }),
  ]);
  it('« Passer » saute toute la création', () => {
    expect(etapeApresPasser(c, 'bouton')?.id).toBe('liste');
    expect(etapeApresPasser(c, 'nom')?.id).toBe('creer');
    expect(etapeApresPasser(chap('d', [e('a', { passerVers: 'fin' }), e('b')]), 'a')).toBeNull();
  });
  it('plus rapide que le guide : on reprend après l\'enregistrement', () => {
    expect(etapeApresSignal(c, 'nom', 'classe-creee')?.id).toBe('liste');
    expect(etapeApresSignal(c, 'creer', 'classe-creee')?.id).toBe('liste');
    expect(etapeApresSignal(c, 'liste', 'classe-creee')).toBeUndefined();
    expect(etapeApresSignal(c, 'nom', 'prof-inscrit')).toBeUndefined();
  });
  it('perdu sur une page choisie : on repart de la dernière adresse connue', () => {
    expect(etapeDeReprise(c, 'liste')?.id).toBe('ouvrir');
    expect(etapeDeReprise(c, 'ouvrir')).toBeNull();
  });
});

describe('progression', () => {
  it('une progression illisible repart de zéro', () => {
    for (const brut of [null, undefined, 'x', 3, []]) expect(lireProgression(brut)).toMatchObject({ actif: false, termines: [] });
    expect(lireProgression({ choix: 'peut-etre', actif: 'oui', termines: [1, 'a'], maj: 'x' }))
      .toEqual({ choix: undefined, actif: false, chapitre: undefined, etape: undefined, termines: ['a'], maj: 0 });
  });
  it('le plus récent des deux, appareil ou compte', () => {
    const a = { ...PROGRESSION_VIDE, maj: 5 }, b = { ...PROGRESSION_VIDE, maj: 9 };
    expect(plusRecente(a, b)).toBe(b);
    expect(plusRecente(b, a)).toBe(b);
  });
  it('chapitre suivant : le prochain non terminé, puis ceux d\'avant', () => {
    const l = ['a', 'b', 'c'].map(id => chap(id, [e('1')]));
    expect(chapitreSuivant(l, ['a'], 'a')?.id).toBe('b');
    expect(chapitreSuivant(l, ['b', 'c'], 'c')?.id).toBe('a');
    expect(chapitreSuivant(l, ['a', 'b', 'c'], 'c')).toBeNull();
  });
  it('terminé une seule fois ; un chapitre refait en partie est « commencé »', () => {
    const p = marquerTermine(marquerTermine(PROGRESSION_VIDE, 'a'), 'a');
    expect(p.termines).toEqual(['a']);
    const c = chap('a', [e('1'), e('2')]);
    expect(statutChapitre(c, p)).toBe('termine');
    expect(statutChapitre(c, { ...p, chapitre: 'a', etape: '2' })).toBe('commence');
    expect(statutChapitre(c, PROGRESSION_VIDE)).toBe('a-faire');
  });
});

describe('place de la bulle', () => {
  const vue = { width: 1200, height: 800 }, bulle = { width: 360, height: 240 };
  const chevauche = (p: { left: number; top: number }, b: { left: number; top: number; width: number; height: number }) =>
    p.left < b.left + b.width && p.left + bulle.width > b.left && p.top < b.top + b.height && p.top + bulle.height > b.top;
  it('jamais sur l\'élément quand il y a de la place, toujours dans l\'écran', () => {
    for (const left of [0, 300, 900, 1150]) for (const top of [0, 300, 760]) for (const width of [40, 280, 800]) {
      const b = { left, top, width, height: 40 };
      const p = placerBulle(b, bulle, vue);
      expect(p.left).toBeGreaterThanOrEqual(16); expect(p.left + bulle.width).toBeLessThanOrEqual(1184);
      expect(p.top).toBeGreaterThanOrEqual(16); expect(p.top + bulle.height).toBeLessThanOrEqual(784);
      expect(chevauche(p, b)).toBe(false);
    }
  });
  it('sans élément, ou élément immense : en bas au milieu', () => {
    expect(placerBulle(null, bulle, vue)).toEqual({ left: 420, top: 544 });
    expect(placerBulle({ left: 0, top: 0, width: 1200, height: 800 }, bulle, vue)).toEqual({ left: 420, top: 544 });
  });
  it('page défilée, élément sorti ou à moitié sorti : la bulle reste entière à l\'écran', () => {
    for (const top of [-900, -300, -70, -20, 790, 2000]) {
      const p = placerBulle({ left: 310, top, width: 900, height: 60 }, bulle, vue);
      expect(p.top).toBeGreaterThanOrEqual(16); expect(p.top + bulle.height).toBeLessThanOrEqual(784);
    }
  });
  it('plusieurs champs : un seul cadre', () => {
    expect(reunir([{ left: 10, top: 10, width: 10, height: 10 }, { left: 50, top: 5, width: 10, height: 10 }])).toEqual({ left: 10, top: 5, width: 50, height: 15 });
    expect(reunir([])).toBeNull();
  });
});
