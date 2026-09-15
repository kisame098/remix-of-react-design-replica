import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { useAttendance } from '@/hooks/useAttendance';

const formatMins = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
};

const MONTHS = [
  { value: 1,  label: 'Janvier'   },
  { value: 2,  label: 'Février'   },
  { value: 3,  label: 'Mars'      },
  { value: 4,  label: 'Avril'     },
  { value: 5,  label: 'Mai'       },
  { value: 6,  label: 'Juin'      },
  { value: 7,  label: 'Juillet'   },
  { value: 8,  label: 'Août'      },
  { value: 9,  label: 'Septembre' },
  { value: 10, label: 'Octobre'   },
  { value: 11, label: 'Novembre'  },
  { value: 12, label: 'Décembre'  },
];

interface TeacherHoursSummaryProps {
  selectedDate: Date;
}

export const TeacherHoursSummary = ({ selectedDate }: TeacherHoursSummaryProps) => {
  const { teachers } = useSchool();
  const { calculateMonthlyHours, lockedMonths } = useAttendance();

  const [selectedMonth, setSelectedMonth] = useState(selectedDate.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(selectedDate.getFullYear());

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isLocked = lockedMonths.includes(monthKey);

  // Calculer les heures pour chaque prof
  const teachersSummary = useMemo(() => {
    return teachers
      .map(teacher => {
        const summary = calculateMonthlyHours(
          teacher.id, selectedMonth, selectedYear,
          `${teacher.firstName} ${teacher.lastName}`
        );
        const entryRate = summary.totalSessions > 0
          ? ((summary.validatedSessions + summary.absentSessions) / summary.totalSessions) * 100
          : 0;
        const effectiveRate = summary.totalTheoreticalMinutes > 0
          ? (summary.totalEffectiveMinutes / summary.totalTheoreticalMinutes) * 100
          : 0;
        return { teacher, summary, entryRate, effectiveRate };
      })
      .filter(item => item.summary.totalSessions > 0);
  }, [teachers, selectedMonth, selectedYear, calculateMonthlyHours]);

  // Totaux globaux
  const totals = useMemo(() => teachersSummary.reduce(
    (acc, item) => ({
      theoretical: acc.theoretical + item.summary.totalTheoreticalMinutes,
      effective:   acc.effective   + item.summary.totalEffectiveMinutes,
      sessions:    acc.sessions    + item.summary.totalSessions,
      undefined:   acc.undefined   + item.summary.undefinedSessions,
    }),
    { theoretical: 0, effective: 0, sessions: 0, undefined: 0 }
  ), [teachersSummary]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bilan Mensuel des Heures
            {isLocked && (
              <Badge variant="secondary" className="ml-2 text-xs">Période clôturée</Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Select
              value={selectedMonth.toString()}
              onValueChange={v => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={v => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[90px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Résumé global */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">H. théoriques</span>
            </div>
            <p className="text-xl font-bold">{formatMins(totals.theoretical)}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-xl">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">H. validées</span>
            </div>
            <p className="text-xl font-bold text-green-600">{formatMins(totals.effective)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Sessions totales</span>
            </div>
            <p className="text-xl font-bold text-blue-600">{totals.sessions}</p>
          </div>
          <div className={cn('p-3 rounded-xl', totals.undefined > 0 ? 'bg-amber-50' : 'bg-green-50')}>
            <div className={cn(
              'flex items-center gap-2 mb-1',
              totals.undefined > 0 ? 'text-amber-600' : 'text-green-600'
            )}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">Non saisies</span>
            </div>
            <p className={cn(
              'text-xl font-bold',
              totals.undefined > 0 ? 'text-amber-600' : 'text-green-600'
            )}>
              {totals.undefined}
            </p>
          </div>
        </div>

        {/* Tableau des profs */}
        {teachersSummary.length > 0 ? (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Professeur</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Sessions</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">H. Théoriques</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">H. Validées</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground">Taux saisie</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground">Taux effectif</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Alertes</th>
                </tr>
              </thead>
              <tbody>
                {teachersSummary.map(({ teacher, summary, entryRate, effectiveRate }, idx) => (
                  <tr
                    key={teacher.id}
                    className={cn(
                      'border-t border-border',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    )}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{teacher.lastName} {teacher.firstName}</p>
                          <p className="text-xs text-muted-foreground">{teacher.teacherId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center text-sm font-medium">{summary.totalSessions}</td>
                    <td className="p-3 text-center text-sm">{formatMins(summary.totalTheoreticalMinutes)}</td>
                    <td className="p-3 text-center text-sm font-medium text-green-600">
                      {formatMins(summary.totalEffectiveMinutes)}
                    </td>
                    <td className="p-3 w-32">
                      <div className="space-y-1">
                        <Progress value={entryRate} className="h-1.5" />
                        <span className="text-xs text-muted-foreground">{entryRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 w-32">
                      <div className="space-y-1">
                        <Progress
                          value={effectiveRate}
                          className={cn('h-1.5', effectiveRate < 80 && '[&>div]:bg-amber-500')}
                        />
                        <span className="text-xs text-muted-foreground">{effectiveRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {summary.undefinedSessions > 0 ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {summary.undefinedSessions}
                        </Badge>
                      ) : (
                        <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-500">
                          <CheckCircle className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-14 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune session enregistrée</p>
            <p className="text-sm mt-1 opacity-70">
              Saisissez des présences depuis la vue journalière pour voir le bilan ici.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
