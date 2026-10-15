import { useEffect, useState } from 'react';
import {
  Globe, Monitor, Smartphone, Palette, Plus, Pencil, ArrowUp, ArrowDown, Copy, Trash2,
  Image, AlignLeft, BarChart3, GraduationCap, Images, Phone, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RenduSite, { type Format } from './RenduSite';
import FenetreBloc from './FenetreBloc';
import { ECOLE_ESSAI } from './ecoleEssai';
import {
  TYPES_BLOCS, ajouterBloc, creerBloc, deplacerBloc, dupliquerBloc, modifierApparence, nomTypeBloc,
  remplacerBloc, resumeBloc, siteDeDepart, sousAdresse, supprimerBloc, type Apparence, type Site, type TypeBloc,
} from './modele';

const ICONES: Record<TypeBloc, React.ElementType> = {
  banniere: Image, presentation: AlignLeft, chiffres: BarChart3, formations: GraduationCap, galerie: Images, contact: Phone,
};

/** Labo : le site est gardé dans ce navigateur. L'étape 3 l'enregistrera dans Supabase. */
const CLE = 'labo.site-ecole';

function lire(): Site {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as Site;
  } catch { /* stockage indisponible ou abîmé : on repart du modèle */ }
  return siteDeDepart(ECOLE_ESSAI);
}

