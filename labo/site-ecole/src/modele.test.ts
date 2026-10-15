import { describe, it, expect } from 'vitest';
import {
  ajouterBloc, ancreBloc, creerBloc, deplacerBloc, dupliquerBloc, modifierApparence,
  remplacerBloc, siteDeDepart, sousAdresse, supprimerBloc, type Site,
} from './modele';
import { ECOLE_ESSAI } from './ecoleEssai';

const site = (): Site => ({
  apparence: { couleur: '#F59E0B', police: 'moderne' },
  blocs: [
    creerBloc('banniere', ECOLE_ESSAI, 'a'),
    creerBloc('presentation', ECOLE_ESSAI, 'b'),
    creerBloc('contact', ECOLE_ESSAI, 'c'),
  ],
});
const ids = (s: Site) => s.blocs.map(b => b.id);

describe('modèle du site', () => {
  it('le site de départ reprend le nom et la ville de l\'école', () => {
    const s = siteDeDepart(ECOLE_ESSAI);
    expect(s.blocs.map(b => b.type)).toEqual(['banniere', 'presentation', 'formations', 'contact']);
    const banniere = s.blocs[0];
    expect(banniere.type === 'banniere' && banniere.titre).toBe('École Essai');
    expect(banniere.type === 'banniere' && banniere.sousTitre).toBe('Dakar, Sénégal');
  });

  it('sans ville, le sous-titre se contente du pays', () => {
    const b = creerBloc('banniere', { ...ECOLE_ESSAI, ville: null });
    expect(b.type === 'banniere' && b.sousTitre).toBe('Sénégal');
  });

  it('ajoute après un bloc donné, ou à la fin', () => {
    expect(ids(ajouterBloc(site(), creerBloc('galerie', ECOLE_ESSAI, 'g'), 'a'))).toEqual(['a', 'g', 'b', 'c']);
    expect(ids(ajouterBloc(site(), creerBloc('galerie', ECOLE_ESSAI, 'g')))).toEqual(['a', 'b', 'c', 'g']);
    expect(ids(ajouterBloc(site(), creerBloc('galerie', ECOLE_ESSAI, 'g'), 'inconnu'))).toEqual(['a', 'b', 'c', 'g']);
  });

  it('déplace sans sortir des bornes', () => {
    expect(ids(deplacerBloc(site(), 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(deplacerBloc(site(), 'b', 1))).toEqual(['a', 'c', 'b']);
    const s = site();
    expect(deplacerBloc(s, 'a', -1)).toBe(s);
    expect(deplacerBloc(s, 'c', 1)).toBe(s);
    expect(deplacerBloc(s, 'inconnu', 1)).toBe(s);
  });

  it('duplique juste après l\'original, sans partager les listes', () => {
    const avec = remplacerBloc(site(), { id: 'b', type: 'chiffres', titre: 'X', elements: [{ valeur: '1', libelle: 'un' }] });
    const s = dupliquerBloc(avec, 'b', 'b2');
    expect(ids(s)).toEqual(['a', 'b', 'b2', 'c']);
    const [orig, copie] = [s.blocs[1], s.blocs[2]];
    if (orig.type !== 'chiffres' || copie.type !== 'chiffres') throw new Error('type');
    expect(copie.elements).toEqual(orig.elements);
    expect(copie.elements).not.toBe(orig.elements);
  });

  it('supprime et remplace sans toucher au site d\'origine', () => {
    const s = site();
    expect(ids(supprimerBloc(s, 'b'))).toEqual(['a', 'c']);
    expect(ids(s)).toEqual(['a', 'b', 'c']);
    const r = remplacerBloc(s, { id: 'b', type: 'presentation', titre: 'Neuf', texte: '', image: '' });
    expect(r.blocs[1].type === 'presentation' && r.blocs[1].titre).toBe('Neuf');
  });

  it('modifie l\'apparence partiellement', () => {
    expect(modifierApparence(site(), { police: 'classique' }).apparence).toEqual({ couleur: '#F59E0B', police: 'classique' });
  });

  it('ancre : le premier bloc d\'un type prend le nom du type', () => {
    const s = ajouterBloc(site(), creerBloc('contact', ECOLE_ESSAI, 'c2abcdef'));
    expect(ancreBloc(s, s.blocs[2])).toBe('contact');
    expect(ancreBloc(s, s.blocs[3])).toBe('contact-c2abcd');
  });

  it('sous-adresse sur senclass.com', () => {
    expect(sousAdresse(ECOLE_ESSAI)).toBe('ecole-essai.senclass.com');
  });
});
