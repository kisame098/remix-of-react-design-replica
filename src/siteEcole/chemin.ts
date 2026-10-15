/**
 * Lecture / écriture d'une valeur du contenu par son chemin (« accueil.chiffres.2.valeur »).
 * Fonctions pures : l'objet d'origine n'est jamais modifié.
 */

type Objet = Record<string, unknown>;

export function lire(objet: unknown, chemin: string): unknown {
  return chemin.split('.').reduce<unknown>((o, cle) => (o == null ? undefined : (o as Objet)[cle]), objet);
}

export function ecrire<T>(objet: T, chemin: string, valeur: unknown): T {
  const [cle, ...reste] = chemin.split('.');
  const courant = objet as unknown as Objet;
  const enfant = reste.length ? ecrire(courant?.[cle] ?? {}, reste.join('.'), valeur) : valeur;
  if (Array.isArray(objet)) {
    const copie = [...objet];
    copie[Number(cle)] = enfant;
    return copie as unknown as T;
  }
  return { ...courant, [cle]: enfant } as T;
}

export const ajouterElement = <E>(liste: E[], element: E, apres = liste.length - 1): E[] => {
  const copie = [...liste];
  copie.splice(apres + 1, 0, element);
  return copie;
};

export const retirerElement = <E>(liste: E[], index: number): E[] => liste.filter((_, i) => i !== index);

export function deplacerElement<E>(liste: E[], index: number, sens: -1 | 1): E[] {
  const cible = index + sens;
  if (index < 0 || cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

/**
 * Recharge une sauvegarde par-dessus le modèle : ce que l'école a écrit gagne,
 * mais un champ ajouté plus tard au modèle apparaît quand même (au lieu de
 * laisser un trou). Les listes sont prises telles quelles depuis la sauvegarde.
 */
export function fusionner<T>(modele: T, sauvegarde: unknown): T {
  if (sauvegarde === undefined || sauvegarde === null) return modele;
  if (Array.isArray(modele)) return (Array.isArray(sauvegarde) ? sauvegarde : modele) as T;
  if (typeof modele === 'object' && modele !== null) {
    if (typeof sauvegarde !== 'object' || Array.isArray(sauvegarde)) return modele;
    const resultat: Objet = { ...(modele as Objet) };
    for (const cle of Object.keys(modele as Objet)) {
      resultat[cle] = fusionner((modele as Objet)[cle], (sauvegarde as Objet)[cle]);
    }
    return resultat as T;
  }
  return (typeof sauvegarde === typeof modele ? sauvegarde : modele) as T;
}
