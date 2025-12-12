import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, User, Calendar, MapPin, Phone, Mail, Home, Briefcase, GraduationCap, Check, Clock, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchool } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';

const TeacherRegistration = () => {
  const { addTeacher, generateTeacherId } = useSchool();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    sex: '' as 'homme' | 'femme' | '',
    phone: '',
    email: '',
    residence: '',
    diploma: '',
    yearsExperience: '',
    emergencyPhone: '',
    contractType: '' as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire' | '',
    paymentType: '' as 'hourly' | 'fixed' | '',
    salaryAmount: '',
  });

  const [previewId, setPreviewId] = useState(generateTeacherId());

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      toast({ title: "Erreur", description: "Le prénom est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.lastName.trim()) {
      toast({ title: "Erreur", description: "Le nom est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.dateOfBirth) {
      toast({ title: "Erreur", description: "La date de naissance est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.placeOfBirth.trim()) {
      toast({ title: "Erreur", description: "Le lieu de naissance est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.sex) {
      toast({ title: "Erreur", description: "Le sexe est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.phone.trim()) {
      toast({ title: "Erreur", description: "Le numéro de téléphone est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.residence.trim()) {
      toast({ title: "Erreur", description: "Le lieu de résidence est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.diploma.trim()) {
      toast({ title: "Erreur", description: "Le diplôme est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.yearsExperience) {
      toast({ title: "Erreur", description: "Les années d'expérience sont obligatoires", variant: "destructive" });
      return false;
    }
    if (!formData.emergencyPhone.trim()) {
      toast({ title: "Erreur", description: "Le numéro d'urgence est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.contractType) {
      toast({ title: "Erreur", description: "Le type de contrat est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.paymentType) {
      toast({ title: "Erreur", description: "Le type de paiement est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.salaryAmount || parseFloat(formData.salaryAmount) <= 0) {
      toast({ title: "Erreur", description: "Le montant du salaire est obligatoire", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const teacher = addTeacher({
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      placeOfBirth: formData.placeOfBirth,
      sex: formData.sex as 'homme' | 'femme',
      phone: formData.phone,
      email: formData.email || undefined,
      residence: formData.residence,
      diploma: formData.diploma,
      yearsExperience: parseInt(formData.yearsExperience),
      emergencyPhone: formData.emergencyPhone,
      contractType: formData.contractType as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire',
      paymentType: formData.paymentType as 'hourly' | 'fixed',
      salaryAmount: parseFloat(formData.salaryAmount),
    });

    toast({
      title: "Inscription réussie!",
      description: `Le professeur ${teacher.firstName} ${teacher.lastName} a été inscrit avec l'ID: ${teacher.teacherId}`,
    });
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      placeOfBirth: '',
      sex: '',
      phone: '',
      email: '',
      residence: '',
      diploma: '',
      yearsExperience: '',
      emergencyPhone: '',
      contractType: '',
      paymentType: '',
      salaryAmount: '',
    });
    setPreviewId(generateTeacherId());
  };

  const contractTypes = [
    { value: 'cdi', label: 'CDI (Contrat à Durée Indéterminée)' },
    { value: 'cdd', label: 'CDD (Contrat à Durée Déterminée)' },
    { value: 'vacataire', label: 'Vacataire' },
    { value: 'stagiaire', label: 'Stagiaire' },
  ];

  const paymentTypes = [
    { value: 'hourly', label: 'Payé à l\'heure' },
    { value: 'fixed', label: 'Salaire fixe' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inscription Professeur</h1>
            <p className="text-muted-foreground">Enregistrez un nouveau professeur dans le système</p>
          </div>
        </div>

        {/* Preview Teacher ID */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">ID Professeur qui sera généré:</span>
              </div>
              <span className="font-mono font-bold text-primary text-lg">{previewId}</span>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
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
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  placeholder="Prénom"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="placeOfBirth">Lieu de naissance *</Label>
                <Input
                  id="placeOfBirth"
                  placeholder="Ville de naissance"
                  value={formData.placeOfBirth}
                  onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexe *</Label>
                <Select value={formData.sex} onValueChange={(value) => handleInputChange('sex', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le sexe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homme">Homme</SelectItem>
                    <SelectItem value="femme">Femme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="residence">Lieu de résidence *</Label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="residence"
                    className="pl-10"
                    placeholder="Adresse de résidence"
                    value={formData.residence}
                    onChange={(e) => handleInputChange('residence', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-10"
                    placeholder="Numéro de téléphone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optionnel)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10"
                    placeholder="Adresse email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
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
                  <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="diploma"
                    className="pl-10"
                    placeholder="Ex: Licence en Mathématiques, Master en Physique..."
                    value={formData.diploma}
                    onChange={(e) => handleInputChange('diploma', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Années d'expérience *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    className="pl-10"
                    placeholder="Nombre d'années"
                    value={formData.yearsExperience}
                    onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyPhone">Numéro d'urgence *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="emergencyPhone"
                    className="pl-10"
                    placeholder="Numéro de contact en cas d'urgence"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract Information */}
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
                <Select value={formData.contractType} onValueChange={(value) => handleInputChange('contractType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type de contrat" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de paiement *</Label>
                <Select value={formData.paymentType} onValueChange={(value) => handleInputChange('paymentType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
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
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">FCFA</span>
                    <Input
                      id="salaryAmount"
                      type="number"
                      min="0"
                      className="pl-14"
                      placeholder={formData.paymentType === 'hourly' ? 'Ex: 5000' : 'Ex: 150000'}
                      value={formData.salaryAmount}
                      onChange={(e) => handleInputChange('salaryAmount', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Button 
              type="submit" 
              size="lg" 
              className="w-full gap-2 py-6 text-lg font-semibold"
            >
              <Check className="w-5 h-5" />
              Inscrire le Professeur
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};

export default TeacherRegistration;