export default function Editeur() {
  const ecole = ECOLE_ESSAI;
  const [site, setSite] = useState<Site>(lire);
  const [selection, setSelection] = useState<string | null>(site.blocs[0]?.id ?? null);
  const [format, setFormat] = useState<Format>('ordinateur');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [apparence, setApparence] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [recommencer, setRecommencer] = useState(false);
  const [tropLourd, setTropLourd] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CLE, JSON.stringify(site)); setTropLourd(false); }
    catch { setTropLourd(true); }
  }, [site]);

  const choisir = (id: string) => {
    setSelection(id);
    document.querySelector(`[data-bloc="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const ajouter = (type: TypeBloc) => {
    const bloc = creerBloc(type, ecole);
    setSite(s => ajouterBloc(s, bloc, selection));
    setSelection(bloc.id);
    setAjout(false);
    // Un bloc à remplir s'ouvre aussitôt ; un bloc automatique est déjà complet.
    if (!TYPES_BLOCS.find(t => t.type === type)?.automatique) setOuvert(bloc.id);
  };

  const blocOuvert = site.blocs.find(b => b.id === ouvert) ?? null;
  const blocASupprimer = site.blocs.find(b => b.id === aSupprimer);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* En-tête */}
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0 flex-wrap">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Site web de l'école</h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Adresse prévue : <span className="font-medium text-foreground">{sousAdresse(ecole)}</span> · brouillon
          </p>
        </div>
        <div className="flex items-center rounded-lg border p-0.5">
          {([['ordinateur', Monitor, 'Aperçu ordinateur'], ['telephone', Smartphone, 'Aperçu téléphone']] as const).map(([f, Icone, titre]) => (
            <Button key={f} variant={format === f ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8"
              onClick={() => setFormat(f)} title={titre} aria-label={titre}>
              <Icone className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setApparence(true)}>
          <Palette className="h-3.5 w-3.5" />Apparence
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setRecommencer(true)}
          title="Repartir du modèle de départ" aria-label="Repartir du modèle de départ">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {tropLourd && (
        <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Photos trop lourdes pour le navigateur : le dernier changement ne sera pas gardé après rechargement (labo).
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Colonne : les blocs du site, dans l'ordre de la page */}
        <nav className="w-64 border-r flex-shrink-0 flex flex-col bg-muted/10">
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {site.blocs.map((bloc, i) => {
              const actif = bloc.id === selection;
              const Icone = ICONES[bloc.type];
              return (
                <div key={bloc.id}>
                  <button
                    onClick={() => choisir(bloc.id)}
                    onDoubleClick={() => setOuvert(bloc.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                      actif ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <Icone className={`h-4 w-4 flex-shrink-0 ${actif ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${actif ? 'text-primary-foreground' : ''}`}>{nomTypeBloc(bloc.type)}</p>
                      <p className={`text-xs truncate ${actif ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{resumeBloc(bloc)}</p>
                    </div>
                  </button>
                  {actif && (
                    <div className="flex items-center justify-end gap-0.5 px-1 pt-1">
                      <Action titre="Modifier" onClick={() => setOuvert(bloc.id)}><Pencil className="h-3.5 w-3.5" /></Action>
                      <Action titre="Monter" disabled={i === 0} onClick={() => setSite(s => deplacerBloc(s, bloc.id, -1))}><ArrowUp className="h-3.5 w-3.5" /></Action>
                      <Action titre="Descendre" disabled={i === site.blocs.length - 1} onClick={() => setSite(s => deplacerBloc(s, bloc.id, 1))}><ArrowDown className="h-3.5 w-3.5" /></Action>
                      <Action titre="Dupliquer" onClick={() => setSite(s => dupliquerBloc(s, bloc.id))}><Copy className="h-3.5 w-3.5" /></Action>
                      <Action titre="Supprimer" onClick={() => setASupprimer(bloc.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Action>
                    </div>
                  )}
                </div>
              );
            })}
            {site.blocs.length === 0 && <p className="text-sm text-muted-foreground p-3">Le site est vide.</p>}
          </div>
          <div className="p-3 border-t">
            <Button className="w-full gap-1.5" onClick={() => setAjout(true)}>
              <Plus className="h-4 w-4" />Ajouter un bloc
            </Button>
          </div>
        </nav>

        {/* Aperçu */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-muted/30 p-6">
          <div className={`mx-auto rounded-xl border shadow-sm overflow-hidden transition-all ${format === 'telephone' ? 'max-w-[390px]' : 'max-w-6xl'}`}>
            <RenduSite
              site={site} ecole={ecole} format={format} selection={selection}
              onSelectionner={setSelection} onOuvrir={setOuvert}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">Cliquez sur un bloc pour le choisir, double-cliquez pour le modifier.</p>
        </div>
      </div>

      <FenetreBloc
        bloc={blocOuvert} ecole={ecole} onFermer={() => setOuvert(null)}
        onEnregistrer={b => { setSite(s => remplacerBloc(s, b)); setOuvert(null); }}
      />

      {/* Ajouter un bloc : un bloc (carte) par type */}
      <Dialog open={ajout} onOpenChange={setAjout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un bloc</DialogTitle>
            <DialogDescription>{selection ? 'Il sera placé sous le bloc choisi.' : 'Il sera placé en fin de page.'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {TYPES_BLOCS.map(t => {
              const Icone = ICONES[t.type];
              return (
                <button key={t.type} onClick={() => ajouter(t.type)}
                  className="text-left rounded-xl border p-4 hover:border-primary hover:shadow-sm transition-all flex gap-3">
                  <span className="p-2.5 rounded-xl bg-primary/10 h-fit"><Icone className="h-5 w-5 text-primary" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-sm">
                      {t.nom}{t.automatique && <Badge variant="secondary" className="text-[10px]">Automatique</Badge>}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <FenetreApparence
        ouvert={apparence} valeur={site.apparence} onFermer={() => setApparence(false)}
        onEnregistrer={a => { setSite(s => modifierApparence(s, a)); setApparence(false); }}
      />

      <AlertDialog open={!!aSupprimer} onOpenChange={o => !o && setASupprimer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le bloc « {blocASupprimer && nomTypeBloc(blocASupprimer.type)} » ?</AlertDialogTitle>
            <AlertDialogDescription>Son contenu ({blocASupprimer && resumeBloc(blocASupprimer)}) disparaîtra du site.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setSite(s => supprimerBloc(s, aSupprimer!)); setSelection(null); setASupprimer(null); }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={recommencer} onOpenChange={setRecommencer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repartir du modèle de départ ?</AlertDialogTitle>
            <AlertDialogDescription>Tous les blocs et textes actuels seront remplacés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const s = siteDeDepart(ecole); setSite(s); setSelection(s.blocs[0].id); }}>
              Repartir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Action({ titre, onClick, disabled, children }: { titre: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" title={titre} aria-label={titre} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

/** Réglage du module, ouvert depuis son en-tête : couleur principale et police. */
function FenetreApparence({ ouvert, valeur, onFermer, onEnregistrer }: {
  ouvert: boolean; valeur: Apparence; onFermer: () => void; onEnregistrer: (a: Apparence) => void;
}) {
  const [brouillon, setBrouillon] = useState(valeur);
  useEffect(() => { if (ouvert) setBrouillon(valeur); }, [ouvert, valeur]);

  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apparence du site</DialogTitle>
          <DialogDescription>S'applique à tout le site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="couleur">Couleur principale</Label>
            <div className="flex items-center gap-3">
              <input id="couleur" type="color" value={brouillon.couleur}
                onChange={e => setBrouillon(b => ({ ...b, couleur: e.target.value }))}
                className="h-10 w-16 rounded-lg border cursor-pointer bg-transparent" />
              <span className="text-sm text-muted-foreground uppercase">{brouillon.couleur}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Police</Label>
            <div className="grid grid-cols-2 gap-2">
              {([['moderne', 'Moderne', "'Inter', sans-serif"], ['classique', 'Classique', 'Georgia, serif']] as const).map(([p, nom, famille]) => (
                <button key={p} onClick={() => setBrouillon(b => ({ ...b, police: p }))}
                  className={`rounded-xl border p-3 text-left transition-all ${brouillon.police === p ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}>
                  <span className="block text-lg" style={{ fontFamily: famille }}>Aa</span>
                  <span className="text-xs text-muted-foreground">{nom}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={() => onEnregistrer(brouillon)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
