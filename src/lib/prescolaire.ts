// ─── Préscolaire (maternelle) — Petite, Moyenne et Grande Section ──────────
// Des classes comme les autres pour tout ce qui n'est pas pédagogique :
// élèves, inscriptions, paiements, emploi du temps, présences, documents.
// Mais NI matières, NI notes, NI bulletins, NI décision de passage : à la
// maternelle, il n'y a pas d'évaluation chiffrée.
//
// Une classe de maternelle n'entre donc jamais dans une période de notes
// (grade_period_classes) : aucune matière ne peut y être créée, ni par le
// directeur ni par les synchronisations automatiques.

export const NIVEAUX_PRESCOLAIRE = ['PS', 'MS', 'GS'] as const;
export type NiveauPrescolaire = typeof NIVEAUX_PRESCOLAIRE[number];

/** Nom complet affiché par défaut (l'école peut le renommer dans Cursus). */
export const LIBELLES_PRESCOLAIRE: Record<NiveauPrescolaire, string> = {
  PS: 'Petite Section',
  MS: 'Moyenne Section',
  GS: 'Grande Section',
};

export const estPrescolaire = (niveau: string | null | undefined): boolean =>
  !!niveau && (NIVEAUX_PRESCOLAIRE as readonly string[]).includes(niveau);

/** « Petite Section » pour PS ; tout autre niveau est rendu tel quel. */
export const libelleParDefautNiveau = (niveau: string): string =>
  estPrescolaire(niveau) ? LIBELLES_PRESCOLAIRE[niveau as NiveauPrescolaire] : niveau;

/** Classes qui ont des notes : tout sauf la maternelle. */
export const classesAvecNotes = <T extends { niveau?: string | null }>(classes: T[]): T[] =>
  classes.filter(c => !estPrescolaire(c.niveau));
