import { useRef, useState } from 'react';
import { ExternalLink, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// Un fichier joint (contrat, lettre, pièce, rapport) dans l'espace privé de
// l'école : l'ouvrir, le remplacer, le retirer. Enregistré aussitôt.

const nomFichier = (chemin: string) => chemin.split('/').pop()?.replace(/-[a-z0-9]{6,}(\.[a-z0-9]+)?$/, '$1') ?? chemin;

/** Un fichier joint : ouvrir, retirer, ou en joindre un. Enregistré aussitôt. */
export const FichierJoint = ({ dossierId, chemin, onChange, libelle }: {
  dossierId: string; chemin?: string; onChange: (chemin: string | undefined) => Promise<void>; libelle: string;
}) => {
  const { televerser, lienFichier, supprimerFichier } = useFinancements();
  const entree = useRef<HTMLInputElement>(null);
  const [occupe, setOccupe] = useState(false);
  const erreur = (titre: string, e: unknown) => toast({ title: titre, description: (e as { message?: string })?.message ?? String(e), variant: 'destructive' });

  const joindre = async (f: File | undefined) => {
    if (!f) return;
    setOccupe(true);
    try {
      const nouveau = await televerser(dossierId, f);
      await onChange(nouveau);
      // L'ancien fichier, remplacé, ne sert plus.
      if (chemin) await supprimerFichier(chemin).catch(() => undefined);
    } catch (e) { erreur('Fichier non joint', e); } finally { setOccupe(false); }
  };
  const ouvrir = async () => {
    if (!chemin) return;
    // Fenêtre ouverte AVANT l'attente : sinon le navigateur la bloque.
    const fenetre = window.open('', '_blank');
    try {
      const lien = await lienFichier(chemin);
      if (fenetre) fenetre.location.href = lien; else window.location.assign(lien);
    } catch (e) { fenetre?.close(); erreur('Fichier introuvable', e); }
  };
  const retirer = async () => {
    if (!chemin) return;
    setOccupe(true);
    try { await onChange(undefined); await supprimerFichier(chemin).catch(() => undefined); }
    catch (e) { erreur('Fichier non retiré', e); } finally { setOccupe(false); }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <input ref={entree} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        onChange={e => { void joindre(e.target.files?.[0]); e.target.value = ''; }} />
      {chemin ? (
        <>
          <button type="button" onClick={() => void ouvrir()} className="text-xs text-primary hover:underline flex items-center gap-1 min-w-0" title={`Ouvrir ${libelle}`}>
            <FileText className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate max-w-[160px]">{nomFichier(chemin)}</span><ExternalLink className="h-3 w-3 flex-shrink-0" />
          </button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={occupe} onClick={() => void retirer()} aria-label={`Retirer le fichier : ${libelle}`}>
            {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={occupe} onClick={() => entree.current?.click()} aria-label={`Joindre un fichier : ${libelle}`}>
          {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Joindre
        </Button>
      )}
    </div>
  );
};

