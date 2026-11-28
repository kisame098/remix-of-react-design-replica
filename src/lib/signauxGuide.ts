// ═══════════════════════════════════════════════════════════════════════════
// SIGNAUX DU MODE GUIDÉ
//
// Un écran annonce « c'est fait » APRÈS un enregistrement réussi ; le guide
// (src/guide) avance alors tout seul. Il n'avance donc jamais sur un simple
// clic : un enregistrement refusé laisse la personne sur la même étape.
//
// Sans guide ouvert, un signal ne fait strictement rien.
// ═══════════════════════════════════════════════════════════════════════════

export const SIGNAUX_GUIDE = [
  'ecole-enregistree', 'compte-enregistre', 'annee-enregistree', 'echeance-enregistree',
  'horaires-enregistres', 'scolarite-enregistree',
  'classe-creee', 'formation-creee', 'niveau-cree', 'matiere-ajoutee', 'promotion-creee',
  'eleve-inscrit', 'eleve-modifie', 'prof-inscrit',
  'periode-creee', 'note-enregistree', 'cours-cree', 'presences-completes',
  'tarif-enregistre', 'paiement-enregistre',
  'periode-fp-creee', 'note-fp-enregistree', 'examen-cree', 'stage-cree', 'organisme-cree',
] as const;

export type SignalGuide = typeof SIGNAUX_GUIDE[number];

export const EVENEMENT_SIGNAL = 'senclass:guide-signal';
export const EVENEMENT_OUVRIR = 'senclass:guide-ouvrir';

export const signalerGuide = (nom: SignalGuide): void => {
  window.dispatchEvent(new CustomEvent(EVENEMENT_SIGNAL, { detail: nom }));
};

/** Ouvre la liste des chapitres (menu du compte → « Apprendre SenClass »). */
export const ouvrirGuide = (): void => {
  window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR));
};
