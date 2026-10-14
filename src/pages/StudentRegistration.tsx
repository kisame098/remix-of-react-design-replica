import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, User, Phone, Mail, Home, Users, GraduationCap,
  Check, Search, RefreshCw, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchool, Tutor } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { estFormationPro } from '@/lib/modeGestion';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/hooks/use-toast';
import { useFicheInscription } from '@/hooks/useFicheInscription';
import BulkImportStudents from '@/components/student/BulkImportStudents';
import { PhotoPicker } from '@/components/student/PhotoPicker';
import { ChoixFinancement } from '@/components/financements/ChoixFinancement';
import { useAppliquerChoixFinancement } from '@/hooks/useChoixFinancement';
import AcademicChoicesFields, { useAcademicChoicesRequirement } from '@/components/student/AcademicChoicesFields';

// ─── Page principale ──────────────────────────────────────────────────────────

const EMPTY_TUTOR: Tutor = { phone: '', status: '', email: '' };

const StudentRegistration = () => {
  const {
    classes, addStudent, getStudentCountByClass,
    generateStudentId, findStudentByUniqueId, reEnrollStudent,
    resolveFiliereChoice, setFacultativeActive,
  } = useSchool();
  const { school } = useAuth();
  const modeFormationPro = estFormationPro(school);
  // Financement (3FPT…) : '' = aucun. N'apparaît que si l'école l'a activé.
  const [financement, setFinancement] = useState('');
  const appliquerFinancement = useAppliquerChoixFinancement();
  const { currentYear } = useSchoolYear();
  const { toast } = useToast();
  const { montrerFiche, dialogueFiche } = useFicheInscription();

  const [reEnrollId, setReEnrollId]       = useState('');
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [photoUrl, setPhotoUrl]           = useState('');

  // Choix de matières optionnelles (LV, facultatives) — capturés en état local
  // tant que l'élève n'existe pas encore, puis persistés juste après la création.
  const [groupChoices, setGroupChoices]           = useState<Record<string, string>>({});
  const [facultativeChoices, setFacultativeChoices] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    firstName:    '',
    lastName:     '',
    dateOfBirth:  '',
    placeOfBirth: '',
    sex:          '' as 'homme' | 'femme' | '',
    phone:        '',
    email:        '',
    residence:    '',
    classId:      null as string | null,
  });

  const [tutor1, setTutor1] = useState<Tutor>({ ...EMPTY_TUTOR });
  const [tutor2, setTutor2] = useState<Tutor>({ ...EMPTY_TUTOR });

  // ID prévisuel : mis à jour chaque fois que studentRecords change
  const [previewId, setPreviewId] = useState(() => generateStudentId());

  const { groups: requiredChoiceGroups } = useAcademicChoicesRequirement(formData.classId);

  useEffect(() => {
    if (!isReEnrolling) setPreviewId(generateStudentId());
  }, [generateStudentId, isReEnrolling]);

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Les choix de matières optionnelles sont spécifiques à la classe choisie.
    if (field === 'classId') { setGroupChoices({}); setFacultativeChoices({}); }
  };
  const handleTutor1Change = (field: string, value: string) =>
    setTutor1(prev => ({ ...prev, [field]: value }));
  const handleTutor2Change = (field: string, value: string) =>
    setTutor2(prev => ({ ...prev, [field]: value }));

  // ── Recherche pour réinscription ───────────────────────────────────────────
  const handleReEnrollSearch = () => {
    if (!reEnrollId.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un ID élève', variant: 'destructive' });
      return;
    }
    const record = findStudentByUniqueId(reEnrollId.trim());
    if (!record) {
      toast({ title: 'Élève non trouvé', description: 'Aucun élève trouvé avec cet ID.', variant: 'destructive' });
      return;
    }
    setFormData({
      firstName:    record.firstName,
      lastName:     record.lastName,
      dateOfBirth:  record.dateOfBirth,
      placeOfBirth: record.placeOfBirth,
      sex:          record.sex,
      phone:        record.phone || '',
      email:        record.email || '',
      residence:    record.residence,
      classId:      null,
    });
    setTutor1({ ...record.tutor1 });
    setTutor2(record.tutor2 ? { ...record.tutor2 } : { ...EMPTY_TUTOR });
    setPreviewId(record.uniqueId);
    setIsReEnrolling(true);
    toast({
      title: 'Élève trouvé !',
      description: `${record.firstName} ${record.lastName} — Sélectionnez une classe pour confirmer.`,
    });
  };

  // ── Confirmation de réinscription ──────────────────────────────────────────
  const handleReEnrollSubmit = async () => {
    if (!formData.classId) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une classe', variant: 'destructive' });
      return;
    }
    const unanswered = requiredChoiceGroups.filter(g => !groupChoices[g.id]);
    if (unanswered.length > 0) {
      toast({
        title: 'Choix de matières requis',
        description: `Veuillez choisir : ${unanswered.map(g => g.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const student = await reEnrollStudent(reEnrollId.trim(), formData.classId);
      if (!student) {
        toast({ title: 'Erreur', description: "Impossible de réinscrire l'élève (déjà inscrit cette année ?).", variant: 'destructive' });
        return;
      }
      if (Object.keys(groupChoices).length > 0 || Object.values(facultativeChoices).some(Boolean)) {
        await persistAcademicChoices(student.id);
      }
      toast({
        title: 'Réinscription réussie !',
        description: `${student.firstName} ${student.lastName} réinscrit pour ${currentYear?.name || 'cette année'}.`,
      });
      if (financement) await appliquerFinancement(student, financement);
      // La fiche s'ouvre APRÈS le succès : l'inscription est déjà enregistrée.
      montrerFiche(student, { reinscription: true });
      resetAll();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setFinancement('');
    setReEnrollId('');
    setIsReEnrolling(false);
    setPhotoUrl('');
    setFormData({ firstName: '', lastName: '', dateOfBirth: '', placeOfBirth: '', sex: '', phone: '', email: '', residence: '', classId: null });
    setTutor1({ ...EMPTY_TUTOR });
    setTutor2({ ...EMPTY_TUTOR });
    setPreviewId(generateStudentId());
    setGroupChoices({});
    setFacultativeChoices({});
  };

  // Persiste les choix de matières optionnelles juste après la création de
  // l'inscription (impossible avant : la RPC a besoin d'un student_enrollment_id réel).
  const persistAcademicChoices = async (studentEnrollmentId: string) => {
    for (const [groupId, subjectName] of Object.entries(groupChoices)) {
      await resolveFiliereChoice(groupId, studentEnrollmentId, subjectName, 'admin_inscription');
    }
    for (const [subjectName, active] of Object.entries(facultativeChoices)) {
      if (active) await setFacultativeActive(studentEnrollmentId, subjectName, true);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const checks: [boolean, string][] = [
      [!!formData.firstName.trim(),    'Le prénom est obligatoire'],
      [!!formData.lastName.trim(),     'Le nom est obligatoire'],
      [!!formData.dateOfBirth,         'La date de naissance est obligatoire'],
      [!!formData.placeOfBirth.trim(), 'Le lieu de naissance est obligatoire'],
      [!!formData.sex,                 'Le sexe est obligatoire'],
      [!!formData.residence.trim(),    'Le lieu de résidence est obligatoire'],
      [!!tutor1.phone.trim(),          'Le numéro du tuteur 1 est obligatoire'],
      [!!tutor1.status,                'Le statut du tuteur 1 est obligatoire'],
      [!!formData.classId,             'Veuillez sélectionner une classe'],
    ];
    for (const [ok, msg] of checks) {
      if (!ok) {
        toast({ title: 'Erreur', description: msg, variant: 'destructive' });
        return false;
      }
    }
    const cls = classes.find(c => c.id === formData.classId);
    if (cls && getStudentCountByClass(cls.id) >= cls.studentLimit) {
      toast({ title: 'Erreur', description: 'Cette classe est pleine', variant: 'destructive' });
      return false;
    }
    const unanswered = requiredChoiceGroups.filter(g => !groupChoices[g.id]);
    if (unanswered.length > 0) {
      toast({
        title: 'Choix de matières requis',
        description: `Veuillez choisir : ${unanswered.map(g => g.label).join(', ')}`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  // ── Soumission inscription ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const student = await addStudent({
        firstName:    formData.firstName,
        lastName:     formData.lastName,
        dateOfBirth:  formData.dateOfBirth,
        placeOfBirth: formData.placeOfBirth,
        sex:          formData.sex as 'homme' | 'femme',
        phone:        formData.phone   || undefined,
        email:        formData.email   || undefined,
        residence:    formData.residence,
        tutor1:       tutor1 as Tutor,
        tutor2:       tutor2.phone ? tutor2 as Tutor : undefined,
        classId:      formData.classId,
        photoUrl:     photoUrl || undefined,
      });

      if (Object.keys(groupChoices).length > 0 || Object.values(facultativeChoices).some(Boolean)) {
        await persistAcademicChoices(student.id);
      }

      toast({
        title: 'Inscription réussie !',
        description: `${student.firstName} ${student.lastName} — ID : ${student.studentId}`,
      });
      if (financement) await appliquerFinancement(student, financement);
      // La fiche s'ouvre APRÈS le succès : l'inscription est déjà enregistrée.
      montrerFiche(student, { reinscription: false });
      resetAll();
    } catch (err) {
      toast({ title: "Erreur lors de l'inscription", description: String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableClasses = classes.filter(c => getStudentCountByClass(c.id) < c.studentLimit);

  const tutorStatuses = [
    { value: 'pere',  label: 'Père'  },
    { value: 'mere',  label: 'Mère'  },
    { value: 'oncle', label: 'Oncle' },
    { value: 'tante', label: 'Tante' },
    { value: 'autre', label: 'Autre' },
  ];

  const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(' ');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Inscription Élève</h1>
              <p className="text-muted-foreground">
                {currentYear ? `Année ${currentYear.name}` : 'Enregistrez un nouvel élève dans le système'}
              </p>
            </div>
          </div>
          <BulkImportStudents />
        </div>

        {/* Alerte année scolaire manquante */}
        {!currentYear && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 text-center text-sm text-destructive">
              Aucune année scolaire sélectionnée. Créez-en une avant d'inscrire des élèves.
            </CardContent>
          </Card>
        )}

        {/* Réinscription rapide */}
        <Card className="mb-6 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              Réinscription Rapide
            </CardTitle>
            <CardDescription>
              Élève déjà inscrit une année précédente ? Saisissez son ID pour réinscrire rapidement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: ETU-2024-00001"
                  value={reEnrollId}
                  onChange={e => setReEnrollId(e.target.value)}
                  className="pl-9 font-mono"
                  disabled={isReEnrolling}
                  onKeyDown={e => e.key === 'Enter' && !isReEnrolling && handleReEnrollSearch()}
                />
              </div>
              {isReEnrolling ? (
                <>
                  <Button type="button" onClick={handleReEnrollSubmit} disabled={isSubmitting} className="gap-2">
                    {isSubmitting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Check className="w-4 h-4" />
                    }
                    Confirmer Réinscription
                  </Button>
                  <Button type="button" variant="outline" onClick={resetAll} disabled={isSubmitting}>
                    Annuler
                  </Button>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={handleReEnrollSearch} className="gap-2">
                  <Search className="w-4 h-4" /> Rechercher
                </Button>
              )}
            </div>
            {isReEnrolling && (
              <p className="text-sm text-amber-600 mt-3">
                ✓ Élève trouvé ! Les informations ont été pré-remplies. Sélectionnez une classe et confirmez.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ID preview */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {isReEnrolling ? 'ID Élève (réinscription) :' : 'ID qui sera généré :'}
                </span>
              </div>
              <span className="font-mono font-bold text-primary text-lg">{previewId}</span>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Informations Personnelles
              </CardTitle>
              <CardDescription>Informations de base de l'élève</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Photo */}
              <div className="pb-4 border-b">
                <PhotoPicker value={photoUrl} onChange={setPhotoUrl} name={fullName} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" placeholder="Nom de famille"
                    value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)}
                    disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input id="firstName" placeholder="Prénom"
                    value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)}
                    disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                  <Input id="dateOfBirth" type="date"
                    value={formData.dateOfBirth} onChange={e => handleInputChange('dateOfBirth', e.target.value)}
                    disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Lieu de naissance *</Label>
                  <Input id="placeOfBirth" placeholder="Ville de naissance"
                    value={formData.placeOfBirth} onChange={e => handleInputChange('placeOfBirth', e.target.value)}
                    disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>Sexe *</Label>
                  <Select value={formData.sex} onValueChange={v => handleInputChange('sex', v)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner le sexe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homme">Homme</SelectItem>
                      <SelectItem value="femme">Femme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residence">Lieu de résidence *</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="residence" className="pl-10" placeholder="Adresse de résidence"
                      value={formData.residence} onChange={e => handleInputChange('residence', e.target.value)}
                      disabled={isSubmitting} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone (optionnel)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="phone" className="pl-10" placeholder="Numéro de téléphone"
                      value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)}
                      disabled={isSubmitting} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optionnel)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" className="pl-10" placeholder="Adresse email"
                      value={formData.email} onChange={e => handleInputChange('email', e.target.value)}
                      disabled={isSubmitting} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tuteur 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Tuteur 1 (Obligatoire)
              </CardTitle>
              <CardDescription>Informations du tuteur principal</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Statut *</Label>
                <Select value={tutor1.status} onValueChange={v => handleTutor1Change('status', v)} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Relation avec l'élève" /></SelectTrigger>
                  <SelectContent>
                    {tutorStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-10" placeholder="Numéro du tuteur"
                    value={tutor1.phone} onChange={e => handleTutor1Change('phone', e.target.value)}
                    disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (optionnel)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" className="pl-10" placeholder="Email du tuteur"
                    value={tutor1.email} onChange={e => handleTutor1Change('email', e.target.value)}
                    disabled={isSubmitting} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tuteur 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                Tuteur 2 (Optionnel)
              </CardTitle>
              <CardDescription>Informations d'un tuteur secondaire</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={tutor2.status} onValueChange={v => handleTutor2Change('status', v)} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Relation avec l'élève" /></SelectTrigger>
                  <SelectContent>
                    {tutorStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-10" placeholder="Numéro du tuteur"
                    value={tutor2.phone} onChange={e => handleTutor2Change('phone', e.target.value)}
                    disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" className="pl-10" placeholder="Email du tuteur"
                    value={tutor2.email} onChange={e => handleTutor2Change('email', e.target.value)}
                    disabled={isSubmitting} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                {modeFormationPro ? 'Promotion' : 'Classe'}
              </CardTitle>
              <CardDescription>
                {modeFormationPro ? "Sélectionnez la promotion de l'élève pour cette année" : "Sélectionnez la classe de l'élève pour cette année"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{modeFormationPro ? 'Aucune promotion disponible pour cette année.' : 'Aucune classe disponible pour cette année.'}</p>
                  <p className="text-sm">
                    {modeFormationPro
                      ? 'Veuillez d\'abord créer une promotion dans « Formation professionnelle → Promotions ».'
                      : 'Veuillez d\'abord créer des classes dans "Gestion Classe".'}
                  </p>
                </div>
              ) : availableClasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{modeFormationPro ? 'Toutes les promotions sont pleines.' : 'Toutes les classes sont pleines.'}</p>
                </div>
              ) : (
                <Select
                  value={formData.classId ?? ''}
                  onValueChange={v => handleInputChange('classId', v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder={modeFormationPro ? 'Sélectionner une promotion' : 'Sélectionner une classe'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(cls => {
                      const count = getStudentCountByClass(cls.id);
                      return (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({count}/{cls.studentLimit} élèves)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {modeFormationPro && (
                <div className="mt-4">
                  <ChoixFinancement valeur={financement} onChange={setFinancement} disabled={isSubmitting} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Choix de matières optionnelles (si la classe l'exige) */}
          <AcademicChoicesFields
            classId={formData.classId}
            groupChoices={groupChoices}
            onGroupChoiceChange={(groupId, subjectName) => setGroupChoices(prev => ({ ...prev, [groupId]: subjectName }))}
            facultativeChoices={facultativeChoices}
            onFacultativeToggle={(subjectName, active) => setFacultativeChoices(prev => ({ ...prev, [subjectName]: active }))}
            disabled={isSubmitting}
          />

          {/* Bouton submit */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={!currentYear || classes.length === 0 || availableClasses.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Check className="w-5 h-5" />
              }
              {isSubmitting ? 'Enregistrement…' : "Inscrire l'élève"}
            </Button>
          </motion.div>
        </form>
      </motion.div>

      {dialogueFiche}
    </div>
  );
};

export default StudentRegistration;
