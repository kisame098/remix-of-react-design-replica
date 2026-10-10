import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Circle, Eye, Image as ImageIcon, Loader2, Minus, Plus, Redo2, School, Square, TriangleAlert, Type, Undo2, CheckCircle2, PenLine,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ApercuHtml } from '@/components/documents/ApercuHtml';
import { PanneauProprietes } from '@/components/documents/PanneauProprietes';
import {
  cssContenu, cssPosition, dimensionsPage, nouvelElement, versStyleReact, visuelVersHtml,
  type DocumentVisuel, type ElementBloc, type ElementTexte, type ElementVisuel, type TypeElement,
} from '@/lib/documentVisuel';
import {
  PX_PAR_MM, POIGNEES, changerPlan, deplacer, dupliquerElement, historiqueInitial, redimensionner,
  reduireHistorique, remplacerElement, supprimerElement, type Guides, type Plan, type Poignee,
} from '@/lib/editeurVisuel';
import { nettoyerFragment, produireDocuments, type ContexteDocument } from '@/lib/modelesDocuments';
import { verifierSource } from '@/lib/modeleDocument';
import { compressImage } from '@/lib/imageCompress';

interface EditeurVisuelProps {
  ouvert: boolean;
  onFermer: () => void;
  initial: { nom: string; contenu: DocumentVisuel };
  /** Logo de l'école, pour le montrer pendant l'édition. */
  logo?: string | null;
  /** Élève d'EXEMPLE pour l'aperçu (jamais un vrai élève). */
  exemple: ContexteDocument;
  onEnregistrer: (nom: string, contenu: DocumentVisuel) => Promise<void>;
}

/** Lecture d'une image choisie sur l'ordinateur, réduite pour ne pas alourdir le modèle. */
const lireImage = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => compressImage(String(r.result), 1000, 'png').then(resolve, reject);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(f);
});

type Geste =
  | { type: 'deplacer'; id: string; x0: number; y0: number; depart: ElementVisuel; avant: DocumentVisuel }
  | { type: 'redimensionner'; id: string; x0: number; y0: number; depart: ElementVisuel; avant: DocumentVisuel; poignee: Poignee };

const CURSEURS: Record<Poignee, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

const POSITION_POIGNEE: Record<Poignee, React.CSSProperties> = {
  nw: { left: 0, top: 0 }, n: { left: '50%', top: 0 }, ne: { left: '100%', top: 0 }, e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' }, s: { left: '50%', top: '100%' }, sw: { left: 0, top: '100%' }, w: { left: 0, top: '50%' },
};

/**
 * L'éditeur de document « page libre » : une feuille A4 où l'on pose du
 * texte, le logo, des images, des formes et des traits, à la souris.
 * Les champs de l'élève s'insèrent depuis le panneau de droite.
 */
