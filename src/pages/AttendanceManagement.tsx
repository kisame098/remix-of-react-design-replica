import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  CalendarIcon, ChevronLeft, ChevronRight, Lock, Unlock,
  BarChart3, AlertTriangle, UserCheck, Users, BookOpen,
  Clock, GraduationCap, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { clampDateObjToSchoolYear } from '@/lib/schoolYearBounds';
import { useSchedule } from '@/contexts/ScheduleContext';
import { useAttendance } from '@/hooks/useAttendance';
import { ScheduleEvent } from '@/types/schedule';
import { StudentAttendanceForm } from '@/components/attendance/StudentAttendanceForm';
import { TeacherAttendanceForm } from '@/components/attendance/TeacherAttendanceForm';
import { TeacherHoursSummary } from '@/components/attendance/TeacherHoursSummary';

// Statut visuel d'une session dans le panneau gauche
const STATUS_DOT: Record<string, string> = {
  not_entered: 'bg-gray-300',
  partial:     'bg-amber-400',
  incident:    'bg-red-500',
  complete:    'bg-green-500',
};

const AttendanceManagement = () => {
  const { classes: allClasses } = useSchool();
  const { currentYear } = useSchoolYear();
  const { events } = useSchedule();
  const {
    sessions,
    ensureSession,
    lockedMonths,
    lockMonth,
    unlockMonth,
    getSessionEntryStatus,
    undefinedTeacherSessionsCount,
    attendanceLoading,
  } = useAttendance();

  const [selectedDate,      setSelectedDate]      = useState<Date>(new Date());
  const [classFilter,       setClassFilter]       = useState<string>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSummary,       setShowSummary]       = useState(false);
  const [calendarOpen,      setCalendarOpen]      = useState(false);
  const [openingSession,    setOpeningSession]    = useState(false);

  // ── Jour de semaine (0=Lundi … 5=Samedi, 6=Dimanche)
  const dayIndex = useMemo(() => {
    const d = selectedDate.getDay(); // 0=Dim
    return d === 0 ? 6 : d - 1;
  }, [selectedDate]);

  const isWeekend = dayIndex === 6; // Dimanche

  // ── Cours du jour filtrés
  const dayEvents = useMemo(() => {
    return events
      .filter(e => {
        if (e.dayIndex !== dayIndex) return false;
        if (classFilter !== 'all' && e.classId !== classFilter) return false;
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, dayIndex, classFilter]);

  // ── Retrouve le UUID de session pour un event + date donnés
  const getEventSessionId = (eventId: string, date: string): string | null =>
    sessions.find(s => s.scheduleEventId === eventId && s.date === date)?.id ?? null;

  // ── Verrouillage du mois courant (basé sur la date sélectionnée)
  const currentMonthKey = format(selectedDate, 'yyyy-MM');
  const isCurrentMonthLocked = lockedMonths.includes(currentMonthKey);

  // ── Stats globales
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      todaySessions: sessions.filter(s => s.date === today).length,
      totalSessions: sessions.length,
      undefinedTeacher: undefinedTeacherSessionsCount,
      classCount: allClasses.length,
    };
  }, [sessions, undefinedTeacherSessionsCount, allClasses]);

  // ── Session sélectionnée
  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  // ── Clic sur un événement du panneau gauche (async : crée la session en DB)
  const handleSelectEvent = async (event: ScheduleEvent) => {
    setOpeningSession(true);
    try {
      const date      = format(selectedDate, 'yyyy-MM-dd');
      const sessionId = await ensureSession(event, date);
      setSelectedSessionId(sessionId);
      setShowSummary(false);
    } catch (err) {
      toast({ title: 'Impossible d\'ouvrir la séance', description: String(err), variant: 'destructive' });
    } finally {
      setOpeningSession(false);
    }
  };

  // ── Bornes de l'année scolaire (Paramètres > Année scolaire) ───────────────
  // Les présences n'existent qu'entre l'ouverture et la fermeture de l'école :
  // on empêche de naviguer hors de cette plage plutôt que d'enregistrer des
  // séances hors année qui seraient quand même estampillées de l'année courante.
  const yearBounds = useMemo(() => {
    if (!currentYear) return null;
    const start = new Date(`${currentYear.startDate}T00:00:00`);
    const end   = new Date(`${currentYear.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }, [currentYear]);

  const clampToYear = useCallback(
    (date: Date): Date => clampDateObjToSchoolYear(date, yearBounds),
    [yearBounds]);

  // Aujourd'hui peut tomber hors année (vacances) : on ouvre alors sur la date
  // valide la plus proche plutôt que sur un jour interdit.
  useEffect(() => {
    if (!yearBounds) return;
    setSelectedDate(prev => {
      const clamped = clampToYear(prev);
      return clamped.getTime() === prev.getTime() ? prev : clamped;
    });
  }, [yearBounds, clampToYear]);

  // ── Navigation date
  const goToDate = (date: Date) => {
    setSelectedDate(clampToYear(date));
    setSelectedSessionId(null); // Déselectionner lors du changement de date
  };

  const formatDayLabel = (d: Date) => format(d, 'EEE d MMM', { locale: fr });

  // ── Libellé du statut de session
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_entered: 'Non saisi',
      partial:     'Partiel',
      incident:    'Incident',
      complete:    'Complet',
    };
    return labels[status] || '';
  };

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Présences</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivi des présences élèves et professeurs par session
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummary(v => !v)}
            className={cn('gap-2', showSummary && 'bg-primary text-primary-foreground hover:bg-primary/90')}
          >
            <BarChart3 className="h-4 w-4" />
            Bilan Heures
          </Button>
          {isCurrentMonthLocked ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => unlockMonth(selectedDate.getFullYear(), selectedDate.getMonth() + 1)}
            >
              <Unlock className="h-4 w-4" />
              Déverrouiller {format(selectedDate, 'MMMM', { locale: fr })}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => lockMonth(selectedDate.getFullYear(), selectedDate.getMonth() + 1)}
            >
              <Lock className="h-4 w-4" />
              Clôturer {format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b grid grid-cols-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{stats.todaySessions}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sessions aujourd'hui</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
          <div className="p-1.5 rounded-lg bg-green-500/10 text-green-600">
            <UserCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sessions enregistrées</p>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          stats.undefinedTeacher > 0 ? 'bg-amber-50' : 'bg-muted/40'
        )}>
          <div className={cn(
            'p-1.5 rounded-lg',
            stats.undefinedTeacher > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
          )}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className={cn(
              'text-lg font-bold leading-none',
              stats.undefinedTeacher > 0 ? 'text-amber-600' : ''
            )}>
              {stats.undefinedTeacher}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Non saisies (profs)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{stats.classCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Classes actives</p>
          </div>
        </div>
      </div>

      {/* ── Corps principal ───────────────────────────────────────── */}
      {showSummary ? (
        /* Vue Bilan Heures */
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <TeacherHoursSummary selectedDate={selectedDate} />
        </div>
      ) : (
        /* Vue 2 panneaux */
        <div className="flex-1 min-h-0 flex">

          {/* ── PANNEAU GAUCHE : navigation + liste sessions ── */}
          <div className="w-64 border-r flex-shrink-0 flex flex-col bg-muted/10">

            {/* Navigation de date */}
            <div className="p-3 border-b flex-shrink-0 space-y-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!!yearBounds && addDays(selectedDate, -1) < yearBounds.start}
                  onClick={() => goToDate(addDays(selectedDate, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs font-medium px-1 capitalize"
                    >
                      {formatDayLabel(selectedDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={d => { if (d) { goToDate(d); setCalendarOpen(false); } }}
                      disabled={yearBounds ? { before: yearBounds.start, after: yearBounds.end } : undefined}
                      fromDate={yearBounds?.start}
                      toDate={yearBounds?.end}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!!yearBounds && addDays(selectedDate, 1) > yearBounds.end}
                  onClick={() => goToDate(addDays(selectedDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {!isToday(selectedDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => goToDate(new Date())}
                >
                  Aujourd'hui
                </Button>
              )}
            </div>

            {/* Filtre classe */}
            <div className="p-3 border-b flex-shrink-0">
              <Select value={classFilter} onValueChange={v => { setClassFilter(v); setSelectedSessionId(null); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {allClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Liste des cours du jour */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {attendanceLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-xs">Chargement…</p>
                </div>
              ) : isWeekend ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Pas de cours le dimanche</p>
                </div>
              ) : dayEvents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    {allClasses.length === 0
                      ? 'Aucune classe créée'
                      : events.length === 0
                        ? 'Aucun cours dans l\'emploi du temps'
                        : 'Aucun cours ce jour'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground px-2 mb-2">
                    {dayEvents.length} cours · {format(selectedDate, 'EEEE', { locale: fr })}
                  </p>
                  {dayEvents.map(event => {
                    const dateStr   = format(selectedDate, 'yyyy-MM-dd');
                    const sessionId = getEventSessionId(event.id, dateStr);
                    const status    = sessionId ? getSessionEntryStatus(sessionId) : 'not_entered';
                    const isSelected = !!sessionId && selectedSessionId === sessionId;

                    return (
                      <button
                        key={event.id}
                        onClick={() => handleSelectEvent(event)}
                        disabled={openingSession}
                        className={cn(
                          'w-full text-left p-2.5 rounded-lg transition-all group',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted text-foreground',
                          openingSession && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {/* Status dot ou spinner */}
                          {openingSession && isSelected ? (
                            <Loader2 className="w-2 h-2 mt-1.5 flex-shrink-0 animate-spin" />
                          ) : (
                            <div className={cn(
                              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                              STATUS_DOT[status]
                            )} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn(
                                'text-xs font-semibold',
                                isSelected ? 'text-primary-foreground' : 'text-foreground'
                              )}>
                                {event.startTime}–{event.endTime}
                              </span>
                              {status !== 'not_entered' && (
                                <span className={cn(
                                  'text-[10px] px-1 py-0.5 rounded',
                                  isSelected ? 'bg-primary-foreground/20' : 'bg-muted'
                                )}>
                                  {getStatusLabel(status)}
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              'text-xs font-medium truncate mt-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-foreground'
                            )}>
                              {event.subjectName}
                            </p>
                            <p className={cn(
                              'text-xs truncate',
                              isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {event.className}
                              {event.groupId !== 'all' && ` · ${event.groupName}`}
                            </p>
                            {event.teacherName && (
                              <p className={cn(
                                'text-xs truncate',
                                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}>
                                {event.teacherName}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ── PANNEAU DROIT : détail session ── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {openingSession ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                <p className="text-sm">Ouverture de la session…</p>
              </div>
            ) : selectedSession ? (
              <div className="p-6 space-y-4">
                {/* Info cours */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold">{selectedSession.subjectName}</h2>
                      {isCurrentMonthLocked && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Lock className="h-3 w-3" />
                          Mois clôturé
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.className}
                      {selectedSession.groupId !== 'all' && ` · ${selectedSession.groupName}`}
                      {' · '}
                      <span className="capitalize">
                        {format(new Date(selectedSession.date), 'EEEE d MMMM yyyy', { locale: fr })}
                      </span>
                      {' · '}
                      {selectedSession.startTime} – {selectedSession.endTime}
                    </p>
                  </div>
                </div>

                {/* Présence professeur */}
                <TeacherAttendanceForm
                  session={selectedSession}
                  isMonthLocked={isCurrentMonthLocked}
                />

                {/* Présences élèves */}
                <StudentAttendanceForm session={selectedSession} />
              </div>
            ) : (
              /* État vide */
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Users className="h-10 w-10 opacity-40" />
                </div>
                <p className="font-medium text-base">Sélectionnez un cours</p>
                <p className="text-sm mt-1 opacity-70 text-center max-w-xs">
                  Choisissez un cours dans le panneau gauche pour saisir les présences élèves et professeur
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
