import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Grid3X3, List, Eye, Pencil, 
  Phone, Mail, MapPin, Calendar, User, X, Save, Briefcase, Home, GraduationCap, Clock, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useSchool, Teacher } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';

interface EditFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme' | '';
  phone: string;
  email: string;
  residence: string;
  diploma: string;
  yearsExperience: string;
  emergencyPhone: string;
  contractType: 'cdi' | 'cdd' | 'vacataire' | 'stagiaire' | '';
  paymentType: 'hourly' | 'fixed' | '';
  salaryAmount: string;
}

type ViewMode = 'grid' | 'table';

const TeacherManagement = () => {
  const { teachers, updateTeacher } = useSchool();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const contractTypes = [
    { value: 'cdi', label: 'CDI' },
    { value: 'cdd', label: 'CDD' },
    { value: 'vacataire', label: 'Vacataire' },
    { value: 'stagiaire', label: 'Stagiaire' },
  ];

  const paymentTypes = [
    { value: 'hourly', label: 'Payé à l\'heure' },
    { value: 'fixed', label: 'Salaire fixe' },
  ];

  const [editForm, setEditForm] = useState<EditFormData>({
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

  // Filter and search teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        teacher.firstName.toLowerCase().includes(searchLower) ||
        teacher.lastName.toLowerCase().includes(searchLower) ||
        teacher.teacherId.toLowerCase().includes(searchLower);

      const matchesContract = 
        contractFilter === 'all' || 
        teacher.contractType === contractFilter;

      return matchesSearch && matchesContract;
    });
  }, [teachers, searchQuery, contractFilter]);

  const getContractLabel = (type: string): string => {
    const labels: Record<string, string> = {
      cdi: 'CDI',
      cdd: 'CDD',
      vacataire: 'Vacataire',
      stagiaire: 'Stagiaire'
    };
    return labels[type] || type;
  };

  const getPaymentLabel = (type: string): string => {
    return type === 'hourly' ? 'À l\'heure' : 'Salaire fixe';
  };

  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const openProfile = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsProfileOpen(true);
  };

  const openEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setEditForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      dateOfBirth: teacher.dateOfBirth,
      placeOfBirth: teacher.placeOfBirth,
      sex: teacher.sex,
      phone: teacher.phone,
      email: teacher.email || '',
      residence: teacher.residence,
      diploma: teacher.diploma,
      yearsExperience: teacher.yearsExperience.toString(),
      emergencyPhone: teacher.emergencyPhone,
      contractType: teacher.contractType,
      paymentType: teacher.paymentType,
      salaryAmount: teacher.salaryAmount.toString(),
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTeacher) return;

    // Validation
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast({ title: "Erreur", description: "Le nom et prénom sont obligatoires", variant: "destructive" });
      return;
    }
    if (!editForm.dateOfBirth || !editForm.placeOfBirth.trim()) {
      toast({ title: "Erreur", description: "La date et lieu de naissance sont obligatoires", variant: "destructive" });
      return;
    }
    if (!editForm.sex) {
      toast({ title: "Erreur", description: "Le sexe est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.phone.trim()) {
      toast({ title: "Erreur", description: "Le numéro de téléphone est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.residence.trim()) {
      toast({ title: "Erreur", description: "Le lieu de résidence est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.diploma.trim()) {
      toast({ title: "Erreur", description: "Le diplôme est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.emergencyPhone.trim()) {
      toast({ title: "Erreur", description: "Le numéro d'urgence est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.contractType) {
      toast({ title: "Erreur", description: "Le type de contrat est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.paymentType) {
      toast({ title: "Erreur", description: "Le type de paiement est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.salaryAmount || parseFloat(editForm.salaryAmount) <= 0) {
      toast({ title: "Erreur", description: "Le montant du salaire est obligatoire", variant: "destructive" });
      return;
    }
    
    updateTeacher(selectedTeacher.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      dateOfBirth: editForm.dateOfBirth,
      placeOfBirth: editForm.placeOfBirth,
      sex: editForm.sex as 'homme' | 'femme',
      phone: editForm.phone,
      email: editForm.email || undefined,
      residence: editForm.residence,
      diploma: editForm.diploma,
      yearsExperience: parseInt(editForm.yearsExperience),
      emergencyPhone: editForm.emergencyPhone,
      contractType: editForm.contractType as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire',
      paymentType: editForm.paymentType as 'hourly' | 'fixed',
      salaryAmount: parseFloat(editForm.salaryAmount),
    });

    toast({
      title: "Modifications enregistrées",
      description: `Les informations de ${editForm.firstName} ${editForm.lastName} ont été mises à jour.`,
    });
    setIsEditOpen(false);
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestion des Professeurs</h1>
              <p className="text-muted-foreground">
                {teachers.length} professeur{teachers.length > 1 ? 's' : ''} inscrit{teachers.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, prénom ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Contract Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={contractFilter} onValueChange={setContractFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrer par contrat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les contrats</SelectItem>
                    {contractTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="gap-2"
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Grille</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Tableau</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        {searchQuery || contractFilter !== 'all' ? (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary">
              {filteredTeachers.length} résultat{filteredTeachers.length > 1 ? 's' : ''}
            </Badge>
            {(searchQuery || contractFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setSearchQuery(''); setContractFilter('all'); }}
                className="text-muted-foreground h-7"
              >
                <X className="w-3 h-3 mr-1" />
                Effacer les filtres
              </Button>
            )}
          </div>
        ) : null}

        {/* Empty State */}
        {teachers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucun professeur inscrit</h3>
              <p className="text-muted-foreground mb-6">
                Commencez par inscrire des professeurs via la page d'inscription.
              </p>
              <Button onClick={() => window.location.href = '/inscription-prof'} className="gap-2">
                Inscrire un professeur
              </Button>
            </CardContent>
          </Card>
        ) : filteredTeachers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucun résultat</h3>
              <p className="text-muted-foreground">
                Aucun professeur ne correspond à votre recherche.
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filteredTeachers.map((teacher, index) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  layout
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center mb-4">
                        <Avatar className="w-16 h-16 mb-3 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                            {getInitials(teacher.firstName, teacher.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold text-foreground">
                          {teacher.firstName} {teacher.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {teacher.teacherId}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Briefcase className="w-3 h-3" />
                            {getContractLabel(teacher.contractType)}
                          </Badge>
                          <Badge variant="secondary" className="gap-1">
                            {getPaymentLabel(teacher.paymentType)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {teacher.yearsExperience} ans d'expérience
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openProfile(teacher)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Profil
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(teacher)}
                          className="gap-1"
                        >
                          <Pencil className="w-4 h-4" />
                          Modifier
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professeur</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Contrat</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Expérience</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredTeachers.map((teacher, index) => (
                      <motion.tr
                        key={teacher.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className="group"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                {getInitials(teacher.firstName, teacher.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {teacher.firstName} {teacher.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {teacher.diploma}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {teacher.teacherId}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getContractLabel(teacher.contractType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getPaymentLabel(teacher.paymentType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {teacher.yearsExperience} ans
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openProfile(teacher)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(teacher)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Profile Sheet */}
        <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <SheetContent className="sm:max-w-lg">
            {selectedTeacher && (
              <>
                <SheetHeader>
                  <SheetTitle>Profil du Professeur</SheetTitle>
                  <SheetDescription>
                    Informations détaillées de {selectedTeacher.firstName} {selectedTeacher.lastName}
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-10rem)] mt-6 pr-4">
                  <div className="space-y-6">
                    {/* Header with avatar */}
                    <div className="flex flex-col items-center text-center pb-4 border-b">
                      <Avatar className="w-20 h-20 mb-4 ring-4 ring-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                          {getInitials(selectedTeacher.firstName, selectedTeacher.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedTeacher.firstName} {selectedTeacher.lastName}
                      </h2>
                      <code className="text-sm bg-muted px-3 py-1 rounded mt-2">
                        {selectedTeacher.teacherId}
                      </code>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline">{getContractLabel(selectedTeacher.contractType)}</Badge>
                        <Badge variant="secondary">{getPaymentLabel(selectedTeacher.paymentType)}</Badge>
                      </div>
                    </div>

                    {/* Personal Info */}
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        Informations Personnelles
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Date de naissance</p>
                            <p className="font-medium">{formatDate(selectedTeacher.dateOfBirth)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Lieu de naissance</p>
                            <p className="font-medium">{selectedTeacher.placeOfBirth}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Sexe</p>
                            <p className="font-medium">{selectedTeacher.sex === 'homme' ? 'Masculin' : 'Féminin'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Résidence</p>
                            <p className="font-medium">{selectedTeacher.residence}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        Contact
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Téléphone</p>
                            <p className="font-medium">{selectedTeacher.phone}</p>
                          </div>
                        </div>
                        {selectedTeacher.email && (
                          <div className="flex items-start gap-3">
                            <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-muted-foreground">Email</p>
                              <p className="font-medium">{selectedTeacher.email}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Numéro d'urgence</p>
                            <p className="font-medium">{selectedTeacher.emergencyPhone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Professional Info */}
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        Informations Professionnelles
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Diplôme</p>
                            <p className="font-medium">{selectedTeacher.diploma}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Années d'expérience</p>
                            <p className="font-medium">{selectedTeacher.yearsExperience} ans</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le Professeur</DialogTitle>
              <DialogDescription>
                Modifiez les informations de {selectedTeacher?.firstName} {selectedTeacher?.lastName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Informations Personnelles
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de naissance *</Label>
                    <Input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lieu de naissance *</Label>
                    <Input
                      value={editForm.placeOfBirth}
                      onChange={(e) => setEditForm(prev => ({ ...prev, placeOfBirth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexe *</Label>
                    <Select value={editForm.sex} onValueChange={(value) => setEditForm(prev => ({ ...prev, sex: value as 'homme' | 'femme' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homme">Homme</SelectItem>
                        <SelectItem value="femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Résidence *</Label>
                    <Input
                      value={editForm.residence}
                      onChange={(e) => setEditForm(prev => ({ ...prev, residence: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Contact
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Numéro d'urgence *</Label>
                    <Input
                      value={editForm.emergencyPhone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Professional Info */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  Informations Professionnelles
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Diplôme *</Label>
                    <Input
                      value={editForm.diploma}
                      onChange={(e) => setEditForm(prev => ({ ...prev, diploma: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Années d'expérience *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editForm.yearsExperience}
                      onChange={(e) => setEditForm(prev => ({ ...prev, yearsExperience: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type de contrat *</Label>
                    <Select value={editForm.contractType} onValueChange={(value) => setEditForm(prev => ({ ...prev, contractType: value as 'cdi' | 'cdd' | 'vacataire' | 'stagiaire' }))}>
                      <SelectTrigger>
                        <SelectValue />
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
                    <Select value={editForm.paymentType} onValueChange={(value) => setEditForm(prev => ({ ...prev, paymentType: value as 'hourly' | 'fixed' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {editForm.paymentType && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>
                        {editForm.paymentType === 'hourly' ? 'Taux horaire (FCFA/heure) *' : 'Salaire mensuel (FCFA) *'}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">FCFA</span>
                        <Input
                          type="number"
                          min="0"
                          className="pl-14"
                          value={editForm.salaryAmount}
                          onChange={(e) => setEditForm(prev => ({ ...prev, salaryAmount: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} className="gap-2">
                <Save className="w-4 h-4" />
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
};

export default TeacherManagement;
