import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, IdCard as IdCardIcon, School, Mail,
  LogOut, User, Maximize2, Printer, Plus, X, Loader2, Users,
} from 'lucide-react';
import { initials } from './portalHelpers';
import { IdCard } from '@/components/portal/IdCard';
import {
  Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LinkedAccount, getLinkedAccounts, upsertLinkedAccount, addLinkedAccount, removeLinkedAccount, switchToLinkedAccount,
} from '@/lib/linkedAccounts';

// ─── Profil ───────────────────────────────────────────────────────────────────

export default function PortalProfil() {
  const { session, schoolAccount, accountRole, school, signOut } = useAuth();
  const { currentYear } = useSchoolYear();
  const [cardOpen, setCardOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  // ── Comptes liés (voir src/lib/linkedAccounts.ts) ──────────────────────────
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(() => getLinkedAccounts());

  // Cette page est accessible sans passer par PortalLayout (route "standalone")
  // — on garde donc le même filet de sécurité ici pour que le compte courant
  // apparaisse toujours dans la liste, même en y arrivant directement.
  useEffect(() => {
    if (!session || !schoolAccount || (schoolAccount.role !== 'student' && schoolAccount.role !== 'teacher')) return;
    upsertLinkedAccount({
      userId:       schoolAccount.authUserId,
      email:        schoolAccount.email,
      displayName:  schoolAccount.displayName,
      displayId:    schoolAccount.displayId,
      role:         schoolAccount.role,
      schoolName:   schoolAccount.schoolName,
      photoUrl:     schoolAccount.photoUrl,
      accessToken:  session.access_token,
      refreshToken: session.refresh_token,
    });
    setLinkedAccounts(getLinkedAccounts());
  }, [session, schoolAccount]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const refreshLinkedAccounts = () => setLinkedAccounts(getLinkedAccounts());

  const handleSwitchAccount = async (acc: LinkedAccount) => {
    setSwitchingId(acc.userId);
    try {
      await switchToLinkedAccount(acc);
      navigate('/portail', { replace: true });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de basculer sur ce compte',
        variant: 'destructive',
      });
      refreshLinkedAccounts();
    } finally {
      setSwitchingId(null);
    }
  };

  const handleRemoveAccount = (userId: string) => {
    removeLinkedAccount(userId);
    refreshLinkedAccounts();
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setAddEmail('');
    setAddPassword('');
    setAddError(null);
  };

  const handleAddAccount = async () => {
    if (!addEmail.trim() || !addPassword) return;
    setAdding(true);
    setAddError(null);
    try {
      const acc = await addLinkedAccount(addEmail.trim(), addPassword);
      closeAddDialog();
      refreshLinkedAccounts();
      await handleSwitchAccount(acc);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Échec de connexion');
    } finally {
      setAdding(false);
    }
  };

  if (!schoolAccount) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Chargement du profil…</p>
      </div>
    );
  }

  const isStudent   = accountRole === 'student';
  const roleLabel   = isStudent ? 'Élève' : 'Professeur';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header with back button ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center
                       hover:bg-gray-100 transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Mon profil</h1>
        </div>
      </header>

      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Carte d'identité scolaire ─────────────────────────────── */}
        <div>
          <button
            onClick={() => setCardOpen(true)}
            className="w-full text-left group relative"
          >
            <IdCard
              displayName={schoolAccount.displayName}
              displayId={schoolAccount.displayId}
              photoUrl={schoolAccount.photoUrl}
              className={schoolAccount.className}
              schoolName={schoolAccount.schoolName}
              schoolLogoUrl={school?.logo_url ?? undefined}
              academicYearLabel={currentYear?.id}
              isStudent={isStudent}
            />
            <div className="absolute inset-0 rounded-2xl bg-black/0 group-active:bg-black/5 transition-colors flex items-end justify-end p-3">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5">
                <Maximize2 className="h-3 w-3" /> Voir en grand
              </span>
            </div>
          </button>
        </div>

        {/* ── Info section ──────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Informations du compte
          </h3>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">

            {/* Identifiant */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <IdCardIcon className="h-4.5 w-4.5 text-blue-500" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Identifiant</p>
                <p className="font-mono font-bold text-gray-900 mt-0.5">{schoolAccount.displayId}</p>
              </div>
            </div>

            {/* École */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <School className="h-4.5 w-4.5 text-emerald-500" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">École</p>
                <p className="font-semibold text-gray-900 mt-0.5 truncate">{schoolAccount.schoolName}</p>
              </div>
            </div>

            {/* Rôle */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                isStudent ? 'bg-blue-50' : 'bg-violet-50',
              )}>
                <User className={cn('w-[18px] h-[18px]', isStudent ? 'text-blue-500' : 'text-violet-500')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rôle</p>
                <p className="font-semibold text-gray-900 mt-0.5">{roleLabel}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Mail className="w-[18px] h-[18px] text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Compte de connexion
                </p>
                <p className="font-mono text-xs text-gray-500 mt-0.5 truncate">{schoolAccount.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Comptes liés ──────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Comptes liés sur cet appareil
          </h3>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
            {linkedAccounts.map(acc => {
              const isActive = acc.userId === schoolAccount.authUserId;
              const isSwitching = switchingId === acc.userId;
              return (
                <div key={acc.userId} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => !isActive && handleSwitchAccount(acc)}
                    disabled={isActive || isSwitching}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left disabled:cursor-default"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-100">
                      {acc.photoUrl ? (
                        <img src={acc.photoUrl} alt={acc.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn('w-full h-full flex items-center justify-center', acc.role === 'student' ? 'bg-blue-600' : 'bg-violet-600')}>
                          <span className="text-white font-bold text-xs">{initials(acc.displayName)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{acc.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {acc.role === 'student' ? 'Élève' : 'Professeur'} · {acc.schoolName}
                      </p>
                    </div>
                  </button>
                  {isActive ? (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      Actif
                    </span>
                  ) : isSwitching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
                  ) : (
                    <button
                      onClick={() => handleRemoveAccount(acc.userId)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 flex-shrink-0"
                      aria-label="Retirer ce compte"
                    >
                      <X className="h-3.5 w-3.5 text-gray-300" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-2xl
                       border border-dashed border-gray-200 text-gray-500
                       hover:bg-gray-50 active:scale-[.98] transition-all font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            Ajouter un compte
          </button>
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed flex items-start gap-1.5">
            <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Pratique si vous suivez plusieurs élèves (ex: vos enfants) — basculez de l'un à l'autre sans vous reconnecter à chaque fois.
          </p>
        </div>

        {/* ── Logout ────────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Session</h3>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl
                       bg-red-50 border border-red-100 text-red-600
                       hover:bg-red-100 active:scale-[.98] transition-all font-bold text-sm shadow-sm"
          >
            <LogOut className="h-5 w-5" />
            Se déconnecter
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 pb-2">
          SenClass · Espace {roleLabel}
        </p>
      </div>

      {/* ── Carte en grand / impression ──────────────────────────────── */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Carte {isStudent ? "d'élève" : 'professeur'}</DialogTitle>
          <div id="id-card-print-area">
            <IdCard
              displayName={schoolAccount.displayName}
              displayId={schoolAccount.displayId}
              photoUrl={schoolAccount.photoUrl}
              className={schoolAccount.className}
              schoolName={schoolAccount.schoolName}
              schoolLogoUrl={school?.logo_url ?? undefined}
              academicYearLabel={currentYear?.id}
              isStudent={isStudent}
              size="large"
            />
          </div>
          <Button className="w-full gap-2 print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer la carte
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Ajouter un compte ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un compte</DialogTitle>
            <DialogDescription>
              Connectez-vous avec l'email et le mot de passe d'un autre compte élève ou professeur. Vous pourrez ensuite basculer entre les deux depuis cette page, sans vous déconnecter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="addAccEmail">Email</Label>
              <Input
                id="addAccEmail"
                type="email"
                placeholder="prenom.nom.xxxxx@senclass.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addAccPassword">Mot de passe</Label>
              <Input
                id="addAccPassword"
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                disabled={adding}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
              />
            </div>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
            <Button className="w-full gap-2" onClick={handleAddAccount} disabled={adding || !addEmail.trim() || !addPassword}>
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter et basculer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
