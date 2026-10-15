import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CloudOff, ExternalLink, Globe, Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import SiteEcole from '@/siteEcole/SiteEcole';
import { contenuDepuis } from '@/siteEcole/edition';
import type { Contenu } from '@/siteEcole/contenu';
import {
  accesSiteWeb, chargerSite, enregistrerBrouillon, publierSite, siteDeDepart, slugDeLEcole, televerserPhoto,
} from '@/lib/siteWeb';

type Etat = 'enregistre' | 'en_cours' | 'erreur';

/**
 * L'éditeur du site web de l'école (bêta). Plein écran : le site s'affiche tel
 * que les visiteurs le verront, et le directeur le modifie directement dessus.
 */
export default function SiteWeb() {
  const { school, accountRole } = useAuth();
  const [initial, setInitial] = useState<Contenu | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>('enregistre');
  const [publieLe, setPublieLe] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [publication, setPublication] = useState(false);
  const existe = useRef(false);
  const minuteur = useRef<ReturnType<typeof setTimeout>>();
  const aEnregistrer = useRef<Contenu | null>(null);

  const autorise = accesSiteWeb(school, accountRole);

  useEffect(() => {
    if (!school || !autorise) return;
    let annule = false;
    (async () => {
      try {
        const [site, s] = await Promise.all([chargerSite(school.id), slugDeLEcole(school.id)]);
        if (annule) return;
        existe.current = !!site;
        setPublieLe(site?.publie_le ?? null);
        setSlug(s);
        setInitial(site ? contenuDepuis(site.brouillon) : siteDeDepart(school));
      } catch (e) {
        if (!annule) setErreurChargement((e as { message?: string })?.message ?? 'Erreur inconnue');
      }
    })();
    return () => { annule = true; };
  }, [school, autorise]);

  // Enregistrement automatique, un instant après la dernière modification.
  // Les enregistrements passent l'un après l'autre : le tout premier crée la
  // ligne, et un second lancé pendant ce temps ne doit pas la créer une deuxième fois.
  const file = useRef<Promise<void>>(Promise.resolve());
  const enregistrer = useCallback(() => {
    file.current = file.current.then(async () => {
      const c = aEnregistrer.current;
      if (!c || !school) return;
      try {
        await enregistrerBrouillon(school.id, c, existe.current);
        existe.current = true;
        if (aEnregistrer.current === c) { aEnregistrer.current = null; setEtat('enregistre'); }
      } catch {
        setEtat('erreur');
      }
    });
    return file.current;
  }, [school]);

  const surChangement = useCallback((c: Contenu) => {
    aEnregistrer.current = c;
    setEtat('en_cours');
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void enregistrer(), 1200);
  }, [enregistrer]);

  // Ne pas perdre la dernière frappe en quittant la page.
  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => { if (aEnregistrer.current) { e.preventDefault(); } };
    window.addEventListener('beforeunload', avant);
    return () => { window.removeEventListener('beforeunload', avant); clearTimeout(minuteur.current); void enregistrer(); };
  }, [enregistrer]);

  const televerser = useCallback((f: File) => televerserPhoto(school!.id, f), [school]);

  const publier = async () => {
    setPublication(true);
    try {
      clearTimeout(minuteur.current);
      await enregistrer();
      const s = await publierSite();
      setSlug(s);
      setPublieLe(new Date().toISOString());
      toast({ title: 'Site publié', description: `Votre site est en ligne : ${location.origin}/site/${s}` });
    } catch (e) {
      toast({ title: 'Publication impossible', description: (e as { message?: string })?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setPublication(false);
      setConfirmer(false);
    }
  };

  if (!autorise) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Site web de l'école</h1>
          <p className="text-muted-foreground">Cette nouveauté est en test auprès de quelques écoles. Elle sera bientôt ouverte à toutes.</p>
          <Button asChild variant="outline"><Link to="/dashboard">Retour au tableau de bord</Link></Button>
        </div>
      </div>
    );
  }
  if (erreurChargement) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-destructive">Chargement du site impossible : {erreurChargement}</div>;
  }
  if (!initial) {
    return <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement de votre site…</div>;
  }

  const adresse = slug ? `${location.origin}/site/${slug}` : null;
  const actions = (
    <>
      <span className="hidden sm:flex items-center gap-1.5 px-2 text-xs text-muted-foreground whitespace-nowrap" aria-live="polite">
        {etat === 'en_cours' && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enregistrement…</>}
        {etat === 'enregistre' && <><Check className="h-3.5 w-3.5 text-green-600" />Enregistré</>}
        {etat === 'erreur' && <><CloudOff className="h-3.5 w-3.5 text-destructive" />Non enregistré</>}
      </span>
      {publieLe && adresse && (
        <Button asChild variant="ghost" size="icon" className="rounded-xl" title="Voir le site en ligne">
          <a href={adresse} target="_blank" rel="noreferrer" aria-label="Voir le site en ligne"><ExternalLink className="h-4 w-4" /></a>
        </Button>
      )}
      <Button className="gap-1.5 rounded-xl" onClick={() => setConfirmer(true)} disabled={publication}>
        {publication ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{publieLe ? 'Mettre à jour' : 'Publier'}
      </Button>
      <Button asChild variant="ghost" size="icon" className="rounded-xl" title="Retour au tableau de bord">
        <Link to="/dashboard" aria-label="Retour au tableau de bord"><ArrowLeft className="h-4 w-4" /></Link>
      </Button>
    </>
  );

  return (
    <>
      <SiteEcole
        initial={initial}
        onChange={surChangement}
        televerser={televerser}
        editionInitiale
        alerte={etat === 'erreur' ? 'Le dernier changement n\'a pas pu être enregistré. Vérifiez la connexion internet.' : null}
        actions={actions}
      />
      <AlertDialog open={confirmer} onOpenChange={o => !publication && setConfirmer(o)}>
        <AlertDialogContent className="font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>{publieLe ? 'Mettre à jour le site en ligne ?' : 'Publier votre site ?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {publieLe
                ? 'Les visiteurs verront la version que vous avez sous les yeux.'
                : 'Votre site deviendra visible par tous, à une adresse que vous pourrez partager (WhatsApp, Facebook…).'}
              {adresse && <span className="block mt-2 font-medium text-foreground break-all">{adresse}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publication}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={publication} onClick={e => { e.preventDefault(); void publier(); }}>
              {publication && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{publieLe ? 'Mettre à jour' : 'Publier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
