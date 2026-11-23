import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CheckCircle2, ChevronsUpDown, Circle, Compass, Keyboard, Lightbulb, MapPin, Minus,
  MousePointerClick, PartyPopper, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HAUTEUR_ETIQUETTE, etiquetteDessus, placerBulle, type Boite, type Chapitre, type Etape, type EtatEtape, type Geste, type Importance } from '@/lib/guide';

const LIBELLE_IMPORTANCE: Record<Importance, string> = {
  obligatoire: 'Obligatoire', conseille: 'Conseillé', facultatif: 'Facultatif',
};
const COULEUR_IMPORTANCE: Record<Importance, string> = {
  obligatoire: 'bg-red-100 text-red-700', conseille: 'bg-sky-100 text-sky-700', facultatif: 'bg-muted text-muted-foreground',
};

const ICONE_GESTE: Record<Geste['type'], typeof Compass> = { cliquer: MousePointerClick, ecrire: Keyboard, choisir: ChevronsUpDown };

const DEBORD = 6;

/**
 * Voile percé d'une fenêtre par élément désigné (deux champs éloignés ont
 * chacun la leur). Ne reçoit jamais les clics : la personne agit sur le vrai écran.
 */
export const Projecteur = ({ boites, voile }: { boites: Boite[]; voile: boolean }) => {
  const trous = boites.map((b, i) => (
    { cle: i, x: b.left - DEBORD, y: b.top - DEBORD, width: b.width + DEBORD * 2, height: b.height + DEBORD * 2, rx: 12 }
  ));
  return (
    <svg aria-hidden data-guide-ui className="fixed inset-0 z-[60] h-full w-full pointer-events-none print:hidden">
      <mask id="voile-guide">
        <rect width="100%" height="100%" fill="white" />
        {trous.map(({ cle, ...r }) => <rect key={cle} {...r} fill="black" />)}
      </mask>
      {voile && <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.5)" mask="url(#voile-guide)" />}
      {trous.map(({ cle, ...r }) => <rect key={cle} {...r} fill="none" strokeWidth={3} className="stroke-primary" />)}
    </svg>
  );
};

/**
 * « Cliquez ici », posé SUR l'écran, contre l'élément : l'ordre est là où la
 * personne regarde, pas dans un texte à lire ailleurs.
 */
export const EtiquetteGeste = ({ geste, boite, insiste }: { geste: Pick<Geste, 'type' | 'etiquette'>; boite: Boite; insiste: boolean }) => {
  const Icone = ICONE_GESTE[geste.type];
  const dessus = etiquetteDessus(boite);
  const centre = boite.left + Math.min(boite.width / 2, 150);
  const largeur = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return (
    <>
      <div
        aria-hidden data-guide-ui
        className="guide-halo fixed z-[61] pointer-events-none rounded-xl print:hidden"
        style={{ left: boite.left - DEBORD, top: boite.top - DEBORD, width: boite.width + DEBORD * 2, height: boite.height + DEBORD * 2 }}
      />
      <div
        aria-hidden data-guide-ui
        className="fixed z-[65] pointer-events-none print:hidden"
        style={{ left: Math.max(90, Math.min(centre, largeur - 90)), top: dessus ? boite.top - DEBORD - HAUTEUR_ETIQUETTE : boite.top + boite.height + DEBORD + 4 }}
      >
        <div className={cn('guide-rebond flex -translate-x-1/2 items-center', dessus ? 'flex-col' : 'flex-col-reverse')}>
          <span className={cn('flex items-center gap-2 whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-[15px] font-bold text-white shadow-xl ring-2 ring-white', insiste && 'guide-secousse')}>
            <Icone className="h-5 w-5" strokeWidth={2.5} />{geste.etiquette}
          </span>
          <span className={cn('h-0 w-0 border-x-8 border-x-transparent', dessus ? 'border-t-8 border-t-blue-600' : 'border-b-8 border-b-blue-600')} />
        </div>
      </div>
    </>
  );
};

interface Props {
  chapitre: Chapitre;
  etape: Etape;
  numero: number;
  etat: Omit<EtatEtape, 'elements' | 'geste'> | null;
  geste: Pick<Geste, 'type' | 'etiquette' | 'libelle'> | null;
  boite: Boite | null;
  introuvable: boolean;
  cachee: boolean;
  bravo: boolean;
  /** La personne hésite (elle attend, ou clique ailleurs) : on insiste. */
  insiste: boolean;
  reduit: boolean;
  peutRejoindre: boolean;
  onContinuer: () => void;
  onPasser: () => void;
  onPrecedent: (() => void) | null;
  onRejoindre: () => void;
  ailleurs: 'haut' | 'bas' | null;
  onMontrer: () => void;
  onReduire: () => void;
  onArreter: () => void;
}

const VERBES: Record<Geste['type'], string> = { cliquer: 'Cliquez', ecrire: 'Écrivez', choisir: 'Choisissez' };

export const BulleGuide = (p: Props) => {
  const { chapitre, etape, etat, geste, boite, introuvable, reduit, bravo } = p;
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Les fenêtres et les listes de l'application se referment dès qu'on touche
  // « dehors » — et la bulle est dehors. On garde donc ces signaux pour nous :
  // lire le guide ne doit jamais fermer la fenêtre qu'il explique.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const retenir = (e: Event) => e.stopPropagation();
    const sansPrendreLeFocus = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', retenir);
    el.addEventListener('focusin', retenir);
    el.addEventListener('mousedown', sansPrendreLeFocus);
    return () => {
      el.removeEventListener('pointerdown', retenir);
      el.removeEventListener('focusin', retenir);
      el.removeEventListener('mousedown', sansPrendreLeFocus);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const n = placerBulle(reduit || bravo ? null : boite, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    setPlace(avant => (avant && avant.left === n.left && avant.top === n.top ? avant : n));
  }, [boite, reduit, bravo, etape, etat, geste, introuvable, p.ailleurs]);

  const horsPage = etat?.horsPage ?? false;
  const satisfaite = etat?.satisfaite ?? false;
  const total = chapitre.etapes.length;
  const versUnePage = etape.condition.type === 'page';
  const aLire = etape.condition.type === 'lire';
  const aRemplir = etape.condition.type === 'rempli';
  const aFaire = !aLire && !horsPage && !satisfaite;
  const Icone = ICONE_GESTE[geste?.type ?? 'cliquer'];

  const aide = p.peutRejoindre && versUnePage && aFaire && !introuvable;
  // Aller sur une page ne se « passe » pas (la suite s'y déroule), sauf s'il n'y a rien à ouvrir.
  const passer = aFaire && (!versUnePage || introuvable);

  const importance = etape.importance && (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0', COULEUR_IMPORTANCE[etape.importance])}>
      {LIBELLE_IMPORTANCE[etape.importance]}
    </span>
  );

  return (
    <div
      ref={ref} data-guide-ui role="region" aria-label="Guide SenClass"
      className="fixed z-[70] pointer-events-auto max-w-[calc(100vw-2rem)] print:hidden transition-[left,top] duration-200 motion-reduce:transition-none"
      style={{ left: place?.left ?? 16, top: place?.top ?? 16, visibility: place ? 'visible' : 'hidden' }}
    >
      {reduit ? (
        <button type="button" onClick={p.onReduire}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xl">
          <Compass className="h-4 w-4" />Guide · {p.numero}/{total}
        </button>
      ) : (
        <div className="w-[360px] max-w-full rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <Compass className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="flex-1 min-w-0 truncate text-xs font-medium text-muted-foreground">{chapitre.titre} · étape {p.numero} sur {total}</p>
            <button type="button" onClick={p.onReduire} title="Réduire" aria-label="Réduire le guide" className="rounded p-1 text-muted-foreground hover:bg-muted"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={p.onArreter} title="Mettre le guide en pause" aria-label="Mettre le guide en pause" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round((p.numero / total) * 100)}%` }} /></div>

          {bravo ? (
            <div className="flex items-center gap-3 bg-green-600 px-4 py-6 text-white" aria-live="polite">
              <PartyPopper className="h-8 w-8" />
              <p className="text-lg font-bold">Bravo, c'est enregistré !</p>
            </div>
          ) : (
            <>
              <div className="max-h-[46vh] overflow-y-auto" aria-live="polite">
                {/* À FAIRE : un bloc bleu, l'ordre et rien d'autre. À LIRE : un titre calme. */}
                {aFaire ? (
                  <div className={cn('flex items-center gap-3 bg-blue-600 px-4 py-3 text-white', p.insiste && 'guide-secousse')}>
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-blue-600">
                      <Icone className="guide-rebond h-6 w-6" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">À vous de le faire</p>
                      <h2 className="text-base font-bold leading-snug">
                        {aRemplir ? (geste ? `${VERBES[geste.type]} : ${geste.libelle}` : etape.titre) : etape.titre}
                      </h2>
                    </div>
                  </div>
                ) : aRemplir && satisfaite && !horsPage ? (
                  <div className="flex items-center gap-3 bg-green-600 px-4 py-3 text-white">
                    <CheckCircle2 className="h-7 w-7 flex-shrink-0" />
                    <h2 className="text-base font-bold leading-snug">C'est rempli. Vérifiez, puis continuez.</h2>
                  </div>
                ) : null}

                <div className="space-y-2 px-4 pt-3 pb-2">
                  <div className="flex items-start gap-2">
                    {!aFaire && aLire && <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />}
                    {!aFaire || aRemplir ? <p className="flex-1 font-semibold leading-snug">{etape.titre}</p> : <span className="flex-1" />}
                    {importance}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{etape.texte}</p>
                  {etape.astuce && (
                    <p className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><Lightbulb className="h-4 w-4 flex-shrink-0" />{etape.astuce}</p>
                  )}
                  {!horsPage && !introuvable && etat && etat.champs.length > 1 && (
                    <ul className="space-y-1">
                      {etat.champs.map(c => (
                        <li key={c.libelle} className={cn('flex items-center gap-2 text-sm', c.rempli ? 'text-green-700' : 'font-medium text-foreground')}>
                          {c.rempli ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-blue-600" />}{c.libelle}
                        </li>
                      ))}
                    </ul>
                  )}
                  {horsPage && <p className="rounded-lg bg-amber-100 p-2 text-sm font-medium text-amber-900">Vous avez changé de page : cette étape se passe ailleurs.</p>}
                  {p.cachee && !horsPage && <p className="rounded-lg bg-amber-100 p-2 text-sm font-medium text-amber-900">Fermez d'abord la fenêtre ouverte.</p>}
                  {introuvable && <p className="rounded-lg bg-amber-100 p-2 text-sm font-medium text-amber-900">{etape.absence ?? 'Cet élément n\'est pas affiché pour le moment.'}</p>}
                </div>
              </div>

              <div className="space-y-1 px-4 pb-3 pt-1">
                {horsPage && p.peutRejoindre && (
                  <Button type="button" className="h-11 w-full gap-2 text-base font-semibold" onClick={p.onRejoindre}><MapPin className="h-4 w-4" />Y retourner</Button>
                )}
                {p.ailleurs && !horsPage && (
                  <Button type="button" onClick={p.onMontrer} className="h-11 w-full gap-2 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700">
                    {p.ailleurs === 'bas' ? <ArrowDown className="guide-rebond h-5 w-5" /> : <ArrowUp className="guide-rebond h-5 w-5" />}
                    C'est plus {p.ailleurs} : me montrer l'endroit
                  </Button>
                )}
                {!horsPage && !aFaire && (
                  <Button type="button" onClick={p.onContinuer}
                    className={cn('h-11 w-full gap-2 text-base font-semibold', !aLire && 'bg-green-600 text-white hover:bg-green-700')}>
                    {p.numero === total ? <><Check className="h-5 w-5" />Terminer</> : <>{!aLire ? 'Continuer' : etape.importance ? 'C\'est bon, suivant' : 'J\'ai compris'}<ArrowRight className="h-5 w-5" /></>}
                  </Button>
                )}
                {(p.onPrecedent || aide || passer) && (
                  <div className="flex items-center">
                    {p.onPrecedent && (
                      <Button type="button" variant="ghost" size="sm" className="gap-1 px-2 text-xs text-muted-foreground" onClick={p.onPrecedent}>
                        <ArrowLeft className="h-3.5 w-3.5" />Étape précédente
                      </Button>
                    )}
                    <span className="flex-1" />
                    {aide && <Button type="button" variant="ghost" size="sm" className="px-2 text-xs text-muted-foreground" onClick={p.onRejoindre}>Je ne trouve pas</Button>}
                    {passer && <Button type="button" variant="ghost" size="sm" className="px-2 text-xs text-muted-foreground" onClick={p.onPasser}>Passer</Button>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
