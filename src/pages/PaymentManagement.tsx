import { useState } from 'react';
import { LayoutDashboard, CreditCard, BarChart3, Settings2, Wallet, UsersRound, ScanLine } from 'lucide-react';
import PaymentOverview from '@/components/payment/PaymentOverview';
import PaymentEntry from '@/components/payment/PaymentEntry';
import PaymentTracking from '@/components/payment/PaymentTracking';
import PaymentConfig from '@/components/payment/PaymentConfig';
import ServiceRoster from '@/components/payment/ServiceRoster';

type Tab = 'overview' | 'entry' | 'scan' | 'tracking' | 'roster' | 'config';

interface NavTab {
  id: Tab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: NavTab[] = [
  { id: 'overview',  label: 'Vue d\'ensemble', icon: LayoutDashboard, description: 'Statistiques globales'        },
  { id: 'entry',     label: 'Paiement',         icon: CreditCard,      description: 'Encaisser un paiement'      },
  { id: 'scan',      label: 'Scanner',          icon: ScanLine,        description: 'Scan QR direct à la caisse' },
  { id: 'tracking',  label: 'Suivi',             icon: BarChart3,       description: 'Qui a payé / pas payé'      },
  { id: 'roster',    label: 'Services',          icon: UsersRound,      description: 'Inscriptions aux services'  },
  { id: 'config',    label: 'Configuration',     icon: Settings2,       description: 'Tarifs & services annexes'  },
];

const PaymentManagement = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Paiements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Inscriptions, scolarité, services annexes</p>
        </div>
      </div>

      {/* Body: left nav + content */}
      <div className="flex-1 min-h-0 flex">
        {/* Left nav */}
        <nav className="w-56 border-r flex-shrink-0 flex flex-col p-3 gap-1 bg-muted/10">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <tab.icon className={`h-4 w-4 flex-shrink-0 ${
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-primary-foreground' : ''}`}>
                    {tab.label}
                  </p>
                  <p className={`text-xs truncate ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {tab.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {activeTab === 'overview'  && <PaymentOverview />}
          {activeTab === 'entry'     && <PaymentEntry />}
          {activeTab === 'scan'      && <PaymentEntry initialMode="scan" />}
          {activeTab === 'tracking'  && <PaymentTracking />}
          {activeTab === 'roster'    && <ServiceRoster />}
          {activeTab === 'config'    && <div className="flex-1 overflow-y-auto"><PaymentConfig /></div>}
        </div>
      </div>
    </div>
  );
};

export default PaymentManagement;
