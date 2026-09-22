import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Loader2, ChevronRight, Users, GraduationCap } from 'lucide-react';
import { triPromotions, grouperPromotions } from '@/lib/formationPro';

/**
 * Page 1 du module Évaluations : choisir une promotion — équivalent de
 * « choisir une classe » dans Gestion des Notes (src/pages/GradeManagement.tsx),
 * sauf que chez nous les périodes appartiennent à la promotion (pas à
 * l'école) : la promotion doit donc être choisie AVANT la période.
 */
const Evaluations = () => {
  const navigate = useNavigate();
  const { loading, promotions, formations, niveaux, evaluations } = useFormationPro();
  const groupes = useMemo(() => grouperPromotions(triPromotions(promotions), niveaux, formations), [promotions, niveaux, formations]);

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Évaluations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Choisissez une promotion</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {promotions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucune promotion créée</h3>
              <p className="text-muted-foreground mb-6">Créez d'abord une promotion pour pouvoir y saisir des notes.</p>
              <Button asChild><Link to="/formation/promotions">Promotions</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupes.map(gf => (
              <div key={gf.formation.id} className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{gf.formation.name}</h2>
                {gf.niveaux.map(gn => (
                  <div key={gn.niveau.id} className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">{gn.niveau.name}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {gn.promotions.map(p => {
                        const nbEval = evaluations.filter(e => e.promotionId === p.id).length;
                        return (
                          <button key={p.id} onClick={() => navigate(`/formation/evaluations/${p.id}`)} className="text-left group">
                            <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <GraduationCap className="h-5 w-5" />
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">{p.name}</h3>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.studentLimit} places max</span>
                                  <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />{nbEval} évaluation{nbEval !== 1 ? 's' : ''}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Evaluations;
