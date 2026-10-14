import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Landmark } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { montantFinance, priseEnChargeEffective } from '@/lib/financements';
import { situationFinanciere, sommeSituations } from '@/lib/financementsSuivi';

// ═══════════════════════════════════════════════════════════════════════════
// Gestion des paiements → Vue d'ensemble : l'argent attendu des organismes
// financeurs (3FPT…), à côté de celui encaissé auprès des familles. Les
// versements des organismes restent dans le module Financements — ils ne se
// mélangent pas à la caisse — mais le directeur voit tout au même endroit.
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

export const EncadreFinancementsPaiements = () => {
  const fin = useFinancements();
  const { students } = useSchool();
  const { elementsDe } = useElementsAPayer();

  const s = useMemo(() => {
    const parId = new Map(students.map(e => [e.id, e]));
    return sommeSituations(fin.dossiers.flatMap(d => {
      const e = parId.get(d.studentEnrollmentId);
      const o = fin.organisme(d.organismeId);
      // Seuls les dossiers validés : avant, l'apprenant paie tout.
      if (!e || !o || !priseEnChargeEffective(d)) return [];
      return [situationFinanciere(d.id, montantFinance(o, elementsDe(e)).finance, fin.factures, fin.versements)];
    }));
  }, [fin, students, elementsDe]);

  if (!fin.actif || fin.dossiers.length === 0) return null;
  const noms = [...new Set(fin.dossiers.map(d => fin.organisme(d.organismeId)?.nom).filter(Boolean))].join(', ');

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">Financements ({noms})</p>
              <p className="text-xs text-muted-foreground">
                {fin.dossiers.length} apprenant{fin.dossiers.length > 1 ? 's' : ''} financé{fin.dossiers.length > 1 ? 's' : ''} : leur part est encaissée ici (dossier validé) ; celle de l'organisme se suit dans le module.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/formation/financements">Ouvrir Financements<ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        {fin.suiviDisponible && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {([
              ["Attendu de l'organisme", s.finance, ''],
              ['Facturé', s.facture, ''],
              ['Reçu', s.recu, 'text-green-700 dark:text-green-400'],
              ['Reste à encaisser', s.finance - s.recu, s.finance - s.recu > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'],
            ] as const).map(([titre, montant, couleur]) => (
              <div key={titre} className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground">{titre}</p>
                <p className={`text-lg font-bold ${couleur}`}>{fmt(montant)} <span className="text-xs font-normal text-muted-foreground">FCFA</span></p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
