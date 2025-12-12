import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Grid3X3, List, Eye, Pencil, 
  Phone, Mail, MapPin, Calendar, User, X, Save, GraduationCap, Home
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
import { useSchool, Student, Tutor } from '@/contexts/SchoolContext';
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
  classId: number | null;
  tutor1: Tutor;
  tutor2: Tutor;
}

type ViewMode = 'grid' | 'table';

const StudentManagement = () => {
  const { students, classes, updateStudent } = useSchool();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const tutorStatuses = [
    { value: 'pere', label: 'Père' },
    { value: 'mere', label: 'Mère' },
    { value: 'oncle', label: 'Oncle' },
    { value: 'tante', label: 'Tante' },
    { value: 'autre', label: 'Autre' },
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
    classId: null,
    tutor1: { phone: '', status: '', email: '' },
    tutor2: { phone: '', status: '', email: '' },
  });

  // Filter and search students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        student.firstName.toLowerCase().includes(searchLower) ||
        student.lastName.toLowerCase().includes(searchLower) ||
        student.studentId.toLowerCase().includes(searchLower);

      // Class filter
      const matchesClass = 
        classFilter === 'all' || 
        student.classId?.toString() === classFilter;

      return matchesSearch && matchesClass;
    });
  }, [students, searchQuery, classFilter]);

  const getClassName = (classId: number | null): string => {
    if (!classId) return 'Non assigné';
    const cls = classes.find(c => c.id === classId);
    return cls?.name || 'Classe inconnue';
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

  const getTutorLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pere: 'Père',
      mere: 'Mère',
      oncle: 'Oncle',
      tante: 'Tante',
      autre: 'Autre'
    };
    return labels[status] || status;
  };

  const openProfile = (student: Student) => {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      placeOfBirth: student.placeOfBirth,
      sex: student.sex,
      phone: student.phone || '',
      email: student.email || '',
      residence: student.residence,
      classId: student.classId,
      tutor1: {
        phone: student.tutor1.phone,
        status: student.tutor1.status,
        email: student.tutor1.email || '',
      },
      tutor2: {
        phone: student.tutor2?.phone || '',
        status: student.tutor2?.status || '',
        email: student.tutor2?.email || '',
      },
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedStudent) return;

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
    if (!editForm.residence.trim()) {
      toast({ title: "Erreur", description: "Le lieu de résidence est obligatoire", variant: "destructive" });
      return;
    }
    if (!editForm.tutor1.phone.trim() || !editForm.tutor1.status) {
      toast({ title: "Erreur", description: "Les informations du tuteur 1 sont obligatoires", variant: "destructive" });
      return;
    }
    
    updateStudent(selectedStudent.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      dateOfBirth: editForm.dateOfBirth,
      placeOfBirth: editForm.placeOfBirth,
      sex: editForm.sex as 'homme' | 'femme',
      phone: editForm.phone || undefined,
      email: editForm.email || undefined,
      residence: editForm.residence,
      classId: editForm.classId,
      tutor1: editForm.tutor1 as Tutor,
      tutor2: editForm.tutor2.phone ? editForm.tutor2 as Tutor : undefined,
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
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestion des Élèves</h1>
              <p className="text-muted-foreground">
                {students.length} élève{students.length > 1 ? 's' : ''} inscrit{students.length > 1 ? 's' : ''}
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

              {/* Class Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrer par classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les classes</SelectItem>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
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
        {searchQuery || classFilter !== 'all' ? (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary">
              {filteredStudents.length} résultat{filteredStudents.length > 1 ? 's' : ''}
            </Badge>
            {(searchQuery || classFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setSearchQuery(''); setClassFilter('all'); }}
                className="text-muted-foreground h-7"
              >
                <X className="w-3 h-3 mr-1" />
                Effacer les filtres
              </Button>
            )}
          </div>
        ) : null}

        {/* Empty State */}
        {students.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucun élève inscrit</h3>
              <p className="text-muted-foreground mb-6">
                Commencez par inscrire des élèves via la page d'inscription.
              </p>
              <Button onClick={() => window.location.href = '/inscription'} className="gap-2">
                Inscrire un élève
              </Button>
            </CardContent>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucun résultat</h3>
              <p className="text-muted-foreground">
                Aucun élève ne correspond à votre recherche.
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filteredStudents.map((student, index) => (
                <motion.div
                  key={student.id}
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
                            {getInitials(student.firstName, student.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold text-foreground">
                          {student.firstName} {student.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {student.studentId}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-center">
                          <Badge variant="outline" className="gap-1">
                            <GraduationCap className="w-3 h-3" />
                            {getClassName(student.classId)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          {student.sex === 'homme' ? 'Masculin' : 'Féminin'}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openProfile(student)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Profil
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(student)}
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
                    <TableHead>Élève</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Sexe</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredStudents.map((student, index) => (
                      <motion.tr
                        key={student.id}
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
                                {getInitials(student.firstName, student.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {student.placeOfBirth}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {student.studentId}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getClassName(student.classId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {student.sex === 'homme' ? 'M' : 'F'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            {student.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {student.phone}
                              </span>
                            )}
                            {student.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {student.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openProfile(student)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(student)}
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
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedStudent && (
              <>
                <SheetHeader className="text-left">
                  <SheetTitle>Profil de l'élève</SheetTitle>
                  <SheetDescription>
                    Informations détaillées de {selectedStudent.firstName} {selectedStudent.lastName}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                        {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </h2>
                      <p className="text-muted-foreground font-mono text-sm">
                        {selectedStudent.studentId}
                      </p>
                      <Badge className="mt-2">
                        {getClassName(selectedStudent.classId)}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Personal Info */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Informations Personnelles</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Né(e) le:</span>
                        <span className="text-foreground">
                          {formatDate(selectedStudent.dateOfBirth)} à {selectedStudent.placeOfBirth}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Sexe:</span>
                        <span className="text-foreground">
                          {selectedStudent.sex === 'homme' ? 'Masculin' : 'Féminin'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Résidence:</span>
                        <span className="text-foreground">{selectedStudent.residence}</span>
                      </div>
                      {selectedStudent.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Téléphone:</span>
                          <span className="text-foreground">{selectedStudent.phone}</span>
                        </div>
                      )}
                      {selectedStudent.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Email:</span>
                          <span className="text-foreground">{selectedStudent.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Tutor 1 */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Tuteur Principal</h3>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          {getTutorLabel(selectedStudent.tutor1.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedStudent.tutor1.phone}</span>
                      </div>
                      {selectedStudent.tutor1.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedStudent.tutor1.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tutor 2 */}
                  {selectedStudent.tutor2 && selectedStudent.tutor2.phone && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3">Tuteur Secondaire</h3>
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">
                            {getTutorLabel(selectedStudent.tutor2.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedStudent.tutor2.phone}</span>
                        </div>
                        {selectedStudent.tutor2.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{selectedStudent.tutor2.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Footer */}
                  <div className="text-sm text-muted-foreground">
                    Inscrit le {selectedStudent.createdAt.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>

                  <Button 
                    className="w-full gap-2" 
                    onClick={() => { setIsProfileOpen(false); openEdit(selectedStudent); }}
                  >
                    <Pencil className="w-4 h-4" />
                    Modifier les informations
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Dialog - Full Form */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Modifier l'élève</DialogTitle>
              <DialogDescription>
                Modifiez toutes les informations de {selectedStudent?.firstName} {selectedStudent?.lastName}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Personal Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="w-4 h-4 text-primary" />
                      Informations Personnelles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-lastName">Nom *</Label>
                      <Input
                        id="edit-lastName"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-firstName">Prénom *</Label>
                      <Input
                        id="edit-firstName"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-dateOfBirth">Date de naissance *</Label>
                      <Input
                        id="edit-dateOfBirth"
                        type="date"
                        value={editForm.dateOfBirth}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-placeOfBirth">Lieu de naissance *</Label>
                      <Input
                        id="edit-placeOfBirth"
                        value={editForm.placeOfBirth}
                        onChange={(e) => setEditForm(prev => ({ ...prev, placeOfBirth: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sexe *</Label>
                      <Select 
                        value={editForm.sex} 
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, sex: value as 'homme' | 'femme' }))}
                      >
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
                      <Label htmlFor="edit-residence">Lieu de résidence *</Label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="edit-residence"
                          className="pl-10"
                          value={editForm.residence}
                          onChange={(e) => setEditForm(prev => ({ ...prev, residence: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Téléphone (optionnel)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="edit-phone"
                          className="pl-10"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email (optionnel)</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="edit-email"
                          type="email"
                          className="pl-10"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tutor 1 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-4 h-4 text-primary" />
                      Tuteur 1 (Obligatoire)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Statut *</Label>
                      <Select 
                        value={editForm.tutor1.status} 
                        onValueChange={(value) => setEditForm(prev => ({ 
                          ...prev, 
                          tutor1: { ...prev.tutor1, status: value as Tutor['status'] }
                        }))}
                      >
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
                          value={editForm.tutor1.phone}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            tutor1: { ...prev.tutor1, phone: e.target.value }
                          }))}
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
                          value={editForm.tutor1.email}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            tutor1: { ...prev.tutor1, email: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tutor 2 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Tuteur 2 (Optionnel)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select 
                        value={editForm.tutor2.status} 
                        onValueChange={(value) => setEditForm(prev => ({ 
                          ...prev, 
                          tutor2: { ...prev.tutor2, status: value as Tutor['status'] }
                        }))}
                      >
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
                          value={editForm.tutor2.phone}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            tutor2: { ...prev.tutor2, phone: e.target.value }
                          }))}
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
                          value={editForm.tutor2.email}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            tutor2: { ...prev.tutor2, email: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Class Selection */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      Classe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={editForm.classId?.toString() || ''} 
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, classId: parseInt(value) }))}
                    >
                      <SelectTrigger className="w-full md:w-1/2">
                        <SelectValue placeholder="Sélectionner une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(cls => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4">
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

export default StudentManagement;
