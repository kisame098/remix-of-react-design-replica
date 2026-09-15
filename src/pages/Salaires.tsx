import { useState } from 'react';
import { LayoutDashboard, UsersRound, History, TrendingUp, Banknote } from 'lucide-react';
import PayrollOverview from '@/components/payroll/PayrollOverview';
import PayrollEmployeeManagement from '@/components/payroll/PayrollEmployeeManagement';
import PayrollLedger from '@/components/payroll/PayrollLedger';
import PayrollMassSalariale from '@/components/payroll/PayrollMassSalariale';

type Tab = 'overview' | 'employees' | 'ledger' | 'mass';

interface NavTab {
  id: Tab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: NavTab[] = [
  { id: 'overview',  label: 'Vue d\'ensemble',           icon: LayoutDashboard, description: 'Qui est payé ce mois-ci'   },
  { id: 'employees', label: 'Personnel non-enseignant',  icon: UsersRound,      description: 'Comptables, gardiens…'      },
  { id: 'ledger',    label: 'Journal des paiements',     icon: History,         description: 'Historique complet'         },
  { id: 'mass',      label: 'Masse salariale',           icon: TrendingUp,      description: 'Coût total sur une période' },
];

const Salaires = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Salaires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Paie des professeurs et du personnel non-enseignant</p>
        </div>
      </div>

      {/* Body: left nav + content */}
      <div className="flex-1 min-h-0 flex">
        <nav className="w-56 border-r flex-shrink-0 flex flex-col p-3 gap-1 bg-muted/10">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                }`}
              >
                <tab.icon className={`h-4 w-4 flex-shrink-0 ${
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-primary-foreground' : ''}`}>{tab.label}</p>
                  <p className={`text-xs truncate ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {tab.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {activeTab === 'overview'  && <PayrollOverview />}
          {activeTab === 'employees' && <PayrollEmployeeManagement />}
          {activeTab === 'ledger'    && <PayrollLedger />}
          {activeTab === 'mass'      && <PayrollMassSalariale />}
        </div>
      </div>
    </div>
  );
};

export default Salaires;
