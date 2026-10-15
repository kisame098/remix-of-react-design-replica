import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, horizontalListSortingStrategy, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, ArrowRight, Award, BookOpen, Bus, Camera, ChartColumn, Clock, Copy, GripVertical, Globe, GraduationCap, MessageCircleMore, Phone,
  Handshake, Heart, ImagePlus, Laptop, Link2, MessageCircle, Music, Plus, Scale, Shield, Star, Trash2, Trophy,
  Users, Utensils, Palette, FlaskConical, Baby, Library,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CONTENU_DEFAUT, type Contenu, type LienBouton } from './contenu';
import { ajouterElement, deplacerElement, ecrire, fusionner, lire, retirerElement } from './chemin';
import { lienWhatsApp } from './utilitaires';

/* ─────────────────────────── Contexte ─────────────────────────── */

type Cible = { type: 'image' | 'lien' | 'icone'; chemin: string } | null;

interface Edition {
  contenu: Contenu;
  edition: boolean;
  setEdition: (v: boolean) => void;
  /** Faux sur le site public : aucun outil de modification n'existe. */
  modifiable: boolean;
  maj: (chemin: string, valeur: unknown) => void;
  majListe: (chemin: string, f: (liste: unknown[]) => unknown[]) => void;
  ouvrir: (c: Cible) => void;
  reinitialiser: () => void;
  /** Message d'alerte d'enregistrement (stockage plein, hors connexion…), sinon null. */
  alerte: string | null;
  /** Envoie une photo choisie par l'école et rend son adresse. */
  televerser: (f: File) => Promise<string>;
  /** Panneau « Identité & couleurs » (ouvrable depuis les icônes de réseaux, etc.). */
  identiteOuverte: boolean;
  ouvrirIdentite: (v: boolean) => void;
}

const Ctx = createContext<Edition | null>(null);

export function useEdition() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEdition hors du fournisseur');
  return c;
}

/** Le contenu enregistré, complété par les champs du modèle ajoutés depuis. */
export const contenuDepuis = (sauvegarde: unknown): Contenu => fusionner(CONTENU_DEFAUT, sauvegarde);

/**
 * Fournit le contenu du site et les outils de modification. Il ne sait pas
 * OÙ le site est enregistré : celui qui l'utilise passe `onChange` (navigateur
 * pour le labo, Supabase dans le SaaS) et `televerser` pour les photos.
 */
export function FournisseurEdition({ children, initial, onChange, televerser, modifiable = true, editionInitiale = false, alerte = null }: {
  children: ReactNode;
  initial: Contenu;
  onChange?: (c: Contenu) => void;
  televerser?: (f: File) => Promise<string>;
  modifiable?: boolean;
  editionInitiale?: boolean;
  alerte?: string | null;
}) {
  const [contenu, setContenu] = useState<Contenu>(initial);
  const [edition, setEdition] = useState(modifiable && editionInitiale);
  const [cible, ouvrir] = useState<Cible>(null);
  const [identiteOuverte, ouvrirIdentite] = useState(false);
  const premier = useRef(true);
  const rappel = useRef(onChange);
  rappel.current = onChange;

  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    rappel.current?.(contenu);
  }, [contenu]);

  const maj = useCallback((chemin: string, valeur: unknown) => setContenu(c => ecrire(c, chemin, valeur)), []);
  const majListe = useCallback((chemin: string, f: (l: unknown[]) => unknown[]) =>
    setContenu(c => ecrire(c, chemin, f((lire(c, chemin) as unknown[]) ?? []))), []);
  const envoyer = useCallback((f: File) => (televerser ? televerser(f) : reduireImage(f)), [televerser]);

  const valeur = useMemo<Edition>(() => ({
    contenu, edition: modifiable && edition, setEdition, modifiable, maj, majListe, ouvrir,
    reinitialiser: () => setContenu(CONTENU_DEFAUT), alerte, televerser: envoyer, identiteOuverte, ouvrirIdentite,
  }), [contenu, edition, modifiable, maj, majListe, alerte, envoyer, identiteOuverte]);

  return (
    <Ctx.Provider value={valeur}>
      {children}
      {modifiable && (
        <>
          <FenetreImage cible={cible} onFermer={() => ouvrir(null)} />
          <FenetreLien cible={cible} onFermer={() => ouvrir(null)} />
          <FenetreIcone cible={cible} onFermer={() => ouvrir(null)} />
        </>
      )}
    </Ctx.Provider>
  );
}

/** Raccourci : lire une valeur du contenu par son chemin. */
export function useValeur<V = string>(chemin: string): V {
  return lire(useEdition().contenu, chemin) as V;
}

