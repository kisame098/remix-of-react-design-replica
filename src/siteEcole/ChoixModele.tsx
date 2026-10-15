import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FournisseurEdition } from './edition';
import Habillage from './Habillage';
import { ecrire } from './chemin';
import { MODELES_SITE, type Contenu, type ModeleSite } from './contenu';
import { cleOrdre, sectionsDuModele } from './sections';

/** Largeur d'écran simulée pour l'aperçu (un ordinateur portable). */
const LARGEUR = 1280;
const HAUTEUR = 800;

/** Le contenu de l'école, présenté avec un autre modèle (et ses couleurs, si demandé). */
export function avecModele(contenu: Contenu, modele: ModeleSite, couleurs: boolean): Contenu {
  let c = ecrire(contenu, 'identite.modele', modele);
  if (couleurs) {
    c = ecrire(c, 'identite.couleur1', MODELES_SITE[modele].couleurs[0]);
    c = ecrire(c, 'identite.couleur2', MODELES_SITE[modele].couleurs[1]);
  }
  return c;
}

/**
 * Aperçu RÉEL d'un modèle : son en-tête et la première section de son accueil,
 * rendus avec le contenu de l'école, puis réduits à la taille de la carte.
 */
export function ApercuModele({ contenu, modele, couleurs }: { contenu: Contenu; modele: ModeleSite; couleurs: boolean }) {
  const boite = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(0.25);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setEchelle(e.contentRect.width / LARGEUR));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const c = useMemo(() => avecModele(contenu, modele, couleurs), [contenu, modele, couleurs]);
  const premiere = (c[cleOrdre(modele)].accueil ?? [])[0] ?? 'diaporama';
  const Section = (sectionsDuModele(modele)[premiere] ?? sectionsDuModele(modele).diaporama).Composant;

  return (
    <div ref={boite} className="relative w-full overflow-hidden bg-white" style={{ aspectRatio: `${LARGEUR} / ${HAUTEUR}` }} aria-hidden="true">
      {/* La transformation fait aussi de cette boîte le repère des en-têtes « fixes » des modèles. */}
      <div className="absolute left-0 top-0 pointer-events-none select-none" style={{ width: LARGEUR, height: HAUTEUR, transform: `scale(${echelle})`, transformOrigin: 'top left', overflow: 'hidden' }}>
        <FournisseurEdition key={modele + String(couleurs)} initial={c} modifiable={false}>
          <Habillage page=""><Section /></Habillage>
        </FournisseurEdition>
      </div>
    </div>
  );
}

/** La galerie des modèles : un aperçu réel par modèle, et le bouton pour le choisir. */
export function GalerieModeles({ contenu, actuel, onChoisir, choixCouleurs = true }: {
  contenu: Contenu;
  actuel?: ModeleSite;
  onChoisir: (modele: ModeleSite, couleurs: boolean) => void;
  /** Faux à la première ouverture : le modèle arrive toujours avec ses couleurs. */
  choixCouleurs?: boolean;
}) {
  const [couleurs, setCouleurs] = useState(true);
  return (
    <div className="font-sans">
      {choixCouleurs && <label className="flex items-center gap-2.5 text-sm mb-5 cursor-pointer w-fit">
        <Checkbox checked={couleurs} onCheckedChange={v => setCouleurs(v === true)} />
        Prendre aussi les couleurs conseillées du modèle <span className="text-muted-foreground">(vous pourrez les changer ensuite)</span>
      </label>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {(Object.entries(MODELES_SITE) as [ModeleSite, (typeof MODELES_SITE)[ModeleSite]][]).map(([cle, m]) => {
          const choisi = cle === actuel;
          return (
            <button key={cle} type="button" onClick={() => onChoisir(cle, couleurs)}
              className={`group text-left rounded-2xl border-2 overflow-hidden bg-card transition-all hover:-translate-y-1 hover:shadow-xl ${choisi ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/60'}`}>
              <div className="relative border-b">
                <ApercuModele contenu={contenu} modele={cle} couleurs={couleurs} />
                {choisi && <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs font-semibold shadow"><Check className="h-3.5 w-3.5" />Modèle actuel</span>}
              </div>
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base flex items-center gap-2">
                    {m.nom}
                    <span className="flex">{m.couleurs.map(x => <span key={x} className="h-3.5 w-3.5 rounded-full border-2 border-background -ml-1 first:ml-0" style={{ background: x }} />)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                </div>
                <span className={`mt-0.5 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${choisi ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground group-hover:brightness-110'}`}>
                  {choisi ? 'Choisi' : 'Choisir'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** La galerie dans une fenêtre, ouverte depuis la barre de modification (bouton « Modèle »). */
export function FenetreModeles({ ouvert, onFermer, contenu, onChoisir }: {
  ouvert: boolean; onFermer: () => void; contenu: Contenu; onChoisir: (modele: ModeleSite, couleurs: boolean) => void;
}) {
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5" />Choisir le modèle du site</DialogTitle>
          <DialogDescription>Les aperçus montrent VOTRE site. Changer de modèle garde tous vos textes, photos et actualités.</DialogDescription>
        </DialogHeader>
        {ouvert && <GalerieModeles contenu={contenu} actuel={contenu.identite.modele} onChoisir={(m, c) => { onChoisir(m, c); onFermer(); }} />}
        <div className="flex justify-end"><Button variant="outline" onClick={onFermer}>Fermer</Button></div>
      </DialogContent>
    </Dialog>
  );
}
