import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Plus, Check, Lock, Unlock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { toast } from '@/hooks/use-toast';

interface SchoolYearSelectorProps {
  collapsed?: boolean;
}

export const SchoolYearSelector = ({ collapsed = false }: SchoolYearSelectorProps) => {
  const { schoolYears, currentYear, setCurrentYear, createSchoolYear, closeSchoolYear, reopenSchoolYear } = useSchoolYear();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');

  const handleCreateYear = () => {
    if (!newYearName.trim()) {
      toast({ title: "Erreur", description: "Le nom de l'année scolaire est obligatoire", variant: "destructive" });
      return;
    }

    // Validate format (e.g., 2024-2025)
    const yearPattern = /^(\d{4})-(\d{4})$/;
    const match = newYearName.trim().match(yearPattern);
    if (!match) {
      toast({ title: "Erreur", description: "Format invalide. Utilisez le format: 2024-2025", variant: "destructive" });
      return;
    }

    const startYear = parseInt(match[1]);
    const endYear = parseInt(match[2]);

    if (endYear !== startYear + 1) {
      toast({ title: "Erreur", description: "L'année de fin doit être l'année de début + 1", variant: "destructive" });
      return;
    }

    // Check if already exists
    if (schoolYears.some(y => y.id === newYearName.trim())) {
      toast({ title: "Erreur", description: "Cette année scolaire existe déjà", variant: "destructive" });
      return;
    }

    const newYear = createSchoolYear(startYear);
    setCurrentYear(newYear);
    toast({ 
      title: "Année scolaire créée", 
      description: `L'année ${newYear.name} a été créée et définie comme année courante.` 
    });
    setNewYearName('');
    setIsCreateDialogOpen(false);
  };

  const handleSelectYear = (yearId: string) => {
    const year = schoolYears.find(y => y.id === yearId);
    if (year) {
      setCurrentYear(year);
      toast({ 
        title: "Année scolaire changée", 
        description: `Vous travaillez maintenant sur l'année ${year.name}.` 
      });
    }
  };

  const handleCloseYear = (yearId: string) => {
    closeSchoolYear(yearId);
    toast({ title: "Année clôturée", description: "L'année scolaire a été clôturée." });
  };

  const handleReopenYear = (yearId: string) => {
    reopenSchoolYear(yearId);
    toast({ title: "Année réouverte", description: "L'année scolaire a été réouverte." });
  };

  // Generate suggested year name
  const getSuggestedYearName = () => {
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${year + 1}`;
  };

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-10 h-10">
            <CalendarDays className="w-5 h-5 text-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-sm font-semibold">Année Scolaire</div>
          <DropdownMenuSeparator />
          {schoolYears.map((year) => (
            <DropdownMenuItem
              key={year.id}
              onClick={() => handleSelectYear(year.id)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                {currentYear?.id === year.id && <Check className="w-4 h-4 text-primary" />}
                {year.name}
              </span>
              {year.isClosed && <Lock className="w-3 h-3 text-muted-foreground" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle année
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between gap-2 h-auto py-2"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Année scolaire</div>
                  <div className="font-semibold">
                    {currentYear?.name || 'Non définie'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {currentYear?.isClosed && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="w-3 h-3 mr-1" />
                    Clôturée
                  </Badge>
                )}
                <ChevronDown className="w-4 h-4" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              Changer d'année scolaire
            </div>
            <DropdownMenuSeparator />
            {schoolYears.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Aucune année scolaire
              </div>
            ) : (
              schoolYears.map((year) => (
                <DropdownMenuItem
                  key={year.id}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => handleSelectYear(year.id)}
                >
                  <span className="flex items-center gap-2">
                    {currentYear?.id === year.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                    <span className={currentYear?.id === year.id ? 'font-semibold' : ''}>
                      {year.name}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    {year.isClosed ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReopenYear(year.id);
                        }}
                      >
                        <Unlock className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseYear(year.id);
                        }}
                      >
                        <Lock className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => {
                setNewYearName(getSuggestedYearName());
                setIsCreateDialogOpen(true);
              }}
              className="text-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer une nouvelle année
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Year Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une nouvelle année scolaire</DialogTitle>
            <DialogDescription>
              Créez une nouvelle année scolaire pour commencer à inscrire des élèves et des professeurs.
              Les classes et matières existantes seront conservées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="yearName">Nom de l'année scolaire *</Label>
              <Input
                id="yearName"
                placeholder="Ex: 2024-2025"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Format recommandé: AAAA-AAAA (ex: 2024-2025)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateYear}>
              Créer l'année
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