/* ─────────────────────────── Texte ─────────────────────────── */

/**
 * Texte modifiable. En mode modification, on clique et on écrit directement
 * sur le site ; la valeur est enregistrée en quittant le champ.
 */
export function T({ c, as: Balise = 'span', className = '', vide = 'Cliquez pour écrire…' }: {
  c: string; as?: ElementType; className?: string; vide?: string;
}) {
  const { edition, maj } = useEdition();
  const valeur = useValeur<string>(c) ?? '';
  const ref = useRef<HTMLElement>(null);

  // Garde l'affichage synchronisé quand la valeur change d'ailleurs
  // (réinitialisation, panneau Identité), sans casser la saisie en cours.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerText !== valeur) {
      ref.current.innerText = valeur;
    }
  }, [valeur, edition]);

  if (!edition) {
    return valeur ? <Balise className={`${className} whitespace-pre-line`}>{valeur}</Balise> : null;
  }
  return (
    <Balise
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-vide={vide}
      onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => { const t = e.currentTarget.innerText.trim(); if (t !== valeur) maj(c, t); }}
      className={`${className} whitespace-pre-line editable`}
    />
  );
}

/* ─────────────────────────── Image ─────────────────────────── */

export function Img({ c, className = '', alt = '' }: { c: string; className?: string; alt?: string }) {
  const { edition, ouvrir } = useEdition();
  const src = useValeur<string>(c);
  return (
    <>
      {src ? <img src={src} alt={alt} className={className} loading="lazy" />
        : <div className={`${className} bg-gray-200 flex items-center justify-center text-gray-400`}><Camera className="h-8 w-8" /></div>}
      {edition && (
        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); ouvrir({ type: 'image', chemin: c }); }}
          className="outil absolute top-3 right-3 z-30">
          <ImagePlus className="h-3.5 w-3.5" />Changer la photo
        </button>
      )}
    </>
  );
}

/* ─────────────────────────── Bouton / lien ─────────────────────────── */

