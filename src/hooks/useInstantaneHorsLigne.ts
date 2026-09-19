import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnLigne } from '@/hooks/useEnLigne';
import { enregistrer, lire } from '@/lib/cacheHorsLigne';

// ═══════════════════════════════════════════════════════════════════════════
// INSTANTANÉ D'UN CONTEXTE DU TABLEAU DE BORD
//
// Les écrans de l'école ne parlent pas à Supabase : ils lisent les contextes
// (élèves, paiements, présences, emploi du temps, salaires). Plutôt que de
// convertir chaque écran, on garde un instantané des tranches de chaque
// contexte, et on le réinstalle quand l'application s'ouvre sans réseau.
//
// Deux règles de prudence :
//   • on ne réinstalle QUE hors connexion — en ligne, rien ne change, un
//     directeur ne doit jamais voir réapparaître un élève supprimé ;
//   • on n'enregistre QUE lorsque le chargement est terminé (`pret`), sinon
//     l'état vide du démarrage écraserait un bon instantané.
//
// L'instantané est rangé par compte et effacé à la déconnexion, comme le
// reste (src/lib/cacheHorsLigne.ts).
// ═══════════════════════════════════════════════════════════════════════════

export function useInstantaneHorsLigne<T extends object>(
  nom: string,
  tranches: T,
  appliquer: (tranches: T) => void,
  pret: boolean,
): string | null {
  const { user } = useAuth();
  const enLigne = useEnLigne();
  const utilisateurId = user?.id ?? null;

  const [instantaneLe, setInstantaneLe] = useState<string | null>(null);

  // Gardés dans des références : ces valeurs changent à chaque rendu, elles ne
  // doivent pas relancer la réinstallation.
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;

  const dejaReinstalle = useRef<string | null>(null);
  const dernierEnregistrement = useRef<string | null>(null);

  // ── Réinstallation, une seule fois par compte ────────────────────────────
  useEffect(() => {
    if (!utilisateurId || enLigne || dejaReinstalle.current === utilisateurId) return;
    dejaReinstalle.current = utilisateurId;

    const cache = lire<T>(utilisateurId, nom);
    if (!cache) return;
    appliquerRef.current(cache.donnees);
    setInstantaneLe(cache.enregistreLe);
  }, [utilisateurId, enLigne, nom]);

  // ── Enregistrement après chaque chargement réussi ────────────────────────
  useEffect(() => {
    if (!utilisateurId || !enLigne || !pret) return;

    // `tranches` est mémorisé par le contexte appelant : cet effet ne se
    // rejoue qu'au changement réel d'une tranche, pas à chaque rendu — sur une
    // école de mille élèves, sérialiser à chaque frappe coûterait cher.
    const serialise = JSON.stringify(tranches);
    if (serialise === dernierEnregistrement.current) return;   // rien de neuf

    if (enregistrer(utilisateurId, nom, tranches)) {
      dernierEnregistrement.current = serialise;
      setInstantaneLe(new Date().toISOString());
    }
  }, [utilisateurId, enLigne, pret, nom, tranches]);

  return instantaneLe;
}
