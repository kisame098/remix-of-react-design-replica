import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Lock, UserCheck, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { useAttendance } from '@/hooks/useAttendance';
import {
  TeacherAttendanceStatus,
  TEACHER_STATUS_LABELS,
  TEACHER_STATUS_COLORS,
  AttendanceSession,
} from '@/types/attendance';
import { toast } from '@/hooks/use-toast';

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const formatMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
};

interface TeacherAttendanceFormProps {
  session: AttendanceSession;
  isMonthLocked: boolean;
}

export const TeacherAttendanceForm = ({ session, isMonthLocked }: TeacherAttendanceFormProps) => {
  const { teachers } = useSchool();
  const { getOrInitTeacherAttendance, getTeacherAttendance, updateTeacherAttendance } = useAttendance();

  const teacher = session.teacherId
    ? teachers.find(t => t.id === session.teacherId)
    : null;

  const theoreticalMinutes = useMemo(
    () => timeToMinutes(session.endTime) - timeToMinutes(session.startTime),
    [session.startTime, session.endTime]
  );

  // État local du formulaire
  const [status, setStatus]               = useState<TeacherAttendanceStatus>('undefined');
  const [effectiveMinutes, setEffectiveMinutes] = useState(0);
  const [justification, setJustification] = useState('');

  // Initialiser l'enregistrement prof dans le contexte
  useEffect(() => {
    if (session.teacherId) {
      getOrInitTeacherAttendance(session.id, session.teacherId, theoreticalMinutes);
    }
  }, [session.id, session.teacherId, theoreticalMinutes]);

  // Charger les données existantes dans l'état local
  const existingAtt = session.teacherId
    ? getTeacherAttendance(session.id, session.teacherId)
    : undefined;

  useEffect(() => {
    if (existingAtt) {
      setStatus(existingAtt.status);
      setEffectiveMinutes(existingAtt.effectiveMinutes);
      setJustification(existingAtt.justification || '');
    }
  }, [existingAtt?.id, session.id]); // Recharger si on change de session

  // Ajuster les heures effectives selon le statut
  useEffect(() => {
    if (status === 'present') {
      setEffectiveMinutes(theoreticalMinutes);
    } else if (status === 'absent' || status === 'undefined') {
      setEffectiveMinutes(0);
    }
    // 'late' et 'incomplete' → saisie manuelle
  }, [status, theoreticalMinutes]);

  const isLocked = isMonthLocked || !!existingAtt?.isLocked;

  const handleSave = () => {
    if (!session.teacherId || !teacher) return;
    updateTeacherAttendance(session.id, session.teacherId, status, effectiveMinutes, justification);
    toast({
      title: 'Présence enregistrée',
      description: `${teacher.firstName} ${teacher.lastName} — ${TEACHER_STATUS_LABELS[status]}`,
    });
  };

  // Pas de prof assigné
  if (!teacher) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center gap-3 text-muted-foreground">
          <XCircle className="h-5 w-5 opacity-50 flex-shrink-0" />
          <p className="text-sm">Aucun professeur assigné à ce cours.</p>
        </CardContent>
      </Card>
    );
  }

  const needsManualDuration = status === 'late' || status === 'incomplete';
  const needsJustification  = status !== 'present' && status !== 'undefined';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5" />
            Présence Professeur
            {isLocked && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Lock className="h-3 w-3" /> Verrouillé
              </Badge>
            )}
          </CardTitle>
          {!isLocked && (
            <Button size="sm" className="gap-2 h-8 text-xs" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Enregistrer
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Info prof */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              {teacher.firstName} {teacher.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              Durée théorique : {formatMins(theoreticalMinutes)}
            </p>
          </div>
          {existingAtt && existingAtt.status !== 'undefined' && (
            <Badge
              variant="outline"
              className={cn('text-xs', TEACHER_STATUS_COLORS[existingAtt.status])}
            >
              {TEACHER_STATUS_LABELS[existingAtt.status]}
            </Badge>
          )}
        </div>

        {/* Boutons de statut */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Statut de présence</Label>
          <div className="flex flex-wrap gap-1.5">
            {(['undefined', 'present', 'absent', 'late', 'incomplete'] as TeacherAttendanceStatus[]).map(s => (
              <button
                key={s}
                disabled={isLocked}
                onClick={() => !isLocked && setStatus(s)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg border font-medium transition-all',
                  status === s
                    ? TEACHER_STATUS_COLORS[s]
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-muted',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
              >
                {TEACHER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Durée effective (retard / incomplet) */}
        {needsManualDuration && (
          <div className="flex items-center gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Durée effective (minutes)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={theoreticalMinutes}
                  value={effectiveMinutes}
                  onChange={e => setEffectiveMinutes(parseInt(e.target.value) || 0)}
                  disabled={isLocked}
                  className="h-8 w-24 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  = {formatMins(effectiveMinutes)} / {formatMins(theoreticalMinutes)} théoriques
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Motif / justification */}
        {needsJustification && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Motif / Justification</Label>
            <Input
              placeholder="Ex : Réunion pédagogique, Maladie..."
              value={justification}
              onChange={e => setJustification(e.target.value)}
              disabled={isLocked}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Impact sur la rémunération (résumé compact) */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Théorique : <span className="font-semibold text-foreground">{formatMins(theoreticalMinutes)}</span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs',
            effectiveMinutes > 0 ? 'text-green-600' : 'text-red-500'
          )}>
            <Clock className="h-3.5 w-3.5" />
            Comptabilisé : <span className="font-semibold">{formatMins(effectiveMinutes)}</span>
          </div>
          {status === 'undefined' && (
            <div className="flex items-center gap-1 text-xs text-amber-600 ml-auto">
              <AlertTriangle className="h-3 w-3" />
              Non saisi = 0h comptabilisée
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
