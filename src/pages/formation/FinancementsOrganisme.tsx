import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, FileCheck2, Landmark, Loader2, Pencil, Receipt, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Button } from '@/components/ui/button';
import { DialogOrganisme } from '@/components/financements/Organismes';
import { useApprenantsOrganisme } from '@/components/financements/donneesOrganisme';
import { StatistiquesOrganisme } from '@/components/financements/StatistiquesOrganisme';
import { ApprenantsOrganisme } from '@/components/financements/ApprenantsOrganisme';
import { FinancesOrganisme } from '@/components/financements/FinancesOrganisme';
import { RapportsOrganisme } from '@/components/financements/RapportsOrganisme';

type Rubrique = 'statistiques' | 'apprenants' | 'finances' | 'rapports';

const RUBRIQUES: { id: Rubrique; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'statistiques', label: 'Statistiques', icon: BarChart3, description: "Vue d'ensemble" },
  { id: 'apprenants', label: 'Apprenants', icon: Users, description: 'Dossiers, insertion, suivi' },
  { id: 'finances', label: 'Gestion financière', icon: Receipt, description: 'Factures et paiements reçus' },
  { id: 'rapports', label: 'Rapports', icon: FileCheck2, description: 'Rapports de fin de formation' },
];

/**
 * Page 2 du module Financements : l'espace d'UN organisme, organisé comme
 * Gestion des paiements — une colonne de rubriques à gauche, le contenu à
 * droite.
 */
const FinancementsOrganisme = () => {
  const { organismeId } = useParams<{ organismeId: string }>();
  const navigate = useNavigate();
  const { accountRole } = useAuth();
  const fin = useFinancements();
  const organisme = organismeId ? fin.organisme(organismeId) : undefined;
  const apprenants = useApprenantsOrganisme(organisme);
  const [rubrique, setRubrique] = useState<Rubrique>('statistiques');
  const [modifier, setModifier] = useState(false);

  if (fin.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!organisme) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/financements" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Financements</Link>
        <p className="text-destructive text-sm">Organisme introuvable.</p>
      </div>
    );
  }
  const valides = apprenants.filter(a => a.dossier.statut === 'valide').length;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" className="flex-shrink-0 -ml-2" onClick={() => navigate('/formation/financements')} aria-label="Retour aux organismes">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Landmark className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{organisme.nom}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {organisme.partFinancee} % pris en charge · {apprenants.length} apprenant{apprenants.length > 1 ? 's' : ''}
            {apprenants.length > 0 && ` · ${valides} dossier${valides > 1 ? 's' : ''} validé${valides > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModifier(true)}>
          <Pencil className="h-3.5 w-3.5" />{accountRole === 'admin' ? 'Modifier' : 'Règles'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <nav className="w-56 border-r flex-shrink-0 flex flex-col p-3 gap-1 bg-muted/10">
          {RUBRIQUES.map(r => {
            const actif = r.id === rubrique;
            return (
              <button
                key={r.id}
                onClick={() => setRubrique(r.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                  actif ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                }`}
              >
                <r.icon className={`h-4 w-4 flex-shrink-0 ${actif ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${actif ? 'text-primary-foreground' : ''}`}>{r.label}</p>
                  <p className={`text-xs truncate ${actif ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{r.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          {rubrique === 'statistiques' && <StatistiquesOrganisme organisme={organisme} apprenants={apprenants} />}
          {rubrique === 'apprenants' && <ApprenantsOrganisme organisme={organisme} apprenants={apprenants} />}
          {rubrique === 'finances' && <FinancesOrganisme organisme={organisme} apprenants={apprenants} />}
          {rubrique === 'rapports' && <RapportsOrganisme organisme={organisme} apprenants={apprenants} />}
        </div>
      </div>

      <DialogOrganisme open={modifier} organisme={organisme} onOpenChange={setModifier} />
    </div>
  );
};

export default FinancementsOrganisme;
