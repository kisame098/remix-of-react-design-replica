import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  generatePassword, generateLoginEmail, generateStaffDisplayId,
} from '@/lib/accountUtils';
import { ALL_PERMISSION_KEYS, PERMISSION_LABELS, PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  UserPlus, Copy, Loader2, CheckCircle2, Users, ShieldCheck, Pencil,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PasswordCell, copyToClipboard } from '@/components/identity/PasswordCell';

interface StaffRow {
  accountId:   string;   // school_accounts.id (pour le mot de passe)
  memberId:    string;   // school_members.id (pour les permissions)
  authUserId:  string | null;
  fullName:    string;
  email:       string;
  isActive:    boolean;
  permissions: PermissionKey[];
  createdAt:   string;
}

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);

// ─── Éditeur de permissions (case à cocher par section du dashboard) ──────────
const PermissionsEditor = ({ staff, isAdmin, onSaved }: {
  staff:   StaffRow;
  isAdmin: boolean;
  onSaved: (permissions: PermissionKey[]) => void;
}) => {
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set(staff.permissions));
  const [saving,   setSaving]   = useState(false);

  const toggle = (key: PermissionKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const permissions = Array.from(selected);
      const { error } = await supabase
        .from('school_members')
        .update({ permissions })
        .eq('id', staff.memberId);
      if (error) throw error;
      onSaved(permissions);
      setOpen(false);
      toast({ title: 'Accès mis à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les accès', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSelected(new Set(staff.permissions)); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" disabled={!isAdmin}>
          <Pencil className="h-3 w-3" />
          Modifier les accès
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sections accessibles</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {ALL_PERMISSION_KEYS.map(key => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
              {PERMISSION_LABELS[key]}
            </label>
          ))}
        </div>
        <Button size="sm" className="w-full gap-1.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Enregistrer
        </Button>
      </PopoverContent>
    </Popover>
  );
};

const PersonnelManagement = () => {
  const { school, accountRole } = useAuth();
  const isAdmin = accountRole === 'admin';

  const [staff,      setStaff]      = useState<StaffRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fullName,    setFullName]    = useState('');
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());

  const load = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    try {
      const [{ data: accounts }, { data: members }] = await Promise.all([
        supabase
          .from('school_accounts')
          .select('id, email, display_name, is_active, auth_user_id, created_at')
          .eq('school_id', school.id)
          .eq('role', 'staff')
          .order('created_at', { ascending: false }),
        supabase
          .from('school_members')
          .select('id, user_id, permissions')
          .eq('school_id', school.id)
          .eq('role', 'staff'),
      ]);

      const membersByUserId = new Map((members ?? []).map(m => [m.user_id, m]));

      setStaff((accounts ?? []).map(a => {
        const member = a.auth_user_id ? membersByUserId.get(a.auth_user_id) : undefined;
        return {
          accountId:   a.id,
          memberId:    member?.id ?? '',
          authUserId:  a.auth_user_id,
          fullName:    a.display_name,
          email:       a.email,
          isActive:    a.is_active,
          permissions: (member?.permissions ?? []) as PermissionKey[],
          createdAt:   a.created_at,
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFullName('');
    setPermissions(new Set());
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!school || !fullName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom complet est obligatoire', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const [firstName, ...rest] = fullName.trim().split(' ');
      const lastName = rest.join(' ') || firstName;
      const email    = generateLoginEmail(firstName, lastName);
      const password = generatePassword();
      const displayId = generateStaffDisplayId();

      const { data: acct, error: insertError } = await supabase
        .from('school_accounts')
        .insert({
          school_id:      school.id,
          role:           'staff',
          email,
          password_plain: password,
          display_name:   fullName.trim(),
          display_id:     displayId,
          school_name:    school.name,
        })
        .select('id')
        .single();
      if (insertError || !acct) throw insertError ?? new Error('Erreur de création');

      const { data, error } = await supabase.functions.invoke('create-staff-account', {
        body: {
          email, password, accountId: acct.id,
          fullName: fullName.trim(),
          permissions: Array.from(permissions),
        },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error ?? String(error));
      }

      await load();
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Compte créé', description: `${fullName} peut maintenant se connecter (${email}).` });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de créer ce compte',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (row: StaffRow) => {
    if (!row.memberId) return;
    const { error } = await supabase
      .from('school_members')
      .update({ is_active: !row.isActive })
      .eq('id', row.memberId);
    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de changer le statut', variant: 'destructive' });
      return;
    }
    setStaff(prev => prev.map(s => s.accountId === row.accountId ? { ...s, isActive: !s.isActive } : s));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-xl">
          Comme pour les élèves et professeurs, l'email et le mot de passe sont générés automatiquement.
          Définissez pour chaque membre les sections du tableau de bord auxquelles il a accès.
        </p>
        {isAdmin && (
          <Button className="gap-1.5 flex-shrink-0" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <UserPlus className="h-4 w-4" />
            Ajouter un membre
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucun membre du personnel créé</p>
              <p className="text-sm mt-1 opacity-70">
                {isAdmin ? 'Cliquez sur "Ajouter un membre" pour déléguer des tâches administratives.'
                         : 'Seul le directeur peut créer un compte personnel.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Personnel</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Email de connexion</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Mot de passe</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Accès</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(row => (
                    <tr key={row.accountId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors align-top">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {getInitials(row.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium">{row.fullName}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono text-primary">{row.email}</code>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
                            onClick={() => copyToClipboard(row.email, 'Email')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <PasswordCell accountId={row.accountId} />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 mb-2 max-w-56">
                          {row.permissions.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">Aucun accès</span>
                          ) : row.permissions.map(p => (
                            <Badge key={p} variant="secondary" className="text-[10px]">{PERMISSION_LABELS[p]}</Badge>
                          ))}
                        </div>
                        {row.memberId && (
                          <PermissionsEditor
                            staff={row}
                            isAdmin={isAdmin}
                            onSaved={(perms) => setStaff(prev => prev.map(s =>
                              s.accountId === row.accountId ? { ...s, permissions: perms } : s
                            ))}
                          />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {row.isActive ? (
                            <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-500">
                              <CheckCircle2 className="h-3 w-3" /> Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inactif</Badge>
                          )}
                          {isAdmin && row.memberId && (
                            <Switch checked={row.isActive} onCheckedChange={() => handleToggleActive(row)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Ajouter un membre du personnel
            </DialogTitle>
            <DialogDescription>
              L'email et le mot de passe sont générés automatiquement, comme pour les élèves et professeurs.
              Cochez les sections auxquelles ce membre aura accès.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex: Awa Ndiaye" disabled={submitting} />
            </div>

            <div className="space-y-1.5">
              <Label>Accès autorisés</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {ALL_PERMISSION_KEYS.map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={permissions.has(key)}
                      onCheckedChange={() => togglePermission(key)}
                      disabled={submitting}
                    />
                    {PERMISSION_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Créer le compte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonnelManagement;
