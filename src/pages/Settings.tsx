import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  CLE_ADRESSE_ECOLE, CLE_NINEA_ECOLE, CLE_AUTORISATION_ECOLE, CLE_RC_ECOLE,
  CLE_DIRECTEUR_ETUDES, CLE_DIRECTEUR_GENERAL, CLE_PIED_DOCUMENTS,
} from '@/lib/documentsEcole';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  School, User, Calendar, Clock,
  Camera, Loader2, Save, ShieldAlert, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/imageCompress';
import {
  getAcademicMonths, isMonthOverdue, TuitionBillingTiming,
  TUITION_BILLING_TIMING_LABELS, DEFAULT_TUITION_BILLING_TIMING,
  EXCLUDED_BILLING_MONTHS_KEY, readExcludedBillingMonths,
  ARRIVAL_MONTH_WAIVE_DAY_KEY, readBillingRules,
} from '@/types/payment';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur / Directeur',
  staff: 'Personnel',
};

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const h = String(i + 6).padStart(2, '0');
  return `${h}:00`;
});

// ─── Photo picker minimal (upload uniquement, pas de caméra) ──────────────────
const PhotoUploadAvatar = ({ value, onChange, initials, uploading, format = 'jpeg' }: {
  value?: string | null; onChange: (dataUrl: string) => void; initials: string; uploading?: boolean; format?: 'jpeg' | 'png';
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string, 320, format);
      onChange(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={value ?? undefined} className="object-cover" />
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90"
          type="button"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        Changer la photo
      </Button>
    </div>
  );
};

