import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  UserCheck, 
  Save,
  Lock,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttendance } from '@/hooks/useAttendance';
import { useSchedule } from '@/hooks/useSchedule';
import { 
  TeacherAttendanceStatus, 
  TEACHER_STATUS_LABELS, 
  TEACHER_STATUS_COLORS 
} from '@/types/attendance';
import { Teacher } from '@/contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';

interface TeacherAttendanceFormProps {
  selectedDate: Date;
  selectedSession: string | null;
  teachers: Teacher[];
  isMonthLocked: boolean;
}

// Helper: convertit time string en minutes
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const TeacherAttendanceForm = ({
  selectedDate,
  selectedSession,
  teachers,
  isMonthLocked,
}: TeacherAttendanceFormProps) => {
  const { events } = useSchedule();
  const {
    getOrInitTeacherAttendance,
    updateTeacherAttendance,
    getTeacherAttendance,
    sessions,
  } = useAttendance();

  const [status, setStatus] = useState<TeacherAttendanceStatus>('undefined');
  const [effectiveMinutes, setEffectiveMinutes] = useState<number>(0);
  const [justification, setJustification] = useState<string>('');

  // Trouver la session et l'événement
  const sessionData = useMemo(() => {
    if (!selectedSession) return null;
    
    const session = sessions.find(s => s.id === selectedSession);
    if (!session) return null;

    const event = events.find(e => e.id === session.scheduleEventId);
    const teacher = teachers.find(t => t.id === session.teacherId);
    const theoreticalMinutes = timeToMinutes(session.endTime) - timeToMinutes(session.startTime);

    return {
      session,
      event,
      teacher,
      theoreticalMinutes,
    };
  }, [selectedSession, sessions, events, teachers]);

  // Charger les données existantes
  useEffect(() => {
    if (sessionData?.session && sessionData.teacher) {
      const existing = getTeacherAttendance(
        sessionData.session.id,
        sessionData.teacher.id
      );

      if (existing) {
        setStatus(existing.status);
        setEffectiveMinutes(existing.effectiveMinutes);
        setJustification(existing.justification || '');
      } else {
        // Initialiser avec undefined (logique pessimiste)
        getOrInitTeacherAttendance(
          sessionData.session.id,
          sessionData.teacher.id,
          sessionData.theoreticalMinutes
        );
        setStatus('undefined');
        setEffectiveMinutes(0);
        setJustification('');
      }
    }
  }, [sessionData, getTeacherAttendance, getOrInitTeacherAttendance]);

  // Mettre à jour les heures effectives selon le statut
  useEffect(() => {
    if (!sessionData) return;

    if (status === 'present') {
      setEffectiveMinutes(sessionData.theoreticalMinutes);
    } else if (status === 'absent' || status === 'undefined') {
      setEffectiveMinutes(0);
    }
    // Pour 'late' et 'incomplete', l'utilisateur saisit manuellement
  }, [status, sessionData]);

  const handleSave = () => {
    if (!sessionData?.session || !sessionData.teacher) return;

    updateTeacherAttendance(
      sessionData.session.id,
      sessionData.teacher.id,
      status,
      effectiveMinutes,
      justification
    );

    toast({
      title: 'Présence professeur enregistrée',
      description: `${sessionData.teacher.firstName} ${sessionData.teacher.lastName} - ${TEACHER_STATUS_LABELS[status]}`,
    });
  };

  // Formater les minutes en heures:minutes
  const formatMinutes = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  if (!selectedSession) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Sélectionnez une session dans le calendrier ou l'onglet Élèves pour saisir la présence du professeur.</p>
        </CardContent>
      </Card>
    );
  }

  if (!sessionData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Session introuvable. Veuillez sélectionner une autre session.</p>
        </CardContent>
      </Card>
    );
  }

  const { session, teacher, theoreticalMinutes } = sessionData;
  const existingAtt = teacher ? getTeacherAttendance(session.id, teacher.id) : undefined;
  const isLocked = isMonthLocked || existingAtt?.isLocked;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Présence Professeur
            {isLocked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                Verrouillé
              </Badge>
            )}
          </CardTitle>
          {!isLocked && (
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Infos session */}
        <div className="p-4 bg-muted/50 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="font-medium">{format(new Date(session.date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Horaires</span>
            <span className="font-medium">{session.startTime} - {session.endTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Matière</span>
            <span className="font-medium">{session.subjectName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Classe</span>
            <span className="font-medium">{session.className} ({session.groupName})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Professeur</span>
            <span className="font-medium">
              {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Non assigné'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Durée théorique</span>
            <span className="font-medium">{formatMinutes(theoreticalMinutes)}</span>
          </div>
        </div>

        {teacher ? (
          <>
            {/* Statut */}
            <div className="space-y-3">
              <Label>Statut de présence</Label>
              <div className="flex flex-wrap gap-2">
                {(['undefined', 'present', 'absent', 'late', 'incomplete'] as TeacherAttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => !isLocked && setStatus(s)}
                    disabled={isLocked}
                    className={cn(
                      'px-4 py-2 text-sm rounded-lg border transition-all',
                      status === s
                        ? TEACHER_STATUS_COLORS[s]
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                      isLocked && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {TEACHER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Heures effectives (pour retard/incomplet) */}
            {(status === 'late' || status === 'incomplete') && (
              <div className="space-y-3">
                <Label>Durée effective (minutes)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={0}
                    max={theoreticalMinutes}
                    value={effectiveMinutes}
                    onChange={(e) => setEffectiveMinutes(parseInt(e.target.value) || 0)}
                    disabled={isLocked}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    sur {theoreticalMinutes} min théoriques ({formatMinutes(effectiveMinutes)} effectuées)
                  </span>
                </div>
              </div>
            )}

            {/* Justification */}
            {status !== 'present' && status !== 'undefined' && (
              <div className="space-y-3">
                <Label>Motif / Justification</Label>
                <Input
                  placeholder="Ex: Réunion pédagogique, Maladie..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={isLocked}
                />
              </div>
            )}

            {/* Résumé financier */}
            <div className="p-4 border border-border rounded-xl space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Impact sur la rémunération
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Heures théoriques</p>
                  <p className="text-xl font-bold">{formatMinutes(theoreticalMinutes)}</p>
                </div>
                <div className={cn(
                  'p-3 rounded-lg',
                  effectiveMinutes > 0 ? 'bg-green-50' : 'bg-red-50'
                )}>
                  <p className="text-sm text-muted-foreground">Heures comptabilisées</p>
                  <p className={cn(
                    'text-xl font-bold',
                    effectiveMinutes > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatMinutes(effectiveMinutes)}
                  </p>
                </div>
              </div>

              {status === 'undefined' && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Statut non saisi = 0h comptabilisée (sécurité financière)
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun professeur assigné à cette session.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
