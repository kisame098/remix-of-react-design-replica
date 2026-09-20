import { useEffect, useRef, useState } from 'react';
import type jsPDF from 'jspdf';
import { Download, Loader2, Printer, RefreshCw, TriangleAlert } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { imprimerPdf, telechargerPdf } from '@/lib/documentsEcole';
import { estUneErreurDeChargement } from '@/lib/rechargementApresDeploiement';

interface DocumentDialogProps {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  description?: string;
  /** Nom du fichier téléchargé, sans extension. */
  nomFichier: string;
  /** Fabrique le PDF. Rappelée à chaque ouverture ; jamais avant. */
  generer: () => Promise<jsPDF>;
}

/**
 * Un document prêt : aperçu, impression, téléchargement.
 *
 * Le PDF n'est fabriqué qu'à l'ouverture (jsPDF pèse lourd : les caissiers qui
 * n'impriment rien ne le chargent pas). L'aperçu intégré n'existe que sur grand
 * écran : la plupart des navigateurs mobiles n'affichent pas un PDF dans un
 * cadre — ils proposent alors seulement Imprimer et Télécharger, qui suffisent.
 */
export const DocumentDialog = ({
  ouvert, onFermer, titre, description, nomFichier, generer,
}: DocumentDialogProps) => {
  const [doc, setDoc] = useState<jsPDF | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  // Une nouvelle version a été installée pendant que cette page restait ouverte.
  const [nouvelleVersion, setNouvelleVersion] = useState(false);
  const genererRef = useRef(generer);
  genererRef.current = generer;

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    let url: string | null = null;
    setDoc(null); setApercu(null); setErreur(false); setNouvelleVersion(false);

    genererRef.current()
      .then(pdf => {
        if (annule) return;
        url = String(pdf.output('bloburl'));
        setDoc(pdf);
        setApercu(url);
      })
      .catch((e: unknown) => {
        if (annule) return;
        setErreur(true);
        setNouvelleVersion(estUneErreurDeChargement(e));
      });

    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ouvert]);

  const imprimer = () => {
    if (!doc) return;
    // Fenêtre bloquée par le navigateur : on télécharge plutôt que de ne rien faire.
    if (!imprimerPdf(doc)) {
      telechargerPdf(doc, nomFichier);
      toast({ title: 'Impression bloquée', description: 'Le PDF a été téléchargé : ouvrez-le pour l\'imprimer.' });
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o) onFermer(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="hidden md:block h-[60vh] rounded-lg border bg-muted/30 overflow-hidden">
          {apercu && <iframe title={titre} src={`${apercu}#toolbar=0&navpanes=0`} className="h-full w-full" />}
          {!apercu && !erreur && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        {!doc && !erreur && (
          <p className="md:hidden flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation du document…
          </p>
        )}
        {erreur && !nouvelleVersion && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" /> Le document n'a pas pu être généré. Réessayez.
          </p>
        )}
        {erreur && nouvelleVersion && (
          // La page n'est PAS rechargée d'office : l'utilisateur travaille peut-être
          // sur un formulaire. C'est à lui de choisir le moment.
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-semibold">Une nouvelle version de SenClass vient d'être installée.</strong>{' '}
                Pour générer ce document, la page doit être rechargée. Terminez et enregistrez ce que vous faites, puis rechargez.
              </span>
            </p>
            <Button size="sm" className="mt-3 gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Recharger la page
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onFermer}>Fermer</Button>
          <Button variant="outline" className="gap-2" disabled={!doc} onClick={() => doc && telechargerPdf(doc, nomFichier)}>
            <Download className="h-4 w-4" /> Télécharger
          </Button>
          <Button className="gap-2" disabled={!doc} onClick={imprimer}>
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
