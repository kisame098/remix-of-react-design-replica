import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnLigne } from '@/hooks/useEnLigne';
import { enregistrer, lire } from '@/lib/cacheHorsLigne';

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT D'UN ÉCRAN, AVEC OU SANS RÉSEAU
//
//   • en ligne      : on interroge Supabase, puis on enregistre le résultat ;
//   • hors ligne    : on affiche ce qui avait été enregistré, daté ;
//   • réseau revenu : on recharge tout seul.
//
// Les données sont rangées par compte (src/lib/cacheHorsLigne.ts) : sur un
// téléphone partagé, personne ne voit celles d'un autre.
// ═══════════════════════════════════════════════════════════════════════════

export interface DonneesHorsLigne<T> {
  donnees: T | null;
  chargement: boolean;
  /** Date ISO du dernier chargement réussi, ou `null`. */
  enregistreLe: string | null;
  /** `true` quand ce qui est affiché vient de l'appareil, pas du réseau. */
  depuisLeCache: boolean;
  recharger: () => void;
}

export function useDonneesHorsLigne<T>(
  nom: string,
  chargeur: () => Promise<T>,
  dependances: unknown[] = [],
  actif = true,
): DonneesHorsLigne<T> {
  const { user } = useAuth();
  const enLigne = useEnLigne();
  const utilisateurId = user?.id ?? null;

  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistreLe, setEnregistreLe] = useState<string | null>(null);
  const [depuisLeCache, setDepuisLeCache] = useState(false);

  // Le chargeur est recréé à chaque rendu par les écrans : on le garde dans
  // une référence pour ne pas relancer une requête à chaque frappe clavier.
  const chargeurRef = useRef(chargeur);
  chargeurRef.current = chargeur;

  const charger = useCallback(async () => {
    if (!actif) { setChargement(false); return; }

    const cache = lire<T>(utilisateurId, nom);
    if (cache) {
      // On montre immédiatement ce qu'on a, même en ligne : l'écran n'est
      // jamais vide pendant que la requête part.
      setDonnees(cache.donnees);
      setEnregistreLe(cache.enregistreLe);
      setDepuisLeCache(true);
    }

    if (!enLigne) { setChargement(false); return; }

    setChargement(!cache);
    try {
      const fraiches = await chargeurRef.current();
      enregistrer(utilisateurId, nom, fraiches);
      setDonnees(fraiches);
      setEnregistreLe(new Date().toISOString());
      setDepuisLeCache(false);
    } catch {
      // Réseau annoncé disponible mais requête échouée : on garde l'affichage
      // enregistré plutôt que de vider l'écran.
    } finally {
      setChargement(false);
    }
  }, [actif, enLigne, nom, utilisateurId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void charger(); }, [charger, ...dependances]);

  return { donnees, chargement, enregistreLe, depuisLeCache, recharger: charger };
}
