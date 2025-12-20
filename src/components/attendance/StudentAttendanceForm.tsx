import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  AlertTriangle,
  Save,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttendance } from '@/hooks/useAttendance';
import { 
  StudentAttendanceStatus, 
  STUDENT_STATUS_LABELS, 
  STUDENT_STATUS_COLORS 
} from '@/types/attendance';
import { ScheduleEvent } from '@/types/schedule';
import { Student, SchoolClass } from '@/contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';

interface StudentAttendanceFormProps {
  selectedDate: Date;
  selectedClassId: number | null;
  selectedSession: string | null;
  onSelectClass: (classId: number) => void;
  onSelectSession: (eventId: string) => void;
  classes: SchoolClass[];
  students: Student[];
  dayEvents: ScheduleEvent[];
}

export const StudentAttendanceForm = ({
  selectedDate,
  selectedClassId,
  selectedSession,
  onSelectClass,
  onSelectSession,
  classes,
  students,
  dayEvents,
}: StudentAttendanceFormProps) => {
  const {
    initializeStudentAttendances,
    updateStudentAttendance,
    getStudentAttendancesBySession,
    markStudentAttendanceComplete,
  } = useAttendance();

  const [localAttendances, setLocalAttendances] = useState<Map<number, {
    status: StudentAttendanceStatus;
    justification: string;
    isJustified: boolean;
  }>>(new Map());

  // Élèves de la classe sélectionnée
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter(s => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  // Initialiser les présences quand une session est sélectionnée
  useEffect(() => {
    if (selectedSession && classStudents.length > 0) {
      const studentIds = classStudents.map(s => s.id);
      const existingAttendances = initializeStudentAttendances(selectedSession, studentIds);
      
      // Mettre à jour l'état local
      const newMap = new Map();
      existingAttendances.forEach(att => {
        newMap.set(att.studentId, {
          status: att.status,
          justification: att.justification || '',
          isJustified: att.isJustified,
        });
      });
      
      // Ajouter les élèves manquants avec défaut "présent"
      classStudents.forEach(student => {
        if (!newMap.has(student.id)) {
          newMap.set(student.id, {
            status: 'present' as StudentAttendanceStatus,
            justification: '',
            isJustified: false,
          });
        }
      });
      
      setLocalAttendances(newMap);
    }
  }, [selectedSession, classStudents, initializeStudentAttendances]);

  // Mettre à jour le statut local
  const handleStatusChange = (studentId: number, status: StudentAttendanceStatus) => {
    setLocalAttendances(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: 'present', justification: '', isJustified: false };
      newMap.set(studentId, { ...current, status });
      return newMap;
    });
  };

  // Mettre à jour la justification
  const handleJustificationChange = (studentId: number, justification: string) => {
    setLocalAttendances(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: 'present', justification: '', isJustified: false };
      newMap.set(studentId, { ...current, justification });
      return newMap;
    });
  };

  // Mettre à jour le flag "justifié"
  const handleJustifiedChange = (studentId: number, isJustified: boolean) => {
    setLocalAttendances(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: 'present', justification: '', isJustified: false };
      newMap.set(studentId, { ...current, isJustified });
      return newMap;
    });
  };

  // Sauvegarder toutes les présences
  const handleSave = () => {
    if (!selectedSession) return;

    localAttendances.forEach((att, studentId) => {
      updateStudentAttendance(
        selectedSession,
        studentId,
        att.status,
        att.justification,
        att.isJustified
      );
    });

    markStudentAttendanceComplete(selectedSession);

    toast({
      title: 'Présences enregistrées',
      description: `Les présences de ${classStudents.length} élèves ont été sauvegardées.`,
    });
  };

  // Statistiques
  const stats = useMemo(() => {
    let present = 0, absent = 0, late = 0, expelled = 0;
    
    localAttendances.forEach((att) => {
      switch (att.status) {
        case 'present': present++; break;
        case 'absent': absent++; break;
        case 'late': late++; break;
        case 'expelled': expelled++; break;
      }
    });

    return { present, absent, late, expelled, total: localAttendances.size };
  }, [localAttendances]);

  // Trouver l'événement sélectionné
  const selectedEvent = useMemo(() => {
    if (!selectedSession) return null;
    const eventId = selectedSession.split('-').slice(0, -3).join('-'); // Remove date part
    return dayEvents.find(e => selectedSession.startsWith(e.id));
  }, [selectedSession, dayEvents]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Présences Élèves - {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </CardTitle>
          {selectedSession && (
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélecteurs */}
        <div className="flex gap-4">
          <Select
            value={selectedClassId?.toString() || ''}
            onValueChange={(v) => onSelectClass(parseInt(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClassId && dayEvents.length > 0 && (
            <Select
              value={selectedEvent?.id || ''}
              onValueChange={(v) => onSelectSession(v)}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Sélectionner un cours" />
              </SelectTrigger>
              <SelectContent>
                {dayEvents.map((evt) => (
                  <SelectItem key={evt.id} value={evt.id}>
                    {evt.startTime} - {evt.endTime} | {evt.subjectName} ({evt.groupName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Message si pas de cours */}
        {selectedClassId && dayEvents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun cours prévu ce jour pour cette classe.</p>
          </div>
        )}

        {/* Statistiques rapides */}
        {selectedSession && (
          <div className="flex gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-sm">{stats.present} présents</span>
            </div>
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-600" />
              <span className="text-sm">{stats.absent} absents</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm">{stats.late} retards</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
              <span className="text-sm">{stats.expelled} renvoyés</span>
            </div>
          </div>
        )}

        {/* Liste des élèves */}
        {selectedSession && classStudents.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Élève</th>
                  <th className="text-center p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Motif</th>
                  <th className="text-center p-3 font-medium">Justifié</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, idx) => {
                  const att = localAttendances.get(student.id);
                  const status = att?.status || 'present';
                  const justification = att?.justification || '';
                  const isJustified = att?.isJustified || false;

                  return (
                    <tr 
                      key={student.id} 
                      className={cn(
                        'border-t border-border',
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                      )}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {student.firstName[0]}{student.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {student.lastName} {student.firstName}
                            </p>
                            <p className="text-xs text-muted-foreground">{student.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          {(['present', 'absent', 'late', 'expelled'] as StudentAttendanceStatus[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(student.id, s)}
                              className={cn(
                                'px-2 py-1 text-xs rounded-md border transition-all',
                                status === s
                                  ? STUDENT_STATUS_COLORS[s]
                                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                              )}
                            >
                              {STUDENT_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {status !== 'present' && (
                          <Input
                            placeholder="Motif..."
                            value={justification}
                            onChange={(e) => handleJustificationChange(student.id, e.target.value)}
                            className="h-8 text-sm"
                          />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {status !== 'present' && (
                          <Checkbox
                            checked={isJustified}
                            onCheckedChange={(checked) => handleJustifiedChange(student.id, !!checked)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Message si pas d'élèves */}
        {selectedSession && classStudents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun élève inscrit dans cette classe.</p>
          </div>
        )}

        {/* Message si pas de session */}
        {!selectedSession && selectedClassId && dayEvents.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Sélectionnez un cours pour saisir les présences.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
