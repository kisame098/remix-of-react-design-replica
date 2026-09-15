import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionGate } from '@/lib/subscription';
import { AlertTriangle } from 'lucide-react';

/**
 * Bandeau affiché à l'élève quand son école n'a pas réglé son abonnement.
 *
 * Décision produit : l'élève garde TOUT son portail — notes, bulletins, emploi
 * du temps, paiements, présences. Il n'est pour rien dans l'impayé de son
 * établissement, et le priver de ses données serait le punir à la place de
 * l'école. On l'informe, sans rien lui retirer.
 *
 * Le ton compte : le message s'adresse souvent à un enfant ou à sa famille. Il
 * dit ce qui se passe et rassure sur l'accès aux données — il n'accuse
 * personne et ne demande rien à l'élève, qui ne peut de toute façon rien y
 * faire.
 *
 * Enveloppe TOUT le portail (pages avec layout ET pages autonomes) : placé
 * ainsi dans App.tsx, il couvre aussi les écrans qu'on ajoutera demain.
 */
export default function PortalSchoolNotice() {
  const { school, accountRole } = useAuth();

  // Le professeur ne voit jamais ce bandeau : quand l'école est bloquée, il est
  // renvoyé vers l'écran d'abonnement (voir routeAccess.ts).
  const aAfficher = accountRole === 'student'
    && !!school
    && getSubscriptionGate(school.subscription_status, school.subscription_expires_at) !== 'ok';

  return (
    <div className="flex flex-col min-h-screen">
      {aAfficher && (
        <div
          role="status"
          className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200"
        >
          <div className="max-w-lg mx-auto flex items-start gap-2.5 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] leading-snug text-amber-900">
              <span className="font-semibold">Ton école n'a pas encore réglé son abonnement.</span>{' '}
              Tes notes, ton emploi du temps et tes paiements restent accessibles normalement.
            </p>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
