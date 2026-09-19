import { Bell, BellOff, Loader2, Share } from 'lucide-react';
import { useNotificationsPush } from '@/hooks/useNotificationsPush';
import { TEXTES_NOTIFICATIONS } from '@/lib/notificationsPush';

/**
 * Activation des notifications, pour le compte connecté sur cet appareil.
 * Le bouton est un vrai geste de l'utilisateur : c'est la seule façon
 * d'obtenir que le navigateur affiche sa demande d'autorisation.
 */
export default function CarteNotifications() {
  const { etat, occupe, erreur, activer, desactiver } = useNotificationsPush();
  const cle = etat ?? 'inconnu';
  const actives = etat === 'actives';
  const peutBasculer = etat === 'actives' || etat === 'inactives';

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Notifications</h3>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="flex items-start gap-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${actives ? 'bg-emerald-50' : 'bg-gray-50'}`}>
            {etat === 'a-installer-ios'
              ? <Share className="w-[18px] h-[18px] text-gray-400" />
              : actives
                ? <Bell className="w-[18px] h-[18px] text-emerald-500" />
                : <BellOff className="w-[18px] h-[18px] text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">
              {actives ? 'Notifications activées' : 'Notifications'}
            </p>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{TEXTES_NOTIFICATIONS[cle]}</p>
            {etat === 'actives' && (
              <p className="text-xs text-gray-400 mt-2">
                Cet appareil, pour ce compte uniquement : chaque compte lié active les siennes.
              </p>
            )}
            {erreur && <p role="alert" className="text-sm text-red-600 mt-2">{erreur}</p>}
          </div>
        </div>

        {peutBasculer && (
          <button
            type="button"
            onClick={actives ? desactiver : activer}
            disabled={occupe}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                        transition-colors disabled:opacity-50 ${actives
                          ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          : 'bg-[#4361ee] text-white hover:bg-[#3651d4]'}`}
          >
            {occupe && <Loader2 className="h-4 w-4 animate-spin" />}
            {actives ? 'Désactiver' : 'Activer les notifications'}
          </button>
        )}
      </div>
    </div>
  );
}
