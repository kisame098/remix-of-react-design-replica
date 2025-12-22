import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchedule } from '@/contexts/ScheduleContext';
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid';
import { EventFormModal } from '@/components/schedule/EventFormModal';
import { ConflictDialog } from '@/components/schedule/ConflictDialog';
import { ScheduleEvent, ScheduleConflict, ViewMode, GROUP_OPTIONS } from '@/types/schedule';
import { Calendar, Users, GraduationCap, Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';

const ScheduleManagement = () => {
  const { classes, teachers } = useSchool();
  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsByClass,
    getEventsByTeacher,
  } = useSchedule();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    classes.length > 0 ? classes[0].id : null
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(
    teachers.length > 0 ? teachers[0].id : null
  );
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [pendingSlot, setPendingSlot] = useState<{
    dayIndex: number;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Conflict state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ScheduleConflict | null>(null);

  // Get filtered events based on view mode
  // When "Classe Entière" is selected, we pass 'all' to show ONLY universal events
  // When a specific group is selected, we show universal + that group's events
  const filteredEvents = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return getEventsByClass(selectedClassId, groupFilter);
    }
    if (viewMode === 'teacher' && selectedTeacherId) {
      return getEventsByTeacher(selectedTeacherId);
    }
    return [];
  }, [viewMode, selectedClassId, selectedTeacherId, groupFilter, getEventsByClass, getEventsByTeacher]);

  // Handle slot click to create new event
  const handleSlotClick = (dayIndex: number, startTime: string, endTime: string) => {
    setPendingSlot({ dayIndex, startTime, endTime });
    setEditingEvent(null);
    setIsFormModalOpen(true);
  };

  // Handle event click to edit
  const handleEventClick = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setPendingSlot(null);
    setIsFormModalOpen(true);
  };

  // Handle save from form
  const handleSaveEvent = (eventData: Omit<ScheduleEvent, 'id'>) => {
    if (editingEvent) {
      // Update existing event
      const result = updateEvent(editingEvent.id, eventData);
      if (result.success) {
        toast.success('Créneau modifié avec succès');
        setIsFormModalOpen(false);
        setEditingEvent(null);
      } else if (result.conflicts.length > 0) {
        // All conflicts are now blocking
        setCurrentConflict(result.conflicts[0]);
        setConflictDialogOpen(true);
      }
    } else {
      // Add new event
      const result = addEvent(eventData);
      if (result.success) {
        toast.success('Créneau ajouté avec succès');
        setIsFormModalOpen(false);
        setPendingSlot(null);
      } else if (result.conflicts.length > 0) {
        // All conflicts are now blocking (hard)
        setCurrentConflict(result.conflicts[0]);
        setConflictDialogOpen(true);
      }
    }
  };

  // Handle delete
  const handleDeleteEvent = () => {
    if (editingEvent) {
      deleteEvent(editingEvent.id);
      toast.success('Créneau supprimé');
      setIsFormModalOpen(false);
      setEditingEvent(null);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            Gestion des Emplois du Temps
          </h1>
          <p className="text-muted-foreground mt-1">
            Planifiez et gérez les créneaux horaires
          </p>
        </div>

        <Button onClick={() => handleSlotClick(0, '08:00', '09:00')}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Créneau
        </Button>
      </div>

      {/* View Mode Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* View Mode Tabs */}
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="class" className="gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Vue Classe
                </TabsTrigger>
                <TabsTrigger value="teacher" className="gap-2">
                  <Users className="w-4 h-4" />
                  Vue Professeur
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Entity Selector + Group Filter */}
            <div className="flex gap-3 items-center">
              {viewMode === 'class' ? (
                <>
                  <Select
                    value={selectedClassId?.toString() || ''}
                    onValueChange={(v) => setSelectedClassId(parseInt(v))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sélectionner une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_OPTIONS.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <Select
                  value={selectedTeacherId?.toString() || ''}
                  onValueChange={(v) => setSelectedTeacherId(parseInt(v))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Sélectionner un professeur" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.firstName} {teacher.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      {(viewMode === 'class' && selectedClassId) ||
      (viewMode === 'teacher' && selectedTeacherId) ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {viewMode === 'class'
                ? `Classe: ${selectedClass?.name}`
                : `Prof: ${selectedTeacher?.firstName} ${selectedTeacher?.lastName}`}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {filteredEvents.length} créneau(x)
            </Badge>
          </div>

          <ScheduleGrid
            events={filteredEvents}
            viewMode={viewMode}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {viewMode === 'class'
                ? 'Sélectionnez une classe pour afficher son emploi du temps'
                : 'Sélectionnez un professeur pour afficher son emploi du temps'}
            </p>
            {(viewMode === 'class' ? classes.length === 0 : teachers.length === 0) && (
              <p className="text-sm text-muted-foreground mt-2">
                Aucun{viewMode === 'class' ? 'e classe créée' : ' professeur enregistré'}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Form Modal */}
      <EventFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEvent(null);
          setPendingSlot(null);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        initialEvent={
          editingEvent ||
          (pendingSlot
            ? {
                dayIndex: pendingSlot.dayIndex,
                startTime: pendingSlot.startTime,
                endTime: pendingSlot.endTime,
              }
            : undefined)
        }
        viewMode={viewMode}
        selectedClassId={viewMode === 'class' ? selectedClassId || undefined : undefined}
        selectedTeacherId={viewMode === 'teacher' ? selectedTeacherId || undefined : undefined}
      />

      {/* Conflict Dialog */}
      <ConflictDialog
        isOpen={conflictDialogOpen}
        onClose={() => {
          setConflictDialogOpen(false);
          setCurrentConflict(null);
        }}
        conflict={currentConflict}
      />
    </div>
  );
};

export default ScheduleManagement;
