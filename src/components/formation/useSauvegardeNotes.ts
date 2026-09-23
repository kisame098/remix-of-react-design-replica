import { useCallback, useEffect, useRef, useState } from 'react';
import { type SaisieNote, type StatutNote } from '@/lib/formationPro';
import { toast } from '@/hooks/use-toast';

export type EtatSauvegarde = 'idle' | 'saving' | 'saved' | 'error';

interface CaseEnAttente { evaluationId: string; studentId: string; bareme: number; texte: string }

/** Où et comment enregistrer — fourni par la page (évaluations ou examens). */
export interface ActionsSauvegarde {
  enregistrer: (colonneId: string, studentId: string, data: { valeur?: number; statut: StatutNote }) => Promise<void>;
  supprimer: (colonneId: string, studentId: string) => Promise<void>;
  /** Lit une case : chaque module a ses statuts permis (pas de « NE » à un examen). */
  analyser: (texte: string, bareme: number) => SaisieNote;
}

export const cleCase = (evaluationId: string, studentId: string) => `${evaluationId}|${studentId}`;

/**
 * Sauvegarde automatique des cases de la grille (800 ms après la dernière
 * frappe, comme Saisie des Notes du système classique).
 *
 * Elle vit au niveau de la PAGE, pas de la grille, et range ce qui attend
 * par case (évaluation × élève) : changer de matière, de période ou partir
 * vers le récapitulatif n'efface plus rien — l'ancienne version vidait la
 * liste des cases à enregistrer dès qu'on changeait d'évaluation, et la
 * dernière note tapée se perdait. Au démontage, ce qui attend part tout de
 * suite au lieu d'être abandonné.
 *
 * Sert aux évaluations comme aux examens : `evaluationId` désigne la colonne
 * (une évaluation, ou une épreuve d'examen).
 */
export const useSauvegardeNotes = (fournies: ActionsSauvegarde) => {
  const actions = useRef(fournies);
  actions.current = fournies;

  /** Ce qui est tapé mais pas encore confirmé par la base (clé : cleCase). */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<EtatSauvegarde>('idle');
  const enAttente = useRef(new Map<string, CaseEnAttente>());
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Un lot à la fois : deux lots en parallèle pourraient créer deux fois la même note.
  const chaine = useRef<Promise<void>>(Promise.resolve());

  const envoyer = useCallback((): Promise<void> => {
    if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; }
    const lot = [...enAttente.current.entries()];
    enAttente.current.clear();
    if (lot.length === 0) return chaine.current;
    chaine.current = chaine.current.then(async () => {
      let echecs = 0;
      for (const [cle, c] of lot) {
        const saisie = actions.current.analyser(c.texte, c.bareme);
        try {
          if (saisie.kind === 'invalide') continue;
          if (saisie.kind === 'vide') await actions.current.supprimer(c.evaluationId, c.studentId);
          else if (saisie.kind === 'note') await actions.current.enregistrer(c.evaluationId, c.studentId, { valeur: saisie.valeur, statut: 'note' });
          else await actions.current.enregistrer(c.evaluationId, c.studentId, { statut: saisie.statut });
          // La base fait foi : le brouillon disparaît, sauf si on a retapé entre-temps.
          setBrouillons(prev => {
            if (prev[cle] !== c.texte) return prev;
            const suite = { ...prev };
            delete suite[cle];
            return suite;
          });
        } catch {
          echecs++;
          // Retentée au prochain envoi, sauf si une saisie plus récente l'a remplacée.
          if (!enAttente.current.has(cle)) enAttente.current.set(cle, c);
        }
      }
      if (echecs > 0) {
        setEtat('error');
        toast({ title: 'Erreur de sauvegarde', description: `${echecs} note${echecs > 1 ? 's' : ''} n'${echecs > 1 ? 'ont' : 'a'} pas pu être enregistrée${echecs > 1 ? 's' : ''}.`, variant: 'destructive' });
      } else if (enAttente.current.size === 0) {
        setEtat('saved');
      }
    });
    return chaine.current;
  }, []);

  const modifierCase = useCallback((evaluationId: string, studentId: string, bareme: number, texte: string) => {
    const cle = cleCase(evaluationId, studentId);
    setBrouillons(prev => ({ ...prev, [cle]: texte }));
    if (actions.current.analyser(texte, bareme).kind === 'invalide') {
      // Jamais enregistrée : la case reste en rouge jusqu'à correction.
      enAttente.current.delete(cle);
      return;
    }
    enAttente.current.set(cle, { evaluationId, studentId, bareme, texte });
    setEtat('saving');
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => { void envoyer(); }, 800);
  }, [envoyer]);

  // Fermer l'onglet avec des notes pas encore parties : le navigateur prévient.
  useEffect(() => {
    const avantDepart = (e: BeforeUnloadEvent) => {
      if (enAttente.current.size > 0) { void envoyer(); e.preventDefault(); }
    };
    window.addEventListener('beforeunload', avantDepart);
    return () => {
      window.removeEventListener('beforeunload', avantDepart);
      void envoyer();
    };
  }, [envoyer]);

  return { brouillons, etat, modifierCase, envoyer };
};

export type SauvegardeNotes = ReturnType<typeof useSauvegardeNotes>;
