import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users, UserCheck, UserX, Clock, AlertTriangle,
  CheckCircle2, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { useAttendance } from '@/hooks/useAttendance';
import {
  StudentAttendanceStatus,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_COLORS,
} from '@/types/attendance';
import { AttendanceSession } from '@/types/attendance';
import { toast } from '@/hooks/use-toast';

interface StudentAttendanceFormProps {
  session: AttendanceSession;
}

export const StudentAttendanceForm = ({ session }: StudentAttendanceFormProps) => {
  const { students } = useSchool();
  const {
    ensureStudentAttendances,
    updateStudentAttendance,
    markAllStudentsPresent,
    markStudentAttendanceComplete,
    getStudentAttendancesBySession,
    sessions,
  } = useAttendance();

  const [search, setSearch] = useState('');

  // Élèves de cette classe
  const classStudents = useMemo(
    () => students.filter(s => s.classId === session.classId)
          .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [students, session.classId]
  );

  // Initialiser les présences (optimiste = tous présents) quand on ouvre la session
  useEffect(() => {
    if (classStudents.length > 0) {
      ensureStudentAttendances(session.id, classStudents.map(s => s.id));
    }
  }, [session.id, classStudents.length]);

  // Présences depuis le contexte partagé
  const sessionAttendances = getStudentAttendancesBySession(session.id);

  // Helpers de lecture
  const getAtt = (studentId: string) =>
    sessionAttendances.find(a => a.studentId === studentId);
  const getStatus = (studentId: string): StudentAttendanceStatus =>
    getAtt(studentId)?.status ?? 'present';
  const getJustification = (studentId: string) =>
    getAtt(studentId)?.justification ?? '';
  const getIsJustified = (studentId: string) =>
    getAtt(studentId)?.isJustified ?? false;

  // Statistiques en temps réel
  const stats = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, expelled: 0 };
    classStudents.forEach(s => { counts[getStatus(s.id)]++; });
    return counts;
  }, [sessionAttendances, classStudents]);

  // Élèves filtrés par recherche
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return classStudents;
    const q = search.toLowerCase();
    return classStudents.filter(s =>
      s.lastName.toLowerCase().includes(q) ||
      s.firstName.toLowerCase().includes(q)
    );
  }, [classStudents, search]);

  // Vérifier si la saisie est déjà marquée complète
  const sessionObj = sessions.find(s => s.id === session.id);
  const isComplete = sessionObj?.studentAttendanceComplete ?? false;

  // Changer le statut d'un élève (auto-save immédiat dans le contexte)
  const handleStatusChange = (studentId: string, status: StudentAttendanceStatus) => {
    const att = getAtt(studentId);
    updateStudentAttendance(
      session.id,
      studentId,
      status,
      status === 'present' ? '' : att?.justification,
      status === 'present' ? false : att?.isJustified
    );
  };

  // Marquer tous présents
  const handleMarkAllPresent = () => {
    markAllStudentsPresent(session.id, classStudents.map(s => s.id));
    toast({
      title: 'Tous présents',
      description: `${classStudents.length} élève${classStudents.length > 1 ? 's' : ''} marqué${classStudents.length > 1 ? 's' : ''} présent${classStudents.length > 1 ? 's' : ''}.`,
    });
  };

  // Marquer la saisie comme complète
  const handleMarkComplete = () => {
    markStudentAttendanceComplete(session.id);
    toast({
      title: 'Saisie complète',
      description: 'Les présences ont été enregistrées pour cette session.',
    });
  };

  if (classStudents.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Aucun élève inscrit dans cette classe.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Présences Élèves
            <span className="text-muted-foreground font-normal text-sm">
              · {classStudents.length} élève{classStudents.length > 1 ? 's' : ''}
            </span>
            {isComplete && (
              <Badge className="gap-1 bg-green-500 hover:bg-green-500 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Complet
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={handleMarkAllPresent}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Tous présents
            </Button>
            {!isComplete && (
              <Button
                size="sm"
                className="gap-2 h-8 text-xs"
                onClick={handleMarkComplete}
              >
                Marquer complet
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Stats bar */}
        <div className="flex gap-3 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700">
            <UserCheck className="h-3.5 w-3.5" />
            <span className="font-medium">{stats.present}</span>
            <span className="text-xs opacity-80">présents</span>
          </div>
          {stats.absent > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700">
              <UserX className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.absent}</span>
              <span className="text-xs opacity-80">absents</span>
            </div>
          )}
          {stats.late > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.late}</span>
              <span className="text-xs opacity-80">retards</span>
            </div>
          )}
          {stats.expelled > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.expelled}</span>
              <span className="text-xs opacity-80">renvoyés</span>
            </div>
          )}
        </div>

        {/* Recherche */}
        {classStudents.length > 8 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un élève..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        )}

        {/* Table des élèves */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Élève</th>
                <th className="p-2.5 text-xs font-semibold text-muted-foreground text-center">Statut</th>
                <th className="p-2.5 text-xs font-semibold text-muted-foreground">Motif</th>
                <th className="p-2.5 text-xs font-semibold text-muted-foreground text-center w-16">Justifié</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, idx) => {
                const status = getStatus(student.id);
                const justification = getJustification(student.id);
                const isJustified = getIsJustified(student.id);
                const isAbsent = status !== 'present';

                return (
                  <tr
                    key={student.id}
                    className={cn(
                      'border-t border-border transition-colors',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                      isAbsent && 'bg-red-50/40'
                    )}
                  >
                    {/* Nom */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium',
                          status === 'present' ? 'bg-green-100 text-green-700' :
                          status === 'absent'  ? 'bg-red-100 text-red-700' :
                          status === 'late'    ? 'bg-amber-100 text-amber-700' :
                                                 'bg-purple-100 text-purple-700'
                        )}>
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {student.lastName} {student.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{student.studentId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Statut buttons */}
                    <td className="p-2.5">
                      <div className="flex justify-center gap-1">
                        {(['present', 'absent', 'late', 'expelled'] as StudentAttendanceStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(student.id, s)}
                            title={STUDENT_STATUS_LABELS[s]}
                            className={cn(
                              'px-2 py-1 text-xs rounded border transition-all font-medium',
                              status === s
                                ? STUDENT_STATUS_COLORS[s]
                                : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-muted'
                            )}
                          >
                            {STUDENT_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Motif */}
                    <td className="p-2.5">
                      {isAbsent && (
                        <Input
                          placeholder="Motif..."
                          value={justification}
                          onChange={e =>
                            updateStudentAttendance(session.id, student.id, status, e.target.value, isJustified)
                          }
                          className="h-7 text-xs"
                        />
                      )}
                    </td>

                    {/* Justifié */}
                    <td className="p-2.5 text-center">
                      {isAbsent && (
                        <Checkbox
                          checked={isJustified}
                          onCheckedChange={checked =>
                            updateStudentAttendance(session.id, student.id, status, justification, !!checked)
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                    Aucun élève trouvé pour « {search} »
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
