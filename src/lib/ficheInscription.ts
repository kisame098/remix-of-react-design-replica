import type { InfosEcole } from '@/lib/documentsEcole';

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES DE LA FICHE D'INSCRIPTION — pur, sans PDF ni réseau.
//
// On ne met sur la fiche que ce que le système SAIT : rien n'est inventé. Ce qui
// manque (tuteur 2, filière, tarifs non saisis) est simplement omis.
// ═══════════════════════════════════════════════════════════════════════════

export interface TuteurFiche {
  /** « Père », « Mère », « Oncle »… */
  qualite: string;
  nom?: string;
  telephone: string;
  email?: string;
}

export interface FicheInscriptionData {
  ecole: InfosEcole;
  anneeScolaire: string;
  /** ISO — date d'inscription POUR CETTE ANNÉE (pas la création du profil). */
  dateInscription: string;
  reinscription: boolean;
  eleve: {
    nom: string;
    prenoms: string;
    matricule: string;
    sexe: string;
    dateNaissance: string;
    lieuNaissance: string;
    residence: string;
    telephone?: string;
    email?: string;
    /** Data URL uniquement : jsPDF ne va pas chercher une image distante. */
    photo?: string | null;
  };
  scolarite: { classe?: string; niveau?: string; filiere?: string };
  tuteurs: TuteurFiche[];
  frais?: { inscription?: number; mensualite?: number; inscriptionPayee: boolean };
  /** Identifiants de connexion de l'élève. `null` : pas (encore) lisibles. */
  compte: { adresseSite: string; identifiant: string; motDePasse: string } | null;
}

const QUALITES: Record<string, string> = {
  pere: 'Père', mere: 'Mère', oncle: 'Oncle', tante: 'Tante', autre: 'Autre',
};

/** « pere » → « Père » ; une valeur inconnue est reprise telle quelle, mise en forme. */
export const libelleQualite = (statut: string | undefined): string => {
  if (!statut) return 'Tuteur';
  return QUALITES[statut] ?? (statut.charAt(0).toUpperCase() + statut.slice(1));
};

/** « 2012-03-05 » → « 05/03/2012 ». Une date non ISO est rendue telle quelle. */
export const dateIsoVersFr = (iso: string | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
};

export const libelleSexe = (sexe: string | undefined): string =>
  sexe === 'homme' ? 'Masculin' : sexe === 'femme' ? 'Féminin' : '—';

interface EntreeFiche {
  ecole: InfosEcole;
  anneeScolaire: string;
  dateInscription: string;
  reinscription: boolean;
  eleve: {
    firstName: string; lastName: string; studentId: string; sex?: string;
    dateOfBirth?: string; placeOfBirth?: string; residence?: string;
    phone?: string; email?: string; photoUrl?: string;
    tutor1: { fullName?: string; phone: string; status: string; email?: string };
    tutor2?: { fullName?: string; phone: string; status: string; email?: string };
  };
  classe?: { name: string; niveau?: string };
  filiere?: string;
  tarifs?: { inscriptionFee: number; monthlyFee: number };
  inscriptionPayee: boolean;
  compte: { identifiant: string; motDePasse: string } | null;
  adresseSite: string;
}

export const construireFiche = (e: EntreeFiche): FicheInscriptionData => {
  const tuteur = (t: NonNullable<EntreeFiche['eleve']['tutor2']>): TuteurFiche => ({
    qualite: libelleQualite(t.status),
    nom: t.fullName?.trim() || undefined,
    telephone: t.phone,
    email: t.email?.trim() || undefined,
  });

  return {
    ecole: e.ecole,
    anneeScolaire: e.anneeScolaire,
    dateInscription: e.dateInscription,
    reinscription: e.reinscription,
    eleve: {
      nom: e.eleve.lastName.toUpperCase(),
      prenoms: e.eleve.firstName,
      matricule: e.eleve.studentId,
      sexe: libelleSexe(e.eleve.sex),
      dateNaissance: dateIsoVersFr(e.eleve.dateOfBirth),
      lieuNaissance: e.eleve.placeOfBirth ?? '',
      residence: e.eleve.residence ?? '',
      telephone: e.eleve.phone?.trim() || undefined,
      email: e.eleve.email?.trim() || undefined,
      photo: e.eleve.photoUrl?.startsWith('data:image/') ? e.eleve.photoUrl : null,
    },
    scolarite: { classe: e.classe?.name, niveau: e.classe?.niveau, filiere: e.filiere },
    // Le tuteur 2 n'apparaît que s'il a été renseigné.
    tuteurs: [tuteur(e.eleve.tutor1), ...(e.eleve.tutor2?.phone ? [tuteur(e.eleve.tutor2)] : [])],
    frais: e.tarifs
      ? { inscription: e.tarifs.inscriptionFee, mensualite: e.tarifs.monthlyFee, inscriptionPayee: e.inscriptionPayee }
      : undefined,
    compte: e.compte
      ? { adresseSite: e.adresseSite, identifiant: e.compte.identifiant, motDePasse: e.compte.motDePasse }
      : null,
  };
};

/** Pièces habituellement demandées à l'inscription — cases à cocher à la main. */
export const PIECES_A_FOURNIR = [
  'Extrait d\'acte de naissance',
  'Certificat de scolarité / bulletin',
  '2 photos d\'identité',
  'Carnet de vaccination',
  'Pièce d\'identité du tuteur',
  'Certificat de radiation (transfert)',
] as const;
