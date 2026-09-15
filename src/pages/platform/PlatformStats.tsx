import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Loader2, RefreshCw, School, Users, GraduationCap, DoorOpen,
  Wallet, TrendingUp, Repeat, AlertTriangle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface PlatformStats {
  schools: {
    total: number; trial: number; active: number; suspended: number; cancelled: number;
    new_this_month: number; trial_expired: number; overdue: number;
  };
  people: { students: number; teachers: number; classes: number };
  revenue: { total: number; this_month: number; pending_claims: number };
  retention: { past_trial: number; converted: number; renewed: number };
  signups: { month: string; count: number }[];
}

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Remplit les mois sans inscription pour que la courbe ne "saute" pas. */
const buildTimeline = (signups: { month: string; count: number }[]) => {
  const byMonth = new Map(signups.map(s => [s.month, Number(s.count)]));
  const out: { label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ label: MONTH_LABELS[d.getMonth()], count: byMonth.get(key) ?? 0 });
  }
  return out;
};

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const KpiCard = ({ icon: Icon, tone, value, label, hint }: {
  icon: typeof School; tone: string; value: string | number; label: string; hint?: string;
}) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</p>}
      </div>
    </CardContent>
  </Card>
);

const PlatformStats = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.rpc('platform_get_stats');
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setStats(data as PlatformStats);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const timeline = useMemo(() => stats ? buildTimeline(stats.signups) : [], [stats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement des statistiques…
      </div>
    );
  }

  const conversionRate = pct(stats.retention.converted, stats.retention.past_trial);
  const loyaltyRate = pct(stats.retention.renewed, stats.retention.converted);
  const attention = stats.schools.trial_expired + stats.schools.overdue;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de SenClass</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {attention > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{attention} école{attention !== 1 ? 's' : ''} à vérifier</span>
              {stats.schools.trial_expired > 0 && ` · ${stats.schools.trial_expired} essai(s) terminé(s)`}
              {stats.schools.overdue > 0 && ` · ${stats.schools.overdue} échéance(s) dépassée(s)`}
              {stats.revenue.pending_claims > 0 && ` · ${stats.revenue.pending_claims} paiement(s) à confirmer`}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={School} tone="bg-primary/10 text-primary"
          value={stats.schools.total} label="Écoles inscrites"
          hint={`+${stats.schools.new_this_month} ce mois-ci`}
        />
        <KpiCard
          icon={Users} tone="bg-blue-500/10 text-blue-600"
          value={stats.people.students.toLocaleString('fr-FR')} label="Élèves inscrits"
        />
        <KpiCard
          icon={GraduationCap} tone="bg-violet-500/10 text-violet-600"
          value={stats.people.teachers.toLocaleString('fr-FR')} label="Professeurs"
        />
        <KpiCard
          icon={DoorOpen} tone="bg-teal-500/10 text-teal-600"
          value={stats.people.classes.toLocaleString('fr-FR')} label="Classes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution des inscriptions d'écoles</CardTitle>
            <p className="text-xs text-muted-foreground">12 derniers mois</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number) => [`${value} école(s)`, 'Inscriptions']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition des écoles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {([
              ['Essai', stats.schools.trial, 'secondary'],
              ['Actives', stats.schools.active, 'default'],
              ['Suspendues', stats.schools.suspended, 'destructive'],
              ['Annulées', stats.schools.cancelled, 'outline'],
            ] as const).map(([label, count, variant]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{count}</span>
                  <Badge variant={variant} className="text-[10px] h-5 w-12 justify-center">
                    {pct(count, stats.schools.total)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp} tone="bg-green-500/10 text-green-600"
          value={`${conversionRate}%`} label="Taux de conversion"
          hint={`${stats.retention.converted} payantes / ${stats.retention.past_trial} sorties d'essai`}
        />
        <KpiCard
          icon={Repeat} tone="bg-amber-500/10 text-amber-600"
          value={`${loyaltyRate}%`} label="Taux de fidélité"
          hint={`${stats.retention.renewed} école(s) ont renouvelé au moins une fois`}
        />
        <KpiCard
          icon={Wallet} tone="bg-emerald-500/10 text-emerald-600"
          value={`${stats.revenue.total.toLocaleString('fr-FR')} F`} label="Revenu encaissé (total)"
        />
        <KpiCard
          icon={Wallet} tone="bg-emerald-500/10 text-emerald-600"
          value={`${stats.revenue.this_month.toLocaleString('fr-FR')} F`} label="Revenu ce mois-ci"
        />
      </div>
    </div>
  );
};

export default PlatformStats;
