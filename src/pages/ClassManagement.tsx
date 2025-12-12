import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, GraduationCap, Users, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSchool } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';

const ClassManagement = () => {
  const { classes, addClass, deleteClass, getStudentCountByClass } = useSchool();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLimit, setNewClassLimit] = useState('30');

  const handleAddClass = () => {
    if (!newClassName.trim()) {
      toast({ title: "Erreur", description: "Le nom de la classe est obligatoire", variant: "destructive" });
      return;
    }

    const limit = parseInt(newClassLimit);
    if (isNaN(limit) || limit < 1) {
      toast({ title: "Erreur", description: "La limite doit être un nombre positif", variant: "destructive" });
      return;
    }

    // Check for duplicate names
    if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
      toast({ title: "Erreur", description: "Une classe avec ce nom existe déjà", variant: "destructive" });
      return;
    }

    addClass({
      name: newClassName.trim(),
      studentLimit: limit,
    });

    toast({
      title: "Classe créée!",
      description: `La classe "${newClassName}" a été créée avec une limite de ${limit} élèves.`,
    });

    setNewClassName('');
    setNewClassLimit('30');
    setIsDialogOpen(false);
  };

  const handleDeleteClass = (classId: number, className: string) => {
    const studentCount = getStudentCountByClass(classId);
    if (studentCount > 0) {
      toast({
        title: "Impossible de supprimer",
        description: `La classe "${className}" contient ${studentCount} élève(s). Veuillez d'abord réassigner les élèves.`,
        variant: "destructive",
      });
      return;
    }

    deleteClass(classId);
    toast({
      title: "Classe supprimée",
      description: `La classe "${className}" a été supprimée.`,
    });
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestion des Classes</h1>
              <p className="text-muted-foreground">Créez et gérez les classes de l'établissement</p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle Classe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle classe</DialogTitle>
                <DialogDescription>
                  Définissez le nom et la capacité maximale de la classe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="className">Nom de la classe *</Label>
                  <Input
                    id="className"
                    placeholder="Ex: 6ème A, Terminale S1..."
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classLimit">Limite d'élèves *</Label>
                  <Input
                    id="classLimit"
                    type="number"
                    min="1"
                    placeholder="30"
                    value={newClassLimit}
                    onChange={(e) => setNewClassLimit(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddClass}>
                  Créer la classe
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Classes</p>
                  <p className="text-3xl font-bold text-foreground">{classes.length}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capacité Totale</p>
                  <p className="text-3xl font-bold text-foreground">
                    {classes.reduce((acc, c) => acc + c.studentLimit, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Places Disponibles</p>
                  <p className="text-3xl font-bold text-foreground">
                    {classes.reduce((acc, c) => acc + (c.studentLimit - getStudentCountByClass(c.id)), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/50 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucune classe créée</h3>
              <p className="text-muted-foreground mb-6">
                Commencez par créer votre première classe pour pouvoir inscrire des élèves.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Créer ma première classe
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {classes.map((cls, index) => {
                const studentCount = getStudentCountByClass(cls.id);
                const percentage = (studentCount / cls.studentLimit) * 100;
                const isFull = studentCount >= cls.studentLimit;

                return (
                  <motion.div
                    key={cls.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className={`relative overflow-hidden ${isFull ? 'border-destructive/50' : ''}`}>
                      {isFull && (
                        <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-bl-lg font-medium">
                          COMPLET
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{cls.name}</CardTitle>
                            <CardDescription>
                              Créée le {cls.createdAt.toLocaleDateString('fr-FR')}
                            </CardDescription>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer la classe ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer la classe "{cls.name}" ?
                                  {studentCount > 0 && (
                                    <span className="block mt-2 text-destructive font-medium">
                                      Attention: Cette classe contient {studentCount} élève(s).
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteClass(cls.id, cls.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Élèves inscrits</span>
                            <span className="font-semibold">
                              {studentCount} / {cls.studentLimit}
                            </span>
                          </div>
                          <div className="relative">
                            <Progress 
                              value={percentage} 
                              className="h-2"
                            />
                            <div 
                              className={`absolute inset-0 h-2 rounded-full ${getProgressColor(percentage)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{Math.round(percentage)}% occupé</span>
                            <span>{cls.studentLimit - studentCount} places restantes</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClassManagement;
