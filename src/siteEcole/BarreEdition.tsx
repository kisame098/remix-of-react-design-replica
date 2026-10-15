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
import { MODELES_SITE, POLICES, TYPES_RESEAUX, type ModeleSite, type Police, type Reseau, type TypeReseau } from './contenu';
import { POLICES_TERANGA } from './themes/teranga/GabaritTeranga';
import { POLICES_PRESTIGE } from './themes/prestige/GabaritPrestige';
import { POLICES_CAMPUS } from './themes/campus/GabaritCampus';
import { POLICES_BAOBAB } from './themes/baobab/GabaritBaobab';
import { STYLE_RESEAU } from './reseaux';
import { useEdition } from './edition';

/** Barre flottante, au style SenClass : bascule du mode modification et réglages du site. */
export default function BarreEdition({ actions }: { actions?: React.ReactNode }) {
  const { edition, setEdition, alerte, reinitialiser, identiteOuverte, ouvrirIdentite } = useEdition();
  const [reinit, setReinit] = useState(false);

  return (
    <>
      {edition && (
        <div className="fixed top-0 inset-x-0 z-[45] bg-[#F59E0B] text-gray-900 text-sm font-medium text-center py-1.5 px-4 font-sans">
          Mode modification : cliquez sur un texte pour l'écrire · survolez un élément ou une section pour le glisser, le dupliquer ou le retirer.
        </div>
      )}
      {alerte && (
        <div className="fixed top-9 left-1/2 -translate-x-1/2 z-[45] bg-red-600 text-white text-sm rounded-lg px-4 py-2 flex items-center gap-2 font-sans shadow-lg">
          <AlertTriangle className="h-4 w-4" />{alerte}
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
          {actions && <><span className="h-6 w-px bg-border mx-0.5" />{actions}</>}
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
  const { contenu, maj, televerser } = useEdition();
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
          <Groupe titre="Modèle du site">
            <p className="text-xs text-muted-foreground -mt-1">Changez de modèle à tout moment : vos textes, photos et actualités sont conservés.</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MODELES_SITE) as [ModeleSite, (typeof MODELES_SITE)[ModeleSite]][]).map(([cle, m]) => (
                <button key={cle} type="button" onClick={() => maj('identite.modele', cle)}
                  className={`rounded-xl border p-2 text-left transition-all ${id.modele === cle ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`}>
                  <MiniatureModele modele={cle} />
                  <span className="block font-semibold text-sm mt-2">{m.nom}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{m.description}</span>
                </button>
              ))}
            </div>
            {(id.couleur1 !== MODELES_SITE[id.modele].couleurs[0] || id.couleur2 !== MODELES_SITE[id.modele].couleurs[1]) && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { maj('identite.couleur1', MODELES_SITE[id.modele].couleurs[0]); maj('identite.couleur2', MODELES_SITE[id.modele].couleurs[1]); }}>
                <span className="flex">{MODELES_SITE[id.modele].couleurs.map(c => <span key={c} className="h-4 w-4 rounded-full border-2 border-white -ml-1 first:ml-0" style={{ background: c }} />)}</span>
                Prendre les couleurs conseillées pour {MODELES_SITE[id.modele].nom}
              </Button>
            )}
          </Groupe>

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
                  void televerser(f).then(src => maj('identite.logo', src));
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
              {(Object.entries(id.modele === 'teranga' ? POLICES_TERANGA : id.modele === 'prestige' ? POLICES_PRESTIGE : id.modele === 'campus' ? POLICES_CAMPUS : id.modele === 'baobab' ? POLICES_BAOBAB : POLICES) as [Police, { nom: string; titres: string }][]).map(([cle, p]) => (
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

/** Petit aperçu dessiné de chaque modèle, pour choisir d'un coup d'œil. */
function MiniatureModele({ modele }: { modele: ModeleSite }) {
  if (modele === 'baobab') {
    return (
      <span className="block h-24 rounded-lg overflow-hidden bg-white relative border">
        <span className="absolute right-0 inset-y-0 w-[45%] bg-[#F3F7F4] rounded-bl-2xl" />
        <span className="absolute left-2 top-5 space-y-1">
          <span className="block h-2 w-14 rounded bg-[#0D1F19]" /><span className="block h-2 w-9 rounded bg-[#0F5C45]" />
          <span className="block h-0.5 w-9 rounded bg-[#FF7A3D]" /><span className="block h-3 w-14 rounded-md bg-white border mt-2" />
        </span>
        <span className="absolute right-2 top-3 h-11 w-10 rounded-lg bg-[#0F5C45]/70" />
        <span className="absolute right-8 top-9 h-7 w-7 rounded-md bg-[#FF7A3D]/80 ring-2 ring-white" />
        <span className="absolute right-3 bottom-2 h-6 w-9 rounded-md bg-[#0F5C45] ring-2 ring-white" />
      </span>
    );
  }
  if (modele === 'campus') {
    return (
      <span className="block h-24 rounded-lg overflow-hidden relative" style={{ background: 'linear-gradient(180deg,#06213d,#0B3A66 45%,#6fa3d8)' }}>
        <span className="absolute inset-x-0 top-3 text-center text-[19px] font-extrabold tracking-tight text-white/40" style={{ fontFamily: 'Bitter, serif' }}>ÉCOLE</span>
        <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0A1A33] to-[#2b5a8a]/40" />
        <span className="absolute left-2 bottom-2.5 space-y-1"><span className="block h-1.5 w-14 rounded bg-white" /><span className="block h-2.5 w-9 rounded-full bg-[#F9C23C]" /></span>
        <span className="absolute right-2 bottom-2 h-6 w-6 rounded-full border border-white/70" />
      </span>
    );
  }
  if (modele === 'prestige') {
    return (
      <span className="block h-24 rounded-lg overflow-hidden bg-[#0E1525] relative">
        <span className="absolute inset-0 bg-gradient-to-t from-[#0E1525] to-[#33415c]" />
        <span className="absolute left-2 top-2 h-3.5 w-3 bg-[#0F1E3D] border border-[#B08D57]" style={{ clipPath: 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)' }} />
        <span className="absolute left-2.5 bottom-3 space-y-1">
          <span className="block h-px w-4 bg-[#B08D57]" />
          <span className="block h-2 w-16 bg-white/90" /><span className="block h-2 w-12 bg-white/90" />
          <span className="block h-2 w-6 bg-[#B08D57] mt-1.5" />
        </span>
      </span>
    );
  }
  if (modele === 'teranga') {
    return (
      <span className="block h-24 rounded-lg overflow-hidden bg-[#FAF6EF] p-1.5 relative">
        <span className="block h-3 rounded-full bg-white border border-black/5 mx-2" />
        <span className="absolute left-3 top-7 space-y-1">
          <span className="block h-2.5 w-14 rounded bg-[#1C1917]" /><span className="block h-2.5 w-10 rounded bg-[#1C1917]" />
          <span className="block h-2 w-8 rounded-full bg-[#B4441C] mt-2" />
        </span>
        <span className="absolute right-3 top-6 h-14 w-11 rounded-t-full rounded-b-md bg-[#0E5E5A]" />
        <span className="absolute right-1.5 bottom-2 h-6 w-6 rounded-full bg-[#B4441C]" />
      </span>
    );
  }
  return (
    <span className="block h-24 rounded-lg overflow-hidden bg-white relative">
      <span className="block h-2 bg-[#0B5D3B]" />
      <span className="block h-3 bg-white border-b" />
      <span className="block h-12 bg-gradient-to-r from-gray-800 to-gray-500 relative">
        <span className="absolute left-2 top-3 space-y-1"><span className="block h-2 w-14 rounded bg-white" /><span className="block h-1.5 w-8 rounded bg-[#E8A317]" /></span>
      </span>
      <span className="absolute left-2 right-2 bottom-2 h-5 rounded bg-white shadow flex justify-around items-center">
        {[0, 1, 2].map(k => <span key={k} className="h-1.5 w-5 rounded bg-[#0B5D3B]" />)}
      </span>
    </span>
  );
}
