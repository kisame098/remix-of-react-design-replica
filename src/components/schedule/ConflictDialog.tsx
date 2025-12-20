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
import { ScheduleConflict } from '@/types/schedule';
import { Ban } from 'lucide-react';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ScheduleConflict | null;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  conflict,
}) => {
  if (!conflict) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" />
            Conflit Bloquant
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>{conflict.message}</p>
            
            {conflict.existingEvent && conflict.existingEvent.id && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium text-foreground">Cours existant :</p>
                <p>
                  {conflict.existingEvent.subjectName} ({conflict.existingEvent.className})
                </p>
                <p className="text-muted-foreground">
                  {conflict.existingEvent.startTime} - {conflict.existingEvent.endTime}
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onClose}>Compris</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};