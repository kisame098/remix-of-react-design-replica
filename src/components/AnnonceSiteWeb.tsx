import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Globe, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { accesSiteWeb } from '@/lib/modeGestion';

/**
 * Annonce de lancement du Site web, en haut du tableau de bord du directeur,
 * pendant 24 h. La croix la masque pour la page en cours : elle revient quand
 * on actualise, jusqu'à la fin de l'annonce.
 */
export const FIN_ANNONCE_SITE_WEB = Date.parse('2026-10-18T16:00:00Z');

export const annonceSiteWebVisible = (
  school: object | null | undefined, accountRole: string | null | undefined, chemin: string, maintenant = Date.now(),
): boolean => maintenant < FIN_ANNONCE_SITE_WEB && accesSiteWeb(school, accountRole) && !chemin.startsWith('/site-web');

export const AnnonceSiteWeb = () => {
  const { school, accountRole } = useAuth();
  const { pathname } = useLocation();
  const [ferme, setFerme] = useState(false);

  if (ferme || !annonceSiteWebVisible(school, accountRole, pathname)) return null;

  return (
    <div className="px-4 pt-4 md:px-6 print:hidden">
      <div role="status" className="relative overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-4 py-3.5 text-sm">
        <div className="flex flex-wrap items-center gap-3 pr-7">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-sky-600 text-white flex items-center justify-center"><Globe className="h-5 w-5" /></span>
          <p className="flex-1 min-w-[16rem] text-slate-700">
            <span className="mr-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Nouveau</span>
            <span className="font-semibold text-slate-900">Créez le site internet de votre école, gratuitement.</span>{' '}
            Choisissez un modèle, vos informations sont déjà remplies : publiez-le en quelques minutes sur votre adresse <span className="font-medium">votre-ecole.senclass.com</span>, visible par les parents et sur Google.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/site-web">Créer mon site<ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <button type="button" onClick={() => setFerme(true)} aria-label="Fermer l'annonce"
          className="absolute right-2 top-2 rounded-md p-1 text-slate-500 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
