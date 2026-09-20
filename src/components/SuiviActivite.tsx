import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { doitPinger } from '@/lib/activiteEcole';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Signale à la plateforme qu'un utilisateur d'une école se sert de l'appli
 * (une ligne par personne et par jour, aucune donnée saisie). Nourrit la
 * fiche « activité » du chef du système. Silencieux : un échec ne se voit
 * jamais et ne bloque jamais rien.
 */
export const SuiviActivite = () => {
  const { user, isPlatformAdmin } = useAuth();
  const { pathname } = useLocation();
  const dernier = useRef<number | null>(null);
  const uid = user?.id ?? null;

  useEffect(() => {
    dernier.current = null;   // nouvel utilisateur : on repart de zéro
  }, [uid]);

  useEffect(() => {
    if (!uid || isPlatformAdmin) return;

    const pinger = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const maintenant = Date.now();
      if (!doitPinger(dernier.current, maintenant)) return;
      dernier.current = maintenant;
      void Promise.resolve(sb.rpc('record_activity')).catch(() => { dernier.current = null; });
    };

    pinger();
    document.addEventListener('visibilitychange', pinger);
    return () => document.removeEventListener('visibilitychange', pinger);
  }, [uid, isPlatformAdmin, pathname]);

  return null;
};
