/**
 * Modèle du site web d'une école : une page faite de blocs empilés.
 *
 * Tout est en fonctions PURES (le site entre, un nouveau site sort) : l'éditeur
 * ne fait qu'appeler ces fonctions, et le même contenu JSON sera plus tard
 * enregistré tel quel dans la table `school_sites`.
 */

/** Informations reprises automatiquement du SaaS — jamais ressaisies dans l'éditeur. */
export interface InfosEcole {
  nom: string;
  slug: string;
  logoUrl: string | null;
  ville: string | null;
  pays: string;
  telephone: string | null;
  email: string | null;
  formations: { nom: string; description?: string }[];
}

export type Police = 'moderne' | 'classique';

export interface Apparence {
  /** Couleur principale, en hexadécimal (#F59E0B). */
  couleur: string;
  police: Police;
}

interface BlocCommun { id: string }

export interface BlocBanniere extends BlocCommun {
  type: 'banniere';
  titre: string;
  sousTitre: string;
  image: string;
  boutonTexte: string;
  /** Ancre d'un autre bloc (« #contact ») ou adresse externe. Vide = pas de bouton. */
  boutonLien: string;
}

export interface BlocPresentation extends BlocCommun {
  type: 'presentation';
  titre: string;
  texte: string;
  image: string;
}

export interface BlocChiffres extends BlocCommun {
  type: 'chiffres';
  titre: string;
  elements: { valeur: string; libelle: string }[];
}

/** Liste des formations / classes : contenu repris du SaaS, seul l'intitulé se règle. */
export interface BlocFormations extends BlocCommun {
  type: 'formations';
  titre: string;
  intro: string;
}

export interface BlocGalerie extends BlocCommun {
  type: 'galerie';
  titre: string;
  images: string[];
}

/** Coordonnées : reprises du SaaS, seul l'intitulé se règle. */
export interface BlocContact extends BlocCommun {
  type: 'contact';
  titre: string;
  intro: string;
}

export type Bloc = BlocBanniere | BlocPresentation | BlocChiffres | BlocFormations | BlocGalerie | BlocContact;
export type TypeBloc = Bloc['type'];

export interface Site {
  apparence: Apparence;
  blocs: Bloc[];
}

/** Description d'un type de bloc pour la fenêtre « Ajouter un bloc ». */
export const TYPES_BLOCS: { type: TypeBloc; nom: string; description: string; automatique: boolean }[] = [
  { type: 'banniere',     nom: 'Bannière',     description: 'Grande image, titre et bouton en haut du site', automatique: false },
  { type: 'presentation', nom: 'Présentation', description: 'Un texte et une photo côte à côte',             automatique: false },
  { type: 'chiffres',     nom: 'Chiffres clés', description: 'Quelques nombres mis en avant',                 automatique: false },
  { type: 'formations',   nom: 'Formations',   description: 'Vos classes et formations, reprises de SenClass', automatique: true },
  { type: 'galerie',      nom: 'Galerie',      description: 'Une grille de photos',                           automatique: false },
  { type: 'contact',      nom: 'Contact',      description: 'Adresse, téléphone, e-mail repris de SenClass',  automatique: true },
];

export const nomTypeBloc = (type: TypeBloc) => TYPES_BLOCS.find(t => t.type === type)?.nom ?? type;

/** Sous-adresse où le site sera publié (étape 4) ; le domaine propre viendra ensuite. */
export const sousAdresse = (ecole: InfosEcole) => `${ecole.slug}.senclass.com`;

let compteur = 0;
export const nouvelId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `bloc-${Date.now()}-${++compteur}`;

/** Un bloc neuf, pré-rempli avec ce que l'on sait déjà de l'école. */
export function creerBloc(type: TypeBloc, ecole: InfosEcole, id: string = nouvelId()): Bloc {
  switch (type) {
    case 'banniere':
      return {
        id, type, titre: ecole.nom,
        sousTitre: ecole.ville ? `${ecole.ville}, ${ecole.pays}` : ecole.pays,
        image: '', boutonTexte: 'Nous contacter', boutonLien: '#contact',
      };
    case 'presentation':
      return { id, type, titre: 'Notre école', texte: '', image: '' };
    case 'chiffres':
      return { id, type, titre: 'En quelques chiffres', elements: [] };
    case 'formations':
      return { id, type, titre: 'Nos formations', intro: '' };
    case 'galerie':
      return { id, type, titre: 'En images', images: [] };
    case 'contact':
      return { id, type, titre: 'Nous contacter', intro: '' };
  }
}

/** Le modèle de départ proposé à une école qui ouvre l'éditeur pour la première fois. */
export function siteDeDepart(ecole: InfosEcole): Site {
  return {
    apparence: { couleur: '#F59E0B', police: 'moderne' },
    blocs: (['banniere', 'presentation', 'formations', 'contact'] as TypeBloc[]).map(t => creerBloc(t, ecole)),
  };
}

/** Insère un bloc juste après `apresId` (ou à la fin si absent / introuvable). */
export function ajouterBloc(site: Site, bloc: Bloc, apresId?: string | null): Site {
  const i = apresId ? site.blocs.findIndex(b => b.id === apresId) : -1;
  const blocs = [...site.blocs];
  blocs.splice(i === -1 ? blocs.length : i + 1, 0, bloc);
  return { ...site, blocs };
}

/** Monte (-1) ou descend (+1) un bloc ; sans effet aux extrémités. */
export function deplacerBloc(site: Site, id: string, sens: -1 | 1): Site {
  const i = site.blocs.findIndex(b => b.id === id);
  const j = i + sens;
  if (i === -1 || j < 0 || j >= site.blocs.length) return site;
  const blocs = [...site.blocs];
  [blocs[i], blocs[j]] = [blocs[j], blocs[i]];
  return { ...site, blocs };
}

export function dupliquerBloc(site: Site, id: string, nouvel: string = nouvelId()): Site {
  const bloc = site.blocs.find(b => b.id === id);
  if (!bloc) return site;
  return ajouterBloc(site, structuredClone({ ...bloc, id: nouvel }), id);
}

export function supprimerBloc(site: Site, id: string): Site {
  return { ...site, blocs: site.blocs.filter(b => b.id !== id) };
}

/** Remplace un bloc par sa version modifiée (même id). */
export function remplacerBloc(site: Site, bloc: Bloc): Site {
  return { ...site, blocs: site.blocs.map(b => (b.id === bloc.id ? bloc : b)) };
}

export function modifierApparence(site: Site, apparence: Partial<Apparence>): Site {
  return { ...site, apparence: { ...site.apparence, ...apparence } };
}

/** Ancre HTML d'un bloc dans la page publique : le premier de chaque type porte le nom du type. */
export function ancreBloc(site: Site, bloc: Bloc): string {
  const premier = site.blocs.find(b => b.type === bloc.type);
  return premier?.id === bloc.id ? bloc.type : `${bloc.type}-${bloc.id.slice(0, 6)}`;
}

/** Résumé d'une ligne, affiché sous le nom du bloc dans la colonne de gauche. */
export function resumeBloc(bloc: Bloc): string {
  switch (bloc.type) {
    case 'chiffres': return bloc.elements.length ? `${bloc.elements.length} chiffre(s)` : 'Aucun chiffre';
    case 'galerie':  return bloc.images.length ? `${bloc.images.length} photo(s)` : 'Aucune photo';
    case 'formations':
    case 'contact':  return `${bloc.titre} · automatique`;
    default:         return bloc.titre || 'Sans titre';
  }
}
