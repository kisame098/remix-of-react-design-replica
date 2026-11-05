// Contrôle du formulaire « Modifier l'élève » (Gestion élèves).
//
// Beaucoup de fiches (souvent importées d'un ancien logiciel) n'ont pas de
// date ou de lieu de naissance, de résidence, de sexe ou de tuteur. Exiger
// ces champs à la MODIFICATION bloquait tout enregistrement : impossible même
// de corriger un simple numéro de téléphone.
//
// Règle : le nom et le prénom sont toujours exigés. Pour les autres champs
// obligatoires, on refuse seulement d'EFFACER une valeur qui existait ; un
// champ déjà vide peut rester vide. (L'inscription d'un nouvel élève garde
// ses propres exigences, ailleurs.)

export type ChampsControles = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: string;
  residence: string;
  tutor1: { phone: string; status: string };
};

const vide = (v: string | null | undefined) => !(v ?? '').trim();

/** Message d'erreur à afficher, ou null si l'enregistrement peut se faire. */
export function erreurModificationEleve(avant: ChampsControles, apres: ChampsControles): string | null {
  if (vide(apres.firstName) || vide(apres.lastName)) return 'Le nom et le prénom sont obligatoires';

  const efface = (a: string | null | undefined, b: string | null | undefined) => !vide(a) && vide(b);
  const effaces: string[] = [];
  if (efface(avant.dateOfBirth, apres.dateOfBirth)) effaces.push('la date de naissance');
  if (efface(avant.placeOfBirth, apres.placeOfBirth)) effaces.push('le lieu de naissance');
  if (efface(avant.sex, apres.sex)) effaces.push('le sexe');
  if (efface(avant.residence, apres.residence)) effaces.push('le lieu de résidence');
  if (efface(avant.tutor1.phone, apres.tutor1.phone)) effaces.push('le téléphone du tuteur 1');
  if (efface(avant.tutor1.status, apres.tutor1.status)) effaces.push('le statut du tuteur 1');
  if (effaces.length === 0) return null;
  return `Impossible d'effacer ${effaces.join(', ')} : ce champ est obligatoire.`;
}
