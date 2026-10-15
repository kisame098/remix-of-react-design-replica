import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Award, BookOpen, Bus, Camera, ChartColumn, Clock, Copy, Eye, EyeOff, Globe, GraduationCap,
  Handshake, Heart, ImagePlus, Laptop, Link2, MessageCircle, Music, Plus, Scale, Shield, Star, Trash2, Trophy,
  Users, Utensils, Palette, FlaskConical, Baby, Library,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CONTENU_DEFAUT, type Contenu, type LienBouton } from './contenu';
import { ajouterElement, deplacerElement, ecrire, fusionner, lire, retirerElement } from './chemin';

/* ─────────────────────────── Contexte ─────────────────────────── */

const CLE = 'labo.site-ecole.contenu';

function charger(): Contenu {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return fusionner(CONTENU_DEFAUT, JSON.parse(brut));
  } catch { /* stockage indisponible ou abîmé : modèle de départ */ }
  return CONTENU_DEFAUT;
}

type Cible = { type: 'image' | 'lien' | 'icone'; chemin: string } | null;

interface Edition {
  contenu: Contenu;
  edition: boolean;
  setEdition: (v: boolean) => void;
  maj: (chemin: string, valeur: unknown) => void;
  majListe: (chemin: string, f: (liste: unknown[]) => unknown[]) => void;
  ouvrir: (c: Cible) => void;
  reinitialiser: () => void;
  stockagePlein: boolean;
}

const Ctx = createContext<Edition | null>(null);

export function useEdition() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEdition hors du fournisseur');
  return c;
}

export function FournisseurEdition({ children }: { children: ReactNode }) {
  const [contenu, setContenu] = useState<Contenu>(charger);
  const [edition, setEdition] = useState(false);
  const [cible, ouvrir] = useState<Cible>(null);
  const [stockagePlein, setStockagePlein] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CLE, JSON.stringify(contenu)); setStockagePlein(false); }
    catch { setStockagePlein(true); }
  }, [contenu]);

  const maj = useCallback((chemin: string, valeur: unknown) => setContenu(c => ecrire(c, chemin, valeur)), []);
  const majListe = useCallback((chemin: string, f: (l: unknown[]) => unknown[]) =>
    setContenu(c => ecrire(c, chemin, f((lire(c, chemin) as unknown[]) ?? []))), []);

  const valeur = useMemo<Edition>(() => ({
    contenu, edition, setEdition, maj, majListe, ouvrir,
    reinitialiser: () => setContenu(CONTENU_DEFAUT), stockagePlein,
  }), [contenu, edition, maj, majListe, stockagePlein]);

  return (
    <Ctx.Provider value={valeur}>
      {children}
      <FenetreImage cible={cible} onFermer={() => ouvrir(null)} />
      <FenetreLien cible={cible} onFermer={() => ouvrir(null)} />
      <FenetreIcone cible={cible} onFermer={() => ouvrir(null)} />
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
 * Liste d'éléments (chiffres, cycles, témoignages…). En mode modification,
 * chaque élément a ses outils (déplacer, dupliquer, supprimer) et une case
 * « Ajouter » termine la liste.
 */
export function Liste<E>({ c, nouveau, className = '', classeElement = '', libelleAjout = 'Ajouter', children }: {
  c: string; nouveau: E; className?: string; classeElement?: string; libelleAjout?: string;
  children: (element: E, index: number, chemin: string) => ReactNode;
}) {
  const { edition, majListe } = useEdition();
  const liste = useValeur<E[]>(c) ?? [];
  return (
    <div className={className}>
      {liste.map((el, i) => (
        <div key={i} className={`${classeElement} ${edition ? 'relative group/el' : ''}`}>
          {children(el, i, `${c}.${i}`)}
          {edition && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 hidden group-hover/el:flex items-center rounded-lg bg-white text-gray-900 border border-gray-200 shadow-md p-0.5">
              <OutilBtn titre="Avant" disabled={i === 0} onClick={() => majListe(c, l => deplacerElement(l, i, -1))}><ArrowLeft /></OutilBtn>
              <OutilBtn titre="Après" disabled={i === liste.length - 1} onClick={() => majListe(c, l => deplacerElement(l, i, 1))}><ArrowRight /></OutilBtn>
              <OutilBtn titre="Dupliquer" onClick={() => majListe(c, l => ajouterElement(l, structuredClone(l[i]), i))}><Copy /></OutilBtn>
              <OutilBtn titre="Supprimer" onClick={() => majListe(c, l => retirerElement(l, i))}><Trash2 className="text-red-600" /></OutilBtn>
            </div>
          )}
        </div>
      ))}
      {edition && (
        <button type="button" onClick={() => majListe(c, l => ajouterElement(l, structuredClone(nouveau)))}
          className="min-h-[56px] rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 bg-white/60 hover:opacity-100 flex items-center justify-center gap-1.5 text-sm font-medium p-4">
          <Plus className="h-4 w-4" />{libelleAjout}
        </button>
      )}
    </div>
  );
}

function OutilBtn({ titre, onClick, disabled, children }: { titre: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={titre} aria-label={titre} disabled={disabled}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5">
      {children}
    </button>
  );
}

/* ─────────────────────────── Sections ─────────────────────────── */

/** Section que l'école peut masquer (et réafficher) en mode modification. */
export function Section({ id, nom, className = '', children }: { id: string; nom: string; className?: string; children: ReactNode }) {
  const { edition, contenu, majListe } = useEdition();
  const masquee = contenu.masques.includes(id);
  if (masquee && !edition) return null;
  if (masquee) {
    return (
      <div className="bg-gray-100 border-y border-dashed border-gray-300 py-3 px-6 flex items-center justify-center gap-3 text-sm text-gray-500">
        Section « {nom} » masquée
        <button type="button" className="outil" onClick={() => majListe('masques', l => l.filter(x => x !== id))}>
          <Eye className="h-3.5 w-3.5" />Afficher
        </button>
      </div>
    );
  }
  return (
    <section className={`${className} ${edition ? 'relative group/sec' : ''}`}>
      {edition && (
        <button type="button" onClick={() => majListe('masques', l => [...l, id])}
          className="outil absolute top-3 left-3 z-30 opacity-0 group-hover/sec:opacity-100 transition-opacity">
          <EyeOff className="h-3.5 w-3.5" />Masquer « {nom} »
        </button>
      )}
      {children}
    </section>
  );
}

/* ─────────────────────────── Fenêtres ─────────────────────────── */

function FenetreImage({ cible, onFermer }: { cible: Cible; onFermer: () => void }) {
  const { contenu, maj } = useEdition();
  const ouvert = cible?.type === 'image';
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
          reduireImage(f).then(valider);
        }} />
        <Button className="gap-1.5" onClick={() => fichier.current?.click()}><ImagePlus className="h-4 w-4" />Choisir une photo</Button>
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
function reduireImage(f: File): Promise<string> {
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
