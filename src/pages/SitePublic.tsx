import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SiteEcole from '@/siteEcole/SiteEcole';
import type { Contenu } from '@/siteEcole/contenu';
import { sitePublic } from '@/lib/siteWeb';

/** Le site publié d'une école, ouvert à tous, sans aucun outil de modification. */
export default function SitePublic({ cle: cleImposee }: { cle?: string }) {
  // Sur un sous-domaine d'école (hors du routeur), le slug est passé directement.
  const params = useParams<{ cle: string }>();
  const cle = cleImposee ?? params.cle;
  const [contenu, setContenu] = useState<Contenu | null | undefined>(undefined);

  useEffect(() => {
    if (!cle) return;
    let annule = false;
    sitePublic(cle).then(c => { if (!annule) setContenu(c); }).catch(() => { if (!annule) setContenu(null); });
    return () => { annule = true; };
  }, [cle]);

  if (contenu === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (contenu === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-2xl font-semibold">Site introuvable</p>
          <p className="text-muted-foreground mt-2">Ce site n'existe pas ou n'est pas encore publié.</p>
        </div>
      </div>
    );
  }
  // Sur le sous-domaine, les pages sont à la racine (/admissions) ; sinon sous /site/<adresse>/.
  return <SiteEcole initial={contenu} modifiable={false} base={cleImposee ? '' : `/site/${cle}`} />;
}