export const EditeurVisuel = ({ ouvert, onFermer, initial, logo, exemple, onEnregistrer }: EditeurVisuelProps) => {
  const [nom, setNom] = useState(initial.nom);
  const [h, dispatch] = useReducer(reduireHistorique, initial.contenu, historiqueInitial);
  const doc = h.present;
  const [selection, setSelection] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ vertical: false, horizontal: false });
  const [zoom, setZoom] = useState(1);
  const [apercu, setApercu] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [confirmerFermeture, setConfirmerFermeture] = useState(false);
  const geste = useRef<Geste | null>(null);
  const zoneTravail = useRef<HTMLDivElement>(null);
  const fichierImage = useRef<HTMLInputElement>(null);
  /** Remplacer l'image de cet élément (sinon : ajouter une nouvelle image). */
  const imageARemplacer = useRef<string | null>(null);
  const zoneTexte = useRef<HTMLDivElement | null>(null);
  const avantEdition = useRef<DocumentVisuel | null>(null);

  const { largeur, hauteur } = dimensionsPage(doc.orientation);
  const element = doc.elements.find(e => e.id === selection) ?? null;
  const modifie = doc !== initial.contenu || nom !== initial.nom;

  // Zoom initial : la feuille entière dans la largeur disponible.
  const ajusterZoom = useCallback(() => {
    const el = zoneTravail.current;
    if (!el) return;
    // Toute la feuille visible, comme dans Canva : la largeur ET la hauteur.
    const zoomLargeur = (el.clientWidth - 48) / (largeur * PX_PAR_MM);
    const zoomHauteur = (el.clientHeight - 48) / (hauteur * PX_PAR_MM);
    const z = el.clientHeight > 200 ? Math.min(zoomLargeur, zoomHauteur) : zoomLargeur;
    setZoom(Math.max(0.3, Math.min(1.5, Math.round(z * 100) / 100)));
  }, [largeur, hauteur]);
  // La zone n'existe qu'une fois la fenêtre affichée : on ajuste dès qu'elle a une taille.
  const zoomAjuste = useRef(false);
  useEffect(() => {
    if (!ouvert) { zoomAjuste.current = false; return; }
    let observateur: ResizeObserver | null = null;
    const essai = window.setInterval(() => {
      const el = zoneTravail.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      window.clearInterval(essai);
      observateur = new ResizeObserver(() => {
        if (!zoomAjuste.current && el.clientWidth > 0 && el.clientHeight > 200) { zoomAjuste.current = true; ajusterZoom(); }
      });
      observateur.observe(el);
    }, 50);
    return () => { window.clearInterval(essai); observateur?.disconnect(); };
  }, [ouvert, ajusterZoom]);

  const valider = useCallback((nouveau: DocumentVisuel, avant?: DocumentVisuel) => dispatch({ type: 'valider', doc: nouveau, avant }), []);
  const majElement = useCallback((el: ElementVisuel) => valider(remplacerElement(doc, el)), [doc, valider]);

  // ── Texte en cours d'écriture ──
  const terminerEdition = useCallback(() => {
    if (!edition) return;
    const el = doc.elements.find(e => e.id === edition);
    const html = zoneTexte.current?.innerHTML;
    if (el && (el.type === 'texte' || el.type === 'bloc') && html !== undefined) {
      const final = remplacerElement(doc, { ...el, html });
      dispatch({ type: 'valider', doc: final, avant: avantEdition.current ?? undefined });
    }
    avantEdition.current = null;
    setEdition(null);
  }, [edition, doc]);

  const commencerEdition = (id: string) => {
    avantEdition.current = docRef.current;
    setSelection(id);
    setEdition(id);
  };

  // ── Gestes à la souris ──
  // Les écouteurs sont posés au début du geste et retirés à la fin ; ils lisent
  // le zoom et la feuille par des références, jamais une version périmée.
  const docRef = useRef(doc);
  docRef.current = doc;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const arreterGeste = useRef<(() => void) | null>(null);

  const debutGeste = (e: React.PointerEvent, el: ElementVisuel, poignee?: Poignee) => {
    if (e.button !== 0 || edition === el.id) return;
    e.stopPropagation();
    e.preventDefault();
    if (edition) terminerEdition();
    setSelection(el.id);
    const g: Geste = poignee
      ? { type: 'redimensionner', id: el.id, x0: e.clientX, y0: e.clientY, depart: el, avant: docRef.current, poignee }
      : { type: 'deplacer', id: el.id, x0: e.clientX, y0: e.clientY, depart: el, avant: docRef.current };
    geste.current = g;
    let bouge = false;
    /** La feuille telle que ce geste l'a laissée : c'est elle qui devient l'étape. */
    let dernier = g.avant;

    const surMouvement = (ev: PointerEvent) => {
      const dx = (ev.clientX - g.x0) / (PX_PAR_MM * zoomRef.current);
      const dy = (ev.clientY - g.y0) / (PX_PAR_MM * zoomRef.current);
      if (!bouge && Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return;
      bouge = true;
      if (g.type === 'deplacer') {
        const r = deplacer(g.depart, dx, dy, g.avant);
        setGuides(r.guides);
        dernier = remplacerElement(g.avant, r.element);
      } else {
        const proportions = ev.shiftKey || (g.depart.type === 'image' && g.poignee.length === 2);
        dernier = remplacerElement(g.avant, redimensionner(g.depart, g.poignee, dx, dy, proportions));
      }
      dispatch({ type: 'direct', doc: dernier });
    };
    const fin = () => {
      window.removeEventListener('pointermove', surMouvement);
      window.removeEventListener('pointerup', fin);
      arreterGeste.current = null;
      geste.current = null;
      setGuides({ vertical: false, horizontal: false });
      if (bouge) { dispatch({ type: 'valider', doc: dernier, avant: g.avant }); return; }
      // Un simple clic (sans glisser) sur un texte : on écrit tout de suite,
      // le curseur à l'endroit cliqué. Glisser, lui, déplace le texte.
      if (g.type === 'deplacer' && (el.type === 'texte' || el.type === 'bloc')) {
        pointDeClic = { x: g.x0, y: g.y0 };
        commencerEdition(el.id);
      }
    };
    window.addEventListener('pointermove', surMouvement);
    window.addEventListener('pointerup', fin);
    arreterGeste.current = fin;
  };

  useEffect(() => () => arreterGeste.current?.(), []);

  // ── Ajouter des éléments ──
  const ajouter = (type: TypeElement, extra: Parameters<typeof nouvelElement>[2] = {}) => {
    if (edition) terminerEdition();
    const el = nouvelElement(type, doc.orientation, extra);
    valider({ ...docRef.current, elements: [...docRef.current.elements, el] });
    setSelection(el.id);
    if (type === 'texte') window.setTimeout(() => commencerEditionApresAjout(el.id), 0);
  };
  const commencerEditionApresAjout = (id: string) => {
    avantEdition.current = docRef.current;
    setSelection(id);
    setEdition(id);
  };

  const choisirImage = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast({ title: 'Ce fichier n\'est pas une image', variant: 'destructive' }); return; }
    try {
      const src = await lireImage(f);
      const id = imageARemplacer.current;
      imageARemplacer.current = null;
      const el = id ? docRef.current.elements.find(e => e.id === id) : null;
      if (el && el.type === 'image') majElement({ ...el, source: src });
      else ajouter('image', { source: src });
    } catch {
      toast({ title: "L'image n'a pas pu être lue", variant: 'destructive' });
    }
  };

  // ── Actions sur la sélection ──
  const supprimer = () => { if (!selection) return; valider(supprimerElement(doc, selection)); setSelection(null); setEdition(null); };
  const dupliquer = () => {
    if (!selection) return;
    const r = dupliquerElement(doc, selection);
    if (r.copie) { valider(r.doc); setSelection(r.copie.id); }
  };
  const plan = (p: Plan) => { if (selection) valider(changerPlan(doc, selection, p)); };

  /** Insère {CHAMP} à l'endroit du curseur dans le texte en cours, sinon à la fin du texte choisi. */
  const insererChamp = (champ: string) => {
    const morceau = `{${champ}}`;
    if (edition && zoneTexte.current) {
      zoneTexte.current.focus();
      document.execCommand('insertText', false, morceau);
      return;
    }
    if (element?.type === 'texte' || element?.type === 'bloc') majElement({ ...element, html: `${element.html}${element.html ? ' ' : ''}${morceau}` });
  };

  /** Gras / italique / souligné : sur la partie sélectionnée en écrivant, sinon sur toute la zone. */
  const formatTexte = (commande: 'bold' | 'italic' | 'underline', cle: 'gras' | 'italique' | 'souligne') => {
    const sel = window.getSelection();
    if (edition && zoneTexte.current && sel && !sel.isCollapsed && zoneTexte.current.contains(sel.anchorNode)) {
      document.execCommand(commande);
      return;
    }
    if (element?.type === 'texte') majElement({ ...element, style: { ...element.style, [cle]: !element.style[cle] } });
  };

  // ── Clavier ──
  useEffect(() => {
    if (!ouvert || apercu) return;
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      const dansChamp = cible && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName));
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === 'z' && !dansChamp) { e.preventDefault(); dispatch({ type: e.shiftKey ? 'retablir' : 'annuler' }); return; }
      if (cmd && e.key.toLowerCase() === 'y' && !dansChamp) { e.preventDefault(); dispatch({ type: 'retablir' }); return; }
      if (e.key === 'Escape') {
        if (edition) { e.preventDefault(); terminerEdition(); } else if (selection) { e.preventDefault(); setSelection(null); }
        return;
      }
      if (dansChamp || !element) return;
      if (cmd && e.key.toLowerCase() === 'd') { e.preventDefault(); dupliquer(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); supprimer(); return; }
      const pas = e.shiftKey ? 5 : 1;
      const deltas: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
      const d = deltas[e.key];
      if (d) { e.preventDefault(); majElement({ ...element, x: element.x + d[0], y: element.y + d[1] }); }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  // ── Vérification et enregistrement ──
  const verification = useMemo(() => verifierSource({ genre: 'visuel', contenu: doc }), [doc]);
  const htmlApercu = useMemo(
    () => (apercu && verification.ok ? produireDocuments(visuelVersHtml(doc, nom), [exemple]).html : ''),
    [apercu, verification.ok, doc, nom, exemple],
  );

  const enregistrer = async () => {
    if (edition) terminerEdition();
    setEnCours(true);
    try {
      await onEnregistrer(nom, docRef.current);
      onFermer();
    } catch (e) {
      toast({ title: "Le document n'est pas enregistré", description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  const demanderFermeture = () => { if (modifie) setConfirmerFermeture(true); else onFermer(); };

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o) demanderFermeture(); }}>
      <DialogContent
        className="max-w-none w-screen h-[100dvh] p-0 gap-0 flex flex-col rounded-none sm:rounded-none translate-x-[-50%] translate-y-[-50%]"
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Éditeur de document</DialogTitle>
        <DialogDescription className="sr-only">Créez votre document sur la feuille : texte, logo, images, formes et traits.</DialogDescription>

        {/* Barre du haut */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 pr-12">
          <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du document" maxLength={120} className="w-56 h-9" aria-label="Nom du document" />
          <div className="h-6 w-px bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={() => ajouter('texte')} disabled={apercu}><Type className="h-4 w-4 mr-1.5" />Texte</Button>
          <Button size="sm" variant="ghost" onClick={() => ajouter('image', { source: 'logo' })} disabled={apercu}><School className="h-4 w-4 mr-1.5" />Logo</Button>
          <Button size="sm" variant="ghost" onClick={() => { imageARemplacer.current = null; fichierImage.current?.click(); }} disabled={apercu}><ImageIcon className="h-4 w-4 mr-1.5" />Image</Button>
          <Button size="sm" variant="ghost" onClick={() => ajouter('forme', { forme: 'rectangle' })} disabled={apercu}><Square className="h-4 w-4 mr-1.5" />Rectangle</Button>
          <Button size="sm" variant="ghost" onClick={() => ajouter('forme', { forme: 'ellipse' })} disabled={apercu}><Circle className="h-4 w-4 mr-1.5" />Cercle</Button>
          <Button size="sm" variant="ghost" onClick={() => ajouter('ligne')} disabled={apercu}><PenLine className="h-4 w-4 mr-1.5" />Trait</Button>
          <input ref={fichierImage} type="file" accept="image/*" className="hidden" onChange={e => { void choisirImage(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="h-6 w-px bg-border mx-1" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => dispatch({ type: 'annuler' })} disabled={h.passe.length === 0} title="Annuler (Ctrl+Z)" aria-label="Annuler"><Undo2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => dispatch({ type: 'retablir' })} disabled={h.futur.length === 0} title="Rétablir (Ctrl+Y)" aria-label="Rétablir"><Redo2 className="h-4 w-4" /></Button>
          <div className="h-6 w-px bg-border mx-1" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} aria-label="Dézoomer"><Minus className="h-4 w-4" /></Button>
          <button className="text-xs w-12 text-center tabular-nums hover:underline" onClick={ajusterZoom} title="Ajuster à l'écran">{Math.round(zoom * 100)} %</button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3, z + 0.1))} aria-label="Zoomer"><Plus className="h-4 w-4" /></Button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={apercu ? 'secondary' : 'outline'} onClick={() => { if (edition) terminerEdition(); setSelection(null); setApercu(a => !a); }}>
              <Eye className="h-4 w-4 mr-1.5" />{apercu ? 'Revenir à l\'édition' : 'Aperçu'}
            </Button>
            <Button size="sm" onClick={enregistrer} disabled={enCours || !verification.ok || !nom.trim()}>
              {enCours && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Enregistrer
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Feuille */}
          <div
            ref={zoneTravail}
            className="flex-1 min-w-0 min-h-0 overflow-auto bg-muted/60 p-6"
            onPointerDown={() => { if (edition) terminerEdition(); setSelection(null); }}
          >
            {apercu ? (
              <div className="max-w-4xl mx-auto space-y-2">
                <p className="text-xs rounded-md bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1">
                  Rempli avec un élève <strong>d'exemple</strong> ({exemple.eleve.prenom} {exemple.eleve.nom}) — ce n'est pas un vrai élève.
                </p>
                {htmlApercu ? <ApercuHtml html={htmlApercu} /> : <p className="text-sm text-destructive">Corrigez les champs inconnus pour voir l'aperçu.</p>}
              </div>
            ) : (
              <div style={{ width: largeur * PX_PAR_MM * zoom, height: hauteur * PX_PAR_MM * zoom }} className="mx-auto">
                <div
                  className="relative shadow-lg"
                  style={{ width: `${largeur}mm`, height: `${hauteur}mm`, background: doc.fond, transform: `scale(${zoom})`, transformOrigin: 'top left', overflow: 'hidden' }}
                  data-testid="feuille"
                >
                  {doc.elements.map(el => (
                    <ElementSurFeuille
                      key={el.id} el={el} logo={logo} choisi={el.id === selection} enEdition={el.id === edition}
                      zoom={zoom} zoneTexte={zoneTexte}
                      onPointerDown={(e, p) => debutGeste(e, el, p)}
                      onDoubleClick={() => { if (el.type === 'texte' || el.type === 'bloc') commencerEdition(el.id); }}
                    />
                  ))}
                  {guides.vertical && <div className="absolute top-0 bottom-0 w-px bg-pink-500 pointer-events-none" style={{ left: `${largeur / 2}mm` }} />}
                  {guides.horizontal && <div className="absolute left-0 right-0 h-px bg-pink-500 pointer-events-none" style={{ top: `${hauteur / 2}mm` }} />}
                </div>
              </div>
            )}
          </div>

          {/* Panneau de droite */}
          <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l overflow-y-auto max-h-[45vh] lg:max-h-none">
            <div className="p-3 border-b text-sm">
              {verification.erreur ? (
                <p className="flex items-start gap-2 text-destructive"><TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />{verification.erreur}</p>
              ) : verification.ok ? (
                <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Document valide</p>
              ) : (
                <div className="text-destructive">
                  <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" />Champs inconnus de SenClass :</p>
                  <p className="mt-1 font-mono text-xs">{verification.inconnus.map(c => `{${c}}`).join(', ')}</p>
                  <p className="mt-1 text-xs">Corrigez-les, ou écrivez le texte sans accolades s'il ne change pas d'un élève à l'autre.</p>
                </div>
              )}
            </div>
            {!apercu && (
              <PanneauProprietes
                doc={doc} element={element} enEdition={edition !== null}
                onDocument={d => valider(d)}
                onElement={majElement}
                onSupprimer={supprimer} onDupliquer={dupliquer} onPlan={plan}
                onInsererChamp={insererChamp}
                onFormat={formatTexte}
                onRemplacerImage={id => { imageARemplacer.current = id; fichierImage.current?.click(); }}
              />
            )}
          </aside>
        </div>

        {confirmerFermeture && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background rounded-lg p-5 max-w-sm space-y-3 shadow-xl">
              <p className="font-medium">Fermer sans enregistrer ?</p>
              <p className="text-sm text-muted-foreground">Les modifications de ce document seront perdues.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmerFermeture(false)}>Continuer à modifier</Button>
                <Button variant="destructive" onClick={() => { setConfirmerFermeture(false); onFermer(); }}>Fermer</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Un élément sur la feuille ──────────────────────────────────────────────

const ElementSurFeuille = ({
  el, logo, choisi, enEdition, zoom, zoneTexte, onPointerDown, onDoubleClick,
}: {
  el: ElementVisuel; logo?: string | null; choisi: boolean; enEdition: boolean; zoom: number;
  zoneTexte: React.MutableRefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent, p?: Poignee) => void;
  onDoubleClick: () => void;
}) => {
  const position = versStyleReact(cssPosition(el));
  const taillePoignee = 9 / zoom;
  return (
    <div
      style={{ ...position, cursor: enEdition ? 'text' : 'move', outline: choisi ? `${1.5 / zoom}px solid #2563eb` : undefined, outlineOffset: 0 }}
      onPointerDown={e => onPointerDown(e)}
      onDoubleClick={e => { pointDeClic = { x: e.clientX, y: e.clientY }; onDoubleClick(); }}
      data-element={el.type}
    >
      {(el.type === 'texte' || el.type === 'bloc') && (enEdition
        ? <TexteEnEdition el={el} zoneTexte={zoneTexte} />
        : <ContenuTexte el={el} />)}
      {el.type === 'image' && (
        el.source === 'logo' && !logo
          ? <div className="w-full h-full border border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-500 text-center leading-tight">Logo de<br />l'école</div>
          : <img src={el.source === 'logo' ? logo ?? '' : el.source} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      )}
      {el.type === 'forme' && <div style={{ width: '100%', height: '100%', ...versStyleReact(cssContenu(el)) }} />}
      {el.type === 'ligne' && <div style={versStyleReact(cssContenu(el))} />}
      {choisi && !enEdition && POIGNEES.map(p => (
        <div
          key={p}
          onPointerDown={e => onPointerDown(e, p)}
          style={{
            position: 'absolute', ...POSITION_POIGNEE[p], width: taillePoignee, height: taillePoignee,
            transform: 'translate(-50%, -50%)', background: 'white', border: `${1.5 / zoom}px solid #2563eb`,
            borderRadius: 2 / zoom, cursor: CURSEURS[p],
          }}
          aria-label={`Redimensionner (${p})`}
        />
      ))}
    </div>
  );
};

