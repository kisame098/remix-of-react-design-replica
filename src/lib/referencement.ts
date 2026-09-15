// ═══════════════════════════════════════════════════════════════════════════
// RÉFÉRENCEMENT — titre de l'onglet et consigne aux moteurs de recherche,
// page par page.
//
// Une seule page doit apparaître sur Google : l'accueil. Les autres sont
// derrière une connexion ; indexées, elles ne montreraient qu'un écran de
// connexion et dilueraient la page d'accueil dans les résultats.
// ═══════════════════════════════════════════════════════════════════════════

export const NOM_DU_SITE = 'SenClass';

/**
 * Titre de la page d'accueil — la ligne bleue cliquable dans Google.
 * Mot-clé en tête : c'est ce que tapent les directeurs d'école, et tous les
 * concurrents l'ont déjà dans leur titre. Doit rester identique au <title>
 * d'index.html (vérifié par src/test/deploiement.test.ts).
 */
export const TITRE_ACCUEIL = 'Logiciel de gestion scolaire au Sénégal | SenClass';

export interface Referencement {
  titre: string;
  /** `true` : la page peut apparaître dans Google. */
  indexer: boolean;
}

const PAGES_PUBLIQUES: Record<string, Referencement> = {
  '/':               { titre: TITRE_ACCUEIL, indexer: true },
  '/auth':           { titre: `Connexion | ${NOM_DU_SITE}`, indexer: false },
  '/reset-password': { titre: `Nouveau mot de passe | ${NOM_DU_SITE}`, indexer: false },
};

/** Espaces connectés : un titre lisible dans l'onglet, jamais d'indexation. */
const PAGES_PRIVEES: [prefixe: string, titre: string][] = [
  ['/dashboard',          'Tableau de bord'],
  ['/inscription',        'Inscription des élèves'],
  ['/inscription-prof',   'Inscription des professeurs'],
  ['/eleves',             'Élèves'],
  ['/professeurs',        'Professeurs'],
  ['/classes',            'Classes'],
  ['/notes',              'Notes'],
  ['/filieres',           'Cursus'],
  ['/emplois-du-temps',   'Emplois du temps'],
  ['/presences',          'Présences'],
  ['/paiements',          'Paiements'],
  ['/salaires',           'Salaires'],
  ['/identifiants',       'Identifiants'],
  ['/parametres',         'Paramètres'],
  ['/abonnement',         'Abonnement'],
  ['/abonnement-requis',  'Abonnement'],
  ['/caisse',             'Caisse'],
  ['/portail',            'Mon espace'],
  ['/portail/notes',      'Mes notes'],
  ['/portail/emploi',     'Mon emploi du temps'],
  ['/portail/paiements',  'Mes paiements'],
  ['/portail/presences',  'Mes présences'],
  ['/portail/profil',     'Mon profil'],
  ['/portail/filiere',    'Choix de filière'],
  ['/platform',           'Administration'],
];

/**
 * Référencement d'une adresse. Une adresse inconnue n'est jamais indexée :
 * l'application répond « page introuvable » avec un code 200, et Google
 * pénalise ces fausses pages.
 */
export const referencementDe = (chemin: string): Referencement => {
  const publique = PAGES_PUBLIQUES[chemin];
  if (publique) return publique;

  // Le préfixe le plus long l'emporte : /portail/notes/42 → « Mes notes ».
  const privee = PAGES_PRIVEES
    .filter(([prefixe]) => chemin === prefixe || chemin.startsWith(`${prefixe}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return {
    titre: `${privee ? privee[1] : 'Page introuvable'} | ${NOM_DU_SITE}`,
    indexer: false,
  };
};

/** Préfixes des espaces privés — robots.txt doit tous les couvrir. */
export const PREFIXES_PRIVES = PAGES_PRIVEES.map(([prefixe]) => prefixe);
