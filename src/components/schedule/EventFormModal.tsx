import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchool } from '@/contexts/SchoolContext';
import { ScheduleEvent, DAYS, GROUP_OPTIONS, EVENT_COLORS } from '@/types/schedule';
import { Trash2, Loader2 } from 'lucide-react';

interface EventFormModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (event: Omit<ScheduleEvent, 'id'>) => void;
  onDelete?: () => void;
  initialEvent?: Partial<ScheduleEvent>;
  viewMode: 'class' | 'teacher';
  selectedClassId?: string;    // UUID string
  selectedTeacherId?: string;  // UUID string
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  isSaving = false,
  onClose,
  onSave,
  onDelete,
  initialEvent,
  viewMode,
  selectedClassId,
  selectedTeacherId,
}) => {
  const { classes, teachers } = useSchool();

  const [formData, setFormData] = useState({
    dayIndex:    0,
    startTime:   '08:00',
    endTime:     '09:00',
    subjectName: '',
    classId:     selectedClassId   ?? '',
    teacherId:   selectedTeacherId ?? null as string | null,
    groupId:     'all',
    color:       EVENT_COLORS[0],
  });

  useEffect(() => {
    if (initialEvent) {
      setFormData({
        dayIndex:    initialEvent.dayIndex    ?? 0,
        startTime:   initialEvent.startTime   ?? '08:00',
        endTime:     initialEvent.endTime     ?? '09:00',
        subjectName: initialEvent.subjectName ?? '',
        classId:     initialEvent.classId     ?? selectedClassId   ?? '',
        teacherId:   initialEvent.teacherId   ?? selectedTeacherId ?? null,
        groupId:     initialEvent.groupId     ?? 'all',
        color:       initialEvent.color       ?? EVENT_COLORS[0],
      });
    } else {
      setFormData({
        dayIndex:    0,
        startTime:   '08:00',
        endTime:     '09:00',
        subjectName: '',
        classId:     selectedClassId   ?? '',
        teacherId:   selectedTeacherId ?? null,
        groupId:     'all',
        color:       EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
      });
    }
  }, [initialEvent, selectedClassId, selectedTeacherId, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedClass   = classes.find(c => c.id === formData.classId);
    const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
    const selectedGroup   = GROUP_OPTIONS.find(g => g.id === formData.groupId);

    onSave({
      dayIndex:    formData.dayIndex,
      startTime:   formData.startTime,
      endTime:     formData.endTime,
      subjectId:   null,
      subjectName: formData.subjectName,
      classId:     formData.classId,
      className:   selectedClass?.name ?? '',
      teacherId:   formData.teacherId,
      teacherName: selectedTeacher
        ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`
        : null,
      groupId:   formData.groupId,
      groupName: selectedGroup?.name ?? 'Classe Entière',
      color:     formData.color,
    });
  };

  const isEditing = !!initialEvent?.id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier le créneau' : 'Ajouter un créneau'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Jour */}
          <div className="space-y-2">
            <Label>Jour</Label>
            <Select
              value={formData.dayIndex.toString()}
              onValueChange={v =>
                setFormData(prev => ({ ...prev, dayIndex: parseInt(v, 10) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(day => (
                  <SelectItem key={day.index} value={day.index.toString()}>
                    {day.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure début</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={e =>
                  setFormData(prev => ({ ...prev, startTime: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Heure fin</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={e =>
                  setFormData(prev => ({ ...prev, endTime: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Matière */}
          <div className="space-y-2">
            <Label>Matière</Label>
            <Input
              placeholder="Ex: Mathématiques"
              value={formData.subjectName}
              onChange={e =>
                setFormData(prev => ({ ...prev, subjectName: e.target.value }))
              }
              required
            />
          </div>

          {/* Classe (en vue professeur ou si aucune classe pré-sélectionnée) */}
          {(viewMode === 'teacher' || !selectedClassId) && (
            <div className="space-y-2">
              <Label>Classe</Label>
              <Select
                value={formData.classId}
                onValueChange={v =>
                  setFormData(prev => ({ ...prev, classId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Professeur (en vue classe ou si aucun prof pré-sélectionné) */}
          {(viewMode === 'class' || !selectedTeacherId) && (
            <div className="space-y-2">
              <Label>Professeur (optionnel)</Label>
              <Select
                value={formData.teacherId ?? 'none'}
                onValueChange={v =>
                  setFormData(prev => ({
                    ...prev,
                    teacherId: v === 'none' ? null : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Groupe */}
          <div className="space-y-2">
            <Label>Groupe</Label>
            <Select
              value={formData.groupId}
              onValueChange={v =>
                setFormData(prev => ({ ...prev, groupId: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Couleur */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    formData.color === color
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isSaving}
                className="mr-auto"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Supprimer
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