/** Là où l'on vient de cliquer pour écrire : le curseur s'y pose. */
let pointDeClic: { x: number; y: number } | null = null;

/** La position du texte sous ce point (Chrome, Safari, Edge, puis Firefox). */
const plageAuPoint = (x: number, y: number): Range | null => {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof d.caretRangeFromPoint === 'function') return d.caretRangeFromPoint(x, y);
  const pos = d.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const r = document.createRange();
  r.setStart(pos.offsetNode, pos.offset);
  r.collapse(true);
  return r;
};

/** Le contenu d'une zone de texte ou d'un bloc, nettoyé avant affichage. */
const ContenuTexte = ({ el }: { el: ElementTexte | ElementBloc }) => {
  const html = useMemo(() => nettoyerFragment(el.html), [el.html]);
  return <div style={{ width: '100%', height: '100%', ...versStyleReact(cssContenu(el)) }} dangerouslySetInnerHTML={{ __html: html }} />;
};

/** La zone de texte qu'on est en train d'écrire. Son contenu n'est posé qu'une fois : le navigateur gère la frappe. */
const TexteEnEdition = ({ el, zoneTexte }: { el: ElementTexte | ElementBloc; zoneTexte: React.MutableRefObject<HTMLDivElement | null> }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const div = ref.current;
    if (!div) return;
    zoneTexte.current = div;
    div.innerHTML = nettoyerFragment(el.html);
    div.focus();
    const sel = window.getSelection();
    // Ouvert par un clic : le curseur se pose là où l'on a cliqué. Texte
    // tout juste ajouté : tout est sélectionné, on tape directement par-dessus.
    let plage: Range | null = null;
    const point = pointDeClic;
    pointDeClic = null;
    if (point) {
      plage = plageAuPoint(point.x, point.y);
      if (plage && !div.contains(plage.startContainer)) plage = null;
    }
    if (!plage) {
      plage = document.createRange();
      plage.selectNodeContents(div);
      if (point || el.type === 'bloc') plage.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(plage);
    return () => { zoneTexte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPointerDown={e => e.stopPropagation()}
      onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
      style={{ width: '100%', minHeight: '100%', outline: 'none', ...versStyleReact(cssContenu(el)) }}
      data-testid="texte-en-edition"
    />
  );
};
