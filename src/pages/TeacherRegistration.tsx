import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, User, Phone, Mail, Home, Briefcase,
  GraduationCap, Check, Clock, Award, Search, RefreshCw,
  Camera, Upload, X, SwitchCamera, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/hooks/use-toast';

// ─── Compression image ───────────────────────────────────────────────────────

const compressImage = (dataUrl: string, maxSize = 320): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = dataUrl;
  });

// ─── Composant PhotoPicker ────────────────────────────────────────────────────

interface PhotoPickerProps {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}

const PhotoPicker = ({ value, onChange, name }: PhotoPickerProps) => {
  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream,     setStream]     = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [camError,   setCamError]   = useState('');
  const [capturing,  setCapturing]  = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraOpen(false);
    setCamError('');
  }, [stream]);

  const openCamera = async (facing: 'user' | 'environment' = facingMode) => {
    try {
      stream?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(s);
      setFacingMode(facing);
      setCamError('');
      setCameraOpen(true);
    } catch {
      setCamError('Caméra non disponible ou accès refusé.');
      setCameraOpen(true);
    }
  };

  const switchCamera = () => openCamera(facingMode === 'user' ? 'environment' : 'user');

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 320;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const compressed = await compressImage(canvas.toDataURL('image/jpeg', 0.9));
    onChange(compressed);
    stopCamera();
    setCapturing(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      onChange(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        {/* Aperçu */}
        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center relative">
          {value ? (
            <>
              <img src={value} alt={name ?? 'Photo'} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <User className="w-12 h-12 text-muted-foreground/40" />
          )}
        </div>

        {/* Boutons */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openCamera()} className="gap-1.5">
            <Camera className="w-4 h-4" />
            Caméra
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-4 h-4" />
            Fichier
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Dialog caméra */}
      <Dialog open={cameraOpen} onOpenChange={open => { if (!open) stopCamera(); }}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle>Prendre une photo</DialogTitle>
          </DialogHeader>
          {camError ? (
            <p className="text-sm text-destructive text-center py-6">{camError}</p>
          ) : (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" size="icon" onClick={switchCamera} className="h-11 w-11 flex-shrink-0">
              <SwitchCamera className="h-5 w-5" />
            </Button>
            <Button type="button" className="flex-1 h-11 gap-2" onClick={capturePhoto} disabled={capturing || !!camError}>
              <Camera className="h-5 w-5" />
              {capturing ? 'Capture…' : 'Capturer'}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={stopCamera} className="h-11 w-11 flex-shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

const TeacherRegistration = () => {
  const {
    addTeacher, generateTeacherId, findTeacherByUniqueId, reEnrollTeacher,
  } = useSchool();
  const { currentYear } = useSchoolYear();
  const { toast } = useToast();

  const [reEnrollId, setReEnrollId]     = useState('');
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl]         = useState('');

  const [formData, setFormData] = useState({
    firstName:       '',
    lastName:        '',
    dateOfBirth:     '',
    placeOfBirth:    '',
    sex:             '' as 'homme' | 'femme' | '',
    phone:           '',
    email:           '',
    residence:       '',
    diploma:         '',
    yearsExperience: '',
    emergencyPhone:  '',
    contractType:    '' as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire' | '',
    paymentType:     '' as 'hourly' | 'fixed' | '',
    salaryAmount:    '',
  });

  // ID prévisuel — mis à jour quand les teacherRecords changent
  const [previewId, setPreviewId] = useState(() => generateTeacherId());
  useEffect(() => {
    if (!isReEnrolling) setPreviewId(generateTeacherId());
  }, [generateTeacherId, isReEnrolling]);

  const handleInputChange = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const resetAll = () => {
    setReEnrollId('');
    setIsReEnrolling(false);
    setPhotoUrl('');
    setFormData({
      firstName: '', lastName: '', dateOfBirth: '', placeOfBirth: '', sex: '',
      phone: '', email: '', residence: '', diploma: '', yearsExperience: '',
      emergencyPhone: '', contractType: '', paymentType: '', salaryAmount: '',
    });
    setPreviewId(generateTeacherId());
  };

  // ── Recherche pour réinscription ───────────────────────────────────────────
  const handleReEnrollSearch = () => {
    if (!reEnrollId.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un ID professeur', variant: 'destructive' });
      return;
    }
    const record = findTeacherByUniqueId(reEnrollId.trim());
    if (!record) {
      toast({ title: 'Professeur non trouvé', description: 'Aucun professeur trouvé avec cet ID.', variant: 'destructive' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      firstName:      record.firstName,
      lastName:       record.lastName,
      dateOfBirth:    record.dateOfBirth,
      placeOfBirth:   record.placeOfBirth,
      sex:            record.sex,
      phone:          record.phone      ?? '',
      email:          record.email      ?? '',
      residence:      record.residence,
      diploma:        record.diploma,
      emergencyPhone: record.emergencyPhone,
    }));
    setPreviewId(record.uniqueId);
    setIsReEnrolling(true);
    toast({
      title: 'Professeur trouvé !',
      description: `${record.firstName} ${record.lastName} — Complétez les infos de contrat.`,
    });
  };

  // ── Confirmation de réinscription ──────────────────────────────────────────
  const handleReEnrollSubmit = async () => {
    if (!formData.contractType || !formData.paymentType || !formData.salaryAmount || !formData.yearsExperience) {
      toast({ title: 'Erreur', description: 'Complétez les informations de contrat', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const teacher = await reEnrollTeacher(reEnrollId.trim(), {
        yearsExperience: parseInt(formData.yearsExperience) || 0,
        contractType:    formData.contractType as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire',
        paymentType:     formData.paymentType  as 'hourly' | 'fixed',
        salaryAmount:    parseFloat(formData.salaryAmount) || 0,
      });
      if (!teacher) {
        toast({ title: 'Erreur', description: 'Impossible de réinscrire. Déjà inscrit cette année ?', variant: 'destructive' });
        return;
      }
      toast({
        title: 'Réinscription réussie !',
        description: `${teacher.firstName} ${teacher.lastName} réinscrit pour ${currentYear?.name || 'cette année'}.`,
      });
      resetAll();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const checks: [boolean, string][] = [
      [!!formData.firstName.trim(),       'Le prénom est obligatoire'],
      [!!formData.lastName.trim(),        'Le nom est obligatoire'],
      [!!formData.dateOfBirth,            'La date de naissance est obligatoire'],
      [!!formData.placeOfBirth.trim(),    'Le lieu de naissance est obligatoire'],
      [!!formData.sex,                    'Le sexe est obligatoire'],
      [!!formData.phone.trim(),           'Le numéro de téléphone est obligatoire'],
      [!!formData.residence.trim(),       'Le lieu de résidence est obligatoire'],
      [!!formData.diploma.trim(),         'Le diplôme est obligatoire'],
      [!!formData.yearsExperience,        "Les années d'expérience sont obligatoires"],
      [!!formData.emergencyPhone.trim(),  "Le numéro d'urgence est obligatoire"],
      [!!formData.contractType,           'Le type de contrat est obligatoire'],
      [!!formData.paymentType,            'Le type de paiement est obligatoire'],
      [!!formData.salaryAmount && parseFloat(formData.salaryAmount) > 0, 'Le montant du salaire est obligatoire'],
    ];
    for (const [ok, msg] of checks) {
      if (!ok) {
        toast({ title: 'Erreur', description: msg, variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  // ── Soumission nouvelle inscription ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const teacher = await addTeacher({
        firstName:       formData.firstName,
        lastName:        formData.lastName,
        dateOfBirth:     formData.dateOfBirth,
        placeOfBirth:    formData.placeOfBirth,
        sex:             formData.sex as 'homme' | 'femme',
        phone:           formData.phone,
        email:           formData.email || undefined,
        residence:       formData.residence,
        diploma:         formData.diploma,
        yearsExperience: parseInt(formData.yearsExperience) || 0,
        emergencyPhone:  formData.emergencyPhone,
        contractType:    formData.contractType as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire',
        paymentType:     formData.paymentType  as 'hourly' | 'fixed',
        salaryAmount:    parseFloat(formData.salaryAmount) || 0,
        photoUrl:        photoUrl || undefined,
      });
      toast({
        title: 'Inscription réussie !',
        description: `${teacher.firstName} ${teacher.lastName} — ID : ${teacher.teacherId}`,
      });
      resetAll();
    } catch (err) {
      toast({ title: "Erreur lors de l'inscription", description: String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contractTypes = [
    { value: 'cdi',       label: 'CDI (Contrat à Durée Indéterminée)' },
    { value: 'cdd',       label: 'CDD (Contrat à Durée Déterminée)' },
    { value: 'vacataire', label: 'Vacataire' },
    { value: 'stagiaire', label: 'Stagiaire' },
  ];

  const paymentTypes = [
    { value: 'hourly', label: "Payé à l'heure" },
    { value: 'fixed',  label: 'Salaire fixe' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inscription Professeur</h1>
            <p className="text-muted-foreground">Enregistrez un nouveau professeur dans le système</p>
          </div>
        </div>

        {/* Réinscription rapide */}
        <Card className="mb-6 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              Réinscription Rapide
            </CardTitle>
            <CardDescription>
              Professeur déjà inscrit ? Saisissez son ID pour réinscrire rapidement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Ex: PROF-2024-00001"
                value={reEnrollId}
                onChange={e => setReEnrollId(e.target.value)}
                className="flex-1 font-mono"
                disabled={isReEnrolling || isSubmitting}
              />
              {isReEnrolling ? (
                <>
                  <Button type="button" onClick={handleReEnrollSubmit} disabled={isSubmitting} className="gap-2">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmer
                  </Button>
                  <Button type="button" variant="outline" onClick={resetAll} disabled={isSubmitting}>
                    Annuler
                  </Button>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={handleReEnrollSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  Rechercher
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aperçu ID */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {isReEnrolling ? 'ID Professeur (réinscription) :' : 'ID Professeur qui sera généré :'}
                </span>
              </div>
              <span className="font-mono font-bold text-primary text-lg">{previewId}</span>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Photo du Professeur
              </CardTitle>
              <CardDescription>Photo d'identité (optionnel)</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PhotoPicker
                value={photoUrl}
                onChange={setPhotoUrl}
                name={formData.firstName ? `${formData.firstName} ${formData.lastName}` : undefined}
              />
            </CardContent>
          </Card>

          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Informations Personnelles
              </CardTitle>
              <CardDescription>Informations de base du professeur</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  placeholder="Nom de famille"
                  value={formData.lastName}
                  onChange={e => handleInputChange('lastName', e.target.value)}
                  disabled={isReEnrolling || isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  placeholder="Prénom"
                  value={formData.firstName}
                  onChange={e => handleInputChange('firstName', e.target.value)}
                  disabled={isReEnrolling || isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => handleInputChange('dateOfBirth', e.target.value)}
                  disabled={isReEnrolling || isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="placeOfBirth">Lieu de naissance *</Label>
                <Input
                  id="placeOfBirth"
                  placeholder="Ville de naissance"
                  value={formData.placeOfBirth}
                  onChange={e => handleInputChange('placeOfBirth', e.target.value)}
                  disabled={isReEnrolling || isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexe *</Label>
                <Select
                  value={formData.sex}
                  onValueChange={v => handleInputChange('sex', v)}
                  disabled={isReEnrolling || isSubmitting}
                >
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
                  <Input
                    id="residence"
                    className="pl-10"
                    placeholder="Adresse de résidence"
                    value={formData.residence}
                    onChange={e => handleInputChange('residence', e.target.value)}
                    disabled={isReEnrolling || isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-10"
                    placeholder="Numéro de téléphone"
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    disabled={isReEnrolling || isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optionnel)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10"
                    placeholder="Adresse email"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    disabled={isReEnrolling || isSubmitting}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations professionnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Informations Professionnelles
              </CardTitle>
              <CardDescription>Diplôme et expérience du professeur</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="diploma">Diplôme *</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="diploma"
                    className="pl-10"
                    placeholder="Ex: Licence en Mathématiques, Master en Physique…"
                    value={formData.diploma}
                    onChange={e => handleInputChange('diploma', e.target.value)}
                    disabled={isReEnrolling || isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Années d'expérience *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    className="pl-10"
                    placeholder="Nombre d'années"
                    value={formData.yearsExperience}
                    onChange={e => handleInputChange('yearsExperience', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyPhone">Numéro d'urgence *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="emergencyPhone"
                    className="pl-10"
                    placeholder="Numéro de contact en cas d'urgence"
                    value={formData.emergencyPhone}
                    onChange={e => handleInputChange('emergencyPhone', e.target.value)}
                    disabled={isReEnrolling || isSubmitting}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contrat et paiement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Contrat et Paiement
              </CardTitle>
              <CardDescription>Type de contrat et mode de paiement</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de contrat *</Label>
                <Select
                  value={formData.contractType}
                  onValueChange={v => handleInputChange('contractType', v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner le type de contrat" /></SelectTrigger>
                  <SelectContent>
                    {contractTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de paiement *</Label>
                <Select
                  value={formData.paymentType}
                  onValueChange={v => handleInputChange('paymentType', v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner le mode de paiement" /></SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.paymentType && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="salaryAmount">
                    {formData.paymentType === 'hourly' ? 'Taux horaire (FCFA/heure) *' : 'Salaire mensuel (FCFA) *'}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">FCFA</span>
                    <Input
                      id="salaryAmount"
                      type="number"
                      min="0"
                      className="pl-14"
                      placeholder={formData.paymentType === 'hourly' ? 'Ex: 5000' : 'Ex: 150000'}
                      value={formData.salaryAmount}
                      onChange={e => handleInputChange('salaryAmount', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bouton soumission */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2 py-6 text-lg font-semibold"
              disabled={isSubmitting || isReEnrolling}
            >
              {isSubmitting
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Check className="w-5 h-5" />
              }
              {isSubmitting ? 'Inscription en cours…' : 'Inscrire le Professeur'}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};

export default TeacherRegistration;
