import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, User, Calendar, MapPin, Phone, Mail, Home, Users, GraduationCap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchool, Tutor } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';

const StudentRegistration = () => {
  const { classes, addStudent, getStudentCountByClass, generateStudentId } = useSchool();
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
    classId: null as number | null,
  });

  const [tutor1, setTutor1] = useState<Tutor>({
    phone: '',
    status: '',
    email: '',
  });

  const [tutor2, setTutor2] = useState<Tutor>({
    phone: '',
    status: '',
    email: '',
  });

  const [previewId, setPreviewId] = useState(generateStudentId());

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTutor1Change = (field: string, value: string) => {
    setTutor1(prev => ({ ...prev, [field]: value }));
  };

  const handleTutor2Change = (field: string, value: string) => {
    setTutor2(prev => ({ ...prev, [field]: value }));
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
    if (!formData.residence.trim()) {
      toast({ title: "Erreur", description: "Le lieu de résidence est obligatoire", variant: "destructive" });
      return false;
    }
    if (!tutor1.phone.trim()) {
      toast({ title: "Erreur", description: "Le numéro du tuteur 1 est obligatoire", variant: "destructive" });
      return false;
    }
    if (!tutor1.status) {
      toast({ title: "Erreur", description: "Le statut du tuteur 1 est obligatoire", variant: "destructive" });
      return false;
    }
    if (!formData.classId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une classe", variant: "destructive" });
      return false;
    }

    // Check if class is full
    const selectedClass = classes.find(c => c.id === formData.classId);
    if (selectedClass) {
      const currentCount = getStudentCountByClass(selectedClass.id);
      if (currentCount >= selectedClass.studentLimit) {
        toast({ title: "Erreur", description: "Cette classe est pleine", variant: "destructive" });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const student = addStudent({
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      placeOfBirth: formData.placeOfBirth,
      sex: formData.sex as 'homme' | 'femme',
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      residence: formData.residence,
      tutor1: tutor1 as Tutor,
      tutor2: tutor2.phone ? tutor2 as Tutor : undefined,
      classId: formData.classId,
    });

    toast({
      title: "Inscription réussie!",
      description: `L'élève ${student.firstName} ${student.lastName} a été inscrit avec l'ID: ${student.studentId}`,
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
      classId: null,
    });
    setTutor1({ phone: '', status: '', email: '' });
    setTutor2({ phone: '', status: '', email: '' });
    setPreviewId(generateStudentId());
  };

  const availableClasses = classes.filter(c => {
    const count = getStudentCountByClass(c.id);
    return count < c.studentLimit;
  });

  const tutorStatuses = [
    { value: 'pere', label: 'Père' },
    { value: 'mere', label: 'Mère' },
    { value: 'oncle', label: 'Oncle' },
    { value: 'tante', label: 'Tante' },
    { value: 'autre', label: 'Autre' },
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
            <h1 className="text-2xl font-bold text-foreground">Inscription Élève</h1>
            <p className="text-muted-foreground">Enregistrez un nouvel élève dans le système</p>
          </div>
        </div>

        {/* Preview Student ID */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">ID Étudiant qui sera généré:</span>
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
              <CardDescription>Informations de base de l'élève</CardDescription>
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
                <Label htmlFor="phone">Téléphone (optionnel)</Label>
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

          {/* Tutor 1 */}
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
                <Select value={tutor1.status} onValueChange={(value) => handleTutor1Change('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Relation avec l'élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutorStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Numéro du tuteur"
                    value={tutor1.phone}
                    onChange={(e) => handleTutor1Change('phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (optionnel)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="Email du tuteur"
                    value={tutor1.email}
                    onChange={(e) => handleTutor1Change('email', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tutor 2 */}
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
                <Select value={tutor2.status} onValueChange={(value) => handleTutor2Change('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Relation avec l'élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutorStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Numéro du tuteur"
                    value={tutor2.phone}
                    onChange={(e) => handleTutor2Change('phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="Email du tuteur"
                    value={tutor2.email}
                    onChange={(e) => handleTutor2Change('email', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Class Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Classe
              </CardTitle>
              <CardDescription>Sélectionnez la classe de l'élève</CardDescription>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune classe disponible.</p>
                  <p className="text-sm">Veuillez d'abord créer des classes dans "Gestion Classe".</p>
                </div>
              ) : availableClasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Toutes les classes sont pleines.</p>
                  <p className="text-sm">Veuillez augmenter la limite ou créer de nouvelles classes.</p>
                </div>
              ) : (
                <Select 
                  value={formData.classId?.toString() || ''} 
                  onValueChange={(value) => handleInputChange('classId', parseInt(value))}
                >
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Sélectionner une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(cls => {
                      const count = getStudentCountByClass(cls.id);
                      return (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name} ({count}/{cls.studentLimit} élèves)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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
              className="w-full gap-2"
              disabled={classes.length === 0 || availableClasses.length === 0}
            >
              <Check className="w-5 h-5" />
              Inscrire l'élève
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};

export default StudentRegistration;
