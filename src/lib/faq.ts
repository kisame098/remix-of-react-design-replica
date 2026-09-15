import { FORMULES, TARIF_MENSUEL, prixPlein } from "@/lib/subscriptionPlans";

// ════════════════════════════════════════════════════════════════════════════
// QUESTIONS FRÉQUENTES DE LA PAGE D'ACCUEIL
//
// Chaque question reprend une recherche réelle d'un directeur d'école
// (« combien coûte un logiciel de gestion scolaire », « bulletins
// automatiques »…) : c'est ce contenu qui fait remonter la page sur les
// recherches précises, là où les concurrents n'ont qu'un slogan.
//
// Les prix sont CALCULÉS depuis la grille réelle (subscriptionPlans.ts) : ils
// ne peuvent pas diverger du tarif. Aucune durée d'essai n'est promise —
// elle dépend du réglage choisi par le chef du système (7 jours par défaut).
// ════════════════════════════════════════════════════════════════════════════

const fcfa = (montant: number) => `${new Intl.NumberFormat("fr-FR").format(montant)} FCFA`;

const ANNUEL = FORMULES.find((f) => f.mois === 12)!;
const REMISE_ANNUELLE = Math.round((1 - ANNUEL.prix / prixPlein(12)) * 100);

export interface QuestionFrequente {
  question: string;
  reponse: string;
}

export const QUESTIONS: QuestionFrequente[] = [
  {
    question: "Qu'est-ce que SenClass ?",
    reponse:
      "SenClass est un logiciel de gestion scolaire en ligne, conçu à Dakar pour les écoles du Sénégal. " +
      "Il réunit en un seul outil les inscriptions, les notes et les bulletins, les emplois du temps, les présences, " +
      "les paiements de scolarité et les salaires des professeurs.",
  },
  {
    question: "Combien coûte SenClass ?",
    reponse:
      `L'abonnement coûte ${fcfa(TARIF_MENSUEL)} par mois pour tout l'établissement, quelle que soit sa taille. ` +
      `En payant plusieurs mois d'avance, la remise augmente progressivement jusqu'à ${REMISE_ANNUELLE} % : ` +
      `un an revient à ${fcfa(ANNUEL.prix)} au lieu de ${fcfa(prixPlein(12))}.`,
  },
  {
    question: "Le logiciel est-il adapté au système scolaire sénégalais ?",
    reponse:
      "Oui, du CI à la Terminale. À l'élémentaire, les notes sont sur 10 et organisées en compétences et ressources ; " +
      "au collège et au lycée, sur 20, avec coefficients, moyennes et classements. Les filières du lycée sont prises en " +
      "charge, et la décision de passage en classe supérieure est calculée à partir de la moyenne annuelle.",
  },
  {
    question: "Les bulletins de notes sont-ils générés automatiquement ?",
    reponse:
      "Oui. Moyennes et rangs sont calculés à partir des notes saisies, et chaque bulletin s'exporte en PDF prêt à imprimer. " +
      "Une fois publiés, les bulletins sont consultables par l'élève depuis son espace personnel.",
  },
  {
    question: "Comment sont gérés les paiements de scolarité ?",
    reponse:
      "Chaque encaissement est enregistré — espèces, Wave ou Orange Money — avec le suivi des mois payés et des impayés " +
      "pour chaque élève. Les familles voient ce qui reste à payer depuis l'espace élève et peuvent régler plusieurs mois d'avance.",
  },
  {
    question: "Les élèves et les parents ont-ils accès à leurs informations ?",
    reponse:
      "Oui. Chaque élève dispose d'un espace personnel, sur téléphone ou ordinateur : notes, emploi du temps, présences " +
      "et paiements. Plusieurs comptes peuvent être ouverts sur le même téléphone, ce qui est pratique pour les parents " +
      "de plusieurs enfants.",
  },
  {
    question: "Faut-il installer un logiciel ?",
    reponse:
      "Non. SenClass s'utilise depuis un navigateur, sur téléphone comme sur ordinateur. Elle peut aussi s'installer " +
      "sur l'écran d'accueil comme une application, et s'ouvre même sans connexion internet.",
  },
  {
    question: "Peut-on essayer SenClass avant de s'abonner ?",
    reponse:
      "Oui. En créant votre école en ligne, vous bénéficiez d'une période d'essai gratuite et sans engagement. " +
      "Vous pouvez aussi nous écrire sur WhatsApp : nous nous déplaçons pour vous présenter le logiciel.",
  },
];

/** Données structurées FAQPage, tirées des mêmes questions que la page. */
export const donneesStructureesFAQ = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QUESTIONS.map((q) => ({
    "@type": "Question",
    name: q.question,
    acceptedAnswer: { "@type": "Answer", text: q.reponse },
  })),
});
