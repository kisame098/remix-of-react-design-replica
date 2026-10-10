import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, FileUp, Loader2, PenSquare, TriangleAlert } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { CHAMPS, LIBELLES_GROUPE_CHAMP, type GroupeChamp } from '@/lib/modelesDocuments';
import { TAILLE_MAX_WORD, verifierWord, versBase64, depuisBase64, type VerificationWord } from '@/lib/modeleWord';

const GROUPES = Object.keys(LIBELLES_GROUPE_CHAMP) as GroupeChamp[];

interface ImportWordProps {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  /** Modèle existant : on peut le renommer ou remplacer son fichier. */
  initial?: { nom: string; fichier: string };
  onEnregistrer: (nom: string, fichierBase64: string) => Promise<void>;
  /** Ouvrir ce Word dans l'éditeur des pages pour le modifier (logo, texte…). */
  onOuvrirEditeur: (nom: string, fichierBase64: string) => void;
}

/**
 * Importer un modèle Word : l'école écrit ses champs entre accolades dans
 * Word, envoie le .docx, et voit tout de suite si un champ est inconnu.
 */
export const ImportWord = ({ ouvert, onFermer, titre, initial, onEnregistrer, onOuvrirEditeur }: ImportWordProps) => {
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [fichier, setFichier] = useState<string | null>(initial?.fichier ?? null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const entree = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    setNom(initial?.nom ?? '');
    setFichier(initial?.fichier ?? null);
    setNomFichier(null);
    if (!initial) window.setTimeout(() => entree.current?.click(), 50);
  }, [ouvert, initial]);

  const verification: VerificationWord | null = useMemo(() => (fichier ? verifierWord(depuisBase64(fichier)) : null), [fichier]);

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > TAILLE_MAX_WORD) { toast({ title: 'Fichier trop lourd', description: 'Un modèle Word ne peut pas dépasser 5 Mo.', variant: 'destructive' }); return; }
    setFichier(versBase64(await f.arrayBuffer()));
    setNomFichier(f.name);
    if (!nom.trim()) setNom(f.name.replace(/\.docx?$/i, ''));
  };

  const copier = async (champ: string) => {
    try { await navigator.clipboard.writeText(`{${champ}}`); toast({ title: 'Copié', description: `{${champ}} — collez-le dans Word.` }); } catch { /* presse-papiers refusé : rien */ }
  };

  const enregistrer = async () => {
    if (!fichier) return;
    setEnCours(true);
    try {
      await onEnregistrer(nom, fichier);
      onFermer();
    } catch (e) {
      toast({ title: "Le modèle n'est pas enregistré", description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o) onFermer(); }}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            Dans Word, écrivez les informations de l'élève entre accolades, par exemple {'{NOM ET PRÉNOM DE L\'ÉLÈVE}'}.
            Votre fichier est gardé tel quel : SenClass remplit seulement ces champs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48 space-y-1">
              <Label htmlFor="nom-word">Nom du modèle</Label>
              <Input id="nom-word" value={nom} maxLength={120} onChange={e => setNom(e.target.value)} placeholder="Certificat de scolarité" />
            </div>
            <Button type="button" variant="outline" onClick={() => entree.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" />{fichier ? 'Remplacer le fichier Word' : 'Choisir le fichier Word'}
            </Button>
            <input ref={entree} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
              data-testid="fichier-word" onChange={e => { void choisir(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {nomFichier && <p className="text-xs text-muted-foreground">Fichier : {nomFichier}</p>}

          {verification && (
            verification.erreur ? (
              <p className="flex items-start gap-2 text-sm text-destructive"><TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />{verification.erreur}</p>
            ) : verification.ok ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />Modèle valide — {verification.utilises.length} champ{verification.utilises.length > 1 ? 's' : ''} trouvé{verification.utilises.length > 1 ? 's' : ''}.
              </p>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive space-y-1">
                {verification.inconnus.length > 0 && (
                  <>
                    <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" />Champs inconnus de SenClass — modèle refusé :</p>
                    <ul className="ml-6 list-disc">{verification.inconnus.map(c => <li key={c} className="font-mono text-xs">{`{${c}}`}</li>)}</ul>
                    <p className="text-xs">Corrigez-les dans Word, ou écrivez le texte sans accolades s'il ne change pas d'un élève à l'autre, puis réimportez le fichier.</p>
                  </>
                )}
                {verification.images.length > 0 && (
                  <p className="text-xs">Le logo ne peut pas être un champ dans un Word : insérez directement l'image du logo dans votre fichier.</p>
                )}
              </div>
            )
          )}

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Champs disponibles <span className="font-normal text-muted-foreground">— cliquez pour copier, puis collez dans Word</span></p>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {GROUPES.map(g => (
                <div key={g}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{LIBELLES_GROUPE_CHAMP[g]}</p>
                  <div className="flex flex-wrap gap-1">
                    {CHAMPS.filter(c => c.groupe === g && !c.image).map(c => (
                      <button key={c.nom} type="button" title={c.source} onClick={() => copier(c.nom)}
                        className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono hover:bg-primary/10 hover:border-primary/40">
                        {`{${c.nom}}`}<Copy className="h-3 w-3 opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button variant="outline" onClick={() => fichier && onOuvrirEditeur(nom, fichier)} disabled={!fichier || !!verification?.erreur || enCours}>
            <PenSquare className="h-4 w-4 mr-2" />Modifier dans l'éditeur
          </Button>
          <Button onClick={enregistrer} disabled={!fichier || !verification?.ok || !nom.trim() || enCours}>
            {enCours && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer le modèle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
