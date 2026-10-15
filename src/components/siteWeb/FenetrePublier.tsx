import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { adresseSiteEcole, suggestionAdresse } from '@/lib/hoteEcole';
import { publierSite } from '@/lib/siteWeb';
import { ChampAdresse } from './ChampAdresse';

/**
 * Mettre le site en ligne : le directeur confirme (ou choisit) l'adresse
 * <adresse>.senclass.com, puis la version en cours de travail devient publique.
 * Partagée par la page « Site web » (bouton d'activation) et par l'éditeur.
 */
export function FenetrePublier({ ouvert, onFermer, enLigne, slug, nomEcole, avantPublication, onPublie }: {
  ouvert: boolean;
  onFermer: () => void;
  /** Le site est déjà en ligne : on met à jour la version publique. */
  enLigne: boolean;
  slug: string | null;
  nomEcole: string;
  /** Par exemple : enregistrer la dernière modification de l'éditeur. */
  avantPublication?: () => Promise<unknown>;
  onPublie: (slug: string) => void;
}) {
  const [adresse, setAdresse] = useState('');
  const [valable, setValable] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const publier = async () => {
    setEnvoi(true);
    try {
      await avantPublication?.();
      const s = await publierSite(adresse);
      onPublie(s);
      toast({ title: enLigne ? 'Site mis à jour' : 'Site en ligne', description: adresseSiteEcole(s, location.hostname, location.origin) });
      onFermer();
    } catch (e) {
      toast({ title: 'Publication impossible', description: (e as { message?: string })?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <AlertDialog open={ouvert} onOpenChange={o => !envoi && !o && onFermer()}>
      <AlertDialogContent className="font-sans max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{enLigne ? 'Mettre à jour le site en ligne ?' : 'Mettre votre site en ligne'}</AlertDialogTitle>
          <AlertDialogDescription>
            {enLigne
              ? 'Les visiteurs verront la dernière version de votre travail.'
              : 'Vérifiez l\'adresse de votre site : c\'est elle que vous partagerez (WhatsApp, Facebook, affiches…).'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {ouvert && (
          <ChampAdresse
            actuelle={slug}
            suggestion={slug ?? suggestionAdresse(nomEcole)}
            onChange={(a, ok) => { setAdresse(a); setValable(ok); }}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={envoi}>Annuler</AlertDialogCancel>
          <AlertDialogAction disabled={envoi || !valable} onClick={e => { e.preventDefault(); void publier(); }}>
            {envoi && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{enLigne ? 'Mettre à jour' : 'Mettre en ligne'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
