import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ApercuHtml } from '@/components/documents/ApercuHtml';
import {
  CHAMPS, LIBELLES_GROUPE_CHAMP, TAILLE_MAX_MODELE, documentPret, verifierModele,
  type ContexteDocument, type GroupeChamp,
} from '@/lib/modelesDocuments';

const GROUPES = Object.keys(LIBELLES_GROUPE_CHAMP) as GroupeChamp[];

/** Le nom du modèle d'après le fichier : son <title>, sinon le nom du fichier. */
const nomDepuisFichier = (html: string, nomFichier: string): string => {
  const titre = new DOMParser().parseFromString(html, 'text/html').title.trim();
  return titre || nomFichier.replace(/\.html?$/i, '');
};

interface EditeurModeleProps {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  initial: { nom: string; html: string };
  /** Ouvre directement le choix d'un fichier HTML. */
  importerAuDemarrage?: boolean;
  /** Données d'EXEMPLE pour l'aperçu (jamais un vrai élève). */
  exemple: ContexteDocument;
  onEnregistrer: (nom: string, html: string) => Promise<void>;
}

/**
 * Écrire ou importer un modèle. La vérification tourne en direct : un champ
 * inconnu de SenClass empêche d'enregistrer, et l'école voit lequel.
 */
export const EditeurModele = ({
  ouvert, onFermer, titre, initial, importerAuDemarrage, exemple, onEnregistrer,
}: EditeurModeleProps) => {
  const [nom, setNom] = useState(initial.nom);
  const [html, setHtml] = useState(initial.html);
  const [enCours, setEnCours] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    setNom(initial.nom);
    setHtml(initial.html);
    if (importerAuDemarrage) window.setTimeout(() => fichier.current?.click(), 50);
  }, [ouvert, initial, importerAuDemarrage]);

  const htmlDiffere = useDeferredValue(html);
  const verification = useMemo(() => verifierModele(htmlDiffere), [htmlDiffere]);
  const apercu = useMemo(
    () => (verification.ok ? documentPret(htmlDiffere, exemple) : ''),
    [verification.ok, htmlDiffere, exemple],
  );

  const importer = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > TAILLE_MAX_MODELE) {
      toast({ title: 'Fichier trop lourd', description: 'Un modèle ne peut pas dépasser 1 Mo.', variant: 'destructive' });
      return;
    }
    const texte = await f.text();
    setHtml(texte);
    if (!nom.trim()) setNom(nomDepuisFichier(texte, f.name));
  };

  /** Insère [CHAMP] là où se trouve le curseur dans le HTML. */
  const inserer = (champ: string) => {
    const el = zone.current;
    const morceau = `[${champ}]`;
    if (!el) { setHtml(h => h + morceau); return; }
    const debut = el.selectionStart ?? html.length;
    const fin = el.selectionEnd ?? debut;
    setHtml(html.slice(0, debut) + morceau + html.slice(fin));
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(debut + morceau.length, debut + morceau.length);
    });
  };

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await onEnregistrer(nom, html);
      onFermer();
    } catch (e) {
      toast({ title: "Le modèle n'est pas enregistré", description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  const peutEnregistrer = verification.ok && nom.trim() !== '' && !enCours && html === htmlDiffere;

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o) onFermer(); }}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            Écrivez le document en HTML. Les informations de chaque élève s'écrivent entre crochets, par exemple
            {' '}<code className="text-xs">[NOM ET PRÉNOM DE L'ÉLÈVE]</code>. Ce qui ne change jamais (dénomination,
            second téléphone…) s'écrit directement dans le texte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-48 space-y-1">
                <Label htmlFor="nom-modele">Nom du modèle</Label>
                <Input id="nom-modele" value={nom} maxLength={120} onChange={e => setNom(e.target.value)} placeholder="Certificat de scolarité" />
              </div>
              <Button type="button" variant="outline" onClick={() => fichier.current?.click()}>
                <FileUp className="h-4 w-4 mr-2" /> Importer un fichier HTML
              </Button>
              <input
                ref={fichier} type="file" accept=".html,.htm,text/html" className="hidden"
                data-testid="fichier-modele"
                onChange={e => { void importer(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="html-modele">HTML</Label>
              <Textarea
                id="html-modele" ref={zone} value={html} onChange={e => setHtml(e.target.value)} spellCheck={false}
                className="font-mono text-xs h-72 resize-y"
              />
            </div>

            <Verification verification={verification} />

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Champs disponibles <span className="font-normal text-muted-foreground">— cliquez pour l'insérer à l'endroit du curseur</span></p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {GROUPES.map(g => (
                  <div key={g}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{LIBELLES_GROUPE_CHAMP[g]}</p>
                    <div className="flex flex-wrap gap-1">
                      {CHAMPS.filter(c => c.groupe === g).map(c => (
                        <button
                          key={c.nom} type="button" title={c.source} onClick={() => inserer(c.nom)}
                          className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono hover:bg-primary/10 hover:border-primary/40"
                        >
                          [{c.nom}]
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <p className="text-sm font-medium">Aperçu</p>
            <p className="text-xs rounded-md bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1">
              Aperçu rempli avec un élève <strong>d'exemple</strong> ({exemple.eleve.prenom} {exemple.eleve.nom}) — ce n'est pas un vrai élève.
              Les informations de l'école sont les vôtres.
            </p>
            {apercu
              ? <ApercuHtml html={apercu} titre="Aperçu du modèle" />
              : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">L'aperçu s'affiche quand le modèle est valide.</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={!peutEnregistrer}>
            {enCours && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer le modèle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Verification = ({ verification: v }: { verification: ReturnType<typeof verifierModele> }) => {
  if (v.erreur) {
    return <p className="flex items-start gap-2 text-sm text-destructive"><TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />{v.erreur}</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      {v.inconnus.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
          <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> Champs inconnus de SenClass — modèle refusé :</p>
          <ul className="mt-1 ml-6 list-disc">{v.inconnus.map(c => <li key={c} className="font-mono text-xs">[{c}]</li>)}</ul>
          <p className="mt-1 text-xs">Remplacez-les par un champ de la liste ci-dessous, ou écrivez le texte en clair s'il ne change pas d'un élève à l'autre.</p>
        </div>
      )}
      {v.imagesMalPlacees.length > 0 && (
        <p className="flex items-start gap-2 text-destructive">
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          Le logo s'écrit dans une image : <code className="text-xs">&lt;img src="[LOGO DE L'ÉTABLISSEMENT]"&gt;</code>
        </p>
      )}
      {v.ok && (
        <p className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Modèle valide{v.utilises.length > 0 ? ` — ${v.utilises.length} champ${v.utilises.length > 1 ? 's' : ''} utilisé${v.utilises.length > 1 ? 's' : ''}` : ''}.
        </p>
      )}
      {v.retraits.length > 0 && (
        <p className="flex items-start gap-2 text-amber-800 text-xs">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          Par sécurité, ces éléments seront ignorés à l'impression : {v.retraits.join(', ')}.
        </p>
      )}
    </div>
  );
};
