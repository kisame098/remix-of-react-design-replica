import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SiteEcole from '@/siteEcole/SiteEcole';
import type { Contenu } from '@/siteEcole/contenu';
import { sitePublic } from '@/lib/siteWeb';

/** Le site publié d'une école, ouvert à tous, sans aucun outil de modification. */
export default function SitePublic() {
  const { cle } = useParams<{ cle: string }>();
  const [contenu, setContenu] = useState<Contenu | null | undefined>(undefined);

  useEffect(() => {
    if (!cle) return;
    let annule = false;
    sitePublic(cle).then(c => { if (!annule) setContenu(c); }).catch(() => { if (!annule) setContenu(null); });
    return () => { annule = true; };
  }, [cle]);

  useEffect(() => {
    if (contenu) document.title = contenu.identite.nom;
  }, [contenu]);

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
  return <SiteEcole initial={contenu} modifiable={false} />;
}
