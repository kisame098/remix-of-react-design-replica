import { motion } from 'framer-motion';
import { Users, School, GraduationCap, Banknote, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

const Dashboard = () => {
  const { profile, school } = useAuth();
  const { students, classes, teachers } = useSchool();
  const { getTotalCollectedForYear } = usePayment();

  const stats = [
    {
      title: 'Nombre d\'Élèves',
      value: fmt(students.length),
      icon: Users,
      color: 'bg-primary',
    },
    {
      title: 'Nombre de Classes',
      value: fmt(classes.length),
      icon: School,
      color: 'bg-secondary',
    },
    {
      title: 'Nombre de Professeurs',
      value: fmt(teachers.length),
      icon: GraduationCap,
      color: 'bg-accent',
    },
    {
      title: 'Total encaissé (année)',
      value: `${fmt(getTotalCollectedForYear())} FCFA`,
      icon: Banknote,
      color: 'bg-emerald-500',
    },
  ];

  // Activité récente — uniquement des inscriptions/créations réelles, jamais
  // de données inventées. Si rien n'existe encore, on l'affiche honnêtement.
  const recentActivity = [
    ...students.map(s => ({
      action: 'Nouvel élève inscrit',
      name: `${s.firstName} ${s.lastName}`,
      at: new Date(s.createdAt).getTime(),
    })),
    ...teachers.map(t => ({
      action: 'Nouveau professeur inscrit',
      name: `${t.firstName} ${t.lastName}`,
      at: new Date(t.createdAt).getTime(),
    })),
    ...classes.map(c => ({
      action: 'Nouvelle classe créée',
      name: c.name,
      at: new Date(c.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Bienvenue, {profile?.full_name || 'Administrateur'} 👋
        </h1>
        <p className="text-muted-foreground">
          Voici un aperçu de {school?.name ? `${school.name} ` : 'votre établissement '}aujourd'hui.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`${stat.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-muted-foreground text-sm font-medium mb-1">{stat.title}</h3>
            <p className="text-3xl font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-card rounded-2xl p-6 border border-border"
      >
        <h2 className="text-xl font-bold text-foreground mb-4">Activité Récente</h2>
        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Inbox className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Aucune activité récente</p>
            <p className="text-sm opacity-70 mt-1">Les inscriptions et créations récentes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div>
                  <p className="font-medium text-foreground">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.name}</p>
                </div>
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(activity.at, { addSuffix: true, locale: fr })}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
