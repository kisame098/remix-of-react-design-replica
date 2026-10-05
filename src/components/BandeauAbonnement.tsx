import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { dateLongueDakar } from '@/lib/documentsEcole';
import { alerteAbonnement, dureeEnLettres, peutMasquer, type AlerteAbonnement } from '@/lib/alerteAbonnement';

/**
 * En haut du tableau de bord : « Votre période d'essai se termine le 12 octobre
 * 2026 à 14:30 — dans 2 jours et 3 h ». Règles dans src/lib/alerteAbonnement.ts.
 *
 * Le directeur a un bouton pour payer ; le personnel est invité à prévenir la
 * direction (il ne peut pas payer lui-même). Masquable pour la session tant
 * qu'il reste plus de 24 h ; ensuite il reste affiché.
 */
const cleMasque = (expireLe: string) => `senclass:bandeau-abonnement:${expireLe}`;

const lireMasque = (expireLe: string): boolean => {
  try { return sessionStorage.getItem(cleMasque(expireLe)) === '1'; } catch { return false; }
};

const message = (a: AlerteAbonnement): string => {
  const quand = dateLongueDakar(a.expireLe);
  if (a.niveau === 'expire') return `L'abonnement de votre établissement a expiré le ${quand}.`;
  return a.essai
    ? `Votre période d'essai se termine le ${quand} — dans ${dureeEnLettres(a.restantMs)}.`
    : `Votre abonnement se termine le ${quand} — dans ${dureeEnLettres(a.restantMs)}.`;
};

export const BandeauAbonnement = () => {
  const { school, accountRole } = useAuth();
  // Le compte à rebours avance : on recalcule toutes les 30 secondes.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const alerte = alerteAbonnement(school?.subscription_status, school?.subscription_expires_at, maintenant);
  const [masque, setMasque] = useState(false);
  useEffect(() => { setMasque(alerte ? lireMasque(alerte.expireLe) : false); }, [alerte?.expireLe]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alerte || (masque && peutMasquer(alerte))) return null;

  const estDirecteur = accountRole === 'admin';
  const fort = alerte.niveau !== 'info';
  const masquer = () => {
    try { sessionStorage.setItem(cleMasque(alerte.expireLe), '1'); } catch { /* indisponible : masqué pour cet écran seulement */ }
    setMasque(true);
  };

  return (
    <div className="px-4 pt-4 md:px-6 print:hidden">
      <div
        role={fort ? 'alert' : 'status'}
        className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          fort ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
      >
        <AlarmClock className="h-5 w-5 shrink-0" />
        <p className="flex-1 min-w-[16rem]">
          <span className="font-semibold">{message(alerte)}</span>{' '}
          {estDirecteur
            ? (alerte.essai ? 'Choisissez un abonnement pour continuer sans interruption.' : 'Renouvelez-le pour éviter toute interruption.')
            : 'Prévenez la direction de l\'établissement.'}
        </p>
        {estDirecteur && (
          <Button asChild size="sm" variant={fort ? 'destructive' : 'default'}>
            <Link to="/abonnement">{alerte.essai ? 'Choisir un abonnement' : 'Renouveler'}</Link>
          </Button>
        )}
        {peutMasquer(alerte) && (
          <button type="button" onClick={masquer} aria-label="Masquer jusqu'à la prochaine connexion"
            className="rounded-md p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
