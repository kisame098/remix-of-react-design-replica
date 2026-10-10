import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, Copy, ImageIcon, Italic, School, Trash2, Underline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  POLICES, arrondirMm, type Alignement, type Bordure, type DocumentVisuel, type ElementVisuel, type StyleTrait,
} from '@/lib/documentVisuel';
import { changerOrientation, type Plan } from '@/lib/editeurVisuel';
import { CHAMPS, LIBELLES_GROUPE_CHAMP, type GroupeChamp } from '@/lib/modelesDocuments';

interface PanneauProps {
  doc: DocumentVisuel;
  element: ElementVisuel | null;
  enEdition: boolean;
  onDocument: (d: DocumentVisuel) => void;
  onElement: (e: ElementVisuel) => void;
  onSupprimer: () => void;
  onDupliquer: () => void;
  onPlan: (p: Plan) => void;
  onInsererChamp: (champ: string) => void;
  onFormat: (commande: 'bold' | 'italic' | 'underline', cle: 'gras' | 'italique' | 'souligne') => void;
  onRemplacerImage: (id: string) => void;
}

const LIBELLES_TYPE: Record<ElementVisuel['type'], string> = { texte: 'Texte', image: 'Image', forme: 'Forme', ligne: 'Trait', bloc: 'Document importé' };
const STYLES_TRAIT: { v: StyleTrait; l: string }[] = [
  { v: 'solid', l: 'Plein' }, { v: 'dashed', l: 'Tirets' }, { v: 'dotted', l: 'Pointillés' }, { v: 'double', l: 'Double' },
];
const INTERLIGNES = [1, 1.15, 1.3, 1.5, 1.8, 2, 2.5];
const GROUPES = Object.keys(LIBELLES_GROUPE_CHAMP) as GroupeChamp[];

/** Ne pas voler le curseur du texte en cours d'écriture quand on clique un bouton du panneau. */
const garderFocus = (e: React.MouseEvent) => e.preventDefault();

const Section = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <div className="p-3 border-b space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titre}</p>
    {children}
  </div>
);

const Nombre = ({ label, valeur, onChange, min, max, pas = 0.5, unite = 'mm' }: {
  label: string; valeur: number; onChange: (v: number) => void; min?: number; max?: number; pas?: number; unite?: string;
}) => (
  <label className="space-y-0.5 block">
    <span className="text-[11px] text-muted-foreground">{label}{unite ? ` (${unite})` : ''}</span>
    <Input
      type="number" className="h-8 text-sm" value={valeur} step={pas} min={min} max={max}
      onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }}
    />
  </label>
);

