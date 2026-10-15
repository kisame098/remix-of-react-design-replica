import { useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, Palette, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POLICES, TYPES_RESEAUX, type Police, type Reseau, type TypeReseau } from './contenu';
import { STYLE_RESEAU } from './reseaux';
import { useEdition } from './edition';

/** Barre flottante, au style SenClass : bascule du mode modification et réglages du site. */
export default function BarreEdition() {
  const { edition, setEdition, stockagePlein, reinitialiser, identiteOuverte, ouvrirIdentite } = useEdition();
  const [reinit, setReinit] = useState(false);

  return (
    <>
      {edition && (
        <div className="fixed top-0 inset-x-0 z-[45] bg-[#F59E0B] text-gray-900 text-sm font-medium text-center py-1.5 px-4 font-sans">
          Mode modification : cliquez sur un texte pour l'écrire · survolez un élément ou une section pour le glisser, le dupliquer ou le retirer.
        </div>
      )}
      {stockagePlein && (
        <div className="fixed top-9 left-1/2 -translate-x-1/2 z-[45] bg-red-600 text-white text-sm rounded-lg px-4 py-2 flex items-center gap-2 font-sans shadow-lg">
          <AlertTriangle className="h-4 w-4" />Photos trop lourdes : le dernier changement ne sera pas gardé (labo).
        </div>
      )}

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[45] font-sans">
        <div className="flex items-center gap-1.5 rounded-2xl border bg-background/95 backdrop-blur shadow-2xl p-1.5">
          <Button onClick={() => setEdition(!edition)} className="gap-1.5 rounded-xl" variant={edition ? 'default' : 'outline'}>
            {edition ? <><Check className="h-4 w-4" />Terminer</> : <><Pencil className="h-4 w-4" />Modifier le site</>}
          </Button>
          {edition && (
            <>
              <Button variant="ghost" className="gap-1.5 rounded-xl" onClick={() => ouvrirIdentite(true)}>
                <Palette className="h-4 w-4" />Identité &amp; couleurs
              </Button>
              <Button variant="ghost" size="icon" className="rounded-xl" title="Revenir au modèle de départ" aria-label="Revenir au modèle de départ" onClick={() => setReinit(true)}>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </div>

      <PanneauIdentite ouvert={identiteOuverte} onFermer={() => ouvrirIdentite(false)} />

      <AlertDialog open={reinit} onOpenChange={setReinit}>
        <AlertDialogContent className="font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Revenir au modèle de départ ?</AlertDialogTitle>
            <AlertDialogDescription>Tous vos textes, photos et couleurs seront remplacés par ceux du modèle.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={reinitialiser}>Tout remplacer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Ce qui apparaît partout sur le site : nom, logo, couleurs, coordonnées. */
function PanneauIdentite({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const { contenu, maj } = useEdition();
  const id = contenu.identite;
  const logo = useRef<HTMLInputElement>(null);
  const champ = (cle: keyof typeof id, libelle: string, placeholder = '') => (
    <div className="space-y-1.5">
      <Label htmlFor={`id-${cle}`}>{libelle}</Label>
      <Input id={`id-${cle}`} value={String(id[cle] ?? '')} placeholder={placeholder} onChange={e => maj(`identite.${cle}`, e.target.value)} />
    </div>
  );

  return (
    <Sheet open={ouvert} onOpenChange={o => !o && onFermer()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto font-sans">
        <SheetHeader>
          <SheetTitle>Identité &amp; couleurs</SheetTitle>
          <SheetDescription>Ces informations apparaissent sur toutes les pages. Les changements s'appliquent aussitôt.</SheetDescription>
        </SheetHeader>

        <div className="space-y-7 mt-6">
          <Groupe titre="École">
            {champ('nom', 'Nom de l\'école')}
            {champ('slogan', 'Devise ou slogan')}
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {id.logo ? <img src={id.logo} alt="" className="h-14 w-14 object-contain rounded-lg border" /> : <span className="h-14 w-14 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground">Aucun</span>}
                <input ref={logo} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  const r = new FileReader(); r.onload = () => maj('identite.logo', String(r.result)); r.readAsDataURL(f);
                }} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => logo.current?.click()}><ImagePlus className="h-3.5 w-3.5" />Choisir</Button>
                {id.logo && <Button variant="ghost" size="icon" aria-label="Retirer le logo" onClick={() => maj('identite.logo', '')}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </div>
          </Groupe>

          <Groupe titre="Couleurs et police">
            <div className="grid grid-cols-2 gap-3">
              <Couleur libelle="Couleur principale" valeur={id.couleur1} onChange={v => maj('identite.couleur1', v)} />
              <Couleur libelle="Couleur d'accent" valeur={id.couleur2} onChange={v => maj('identite.couleur2', v)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(POLICES) as [Police, (typeof POLICES)[Police]][]).map(([cle, p]) => (
                <button key={cle} type="button" onClick={() => maj('identite.police', cle)}
                  className={`rounded-xl border p-3 text-left transition-all ${id.police === cle ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}>
                  <span className="block text-xl font-bold" style={{ fontFamily: p.titres }}>Aa</span>
                  <span className="text-xs text-muted-foreground">{p.nom}</span>
                </button>
              ))}
            </div>
          </Groupe>

          <Groupe titre="Coordonnées">
            {champ('telephone', 'Téléphone')}
            {champ('email', 'E-mail')}
            {champ('adresse', 'Adresse (sert aussi au plan)')}
            {champ('horaires', 'Horaires', 'Lun – Ven : … · Sam : …')}
          </Groupe>

          <Groupe titre="WhatsApp">
            <p className="text-xs text-muted-foreground -mt-1">Un clic sur n'importe quel bouton WhatsApp du site ouvre une discussion avec ce numéro.</p>
            {champ('whatsapp', 'Numéro WhatsApp', '+221 7X XXX XX XX')}
            {champ('messageWhatsApp', 'Message déjà écrit pour le visiteur')}
          </Groupe>

          <Groupe titre="Réseaux sociaux">
            <p className="text-xs text-muted-foreground -mt-1">Collez l'adresse de chaque page. Les icônes apparaissent en haut, en bas et dans « Suivez-nous ».</p>
            {id.reseaux.map((r, i) => {
              const { Icone, couleur } = STYLE_RESEAU[r.type] ?? STYLE_RESEAU.site;
              const changer = (v: Partial<Reseau>) => maj('identite.reseaux', id.reseaux.map((x, j) => j === i ? { ...x, ...v } : x));
              return (
                <div key={i} className="rounded-xl border p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: couleur }}><Icone className="h-4 w-4" /></span>
                    <Select value={r.type} onValueChange={v => changer({ type: v as TypeReseau })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(TYPES_RESEAUX).map(([t, nom]) => <SelectItem key={t} value={t}>{nom}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" aria-label="Retirer ce réseau"
                      onClick={() => maj('identite.reseaux', id.reseaux.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <Input value={r.url} onChange={e => changer({ url: e.target.value })} placeholder="https://www.facebook.com/votre-ecole" />
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => maj('identite.reseaux', [...id.reseaux, { type: 'facebook', url: '' }])}>
              <Plus className="h-3.5 w-3.5" />Ajouter un réseau
            </Button>
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="text-sm">
                <span className="block font-medium">Afficher le fil Facebook</span>
                <span className="block text-xs text-muted-foreground">Vos dernières publications Facebook dans « Suivez-nous ».</span>
              </span>
              <Switch checked={id.filFacebook} onCheckedChange={v => maj('identite.filFacebook', v)} />
            </label>
          </Groupe>

          <Groupe titre="Bouton « Espace parents »">
            <div className="space-y-1.5">
              <Label>Texte</Label>
              <Input value={id.espaceParents.texte} onChange={e => maj('identite.espaceParents.texte', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Adresse du portail</Label>
              <Input value={id.espaceParents.lien} onChange={e => maj('identite.espaceParents.lien', e.target.value)} />
            </div>
          </Groupe>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titre}</p>
      {children}
    </div>
  );
}

function Couleur({ libelle, valeur, onChange }: { libelle: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{libelle}</span>
      <span className="flex items-center gap-2 rounded-lg border p-1.5">
        <input type="color" value={valeur} onChange={e => onChange(e.target.value)} className="h-8 w-10 rounded cursor-pointer bg-transparent" />
        <span className="text-xs uppercase text-muted-foreground">{valeur}</span>
      </span>
    </label>
  );
}
