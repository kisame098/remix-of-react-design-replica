import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generatePassword } from '@/lib/accountUtils';
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
export const PasswordCell = ({ accountId }: {
  accountId: string;
}) => {
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

  const handleReset = async () => {
    setResetting(true);
    try {
      const newPwd = generatePassword();
      const { error } = await supabase.functions.invoke('reset-school-account', {
        body: { accountId, newPassword: newPwd },
      });
      if (error) throw new Error(String(error));
      setPassword(newPwd);
      setVisible(true);
      toast({ title: 'Mot de passe réinitialisé', description: 'Nouveau mot de passe généré' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de réinitialiser', variant: 'destructive' });
    } finally {
      setResetting(false);
    }
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
        title="Réinitialiser"
      >
        {resetting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};
