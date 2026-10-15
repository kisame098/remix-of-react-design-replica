import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { adresseRefusee, nettoyerAdresse } from '@/lib/hoteEcole';
import { verifierAdresse, type EtatAdresse } from '@/lib/siteWeb';

const MESSAGES: Record<Exclude<EtatAdresse, 'libre' | 'actuelle'>, string> = {
  prise: 'Déjà prise par une autre école.',
  reservee: 'Réservée à SenClass.',
  format: 'Lettres minuscules, chiffres et tirets uniquement (3 caractères au moins).',
};

/**
 * L'adresse du site : <saisie>.senclass.com. Nettoyée à la frappe, puis
 * vérifiée par le serveur (libre, déjà prise, réservée…) un instant après.
 */
export function ChampAdresse({ actuelle, suggestion, onChange }: {
  actuelle: string | null; suggestion: string; onChange: (adresse: string, valable: boolean) => void;
}) {
  const [saisie, setSaisie] = useState(suggestion);
  const [etat, setEtat] = useState<EtatAdresse | 'verification' | 'erreur'>('verification');
  const rappel = useRef(onChange);
  rappel.current = onChange;

  useEffect(() => {
    const propre = saisie.replace(/-+$/, '');
    const refus = adresseRefusee(propre);
    if (refus) { setEtat(refus); rappel.current(propre, false); return; }
    setEtat('verification');
    rappel.current(propre, false);
    let annule = false;
    const t = setTimeout(() => {
      verifierAdresse(propre)
        .then(e => { if (!annule) { setEtat(e); rappel.current(propre, e === 'libre' || e === 'actuelle'); } })
        .catch(() => { if (!annule) setEtat('erreur'); });
    }, 400);
    return () => { annule = true; clearTimeout(t); };
  }, [saisie]);

  const change = actuelle && saisie.replace(/-+$/, '') !== actuelle && (etat === 'libre');
  return (
    <div className="space-y-2">
      <label htmlFor="adresse-site" className="text-sm font-medium">Adresse du site</label>
      <div className={`flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring ${etat === 'libre' || etat === 'actuelle' ? 'border-green-500' : etat === 'verification' ? '' : 'border-destructive'}`}>
        <span className="pl-3 text-sm text-muted-foreground select-none">https://</span>
        <input id="adresse-site" value={saisie} autoFocus spellCheck={false} autoComplete="off"
          onChange={e => setSaisie(nettoyerAdresse(e.target.value))}
          className="flex-1 min-w-0 bg-transparent px-1 py-2.5 text-sm font-semibold outline-none" />
        <span className="pr-3 text-sm text-muted-foreground select-none">.senclass.com</span>
      </div>
      <p className="text-xs flex items-center gap-1.5 min-h-[18px]" aria-live="polite">
        {etat === 'verification' && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Vérification…</>}
        {etat === 'libre' && <span className="text-green-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Disponible</span>}
        {etat === 'actuelle' && <span className="text-green-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Adresse actuelle de votre site</span>}
        {etat === 'erreur' && <span className="text-destructive">Vérification impossible : vérifiez la connexion internet.</span>}
        {(etat === 'prise' || etat === 'reservee' || etat === 'format') && <span className="text-destructive">{MESSAGES[etat]}</span>}
      </p>
      {change && (
        <p className="text-xs rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
          L'ancienne adresse <strong>{actuelle}.senclass.com</strong> ne fonctionnera plus : pensez à mettre à jour vos liens et affiches.
        </p>
      )}
    </div>
  );
}
