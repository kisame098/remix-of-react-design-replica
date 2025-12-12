import { motion } from 'framer-motion';
import { Users, School, GraduationCap, TrendingUp } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';

const Dashboard = () => {
  const { students, classes } = useSchool();

  const stats = [
    {
      title: 'Nombre d\'Élèves',
      value: students.length.toString(),
      change: '+12%',
      icon: Users,
      color: 'bg-primary',
    },
    {
      title: 'Nombre de Classes',
      value: classes.length.toString(),
      change: '+3',
      icon: School,
      color: 'bg-secondary',
    },
    {
      title: 'Nombre de Professeurs',
      value: '86',
      change: '+5%',
      icon: GraduationCap,
      color: 'bg-accent',
    },
  ];

  // Recent activity from actual data
  const recentActivity = [
    ...students.slice(-3).reverse().map(s => ({
      action: 'Nouvel élève inscrit',
      name: `${s.firstName} ${s.lastName}`,
      time: 'Récemment',
    })),
    ...classes.slice(-2).reverse().map(c => ({
      action: 'Nouvelle classe créée',
      name: c.name,
      time: 'Récemment',
    })),
  ].slice(0, 4);

  const defaultActivity = [
    { action: 'Nouvel élève inscrit', name: 'Amadou Diallo', time: 'Il y a 2 heures' },
    { action: 'Nouvelle classe créée', name: 'Terminale S2', time: 'Il y a 5 heures' },
    { action: 'Professeur ajouté', name: 'Mme. Fatou Sow', time: 'Hier' },
    { action: 'Mise à jour des notes', name: 'Classe de 3ème A', time: 'Hier' },
  ];

  const displayActivity = recentActivity.length > 0 ? recentActivity : defaultActivity;

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
          Bienvenue, Test Utilisateur 👋
        </h1>
        <p className="text-muted-foreground">
          Voici un aperçu de votre établissement aujourd'hui.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${stat.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                {stat.change}
              </div>
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
        <div className="space-y-4">
          {displayActivity.map((activity, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div>
                <p className="font-medium text-foreground">{activity.action}</p>
                <p className="text-sm text-muted-foreground">{activity.name}</p>
              </div>
              <span className="text-sm text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
