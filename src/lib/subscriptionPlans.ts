// ═══════════════════════════════════════════════════════════════════════════
// GRILLE D'ABONNEMENT — une école peut régler plusieurs mois d'un coup, avec
// une remise qui grandit avec la durée.
//
// Les prix sont écrits EN DUR, pas calculés à partir d'un pourcentage : un
// tarif doit être rond et lisible (135 000, pas 134 999,50). La remise
// affichée est au contraire DÉDUITE du prix — elle ne peut donc jamais mentir.
//
// Le geste commercial reste mesuré : 20 % au maximum, pour l'année complète.
// C'est environ deux mois offerts sur douze — l'usage dans le logiciel en
// abonnement, sans brader le produit.
// ═══════════════════════════════════════════════════════════════════════════

/** Tarif mensuel de référence, en FCFA. */
export const TARIF_MENSUEL = 25_000;

export interface FormuleAbonnement {
  mois: number;
  /** Prix réellement payé, en FCFA — toujours un montant rond. */
  prix: number;
  /** Libellé court pour les cartes de choix. */
  libelle: string;
}

/**
 * Durées proposées. Le saut de 10 à 12 mois est volontaire : « 11 mois » n'a
 * aucun sens pour une école, dont l'année en compte 9 ou 10, et l'année pleine
 * est la formule qu'on veut mettre en avant.
 */
export const FORMULES: FormuleAbonnement[] = [
  { mois: 1,  prix:  25_000, libelle: '1 mois'   },
  { mois: 2,  prix:  48_500, libelle: '2 mois'   },
  { mois: 3,  prix:  71_000, libelle: '3 mois'   },
  { mois: 4,  prix:  93_000, libelle: '4 mois'   },
  { mois: 5,  prix: 115_000, libelle: '5 mois'   },
  { mois: 6,  prix: 135_000, libelle: '6 mois'   },
  { mois: 7,  prix: 156_000, libelle: '7 mois'   },
  { mois: 8,  prix: 176_000, libelle: '8 mois'   },
  { mois: 9,  prix: 196_000, libelle: '9 mois'   },
  { mois: 10, prix: 212_500, libelle: '10 mois'  },
  { mois: 12, prix: 240_000, libelle: '1 an'     },
];

export const FORMULE_PAR_DEFAUT = 1;

export const trouverFormule = (mois: number): FormuleAbonnement | undefined =>
  FORMULES.find(f => f.mois === mois);

/** Prix sans remise : ce que coûteraient ces mois au tarif mensuel. */
export const prixPlein = (mois: number): number => mois * TARIF_MENSUEL;

/** Économie en FCFA par rapport au tarif mensuel. */
export const economie = (formule: FormuleAbonnement): number =>
  prixPlein(formule.mois) - formule.prix;

/** Remise en pourcentage, arrondie à l'entier — déduite du prix, jamais l'inverse. */
export const remisePourcent = (formule: FormuleAbonnement): number =>
  Math.round((economie(formule) / prixPlein(formule.mois)) * 100);

/** Coût ramené au mois — ce que la famille des tarifs compare réellement. */
export const prixParMois = (formule: FormuleAbonnement): number =>
  Math.round(formule.prix / formule.mois);

/**
 * Nom de plan stocké en base et affiché dans l'historique de facturation.
 * Lisible sans décodeur : « 6 mois », « 1 an ».
 */
export const nomDuPlan = (formule: FormuleAbonnement): string => formule.libelle;