const SettingsPage = () => {
  const { school, profile, accountRole, updateProfile, updateSchool, updateSchoolSettings } = useAuth();
  const { currentYear, updateSchoolYear } = useSchoolYear();

  const isAdmin = accountRole === 'admin';

  // ── École ────────────────────────────────────────────────────────────────────
  const [schoolForm, setSchoolForm] = useState({
    name: '', city: '', country: '', phone: '', email: '',
  });
  // Adresse et n° d'agrément : dans schools.settings (pas de colonne dédiée), ils
  // figurent dans l'en-tête des reçus et des fiches d'inscription.
  const [adresseEcole, setAdresseEcole] = useState('');
  const [nineaEcole, setNineaEcole] = useState('');
  const [autorisationEcole, setAutorisationEcole] = useState('');
  const [rcEcole, setRcEcole] = useState('');
  const [directeurEtudes, setDirecteurEtudes] = useState('');
  const [directeurGeneral, setDirecteurGeneral] = useState('');
  const [piedDocuments, setPiedDocuments] = useState('');
  const [savingSchool, setSavingSchool] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (school) {
      setSchoolForm({
        name: school.name ?? '',
        city: school.city ?? '',
        country: school.country ?? '',
        phone: school.phone ?? '',
        email: school.email ?? '',
      });
      setAdresseEcole(typeof school.settings?.[CLE_ADRESSE_ECOLE] === 'string' ? school.settings[CLE_ADRESSE_ECOLE] as string : '');
      setNineaEcole(typeof school.settings?.[CLE_NINEA_ECOLE] === 'string' ? school.settings[CLE_NINEA_ECOLE] as string : '');
      setAutorisationEcole(typeof school.settings?.[CLE_AUTORISATION_ECOLE] === 'string' ? school.settings[CLE_AUTORISATION_ECOLE] as string : '');
      setRcEcole(typeof school.settings?.[CLE_RC_ECOLE] === 'string' ? school.settings[CLE_RC_ECOLE] as string : '');
      const reglage = (cle: string) => (typeof school.settings?.[cle] === 'string' ? school.settings[cle] as string : '');
      setDirecteurEtudes(reglage(CLE_DIRECTEUR_ETUDES));
      setDirecteurGeneral(reglage(CLE_DIRECTEUR_GENERAL));
      setPiedDocuments(reglage(CLE_PIED_DOCUMENTS));
    }
  }, [school]);

  const saveSchool = async () => {
    setSavingSchool(true);
    try {
      await updateSchool(schoolForm);
      await updateSchoolSettings({
        [CLE_ADRESSE_ECOLE]: adresseEcole.trim(), [CLE_NINEA_ECOLE]: nineaEcole.trim(),
        [CLE_AUTORISATION_ECOLE]: autorisationEcole.trim(), [CLE_RC_ECOLE]: rcEcole.trim(),
        [CLE_DIRECTEUR_ETUDES]: directeurEtudes.trim(), [CLE_DIRECTEUR_GENERAL]: directeurGeneral.trim(),
        [CLE_PIED_DOCUMENTS]: piedDocuments.trim(),
      });
      toast({ title: 'École mise à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingSchool(false);
    }
  };

  const handleLogoChange = async (dataUrl: string) => {
    setUploadingLogo(true);
    try {
      await updateSchool({ logo_url: dataUrl });
      toast({ title: 'Logo mis à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le logo', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Mon compte ───────────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { if (profile) setFullName(profile.full_name ?? ''); }, [profile]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName });
      toast({ title: 'Profil mis à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (dataUrl: string) => {
    setUploadingAvatar(true);
    try {
      await updateProfile({ avatar_url: dataUrl });
      toast({ title: 'Photo de profil mise à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la photo', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Année scolaire ───────────────────────────────────────────────────────────
  const [yearForm, setYearForm] = useState({ startDate: '', endDate: '' });
  const [savingYear, setSavingYear] = useState(false);
  const [billingTiming, setBillingTiming] = useState<TuitionBillingTiming>(DEFAULT_TUITION_BILLING_TIMING);
  const [savingTiming, setSavingTiming] = useState(false);

  useEffect(() => {
    if (currentYear) setYearForm({ startDate: currentYear.startDate, endDate: currentYear.endDate });
  }, [currentYear]);

  useEffect(() => {
    if (school?.settings) {
      setBillingTiming((school.settings.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING);
      setExcludedMonths(readExcludedBillingMonths(school.settings));
    }
  }, [school]);

  const previewMonths = currentYear
    ? getAcademicMonths(yearForm.startDate || currentYear.startDate, yearForm.endDate || currentYear.endDate, billingTiming)
    : [];

  // ── Mois facturés (cases à cocher) ───────────────────────────────────────────
  // On stocke les mois EXCLUS : si l'école élargit ensuite ses dates, les
  // nouveaux mois sont facturables par défaut plutôt qu'oubliés en silence.
  const [excludedMonths, setExcludedMonths] = useState<string[]>([]);
  const [savingMonths, setSavingMonths] = useState(false);

  const toggleMonth = (key: string) => {
    setExcludedMonths(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const saveExcludedMonths = async () => {
    setSavingMonths(true);
    try {
      await updateSchoolSettings({ [EXCLUDED_BILLING_MONTHS_KEY]: excludedMonths });
      toast({
        title: 'Mois facturés mis à jour',
        description: 'Les mois décochés ne sont plus réclamés aux élèves. Les paiements déjà enregistrés restent visibles.',
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingMonths(false);
    }
  };

  // ── Mois d'arrivée : dû ou offert selon le jour d'inscription ───────────────
  // Variable d'une école à l'autre : certaines facturent le mois entier quel
  // que soit le jour d'arrivée, d'autres l'offrent à partir d'une certaine date.
  const [waiveFromDay, setWaiveFromDay] = useState<number | null>(null);
  const [waiveDayDraft, setWaiveDayDraft] = useState('15');
  const [savingWaive, setSavingWaive] = useState(false);

  useEffect(() => {
    if (school?.settings) {
      const day = readBillingRules(school.settings).waiveArrivalMonthFromDay;
      setWaiveFromDay(day);
      if (day !== null) setWaiveDayDraft(String(day));
    }
  }, [school]);

  const saveWaiveRule = async (day: number | null) => {
    setSavingWaive(true);
    try {
      await updateSchoolSettings({ [ARRIVAL_MONTH_WAIVE_DAY_KEY]: day });
      setWaiveFromDay(day);
      if (day !== null) setWaiveDayDraft(String(day));
      toast({
        title: 'Règle enregistrée',
        description: day === null
          ? "Le mois d'arrivée est désormais facturé quel que soit le jour d'inscription."
          : `Un élève inscrit à partir du ${day} du mois ne paiera pas ce mois-là.`,
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingWaive(false);
    }
  };

  const saveYear = () => {
    if (!currentYear) return;
    if (yearForm.endDate <= yearForm.startDate) {
      toast({ title: 'Erreur', description: 'La date de fermeture doit être après la date d\'ouverture', variant: 'destructive' });
      return;
    }
    setSavingYear(true);
    try {
      updateSchoolYear(currentYear.id, yearForm);
      toast({ title: 'Année scolaire mise à jour', description: 'Les mois facturables dans Paiements sont recalculés automatiquement.' });
    } finally {
      setSavingYear(false);
    }
  };

  const saveBillingTiming = async () => {
    setSavingTiming(true);
    try {
      await updateSchoolSettings({ tuitionBillingTiming: billingTiming });
      toast({ title: 'Mode de facturation mis à jour', description: 'Les échéances et retards affichés dans Paiements sont recalculés automatiquement.' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingTiming(false);
    }
  };

  // ── Emploi du temps ──────────────────────────────────────────────────────────
  const [minHour, setMinHour] = useState('07:00');
  const [maxHour, setMaxHour] = useState('18:00');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (school?.settings) {
      setMinHour((school.settings.scheduleMinHour as string) ?? '07:00');
      setMaxHour((school.settings.scheduleMaxHour as string) ?? '18:00');
    }
  }, [school]);

  const saveHours = async () => {
    if (maxHour <= minHour) {
      toast({ title: 'Erreur', description: 'L\'heure maximale doit être après l\'heure minimale', variant: 'destructive' });
      return;
    }
    setSavingHours(true);
    try {
      await updateSchoolSettings({ scheduleMinHour: minHour, scheduleMaxHour: maxHour });
      toast({ title: 'Horaires mis à jour', description: 'La grille d\'emploi du temps est recalculée automatiquement.' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSavingHours(false);
    }
  };

  const initials = (profile?.full_name || profile?.email || 'AD').slice(0, 2).toUpperCase();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium">Accès réservé à l'administrateur</p>
        <p className="text-sm text-muted-foreground mt-1">Seul le directeur peut modifier les paramètres généraux.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configuration générale de l'application</p>
      </div>

      <Tabs defaultValue="ecole" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ecole" className="gap-2"><School className="h-4 w-4" /> École</TabsTrigger>
          <TabsTrigger value="compte" className="gap-2"><User className="h-4 w-4" /> Mon compte</TabsTrigger>
          <TabsTrigger value="annee" className="gap-2"><Calendar className="h-4 w-4" /> Année scolaire</TabsTrigger>
          <TabsTrigger value="horaires" className="gap-2"><Clock className="h-4 w-4" /> Emploi du temps</TabsTrigger>
        </TabsList>

        {/* École */}
        <TabsContent value="ecole">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'établissement</CardTitle>
              <CardDescription>Nom, coordonnées et logo affichés dans l'application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <PhotoUploadAvatar
                  value={school?.logo_url}
                  onChange={handleLogoChange}
                  initials={(school?.name ?? 'EC').slice(0, 2).toUpperCase()}
                  uploading={uploadingLogo}
                  format="png"
                />
                <p className="text-xs text-muted-foreground">
                  Pour un rendu propre sur le bulletin, utilisez un logo à fond transparent (PNG) — vous pouvez
                  demander à ChatGPT ou un autre outil IA de le préparer pour vous, aucun logiciel de retouche requis.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom de l'école</Label>
                  <Input value={schoolForm.name} onChange={e => setSchoolForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input value={schoolForm.city} onChange={e => setSchoolForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pays</Label>
                  <Input value={schoolForm.country} onChange={e => setSchoolForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={schoolForm.phone} onChange={e => setSchoolForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Email de contact</Label>
                  <Input type="email" value={schoolForm.email} onChange={e => setSchoolForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    value={adresseEcole}
                    onChange={e => setAdresseEcole(e.target.value)}
                    placeholder="Ex : BP 1234, Point E"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>N° d'agrément / NINEA <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input value={nineaEcole} onChange={e => setNineaEcole(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Le logo, l'adresse et ce numéro figurent dans l'en-tête des reçus de paiement et des fiches d'inscription.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>N° d'autorisation d'ouverture <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input value={autorisationEcole} onChange={e => setAutorisationEcole(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Registre de commerce (RC) <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input value={rcEcole} onChange={e => setRcEcole(e.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2 -mt-2">
                  L'autorisation et le RC figurent au pied des documents officiels (attestations, diplômes).
                </p>
                <div className="space-y-1.5">
                  <Label>Directeur des études <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input value={directeurEtudes} onChange={e => setDirecteurEtudes(e.target.value)} placeholder="Ex : M. Babacar Gueye" />
                </div>
                <div className="space-y-1.5">
                  <Label>Directeur général <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input value={directeurGeneral} onChange={e => setDirecteurGeneral(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Pied de page des documents <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Textarea
                    rows={3} value={piedDocuments} onChange={e => setPiedDocuments(e.target.value)}
                    placeholder={"Adresse : …\nE-mail : …  ·  Tél. : …\nBanque : …"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Imprimé en bas des bulletins et relevés, une ligne par ligne. Les noms des directeurs signent les bulletins.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-4">
              <Button className="gap-2" onClick={saveSchool} disabled={savingSchool}>
                {savingSchool ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Mon compte */}
        <TabsContent value="compte">
          <Card>
            <CardHeader>
              <CardTitle>Mon compte</CardTitle>
              <CardDescription>Vos informations personnelles, visibles par le reste de l'équipe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PhotoUploadAvatar
                value={profile?.avatar_url}
                onChange={handleAvatarChange}
                initials={initials}
                uploading={uploadingAvatar}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom complet</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile?.email ?? ''} disabled />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Rôle</Label>
                  <Input value={ROLE_LABELS[accountRole ?? ''] ?? '—'} disabled />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-4">
              <Button className="gap-2" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Année scolaire */}
        <TabsContent value="annee" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{currentYear?.name ?? 'Année scolaire'}</CardTitle>
              <CardDescription>
                Ces dates déterminent automatiquement les mois facturables affichés dans Paiements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Date d'ouverture</Label>
                  <Input type="date" value={yearForm.startDate} onChange={e => setYearForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date de fermeture</Label>
                  <Input type="date" value={yearForm.endDate} onChange={e => setYearForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-4">
              <Button className="gap-2" onClick={saveYear} disabled={savingYear || !currentYear}>
                {savingYear ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Échéance de la scolarité</CardTitle>
              <CardDescription>
                Choisissez quand la scolarité mensuelle est due — ça détermine quand un mois impayé
                est signalé "en retard" dans Paiements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 max-w-md">
                <Label>Mode de facturation</Label>
                <Select value={billingTiming} onValueChange={v => setBillingTiming(v as TuitionBillingTiming)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TUITION_BILLING_TIMING_LABELS) as TuitionBillingTiming[]).map(t => (
                      <SelectItem key={t} value={t}>{TUITION_BILLING_TIMING_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Élève inscrit en cours de mois
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={waiveFromDay !== null}
                    onCheckedChange={checked => saveWaiveRule(checked === true ? 15 : null)}
                    disabled={savingWaive}
                  />
                  <span className="text-sm">Offrir le mois d'arrivée si l'élève s'inscrit tard dans le mois</span>
                </label>

                {waiveFromDay !== null && (
                  <div className="flex items-center gap-2 flex-wrap pl-7">
                    <span className="text-sm text-muted-foreground">À partir du</span>
                    <Input
                      type="number" min={1} max={31}
                      className="w-20 h-9"
                      value={waiveDayDraft}
                      onChange={e => setWaiveDayDraft(e.target.value)}
                      onBlur={() => {
                        const n = Number(waiveDayDraft);
                        if (!Number.isFinite(n) || n < 1 || n > 31) { setWaiveDayDraft(String(waiveFromDay)); return; }
                        if (n !== waiveFromDay) saveWaiveRule(Math.floor(n));
                      }}
                    />
                    <span className="text-sm text-muted-foreground">du mois</span>
                    {savingWaive && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {waiveFromDay === null
                    ? "Un élève arrivé le 24 paie le mois entier."
                    : `Un élève arrivé le ${waiveFromDay} ou après ne paie pas ce mois-là : sa scolarité démarre le mois suivant.`}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Mois à facturer ({previewMonths.length - previewMonths.filter(m => excludedMonths.includes(m.key)).length}/{previewMonths.length})
                  </p>
                  <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={saveExcludedMonths} disabled={savingMonths}>
                    {savingMonths ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Enregistrer les mois
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Décochez un mois pour ne pas le facturer (ex: vacances). Les paiements déjà
                  enregistrés sur un mois décoché restent visibles et comptabilisés.
                </p>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {previewMonths.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      Renseignez des dates d'ouverture/fermeture valides ci-dessus pour voir les mois.
                    </p>
                  ) : previewMonths.map(month => {
                    const excluded = excludedMonths.includes(month.key);
                    const overdue = isMonthOverdue(month, false);
                    return (
                      <label
                        key={month.key}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-muted/40 transition-colors ${excluded ? 'opacity-50' : ''}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Checkbox checked={!excluded} onCheckedChange={() => toggleMonth(month.key)} />
                          <span className="font-medium">{month.label}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {excluded ? (
                            <Badge variant="outline" className="text-xs">Non facturé</Badge>
                          ) : (
                            <>
                              Échéance : {new Date(month.dueDate).toLocaleDateString('fr-FR')}
                              {overdue ? (
                                <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" /> Passée</Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> À venir</Badge>
                              )}
                            </>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-4">
              <Button className="gap-2" onClick={saveBillingTiming} disabled={savingTiming}>
                {savingTiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Emploi du temps */}
        <TabsContent value="horaires">
          <Card>
            <CardHeader>
              <CardTitle>Plage horaire des cours</CardTitle>
              <CardDescription>Détermine les heures affichées dans la grille d'emploi du temps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Heure minimum de début des cours</Label>
                  <Select value={minHour} onValueChange={setMinHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Heure maximum de fin des cours</Label>
                  <Select value={maxHour} onValueChange={setMaxHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-4">
              <Button className="gap-2" onClick={saveHours} disabled={savingHours}>
                {savingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
