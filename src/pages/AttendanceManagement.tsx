import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarIcon, 
  Users, 
  UserCheck, 
  AlertTriangle, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchedule } from '@/hooks/useSchedule';
import { useAttendance } from '@/hooks/useAttendance';
import { DAYS } from '@/types/schedule';
import { SESSION_ENTRY_STATUS } from '@/types/attendance';
import { StudentAttendanceForm } from '@/components/attendance/StudentAttendanceForm';
import { TeacherAttendanceForm } from '@/components/attendance/TeacherAttendanceForm';
import { TeacherHoursSummary } from '@/components/attendance/TeacherHoursSummary';

const AttendanceManagement = () => {
  const { classes, teachers, students } = useSchool();
  const { events, getEventsByClass, getEventsByTeacher } = useSchedule();
  const {
    sessions,
    getOrCreateSession,
    getSessionEntryStatus,
    getUndefinedTeacherSessions,
    lockedMonths,
    lockMonth,
    unlockMonth,
  } = useAttendance();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'students' | 'teachers' | 'summary'>('calendar');

  // Calculer le jour de la semaine (0 = Lundi)
  const dayIndex = useMemo(() => {
    const jsDay = selectedDate.getDay(); // 0 = Dimanche
    return jsDay === 0 ? 6 : jsDay - 1; // Convertir en 0 = Lundi
  }, [selectedDate]);

  // Événements du jour pour la classe sélectionnée
  const dayEvents = useMemo(() => {
    if (!selectedClassId) return [];
    const classEvents = getEventsByClass(selectedClassId);
    return classEvents.filter(e => e.dayIndex === dayIndex);
  }, [selectedClassId, dayIndex, getEventsByClass]);

  // Statistiques globales
  const stats = useMemo(() => {
    const undefined_sessions = getUndefinedTeacherSessions.length;
    const total_sessions = sessions.length;
    const today = format(new Date(), 'yyyy-MM-dd');
    const today_sessions = sessions.filter(s => s.date === today).length;
    
    return {
      undefined_sessions,
      total_sessions,
      today_sessions,
    };
  }, [sessions, getUndefinedTeacherSessions]);

  // Gestion de la semaine
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Lundi
    return Array.from({ length: 6 }, (_, i) => addDays(start, i)); // Lun-Sam
  }, [selectedDate]);

  const handlePrevWeek = () => {
    setSelectedDate(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  const handleSessionClick = (eventId: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const event = events.find(e => e.id === eventId);
    if (event) {
      getOrCreateSession(event, dateStr);
      setSelectedSession(`${eventId}-${dateStr}`);
      setActiveTab('students');
    }
  };

  // Vérifier si le mois est verrouillé
  const currentMonthKey = format(selectedDate, 'yyyy-MM');
  const isCurrentMonthLocked = lockedMonths.includes(currentMonthKey);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Présences</h1>
          <p className="text-muted-foreground mt-1">
            Suivi des présences élèves et professeurs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isCurrentMonthLocked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlockMonth(selectedDate.getFullYear(), selectedDate.getMonth() + 1)}
              className="gap-2"
            >
              <Unlock className="w-4 h-4" />
              Déverrouiller {format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => lockMonth(selectedDate.getFullYear(), selectedDate.getMonth() + 1)}
              className="gap-2"
            >
              <Lock className="w-4 h-4" />
              Clôturer {format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.today_sessions}</p>
              <p className="text-sm text-muted-foreground">Sessions aujourd'hui</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total_sessions}</p>
              <p className="text-sm text-muted-foreground">Sessions enregistrées</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.undefined_sessions}</p>
              <p className="text-sm text-muted-foreground">Non saisies (profs)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{classes.length}</p>
              <p className="text-sm text-muted-foreground">Classes actives</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <Users className="w-4 h-4" />
            Élèves
          </TabsTrigger>
          <TabsTrigger value="teachers" className="gap-2">
            <UserCheck className="w-4 h-4" />
            Professeurs
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <FileText className="w-4 h-4" />
            Bilan Heures
          </TabsTrigger>
        </TabsList>

        {/* Calendrier */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Vue Calendrier</CardTitle>
                <div className="flex items-center gap-4">
                  {/* Sélecteur de classe */}
                  <Select
                    value={selectedClassId?.toString() || ''}
                    onValueChange={(v) => setSelectedClassId(parseInt(v))}
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

                  {/* Navigation semaine */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => d && setSelectedDate(d)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Grille semaine */}
              <div className="grid grid-cols-6 gap-2">
                {weekDays.map((day, idx) => {
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const dayIdx = idx; // 0 = Lundi

                  // Événements de ce jour pour la classe
                  const dayEvts = selectedClassId
                    ? getEventsByClass(selectedClassId).filter(e => e.dayIndex === dayIdx)
                    : [];

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-xl border cursor-pointer transition-all min-h-[200px]',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                        isToday && 'ring-2 ring-primary/30'
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="text-center mb-3">
                        <p className="text-xs text-muted-foreground uppercase">
                          {DAYS[idx].short}
                        </p>
                        <p className={cn(
                          'text-lg font-bold',
                          isToday ? 'text-primary' : 'text-foreground'
                        )}>
                          {format(day, 'd')}
                        </p>
                      </div>

                      <div className="space-y-1">
                        {dayEvts.map((evt) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const sessionId = `${evt.id}-${dateStr}`;
                          const entryStatus = getSessionEntryStatus(sessionId);
                          const statusInfo = SESSION_ENTRY_STATUS[entryStatus];

                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                handleSessionClick(evt.id);
                              }}
                              className={cn(
                                'p-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                statusInfo.color,
                                statusInfo.textColor
                              )}
                            >
                              <p className="font-medium truncate">{evt.subjectName}</p>
                              <p className="opacity-80">{evt.startTime} - {evt.endTime}</p>
                            </div>
                          );
                        })}

                        {dayEvts.length === 0 && selectedClassId && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Pas de cours
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">Légende :</span>
                {Object.entries(SESSION_ENTRY_STATUS).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded', value.color)} />
                    <span className="text-xs text-muted-foreground">{value.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Présences Élèves */}
        <TabsContent value="students">
          <StudentAttendanceForm
            selectedDate={selectedDate}
            selectedClassId={selectedClassId}
            selectedSession={selectedSession}
            onSelectClass={setSelectedClassId}
            onSelectSession={(eventId) => handleSessionClick(eventId)}
            classes={classes}
            students={students}
            dayEvents={dayEvents}
          />
        </TabsContent>

        {/* Présences Professeurs */}
        <TabsContent value="teachers">
          <TeacherAttendanceForm
            selectedDate={selectedDate}
            selectedSession={selectedSession}
            teachers={teachers}
            isMonthLocked={isCurrentMonthLocked}
          />
        </TabsContent>

        {/* Bilan Heures */}
        <TabsContent value="summary">
          <TeacherHoursSummary
            selectedDate={selectedDate}
            teachers={teachers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceManagement;
