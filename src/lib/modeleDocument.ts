import { visuelVersHtml, lireDocumentVisuel, type DocumentVisuel } from '@/lib/documentVisuel';
import {
  ERREUR_MIXTE, cibleDesChamps, nomPersonne, assemblerDocuments, listerVides, nettoyer, produireDocuments, valeursChamps, verifierModele,
  type ContexteDocument, type Production, type VerificationModele,
} from '@/lib/modelesDocuments';
import { archiverWords, depuisBase64, remplirWord, verifierWord, TYPE_DOCX } from '@/lib/modeleWord';
import { nomDeFichier } from '@/lib/documentsEcole';

// ═══════════════════════════════════════════════════════════════════════════
// UN MODÈLE, QUELLE QUE SOIT SA FORME
//
//   visuel : une page de l'éditeur (façon Canva) — le cas courant ;
//   html   : du HTML écrit ou importé (pour ceux qui savent) ;
//   word   : un fichier Word gardé tel quel.
//
// Même règle pour les trois : un champ inconnu de SenClass est refusé, à
// l'enregistrement comme à la production.
// ═══════════════════════════════════════════════════════════════════════════

export type GenreModele = 'visuel' | 'html' | 'word';

/** Une page de l'éditeur, images comprises (même limite que la base). */
export const TAILLE_MAX_VISUEL = 3_000_000;

export const LIBELLES_GENRE: Record<GenreModele, string> = { visuel: 'Page', html: 'HTML', word: 'Word' };

export type SourceModele =
  | { genre: 'visuel'; contenu: DocumentVisuel }
  | { genre: 'html'; html: string }
  /** Le .docx en base64. */
  | { genre: 'word'; fichier: string };

/** Une ligne de la base → une source, ou null si elle est illisible. */
export const lireSource = (r: { genre?: string | null; html?: string | null; contenu?: unknown; fichier?: string | null }): SourceModele | null => {
  if (r.genre === 'visuel') {
    const contenu = lireDocumentVisuel(r.contenu);
    return contenu ? { genre: 'visuel', contenu } : null;
  }
  if (r.genre === 'word') return r.fichier ? { genre: 'word', fichier: r.fichier } : null;
  return r.html ? { genre: 'html', html: r.html } : null;
};

/** Vérification commune, présentée de la même façon quel que soit le genre. */
export const verifierSource = (s: SourceModele): VerificationModele => {
  if (s.genre === 'word') {
    const v = verifierWord(depuisBase64(s.fichier));
    const cible = cibleDesChamps(v.utilises);
    return {
      ok: v.ok && cible !== 'mixte', inconnus: v.inconnus, imagesMalPlacees: v.images, utilises: v.utilises, retraits: [],
      erreur: v.erreur ?? (cible === 'mixte' ? ERREUR_MIXTE : undefined), cible: cible === 'mixte' ? 'aucune' : cible,
    };
  }
  if (s.genre === 'visuel' && s.contenu.elements.length === 0) {
    return { ok: false, inconnus: [], imagesMalPlacees: [], utilises: [], retraits: [], erreur: 'La page est vide : ajoutez du texte, une image ou une forme.' };
  }
  if (s.genre === 'visuel') {
    // Même limite que la base (3 Mo) : des images (cachet, signature) y tiennent.
    if (JSON.stringify(s.contenu).length > TAILLE_MAX_VISUEL) {
      return { ok: false, inconnus: [], imagesMalPlacees: [], utilises: [], retraits: [], erreur: 'Le document dépasse 3 Mo : retirez ou remplacez une image trop lourde.' };
    }
    return verifierModele(visuelVersHtml(s.contenu), TAILLE_MAX_VISUEL);
  }
  return verifierModele(s.html);
};

/**
 * Remplit le modèle pour chaque élève : un seul document à afficher, imprimer
 * ou mettre en PDF. Un Word est d'abord rempli (exact), puis redessiné en
 * page pour l'aperçu et l'impression.
 */
export const produire = async (s: SourceModele, contextes: ContexteDocument[]): Promise<Production> => {
  if (s.genre !== 'word') return produireDocuments(s.genre === 'visuel' ? visuelVersHtml(s.contenu) : s.html, contextes);
  const verification = verifierSource(s);
  if (!verification.ok) return { refus: verification, html: '', vides: [] };
  const original = depuisBase64(s.fichier);
  const { wordVersHtml } = await import('@/lib/modeleWordRendu');
  const pages: string[] = [];
  for (const c of contextes) pages.push(nettoyer(await wordVersHtml(remplirWord(original, valeursChamps(c)))).html);
  return { html: assemblerDocuments(pages), vides: listerVides(verification.utilises, contextes) };
};

const enregistrerFichier = (contenu: Uint8Array, type: string, nom: string) => {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Le Word rempli, exact au millimètre : un .docx pour un élève, une archive
 * .zip (un .docx par élève) pour plusieurs.
 */
export const telechargerWordRempli = (fichier: string, contextes: ContexteDocument[], nom: string): void => {
  const original = depuisBase64(fichier);
  const remplis = contextes.map(c => ({
    nom: nomDeFichier(nomPersonne(c)) || 'document',
    contenu: remplirWord(original, valeursChamps(c)),
  }));
  if (remplis.length === 1) enregistrerFichier(remplis[0].contenu, TYPE_DOCX, `${nomDeFichier(nom) || 'document'}.docx`);
  else enregistrerFichier(archiverWords(remplis), 'application/zip', `${nomDeFichier(nom) || 'documents'}.zip`);
};

/** Le Word d'origine, pour que l'école le retouche dans Word puis le réimporte. */
export const telechargerWordOriginal = (fichier: string, nom: string): void =>
  enregistrerFichier(depuisBase64(fichier), TYPE_DOCX, `${nomDeFichier(nom) || 'modele'}.docx`);
