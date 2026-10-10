// Le choix « 2 par feuille », retenu sur CET ordinateur, par sorte de document.
// Module à part, sans dépendance : la fenêtre des reçus (caisse) l'importe
// sans charger tout le moteur des modèles de documents.

/** Un choix par sorte de document : « documents » (rubrique Documents), « recu »… */
const cle = (sorte: string) => `senclass:${sorte}:deux-par-feuille`;

export const lireDeuxParFeuille = (sorte = 'documents'): boolean => {
  try { return localStorage.getItem(cle(sorte)) === '1'; } catch { return false; }
};

export const retenirDeuxParFeuille = (actif: boolean, sorte = 'documents'): void => {
  try { localStorage.setItem(cle(sorte), actif ? '1' : '0'); } catch { /* stockage indisponible : choix non retenu */ }
};
