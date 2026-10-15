import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, Globe, LayoutTemplate, Loader2, Pencil, Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { adresseSiteEcole } from '@/lib/hoteEcole';
import { FenetrePublier } from '@/components/siteWeb/FenetrePublier';
import { ApercuModele } from '@/siteEcole/ChoixModele';
import { contenuDepuis } from '@/siteEcole/edition';
import { MODELES_SITE } from '@/siteEcole/contenu';
import {
  accesSiteWeb, depublierSite, etatDuSite, modificationsNonPubliees, slugDeLEcole, type EtatSite,
} from '@/lib/siteWeb';

const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Page « Site web » du tableau de bord : l'état du site (en ligne ou non),
 * l'interrupteur pour le mettre en ligne ou le retirer, son adresse, et le
 * bouton qui ouvre l'éditeur (/site-web/editeur, plein écran).
 */
export default function SiteWebAccueil() {
  const { school, accountRole } = useAuth();
  const autorise = accesSiteWeb(school, accountRole);
  const [site, setSite] = useState<EtatSite | null | undefined>(undefined);
  const [slug, setSlug] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Fenêtre ouverte : mise en ligne (ou mise à jour), ou retrait. */
  const [fenetre, setFenetre] = useState<'publier' | 'retirer' | null>(null);
  const [retrait, setRetrait] = useState(false);

  const charger = useCallback(async () => {
    if (!school) return;
    try {
      const [etat, s] = await Promise.all([etatDuSite(school.id), slugDeLEcole(school.id)]);
      setSite(etat);
      setSlug(s);
    } catch (e) {
      setErreur((e as { message?: string })?.message ?? 'Erreur inconnue');
    }
  }, [school]);

  useEffect(() => { if (autorise) void charger(); }, [autorise, charger]);

  const contenu = useMemo(() => (site ? contenuDepuis(site.brouillon) : null), [site]);
  const enLigne = !!site?.publie;
  const adresse = slug ? adresseSiteEcole(slug, location.hostname, location.origin) : null;

  const retirer = async () => {
    setRetrait(true);
    try {
      await depublierSite();
      toast({ title: 'Site hors ligne', description: 'Votre travail est conservé : vous pouvez le remettre en ligne à tout moment.' });
      setFenetre(null);
      await charger();
    } catch (e) {
      toast({ title: 'Impossible de retirer le site', description: (e as { message?: string })?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setRetrait(false);
    }
  };

  const copier = async () => {
    if (!adresse) return;
    try {
      await navigator.clipboard.writeText(adresse);
      toast({ title: 'Adresse copiée', description: adresse });
    } catch {
      toast({ title: 'Copie impossible', description: adresse, variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Site web
            <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-[11px] font-semibold">Bêta</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Le site internet de votre école, sur sa propre adresse</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        {!autorise ? (
          <Vide titre="Bientôt disponible" texte="Cette nouveauté est en test auprès de quelques écoles. Elle sera bientôt ouverte à toutes." />
        ) : erreur ? (
          <p className="text-destructive">Chargement impossible : {erreur}</p>
        ) : site === undefined ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>
        ) : site === null || !contenu ? (
          <Vide
            titre="Votre école n'a pas encore de site"
            texte="Choisissez un modèle : il arrive déjà rempli avec le nom, le logo et les coordonnées de votre école. Vous modifiez ensuite tout directement sur la page, puis vous le mettez en ligne quand il vous plaît."
            action={<Button asChild size="lg" className="gap-2"><Link to="/site-web/editeur"><Sparkles className="h-4 w-4" />Créer mon site</Link></Button>}
          />
        ) : (
          <Card className="max-w-5xl overflow-hidden">
            <CardContent className="p-0 grid md:grid-cols-[1.15fr_1fr]">
              {/* Aperçu réel : un clic ouvre l'éditeur. */}
              <Link to="/site-web/editeur" className="group relative block border-b md:border-b-0 md:border-r bg-muted/30 p-4 md:p-5">
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <ApercuModele contenu={contenu} modele={contenu.identite.modele} couleurs={false} />
                </div>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-lg">
                    <Pencil className="h-4 w-4" />Ouvrir l'éditeur
                  </span>
                </span>
                <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                  <LayoutTemplate className="h-3.5 w-3.5" />Modèle {MODELES_SITE[contenu.identite.modele]?.nom ?? ''}
                </p>
              </Link>

              <div className="p-5 md:p-6 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-lg">Site en ligne</p>
                    <p className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${enLigne ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {enLigne
                        ? `Visible par tous${site.publie_le ? ` depuis le ${dateLongue(site.publie_le)}` : ''}.`
                        : 'Hors ligne : les visiteurs voient « Site introuvable ». Votre travail est conservé.'}
                    </p>
                  </div>
                  <Switch
                    checked={enLigne}
                    onCheckedChange={v => setFenetre(v ? 'publier' : 'retirer')}
                    aria-label={enLigne ? 'Mettre le site hors ligne' : 'Mettre le site en ligne'}
                    className="mt-1 scale-125"
                  />
                </div>

                {adresse && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Adresse du site</p>
                    <div className="flex items-center gap-1 mt-1">
                      <p className={`flex-1 min-w-0 truncate font-medium ${enLigne ? '' : 'text-muted-foreground'}`}>{adresse.replace(/^https?:\/\//, '')}</p>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copier l'adresse" aria-label="Copier l'adresse" onClick={copier}><Copy className="h-4 w-4" /></Button>
                      {enLigne && (
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Voir le site" aria-label="Voir le site">
                          <a href={adresse} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {enLigne && modificationsNonPubliees(site) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>Vous avez fait des modifications qui ne sont pas encore visibles en ligne.</p>
                    <Button size="sm" variant="outline" className="mt-2 gap-1.5 bg-white" onClick={() => setFenetre('publier')}>
                      <Rocket className="h-3.5 w-3.5" />Mettre à jour le site
                    </Button>
                  </div>
                )}

                <Button asChild size="lg" className="mt-auto gap-2">
                  <Link to="/site-web/editeur"><Pencil className="h-4 w-4" />Ouvrir l'éditeur</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {school && site && (
        <FenetrePublier
          ouvert={fenetre === 'publier'}
          onFermer={() => setFenetre(null)}
          enLigne={enLigne}
          slug={slug}
          nomEcole={school.name}
          onPublie={() => void charger()}
        />
      )}

      <AlertDialog open={fenetre === 'retirer'} onOpenChange={o => !retrait && !o && setFenetre(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mettre le site hors ligne ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les visiteurs ne pourront plus le voir : ils trouveront « Site introuvable ». Rien n'est effacé ; vous pourrez le remettre en ligne à tout moment, avec la même adresse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={retrait}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={retrait} onClick={e => { e.preventDefault(); void retirer(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {retrait && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Mettre hors ligne
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Vide({ titre, texte, action }: { titre: string; texte: string; action?: React.ReactNode }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center"><Globe className="h-7 w-7 text-primary" /></div>
        <h2 className="text-xl font-semibold">{titre}</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">{texte}</p>
        {action}
      </CardContent>
    </Card>
  );
}
