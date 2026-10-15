import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { nomTypeBloc, type Bloc, type InfosEcole } from './modele';

interface Props {
  bloc: Bloc | null;
  ecole: InfosEcole;
  onFermer: () => void;
  onEnregistrer: (bloc: Bloc) => void;
}

/** Une fenêtre = un bloc. Le brouillon n'arrive sur le site qu'à « Enregistrer ». */
export default function FenetreBloc({ bloc, ecole, onFermer, onEnregistrer }: Props) {
  const [brouillon, setBrouillon] = useState<Bloc | null>(bloc);
  useEffect(() => setBrouillon(bloc), [bloc]);
  if (!brouillon) return null;

  const maj = (changes: Partial<Bloc>) => setBrouillon(b => ({ ...b!, ...changes }) as Bloc);

  return (
    <Dialog open={!!bloc} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nomTypeBloc(brouillon.type)}</DialogTitle>
          <DialogDescription>Les changements apparaissent sur l'aperçu après « Enregistrer ».</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Champ label="Titre">
            <Input value={brouillon.titre} onChange={e => maj({ titre: e.target.value })} />
          </Champ>

          {brouillon.type === 'banniere' && (
            <>
              <Champ label="Sous-titre">
                <Input value={brouillon.sousTitre} onChange={e => maj({ sousTitre: e.target.value })} />
              </Champ>
              <ChampImage valeur={brouillon.image} onChange={image => maj({ image })} />
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Texte du bouton">
                  <Input value={brouillon.boutonTexte} onChange={e => maj({ boutonTexte: e.target.value })} placeholder="Vide = pas de bouton" />
                </Champ>
                <Champ label="Le bouton mène à">
                  <Input value={brouillon.boutonLien} onChange={e => maj({ boutonLien: e.target.value })} placeholder="#contact" />
                </Champ>
              </div>
            </>
          )}

          {brouillon.type === 'presentation' && (
            <>
              <Champ label="Texte">
                <Textarea rows={6} value={brouillon.texte} onChange={e => maj({ texte: e.target.value })}
                  placeholder="Histoire, valeurs, projet pédagogique…" />
              </Champ>
              <ChampImage valeur={brouillon.image} onChange={image => maj({ image })} />
            </>
          )}

          {brouillon.type === 'chiffres' && (
            <div className="space-y-2">
              <Label>Chiffres</Label>
              {brouillon.elements.map((el, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-28" value={el.valeur} placeholder="450"
                    onChange={e => maj({ elements: brouillon.elements.map((x, j) => j === i ? { ...x, valeur: e.target.value } : x) })} />
                  <Input className="flex-1" value={el.libelle} placeholder="élèves"
                    onChange={e => maj({ elements: brouillon.elements.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x) })} />
                  <Button variant="ghost" size="icon" aria-label="Retirer ce chiffre"
                    onClick={() => maj({ elements: brouillon.elements.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => maj({ elements: [...brouillon.elements, { valeur: '', libelle: '' }] })}>
                <Plus className="h-3.5 w-3.5" />Ajouter un chiffre
              </Button>
            </div>
          )}

          {brouillon.type === 'galerie' && (
            <div className="space-y-2">
              <Label>Photos</Label>
              <div className="grid grid-cols-3 gap-2">
                {brouillon.images.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="rounded-lg aspect-square object-cover w-full" />
                    <button type="button" aria-label="Retirer cette photo"
                      onClick={() => maj({ images: brouillon.images.filter((_, j) => j !== i) })}
                      className="absolute top-1 right-1 p-1 rounded-md bg-background/90 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <ChoixFichier onImage={src => maj({ images: [...brouillon.images, src] })} />
            </div>
          )}

          {(brouillon.type === 'formations' || brouillon.type === 'contact') && (
            <>
              <Champ label="Phrase d'introduction (facultative)">
                <Textarea rows={2} value={brouillon.intro} onChange={e => maj({ intro: e.target.value })} />
              </Champ>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
                <p className="flex items-center gap-1.5 font-medium"><Sparkles className="h-4 w-4 text-primary" />Repris automatiquement de SenClass</p>
                <p className="text-muted-foreground">
                  {brouillon.type === 'formations'
                    ? ecole.formations.map(f => f.nom).join(', ')
                    : [ecole.ville, ecole.telephone, ecole.email].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">Pour les changer, modifiez-les dans SenClass : le site suit tout seul.</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={() => onEnregistrer(brouillon)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ChampImage({ valeur, onChange }: { valeur: string; onChange: (src: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Photo</Label>
      {valeur ? (
        <div className="flex items-center gap-3">
          <img src={valeur} alt="" className="h-16 w-24 rounded-lg object-cover border" />
          <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => onChange('')}>
            <Trash2 className="h-3.5 w-3.5" />Retirer
          </Button>
        </div>
      ) : <ChoixFichier onImage={onChange} />}
    </div>
  );
}

/**
 * Labo : la photo est gardée dans le navigateur (image encodée). L'étape 2 la
 * déposera dans le stockage Supabase et ne gardera que son adresse.
 */
function ChoixFichier({ onImage }: { onImage: (src: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const lecteur = new FileReader();
          lecteur.onload = () => onImage(String(lecteur.result));
          lecteur.readAsDataURL(f);
        }} />
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => ref.current?.click()}>
        <ImagePlus className="h-3.5 w-3.5" />Choisir une photo
      </Button>
    </>
  );
}
