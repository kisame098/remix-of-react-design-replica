import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Loader2, ChevronRight, Users, GraduationCap } from 'lucide-react';
import { triPromotions, grouperPromotions, type Promotion } from '@/lib/formationPro';

interface Props {
  titre: string;
  /** Adresse de la page d'une promotion (ex. `/formation/examens/${p.id}`). */
  lien: (promotion: Promotion) => string;
  /** Ce que la carte affiche à droite de l'effectif (« 2 examens »…). */
  details?: (promotion: Promotion) => ReactNode;
  /** Chargement propre au module (ex. les examens), en plus du catalogue. */
  chargement?: boolean;
}

/**
 * Premier écran des modules qui travaillent PAR PROMOTION (Évaluations,
 * Examens…) : les promotions groupées par formation puis niveau, en cartes —
 * le même geste que « choisir une classe » dans Gestion des Notes.
 */
export const GrillePromotions = ({ titre, lien, details, chargement }: Props) => {
  const navigate = useNavigate();
  const { loading, promotions, formations, niveaux } = useFormationPro();
  const { getStudentCountByClass } = useSchool();
  const groupes = useMemo(() => grouperPromotions(triPromotions(promotions), niveaux, formations), [promotions, niveaux, formations]);

  if (loading || chargement) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">{titre}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Choisissez une promotion</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {promotions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucune promotion créée</h3>
              <p className="text-muted-foreground mb-6">Créez d'abord une promotion pour pouvoir y travailler.</p>
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
                        const nbEleves = getStudentCountByClass(p.classId);
                        return (
                          <button key={p.id} onClick={() => navigate(lien(p))} className="text-left group">
                            <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <GraduationCap className="h-5 w-5" />
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">{p.name}</h3>
                                <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{nbEleves} élève{nbEleves !== 1 ? 's' : ''}</span>
                                  {details?.(p)}
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
