import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttendance } from '@/hooks/useAttendance';
import { Teacher } from '@/contexts/SchoolContext';

interface TeacherHoursSummaryProps {
  selectedDate: Date;
  teachers: Teacher[];
}

export const TeacherHoursSummary = ({
  selectedDate,
  teachers,
}: TeacherHoursSummaryProps) => {
  const { calculateMonthlyHours, lockedMonths } = useAttendance();
  
  const [selectedMonth, setSelectedMonth] = useState<number>(selectedDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(selectedDate.getFullYear());

  // Calculer les heures pour tous les profs
  const teachersSummary = useMemo(() => {
    return teachers.map(teacher => {
      const summary = calculateMonthlyHours(
        teacher.id,
        selectedMonth,
        selectedYear,
        `${teacher.firstName} ${teacher.lastName}`
      );

      // Calculer le taux de saisie
      const entryRate = summary.totalSessions > 0
        ? ((summary.validatedSessions + summary.absentSessions) / summary.totalSessions) * 100
        : 0;

      // Calculer le taux de présence effective
      const effectiveRate = summary.totalTheoreticalMinutes > 0
        ? (summary.totalEffectiveMinutes / summary.totalTheoreticalMinutes) * 100
        : 0;

      return {
        teacher,
        summary,
        entryRate,
        effectiveRate,
      };
    }).filter(item => item.summary.totalSessions > 0);
  }, [teachers, selectedMonth, selectedYear, calculateMonthlyHours]);

  // Vérifier si le mois est verrouillé
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isLocked = lockedMonths.includes(monthKey);

  // Formater les minutes en heures
  const formatMinutes = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  // Générer les options de mois
  const months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

  // Totaux globaux
  const totals = useMemo(() => {
    return teachersSummary.reduce(
      (acc, item) => ({
        theoretical: acc.theoretical + item.summary.totalTheoreticalMinutes,
        effective: acc.effective + item.summary.totalEffectiveMinutes,
        sessions: acc.sessions + item.summary.totalSessions,
        undefined: acc.undefined + item.summary.undefinedSessions,
      }),
      { theoretical: 0, effective: 0, sessions: 0, undefined: 0 }
    );
  }, [teachersSummary]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Bilan Mensuel des Heures
            {isLocked && (
              <Badge variant="secondary" className="gap-1 ml-2">
                Période clôturée
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Résumé global */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Heures théoriques</span>
            </div>
            <p className="text-2xl font-bold">{formatMinutes(totals.theoretical)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Heures validées</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatMinutes(totals.effective)}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Sessions totales</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{totals.sessions}</p>
          </div>
          <div className={cn(
            'p-4 rounded-xl',
            totals.undefined > 0 ? 'bg-amber-50' : 'bg-green-50'
          )}>
            <div className={cn(
              'flex items-center gap-2 mb-1',
              totals.undefined > 0 ? 'text-amber-600' : 'text-green-600'
            )}>
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Non saisies</span>
            </div>
            <p className={cn(
              'text-2xl font-bold',
              totals.undefined > 0 ? 'text-amber-600' : 'text-green-600'
            )}>
              {totals.undefined}
            </p>
          </div>
        </div>

        {/* Tableau des profs */}
        {teachersSummary.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Professeur</th>
                  <th className="text-center p-3 font-medium">Sessions</th>
                  <th className="text-center p-3 font-medium">H. Théoriques</th>
                  <th className="text-center p-3 font-medium">H. Validées</th>
                  <th className="text-center p-3 font-medium">Taux saisie</th>
                  <th className="text-center p-3 font-medium">Taux effectif</th>
                  <th className="text-center p-3 font-medium">Alertes</th>
                </tr>
              </thead>
              <tbody>
                {teachersSummary.map(({ teacher, summary, entryRate, effectiveRate }, idx) => (
                  <tr 
                    key={teacher.id}
                    className={cn(
                      'border-t border-border',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                    )}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{teacher.lastName} {teacher.firstName}</p>
                          <p className="text-xs text-muted-foreground">{teacher.teacherId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-medium">{summary.totalSessions}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span>{formatMinutes(summary.totalTheoreticalMinutes)}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-medium text-green-600">
                        {formatMinutes(summary.totalEffectiveMinutes)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Progress value={entryRate} className="h-2" />
                        <span className="text-xs text-muted-foreground text-center">
                          {entryRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Progress 
                          value={effectiveRate} 
                          className={cn(
                            'h-2',
                            effectiveRate < 80 && 'bg-amber-100'
                          )}
                        />
                        <span className="text-xs text-muted-foreground text-center">
                          {effectiveRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {summary.undefinedSessions > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {summary.undefinedSessions}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
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
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucune session enregistrée pour cette période.</p>
            <p className="text-sm mt-1">
              Sélectionnez des créneaux dans le calendrier pour commencer à saisir les présences.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
