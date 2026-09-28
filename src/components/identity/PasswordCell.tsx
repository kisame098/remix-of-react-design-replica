import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generatePassword } from '@/lib/accountUtils';
import { MIN_MOT_DE_PASSE } from '@/lib/comptePersonnel';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copié`, description: text });
  } catch {
    toast({ title: 'Erreur', description: 'Impossible de copier', variant: 'destructive' });
  }
};

// ─── Password cell ────────────────────────────────────────────────────────────
// Utilisé pour élèves, professeurs ET personnel — le mot de passe n'est jamais
// chargé en masse avec la liste des comptes : il est chiffré en base et n'est
// déchiffré qu'à la demande, via la fonction RPC `reveal_school_account_password`
// (vérifie que l'appelant est admin de l'école propriétaire du compte).
export const PasswordCell = ({ accountId, saisieLibre = false }: {
  accountId: string;
  /** Personnel : le directeur SAISIT le mot de passe choisi par l'employé, au lieu d'en générer un. */
  saisieLibre?: boolean;
}) => {
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const [nouveau, setNouveau] = useState('');
  const [password,  setPassword]  = useState<string | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const reveal = useCallback(async (): Promise<string | null> => {
    if (password !== null) return password;
    setRevealing(true);
    try {
      const { data, error } = await supabase.rpc('reveal_school_account_password', {
        p_account_id: accountId,
      });
      if (error) throw error;
      setPassword(data ?? '');
      return data ?? '';
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de récupérer le mot de passe', variant: 'destructive' });
      return null;
    } finally {
      setRevealing(false);
    }
  }, [accountId, password]);

  const handleToggleVisible = async () => {
    if (!visible) await reveal();
    setVisible(v => !v);
  };

  const handleCopy = async () => {
    const pwd = await reveal();
    if (pwd) copyToClipboard(pwd, 'Mot de passe');
  };

  const changer = async (newPwd: string): Promise<boolean> => {
    setResetting(true);
    try {
      const { error } = await supabase.functions.invoke('reset-school-account', {
        body: { accountId, newPassword: newPwd },
      });
      if (error) {
        const message = 'context' in error
          ? await (error as { context: Response }).context.json().then(j => j?.error).catch(() => undefined)
          : undefined;
        throw new Error(message ?? 'Impossible de changer le mot de passe');
      }
      setPassword(newPwd);
      setVisible(true);
      toast({ title: 'Mot de passe changé', description: saisieLibre ? 'Le nouveau mot de passe est enregistré.' : 'Nouveau mot de passe généré' });
      return true;
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible de réinitialiser', variant: 'destructive' });
      return false;
    } finally {
      setResetting(false);
    }
  };

  const handleReset = () => {
    if (saisieLibre) { setNouveau(''); setSaisieOuverte(true); return; }
    changer(generatePassword());
  };

  const enregistrerSaisie = async () => {
    if (nouveau.length < MIN_MOT_DE_PASSE) {
      toast({ title: 'À corriger', description: `Au moins ${MIN_MOT_DE_PASSE} caractères.`, variant: 'destructive' });
      return;
    }
    if (await changer(nouveau)) setSaisieOuverte(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <code className={cn(
        'text-xs font-mono px-2 py-1 rounded bg-muted min-w-24 inline-block',
        (!visible || password === null) && 'blur-sm select-none'
      )}>
        {password ?? '••••••••••'}
      </code>
      <Button
        variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
        onClick={handleToggleVisible}
        disabled={revealing}
        title={visible ? 'Masquer' : 'Afficher'}
      >
        {revealing
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
        onClick={handleCopy}
        disabled={revealing}
        title="Copier"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 flex-shrink-0 text-amber-600 hover:text-amber-700"
        onClick={handleReset}
        disabled={resetting}
        title={saisieLibre ? 'Changer le mot de passe' : 'Réinitialiser'}
      >
        {resetting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
      </Button>
      {saisieLibre && (
        <Dialog open={saisieOuverte} onOpenChange={o => !resetting && setSaisieOuverte(o)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Changer le mot de passe</DialogTitle>
              <DialogDescription>Saisissez le nouveau mot de passe choisi par le membre du personnel.</DialogDescription>
            </DialogHeader>
            <Input
              type="text" autoComplete="new-password" autoFocus
              value={nouveau} onChange={e => setNouveau(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') enregistrerSaisie(); }}
              placeholder={`Au moins ${MIN_MOT_DE_PASSE} caractères`} disabled={resetting}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaisieOuverte(false)} disabled={resetting}>Annuler</Button>
              <Button onClick={enregistrerSaisie} disabled={resetting} className="gap-2">
                {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