/** Une couleur, ou « aucune » (transparent). */
const Couleur = ({ label, valeur, onChange, aucuneAutorisee = true }: {
  label: string; valeur: string | null; onChange: (v: string | null) => void; aucuneAutorisee?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs w-20 shrink-0">{label}</span>
    <input
      type="color" value={valeur ?? '#ffffff'} onChange={e => onChange(e.target.value)}
      className="h-7 w-10 rounded border cursor-pointer" aria-label={label}
    />
    {aucuneAutorisee && (
      <Button size="sm" variant={valeur === null ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => onChange(null)}>Aucune</Button>
    )}
  </div>
);

const EditeurBordure = ({ bordure, onChange, obligatoire = false }: {
  bordure: Bordure | null; onChange: (b: Bordure | null) => void; obligatoire?: boolean;
}) => {
  const b = bordure ?? { couleur: '#222222', epaisseur: 0.5, style: 'solid' as StyleTrait };
  return (
    <div className="space-y-2">
      <Couleur label="Couleur" valeur={bordure ? b.couleur : null} aucuneAutorisee={!obligatoire}
        onChange={c => onChange(c === null ? null : { ...b, couleur: c })} />
      {(bordure || obligatoire) && (
        <div className="grid grid-cols-2 gap-2">
          <Nombre label="Épaisseur" valeur={b.epaisseur} pas={0.1} min={0.1} max={10} onChange={v => onChange({ ...b, epaisseur: Math.max(0.1, v) })} />
          <label className="space-y-0.5 block">
            <span className="text-[11px] text-muted-foreground">Style</span>
            <Select value={b.style} onValueChange={v => onChange({ ...b, style: v as StyleTrait })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{STYLES_TRAIT.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
      )}
    </div>
  );
};

/** La liste cliquable des informations de l'élève. */
const ChampsEleve = ({ enEdition, onInserer }: { enEdition: boolean; onInserer: (champ: string) => void }) => (
  <Section titre="Informations de l'élève">
    <p className="text-[11px] text-muted-foreground">
      {enEdition ? 'Cliquez : le champ s\'insère à l\'endroit du curseur.' : 'Cliquez d\'abord dans le texte pour choisir l\'endroit.'}
    </p>
    {GROUPES.map(g => (
      <div key={g}>
        <p className="text-[11px] font-semibold text-muted-foreground mt-1 mb-0.5">{LIBELLES_GROUPE_CHAMP[g]}</p>
        <div className="flex flex-wrap gap-1">
          {CHAMPS.filter(c => c.groupe === g && !c.image).map(c => (
            <button key={c.nom} type="button" title={c.source} onMouseDown={garderFocus} onClick={() => onInserer(c.nom)}
              className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] hover:bg-primary/10 hover:border-primary/40">
              {c.nom.toLowerCase().replace(/^./, m => m.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
    ))}
  </Section>
);

/** Le panneau de droite : réglages de l'élément choisi, ou de la feuille. */
export const PanneauProprietes = ({
  doc, element: el, enEdition, onDocument, onElement, onSupprimer, onDupliquer, onPlan, onInsererChamp, onFormat, onRemplacerImage,
}: PanneauProps) => {
  if (!el) {
    return (
      <>
        <Section titre="Feuille A4">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant={doc.orientation === 'portrait' ? 'secondary' : 'outline'} onClick={() => onDocument(changerOrientation(doc, 'portrait'))}>Portrait</Button>
            <Button size="sm" variant={doc.orientation === 'paysage' ? 'secondary' : 'outline'} onClick={() => onDocument(changerOrientation(doc, 'paysage'))}>Paysage</Button>
          </div>
          <Couleur label="Fond" valeur={doc.fond} aucuneAutorisee={false} onChange={c => onDocument({ ...doc, fond: c ?? '#ffffff' })} />
        </Section>
        <div className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p>Ajoutez des éléments avec la barre du haut, puis déplacez-les à la souris.</p>
          <p><strong>Cliquez</strong> un texte pour l'écrire ; faites-le glisser pour le déplacer. Les informations de l'élève s'insèrent depuis ce panneau.</p>
          <p>Flèches : déplacer (Maj : 5 mm). Suppr : effacer. Ctrl+D : dupliquer. Ctrl+Z : annuler.</p>
        </div>
      </>
    );
  }

  const maj = (modif: Partial<ElementVisuel>) => onElement({ ...el, ...modif } as ElementVisuel);

  return (
    <>
      <Section titre={LIBELLES_TYPE[el.type]}>
        <div className="grid grid-cols-2 gap-2">
          <Nombre label="Gauche" valeur={el.x} onChange={v => maj({ x: arrondirMm(v) })} />
          <Nombre label="Haut" valeur={el.y} onChange={v => maj({ y: arrondirMm(v) })} />
          <Nombre label="Largeur" valeur={el.l} min={2} onChange={v => maj({ l: Math.max(2, arrondirMm(v)) })} />
          <Nombre label="Hauteur" valeur={el.h} min={1} onChange={v => maj({ h: Math.max(1, arrondirMm(v)) })} />
          <Nombre label="Rotation" unite="°" pas={1} valeur={el.rotation} onChange={v => maj({ rotation: ((Math.round(v) % 360) + 360) % 360 })} />
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onDupliquer} title="Dupliquer" aria-label="Dupliquer"><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onPlan('premier')} title="Premier plan" aria-label="Premier plan"><ArrowUpToLine className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onPlan('arriere')} title="Arrière-plan" aria-label="Arrière-plan"><ArrowDownToLine className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onSupprimer} title="Supprimer" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </Section>

      {el.type === 'texte' && (
        <>
          <Section titre="Texte">
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <Select value={el.style.police} onValueChange={v => maj({ style: { ...el.style, police: v } })}>
                <SelectTrigger className="h-8 text-sm" aria-label="Police"><SelectValue /></SelectTrigger>
                <SelectContent>{POLICES.map(p => <SelectItem key={p.nom} value={p.nom}><span style={{ fontFamily: p.css }}>{p.nom}</span></SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" className="h-8 text-sm" min={6} max={96} step={0.5} value={el.style.taille} aria-label="Taille"
                onChange={e => { const v = Number(e.target.value); if (v >= 4 && v <= 200) maj({ style: { ...el.style, taille: v } }); }} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="icon" variant={el.style.gras ? 'secondary' : 'ghost'} className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('bold', 'gras')} aria-label="Gras" title="Gras (sur la sélection quand vous écrivez)"><Bold className="h-4 w-4" /></Button>
              <Button size="icon" variant={el.style.italique ? 'secondary' : 'ghost'} className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('italic', 'italique')} aria-label="Italique"><Italic className="h-4 w-4" /></Button>
              <Button size="icon" variant={el.style.souligne ? 'secondary' : 'ghost'} className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('underline', 'souligne')} aria-label="Souligné"><Underline className="h-4 w-4" /></Button>
              <div className="w-px h-6 bg-border mx-1" />
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight], ['justify', AlignJustify]] as [Alignement, typeof AlignLeft][]).map(([a, Icone]) => (
                <Button key={a} size="icon" variant={el.style.alignement === a ? 'secondary' : 'ghost'} className="h-8 w-8"
                  onMouseDown={garderFocus} onClick={() => maj({ style: { ...el.style, alignement: a } })} aria-label={`Aligner ${a}`}><Icone className="h-4 w-4" /></Button>
              ))}
            </div>
            <Couleur label="Couleur" valeur={el.style.couleur} aucuneAutorisee={false} onChange={c => maj({ style: { ...el.style, couleur: c ?? '#111111' } })} />
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 shrink-0">Interligne</span>
              <Select value={String(el.style.interligne)} onValueChange={v => maj({ style: { ...el.style, interligne: Number(v) } })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{INTERLIGNES.map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Couleur label="Fond" valeur={el.fond} onChange={c => maj({ fond: c })} />
            <p className="text-[11px] font-medium pt-1">Cadre</p>
            <EditeurBordure bordure={el.bordure} onChange={b => maj({ bordure: b })} />
          </Section>
          <ChampsEleve enEdition={enEdition} onInserer={onInsererChamp} />
        </>
      )}

      {el.type === 'bloc' && (
        <>
          <Section titre="Texte">
            <p className="text-[11px] text-muted-foreground">Cliquez dans le document pour écrire. Sélectionnez du texte pour le mettre en forme.</p>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('bold', 'gras')} aria-label="Gras"><Bold className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('italic', 'italique')} aria-label="Italique"><Italic className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onMouseDown={garderFocus} onClick={() => onFormat('underline', 'souligne')} aria-label="Souligné"><Underline className="h-4 w-4" /></Button>
            </div>
          </Section>
          <ChampsEleve enEdition={enEdition} onInserer={onInsererChamp} />
        </>
      )}

      {el.type === 'image' && (
        <Section titre="Image">
          <p className="text-xs text-muted-foreground">
            {el.source === 'logo' ? "Le logo de l'école (Paramètres → École) : il change tout seul si l'école change de logo." : 'Une image de votre ordinateur (cachet, signature, décor…).'}
          </p>
          <div className="flex flex-wrap gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onRemplacerImage(el.id)} title="Choisir une image" aria-label="Choisir une image"><ImageIcon className="h-4 w-4" /></Button>
            {el.source !== 'logo' && <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => maj({ source: 'logo' })} title="Utiliser le logo de l'école" aria-label="Utiliser le logo de l'école"><School className="h-4 w-4" /></Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">Par un coin, l'image garde ses proportions.</p>
        </Section>
      )}

      {el.type === 'forme' && (
        <Section titre={el.forme === 'ellipse' ? 'Cercle' : 'Rectangle'}>
          <Couleur label="Remplissage" valeur={el.fond} onChange={c => maj({ fond: c })} />
          <p className="text-[11px] font-medium pt-1">Contour</p>
          <EditeurBordure bordure={el.bordure} onChange={b => maj({ bordure: b })} />
          {el.forme === 'rectangle' && (
            <Nombre label="Coins arrondis" valeur={el.arrondi} min={0} max={50} onChange={v => maj({ arrondi: Math.max(0, v) })} />
          )}
        </Section>
      )}

      {el.type === 'ligne' && (
        <Section titre="Trait">
          <EditeurBordure bordure={el.bordure} obligatoire onChange={b => { if (b) maj({ bordure: b }); }} />
          <p className="text-[11px] text-muted-foreground">Pour un trait vertical : rotation 90°.</p>
        </Section>
      )}
    </>
  );
};
