import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  etapeFranchie, lignesApercu, messageErreurSuppression, MOT_DE_CONFIRMATION,
  type ApercuSuppression, type EtapeSuppression,
} from '@/lib/suppressionEcole';

// Les RPC de la plateforme ne sont pas dans les types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Props {
  ecole: { id: string; name: string } | null;
  onFermer: () => void;
  onSupprimee: (id: string) => void;
}

const TITRES: Record<EtapeSuppression, string> = {
  1: 'Confirmation 1 sur 3 — ce qui sera effacé',
  2: 'Confirmation 2 sur 3 — tapez SUPPRIMER',
  3: "Confirmation 3 sur 3 — nom de l'école",
};

export function SuppressionEcoleDialog({ ecole, onFermer, onSupprimee }: Props) {
  const [etape, setEtape] = useState<EtapeSuppression>(1);
  const [apercu, setApercu] = useState<ApercuSuppression | null>(null);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const [saisie, setSaisie] = useState({ compris: false, mot: '', nom: '' });
  const [enCours, setEnCours] = useState(false);

  // Chaque ouverture repart de zéro : une confirmation ne se garde pas d'une école à l'autre.
  useEffect(() => {
    setEtape(1);
    setApercu(null);
    setErreurApercu(null);
    setSaisie({ compris: false, mot: '', nom: '' });
    if (!ecole) return;
    let annule = false;
    void (async () => {
      const { data, error } = await sb.rpc('platform_school_deletion_preview', { p_school_id: ecole.id });
      if (annule) return;
      if (error) setErreurApercu(messageErreurSuppression(error));
      else setApercu(data as ApercuSuppression);
    })();
    return () => { annule = true; };
  }, [ecole]);

  if (!ecole) return null;
  const nomEcole = ecole.name;

  const supprimer = async () => {
    setEnCours(true);
    try {
      const { error } = await sb.rpc('platform_delete_school', {
        p_school_id: ecole.id, p_confirm_name: saisie.nom.trim(), p_confirm_word: saisie.mot.trim(),
      });
      if (error) throw error;
      toast({ title: 'École supprimée', description: `${nomEcole} et toutes ses données ont été effacées définitivement.` });
      onSupprimee(ecole.id);
      onFermer();
    } catch (e) {
      toast({ title: 'École non supprimée', description: messageErreurSuppression(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  const peutAvancer = etapeFranchie(etape, saisie, nomEcole);

  return (
    <Dialog open onOpenChange={o => { if (!o && !enCours) onFermer(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Supprimer « {nomEcole} »
          </DialogTitle>
          <DialogDescription>{TITRES[etape]}</DialogDescription>
        </DialogHeader>

        {etape === 1 && (
          <div className="space-y-4">
            <p className="text-sm">
              Cette action est <strong>définitive</strong> et ne peut pas être annulée. Seront effacés, avec l'école :
            </p>
            {erreurApercu ? (
              <p className="text-sm text-destructive">{erreurApercu}</p>
            ) : !apercu ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calcul en cours…</div>
            ) : (
              <>
                <ul className="rounded-lg border divide-y text-sm">
                  {lignesApercu(apercu).map(l => (
                    <li key={l.label} className="flex justify-between px-3 py-2">
                      <span>{l.label}</span><span className="font-semibold">{l.valeur}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Tous les comptes de connexion de cette école (directeur, personnel, professeurs, élèves) sont supprimés.
                  Sont conservés : l'historique de ses abonnements payés à SenClass, et un journal de la suppression (nom, e-mails, effectifs).
                  {apercu.compte_chef_conserve && ' Votre propre compte chef du système, rattaché à cette école, est conservé.'}
                </p>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={saisie.compris}
                    onCheckedChange={v => setSaisie(s => ({ ...s, compris: v === true }))}
                    className="mt-0.5"
                  />
                  <span>J'ai compris : tout sera effacé et aucune restauration n'est possible.</span>
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onFermer}>Annuler</Button>
              <Button variant="destructive" disabled={!peutAvancer || !apercu} onClick={() => setEtape(2)}>Continuer</Button>
            </div>
          </div>
        )}

        {etape === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mot-suppression">Tapez <span className="font-mono font-bold">{MOT_DE_CONFIRMATION}</span> en majuscules</Label>
              <Input
                id="mot-suppression" autoComplete="off" value={saisie.mot}
                onChange={e => setSaisie(s => ({ ...s, mot: e.target.value }))}
                placeholder={MOT_DE_CONFIRMATION}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setEtape(1)}>Retour</Button>
              <Button variant="destructive" disabled={!peutAvancer} onClick={() => setEtape(3)}>Continuer</Button>
            </div>
          </div>
        )}

        {etape === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom-suppression">Retapez le nom exact de l'école : <span className="font-semibold">{nomEcole}</span></Label>
              <Input
                id="nom-suppression" autoComplete="off" value={saisie.nom}
                onChange={e => setSaisie(s => ({ ...s, nom: e.target.value }))}
                placeholder={nomEcole}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={enCours} onClick={() => setEtape(2)}>Retour</Button>
              <Button variant="destructive" className="gap-2" disabled={!peutAvancer || enCours} onClick={() => void supprimer()}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
