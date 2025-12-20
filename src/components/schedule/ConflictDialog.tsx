import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScheduleConflict, GROUP_OPTIONS } from '@/types/schedule';
import { AlertTriangle, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ScheduleConflict | null;
  onResolve: (existingGroup: string, newGroup: string) => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve,
}) => {
  const [existingGroup, setExistingGroup] = React.useState('group_a');
  const [newGroup, setNewGroup] = React.useState('group_b');

  if (!conflict) return null;

  const isHardConflict = conflict.severity === 'hard';

  const handleResolve = () => {
    onResolve(existingGroup, newGroup);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHardConflict ? (
              <XCircle className="w-5 h-5 text-destructive" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            {isHardConflict ? 'Conflit Bloquant' : 'Chevauchement Détecté'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {conflict.message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isHardConflict && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Pour autoriser deux cours sur ce créneau, assignez des groupes différents :
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">
                  Cours existant ({conflict.existingEvent.subjectName})
                </Label>
                <Select value={existingGroup} onValueChange={setExistingGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.filter((g) => g.id !== 'all').map((group) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                        disabled={group.id === newGroup}
                      >
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Nouveau cours</Label>
                <Select value={newGroup} onValueChange={setNewGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.filter((g) => g.id !== 'all').map((group) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                        disabled={group.id === existingGroup}
                      >
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>
            {isHardConflict ? 'Fermer' : 'Annuler'}
          </AlertDialogCancel>
          {!isHardConflict && (
            <AlertDialogAction onClick={handleResolve}>
              Appliquer les groupes
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