export function Bouton({ c, className = '', style }: { c: string; className?: string; style?: React.CSSProperties }) {
  const { edition, ouvrir } = useEdition();
  const b = useValeur<LienBouton>(c);
  if (!b) return null;
  if (!edition) {
    if (!b.texte) return null;
    const externe = /^https?:/.test(b.lien);
    return <a href={b.lien || '#'} className={className} style={style} {...(externe ? { target: '_blank', rel: 'noreferrer' } : {})}>{b.texte}</a>;
  }
  return (
    <span className={`${className} relative`} style={style}>
      <T c={`${c}.texte`} vide="Texte du bouton" />
      <button type="button" title="Où mène ce bouton ?" onClick={e => { e.stopPropagation(); ouvrir({ type: 'lien', chemin: c }); }}
        className="outil absolute -top-3 -right-3 z-30 !px-1.5">
        <Link2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/* ─────────────────────────── Icône ─────────────────────────── */

export const ICONES: Record<string, ElementType> = {
  users: Users, award: Award, shield: Shield, globe: Globe, laptop: Laptop, bus: Bus, book: BookOpen,
  scale: Scale, heart: Heart, handshake: Handshake, chart: ChartColumn, message: MessageCircle, clock: Clock,
  utensils: Utensils, graduation: GraduationCap, star: Star, trophy: Trophy, music: Music, palette: Palette,
  science: FlaskConical, bebe: Baby, bibliotheque: Library,
};

export function Icone({ c, className = '' }: { c: string; className?: string }) {
  const { edition, ouvrir } = useEdition();
  const nom = useValeur<string>(c);
  const Composant = ICONES[nom] ?? Star;
  if (!edition) return <Composant className={className} />;
  return (
    <button type="button" title="Changer l'icône" onClick={e => { e.stopPropagation(); ouvrir({ type: 'icone', chemin: c }); }}
      className="rounded-md outline-dashed outline-1 outline-offset-4 outline-amber-400 hover:outline-2">
      <Composant className={className} />
    </button>
  );
}

/* ─────────────────────────── Listes ─────────────────────────── */

/**
 * Largeur d'un élément selon le nombre de colonnes voulu. Les éléments sont
 * en « flex-wrap » centré : en supprimer un ne laisse jamais de trou, la
 * rangée se recentre.
 */
const LARGEURS: Record<number, string> = {
  1: 'w-full',
  2: 'w-full md:w-[calc((100%_-_1.5rem)/2)]',
  3: 'w-full md:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_3rem)/3)]',
  4: 'w-full sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_4.5rem)/4)]',
};

/**
 * Liste d'éléments (chiffres, cycles, témoignages…). En mode modification,
 * chaque élément se GLISSE à la souris (poignée), se duplique, se supprime,
 * et une case « Ajouter » termine la liste.
 */
export function Liste<E>({ c, nouveau, colonnes, horizontal = false, className = '', classeElement = '', libelleAjout = 'Ajouter', children }: {
  c: string; nouveau: E; colonnes?: 1 | 2 | 3 | 4; className?: string; classeElement?: string; libelleAjout?: string;
  /** Liste qui défile à l'horizontale (on la réordonne de gauche à droite). */
  horizontal?: boolean;
  children: (element: E, index: number, chemin: string) => ReactNode;
}) {
  const { edition, majListe } = useEdition();
  const liste = useValeur<E[]>(c) ?? [];
  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const conteneur = colonnes ? `flex flex-wrap justify-center gap-6 ${className}` : className;
  const largeur = colonnes ? LARGEURS[colonnes] : '';
  const ids = liste.map((_, i) => `${c}#${i}`);

  if (!edition) {
    return <div className={conteneur}>{liste.map((el, i) => <div key={i} className={`${largeur} ${classeElement}`}>{children(el, i, `${c}.${i}`)}</div>)}</div>;
  }

  const finGlisse = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    majListe(c, l => arrayMove(l, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={finGlisse}>
      <SortableContext items={ids} strategy={horizontal ? horizontalListSortingStrategy : colonnes && colonnes > 1 ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={conteneur}>
          {liste.map((el, i) => (
            <ElementTriable key={ids[i]} id={ids[i]} className={`${largeur} ${classeElement}`}
              premier={i === 0} dernier={i === liste.length - 1}
              onDeplacer={sens => majListe(c, l => deplacerElement(l, i, sens))}
              onDupliquer={() => majListe(c, l => ajouterElement(l, structuredClone(l[i]), i))}
              onSupprimer={() => majListe(c, l => retirerElement(l, i))}>
              {children(el, i, `${c}.${i}`)}
            </ElementTriable>
          ))}
          <button type="button" onClick={() => majListe(c, l => ajouterElement(l, structuredClone(nouveau)))}
            className={`${largeur} ${horizontal ? classeElement : ''} min-h-[56px] rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 bg-white/60 hover:border-amber-400 hover:text-gray-800 flex items-center justify-center gap-1.5 text-sm font-medium p-4`}>
            <Plus className="h-4 w-4" />{libelleAjout}
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ElementTriable({ id, className, premier, dernier, onDeplacer, onDupliquer, onSupprimer, children }: {
  id: string; className: string; premier: boolean; dernier: boolean;
  onDeplacer: (sens: -1 | 1) => void; onDupliquer: () => void; onSupprimer: () => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className} relative group/el ${isDragging ? 'z-50 opacity-80 ring-2 ring-amber-400 rounded-2xl shadow-2xl' : ''}`}>
      {children}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 z-40 ${isDragging ? 'flex' : 'hidden group-hover/el:flex'} items-center rounded-lg bg-white text-gray-900 border border-gray-200 shadow-md p-0.5`}>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} title="Glisser pour déplacer" aria-label="Glisser pour déplacer"
          className="p-1.5 rounded-md hover:bg-amber-50 cursor-grab active:cursor-grabbing text-amber-600 [&>svg]:h-3.5 [&>svg]:w-3.5">
          <GripVertical />
        </button>
        <OutilBtn titre="Avant" disabled={premier} onClick={() => onDeplacer(-1)}><ArrowLeft /></OutilBtn>
        <OutilBtn titre="Après" disabled={dernier} onClick={() => onDeplacer(1)}><ArrowRight /></OutilBtn>
        <OutilBtn titre="Dupliquer" onClick={onDupliquer}><Copy /></OutilBtn>
        <OutilBtn titre="Supprimer" onClick={onSupprimer}><Trash2 className="text-red-600" /></OutilBtn>
      </div>
    </div>
  );
}

function OutilBtn({ titre, onClick, disabled, children }: { titre: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={titre} aria-label={titre} disabled={disabled}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5">
      {children}
    </button>
  );
}

/* ─────────────────────────── Sections ─────────────────────────── */

/** Bloc d'une page. Son ordre, son retrait et son ajout se gèrent dans `PageSections`. */
export function Section({ className = '', children }: { id?: string; nom?: string; className?: string; children: ReactNode }) {
  return <section className={className}>{children}</section>;
}

/* ─────────────────────────── Fenêtres ─────────────────────────── */

function FenetreImage({ cible, onFermer }: { cible: Cible; onFermer: () => void }) {
  const { contenu, maj, televerser } = useEdition();
  const ouvert = cible?.type === 'image';
  const [envoi, setEnvoi] = useState(false);
  const [url, setUrl] = useState('');
  const fichier = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ouvert) setUrl(String(lire(contenu, cible!.chemin) ?? '')); }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const valider = (src: string) => { maj(cible!.chemin, src); onFermer(); };
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Changer la photo</DialogTitle>
          <DialogDescription>Choisissez une photo sur cet appareil, ou collez l'adresse d'une image.</DialogDescription>
        </DialogHeader>
        {url && <img src={url} alt="" className="rounded-lg max-h-48 w-full object-cover border" />}
        <input ref={fichier} type="file" accept="image/*" className="hidden" onChange={e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          setEnvoi(true);
          televerser(f).then(valider).catch(() => setEnvoi(false)).finally(() => setEnvoi(false));
        }} />
        <Button className="gap-1.5" disabled={envoi} onClick={() => fichier.current?.click()}><ImagePlus className="h-4 w-4" />{envoi ? 'Envoi de la photo…' : 'Choisir une photo'}</Button>
        <div className="space-y-1.5">
          <Label>Ou adresse de l'image</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={() => valider('')}>Retirer la photo</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFermer}>Annuler</Button>
            <Button onClick={() => valider(url.trim())}>Enregistrer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Labo : la photo est gardée dans le navigateur. On la réduit (1600 px, JPEG)
 * pour ne pas remplir le stockage ; l'étape suivante l'enverra sur Supabase.
 */
export function reduireImage(f: File): Promise<string> {
  return new Promise(resolve => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const img = new Image();
      img.onload = () => {
        const echelle = Math.min(1, 1600 / Math.max(img.width, img.height));
        const toile = document.createElement('canvas');
        toile.width = Math.round(img.width * echelle);
        toile.height = Math.round(img.height * echelle);
        toile.getContext('2d')!.drawImage(img, 0, 0, toile.width, toile.height);
        resolve(f.type === 'image/png' ? toile.toDataURL('image/png') : toile.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(lecteur.result);
    };
    lecteur.readAsDataURL(f);
  });
}

export const PAGES_INTERNES = [
  { lien: '#/', nom: 'Accueil' },
  { lien: '#/ecole', nom: 'Notre école' },
  { lien: '#/enseignement', nom: 'Enseignement' },
  { lien: '#/vie-scolaire', nom: 'Vie scolaire' },
  { lien: '#/admissions', nom: 'Admissions' },
  { lien: '#/actualites', nom: 'Actualités' },
  { lien: '#/contact', nom: 'Contact' },
];

function FenetreLien({ cible, onFermer }: { cible: Cible; onFermer: () => void }) {
  const { contenu, maj } = useEdition();
  const ouvert = cible?.type === 'lien';
  const [lien, setLien] = useState('');
  useEffect(() => { if (ouvert) setLien((lire(contenu, cible!.chemin) as LienBouton)?.lien ?? ''); }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Où mène ce bouton ?</DialogTitle>
          <DialogDescription>Une page du site, ou une adresse externe.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {PAGES_INTERNES.map(p => (
            <Button key={p.lien} size="sm" variant={lien === p.lien ? 'default' : 'outline'} onClick={() => setLien(p.lien)}>{p.nom}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLien(lienWhatsApp(contenu.identite.whatsapp, contenu.identite.messageWhatsApp))}>
            <MessageCircleMore className="h-3.5 w-3.5 text-green-600" />Notre WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLien(`tel:${contenu.identite.telephone.replace(/\s/g, '')}`)}>
            <Phone className="h-3.5 w-3.5" />Nous appeler
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label>Adresse</Label>
          <Input value={lien} onChange={e => setLien(e.target.value)} placeholder="https://… ou une page ci-dessus" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={() => { maj(`${cible!.chemin}.lien`, lien.trim()); onFermer(); }}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FenetreIcone({ cible, onFermer }: { cible: Cible; onFermer: () => void }) {
  const { maj } = useEdition();
  return (
    <Dialog open={cible?.type === 'icone'} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Choisir une icône</DialogTitle></DialogHeader>
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(ICONES).map(([nom, I]) => (
            <button key={nom} type="button" onClick={() => { maj(cible!.chemin, nom); onFermer(); }}
              className="aspect-square rounded-xl border hover:border-primary hover:bg-primary/5 flex items-center justify-center">
              <I className="h-5 w-5" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
