import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Landmark } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useSchool } from '@/contexts/SchoolContext';
import { GrillePromotions } from '@/components/formation/GrillePromotions';
import { TableauBordFinancements } from '@/components/financements/TableauBordFinancements';
import { DialogOrganismes } from '@/components/financements/Organismes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Page 1 du module Financements : choisir une promotion (même grille que Stages et Examens). */
const Financements = () => {
  const { actif, loading, disponible, dossiers, reglages } = useFinancements();
  const [organismes, setOrganismes] = useState(false);
  const { students } = useSchool();

  if (!actif) {
    return (
      <div className="p-6 max-w-xl">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-medium">Les financements ne sont pas activés</p>
            <p className="text-sm text-muted-foreground">Le directeur les active dans <Link to="/parametres" className="text-primary hover:underline">Paramètres → Financements</Link>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!disponible) {
    return (
      <div className="p-6 max-w-xl text-sm text-muted-foreground rounded-md border border-dashed m-6">
        Le module Financements n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.
      </div>
    );
  }

  return (
    <>
    <GrillePromotions
      actions={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOrganismes(true)}>
          <Landmark className="h-3.5 w-3.5" />Organismes ({reglages.organismes.length})
        </Button>
      }
      titre="Financements"
      sousTitre="Apprenants pris en charge par un organisme : l'état d'ensemble, puis une promotion"
      entete={<TableauBordFinancements />}
      chargement={loading}
      lien={p => `/formation/financements/${p.id}`}
      details={p => {
        const ids = new Set(students.filter(s => s.classId === p.classId).map(s => s.id));
        const siens = dossiers.filter(d => ids.has(d.studentEnrollmentId));
        if (siens.length === 0) return null;
        const aRegler = siens.filter(d => d.statut === 'en_attente' || d.statut === 'a_regulariser').length;
        return (
          <>
            <span className="flex items-center gap-1"><Landmark className="h-3 w-3" />{siens.length} financé{siens.length > 1 ? 's' : ''}</span>
            {aRegler > 0 && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" />{aRegler} à traiter</span>}
          </>
        );
      }}
    />
    <DialogOrganismes open={organismes} onOpenChange={setOrganismes} />
    </>
  );
};

export default Financements;
