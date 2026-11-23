import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Compass, Lightbulb, MapPin, Minus, PartyPopper, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { avanceSeule, placerBulle, type Boite, type Chapitre, type Etape, type EtatEtape, type Importance } from '@/lib/guide';

const LIBELLE_IMPORTANCE: Record<Importance, string> = {
  obligatoire: 'Obligatoire', conseille: 'Conseillé', facultatif: 'Facultatif',
};
const COULEUR_IMPORTANCE: Record<Importance, string> = {
  obligatoire: 'bg-red-100 text-red-700', conseille: 'bg-sky-100 text-sky-700', facultatif: 'bg-muted text-muted-foreground',
};

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
      {voile && <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.38)" mask="url(#voile-guide)" />}
      {trous.map(({ cle, ...r }) => <rect key={cle} {...r} fill="none" strokeWidth={3} className="stroke-primary" />)}
    </svg>
  );
};

interface Props {
  chapitre: Chapitre;
  etape: Etape;
  numero: number;
  etat: EtatEtape | null;
  boite: Boite | null;
  introuvable: boolean;
  cachee: boolean;
  bravo: boolean;
  reduit: boolean;
  peutRejoindre: boolean;
  onContinuer: () => void;
  onPasser: () => void;
  onPrecedent: (() => void) | null;
  onRejoindre: () => void;
  onReduire: () => void;
  onArreter: () => void;
}

export const BulleGuide = (p: Props) => {
  const { chapitre, etape, etat, boite, introuvable, reduit, bravo } = p;
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
  }, [boite, reduit, bravo, etape, etat, introuvable]);

  const attend = avanceSeule(etape) && !etat?.satisfaite;
  const horsPage = etat?.horsPage ?? false;
  const total = chapitre.etapes.length;
  const versUnePage = etape.condition.type === 'page';
  const aide = p.peutRejoindre && (horsPage || (versUnePage && attend && !introuvable));
  // Aller sur une page ne se « passe » pas (la suite s'y déroule), sauf s'il n'y a rien à ouvrir.
  const passer = !horsPage && !etat?.satisfaite && (!versUnePage || introuvable);

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
            <div className="flex items-center gap-3 px-4 py-6" aria-live="polite">
              <PartyPopper className="h-7 w-7 text-green-600" />
              <p className="font-semibold text-green-700">Bravo, c'est enregistré !</p>
            </div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-2 space-y-2 max-h-[46vh] overflow-y-auto" aria-live="polite">
                <div className="flex items-start gap-2">
                  <h2 className="flex-1 font-semibold leading-snug">{etape.titre}</h2>
                  {etape.importance && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0', COULEUR_IMPORTANCE[etape.importance])}>
                      {LIBELLE_IMPORTANCE[etape.importance]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{etape.texte}</p>
                {etape.astuce && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><Lightbulb className="h-4 w-4 flex-shrink-0" />{etape.astuce}</p>
                )}
                {!horsPage && !introuvable && etat && etat.champs.length > 0 && (
                  <ul className="space-y-1">
                    {etat.champs.map(c => (
                      <li key={c.libelle} className={cn('flex items-center gap-2 text-sm', c.rempli ? 'text-green-700' : 'text-foreground')}>
                        {c.rempli ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}{c.libelle}
                      </li>
                    ))}
                  </ul>
                )}
                {horsPage && (
                  <p className="rounded-lg bg-muted p-2 text-xs">Cette étape se passe sur une autre page.</p>
                )}
                {p.cachee && !horsPage && (
                  <p className="rounded-lg bg-muted p-2 text-xs">Fermez d'abord la fenêtre ouverte.</p>
                )}
                {introuvable && (
                  <p className="rounded-lg bg-muted p-2 text-xs">{etape.absence ?? 'Cet élément n\'est pas affiché pour le moment.'}</p>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                {p.onPrecedent && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={p.onPrecedent} title="Étape précédente" aria-label="Étape précédente">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex-1" />
                {aide && (
                  <Button type="button" variant={horsPage ? 'default' : 'ghost'} size="sm" className="gap-1.5" onClick={p.onRejoindre}>
                    <MapPin className="h-3.5 w-3.5" />{horsPage ? 'Y retourner' : 'Je ne trouve pas'}
                  </Button>
                )}
                {passer && <Button type="button" variant="ghost" size="sm" onClick={p.onPasser}>Passer</Button>}
                {!horsPage && !attend && (
                  <Button type="button" size="sm" className="gap-1.5" onClick={p.onContinuer} disabled={etat !== null && !etat.satisfaite}>
                    {p.numero === total ? <><Check className="h-4 w-4" />Terminer</> : <>Continuer<ArrowRight className="h-4 w-4" /></>}
                  </Button>
                )}
              </div>
              {attend && !horsPage && !introuvable && (
                <p className="flex items-center gap-2 border-t bg-primary/5 px-4 py-2 text-xs font-medium text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />À vous de jouer : le guide avance dès que c'est fait.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
