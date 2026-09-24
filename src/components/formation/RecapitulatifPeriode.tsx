import { useMemo } from 'react';
import { useFormationPro } from '@/contexts/FormationProContext';
import type { Student } from '@/contexts/SchoolContext';
import {
  type BaremeCategorie, type Evaluation, type Note, type NiveauMatiere, type Periode, type Stage,
  recapitulatifPeriode, evaluationsDeLaFormule, notesImposeesParStages,
} from '@/lib/formationPro';

const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleur = (m: number | null) => m === null ? 'text-muted-foreground' : m >= 10 ? 'text-green-600' : 'text-red-500';

interface Props {
  promotionId: string;
  periode: Periode;
  matieres: NiveauMatiere[];
  categories: BaremeCategorie[];
  depuisExamens: { evaluations: Evaluation[]; notes: Note[] };
  /** Les stages de la promotion : leur note remplit les matières « Stage ». */
  stages: Stage[];
  eleves: Student[];
  onChoisirMatiere: (matiereId: string) => void;
}

/**
 * Toute la promotion sur une période : la moyenne de chaque matière, la
 * moyenne générale (pondérée par les coefficients) et le rang — le résultat
 * des trois étages de calcul, qu'aucun écran ne montrait jusqu'ici.
 */
export const RecapitulatifPeriode = ({ promotionId, periode, matieres, categories, depuisExamens, stages, eleves, onChoisirMatiere }: Props) => {
  const { evaluations, notes } = useFormationPro();
  const lignes = useMemo(() => {
    // Contrôle continu et TP saisis dans Évaluations + examens blancs et finaux de la période.
    const f = evaluationsDeLaFormule(evaluations.filter(e => e.promotionId === promotionId), notes, categories, depuisExamens);
    return recapitulatifPeriode(
      eleves.map(s => s.id), matieres, categories, f.evaluations.filter(e => e.periodeId === periode.id), f.notes,
      notesImposeesParStages(matieres, stages, periode.id),
    );
  }, [eleves, matieres, categories, evaluations, notes, promotionId, periode.id, depuisExamens, stages]);
  const parId = new Map(eleves.map(s => [s.id, s]));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="w-12 px-2 py-2 text-center font-medium text-muted-foreground border-b">Rang</th>
              <th className="sticky left-0 z-10 bg-muted min-w-[170px] px-3 py-2 text-left font-medium text-muted-foreground border-b border-r">Élève</th>
              {matieres.map(m => (
                <th key={m.id} className="px-2 py-2 border-b text-center min-w-[90px]">
                  <button onClick={() => onChoisirMatiere(m.id)} className="hover:text-primary hover:underline" title={`Saisir les notes de ${m.matiereName}`}>
                    <div className="text-xs font-medium text-foreground">{m.matiereName}</div>
                  </button>
                  <div className="text-[11px] font-normal text-muted-foreground">×{m.coefficient}</div>
                </th>
              ))}
              <th className="min-w-[100px] px-3 text-center font-semibold border-l border-b bg-muted/60">
                Moyenne générale<div className="text-xs font-normal text-muted-foreground">/20</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => {
              const s = parId.get(l.studentEnrollmentId);
              if (!s) return null;
              return (
                <tr key={l.studentEnrollmentId} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="text-center font-bold bg-primary/5">{l.rang ?? '—'}</td>
                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                    <div className="font-medium leading-tight">{s.lastName}</div>
                    <div className="text-xs text-muted-foreground">{s.firstName}</div>
                  </td>
                  {matieres.map(m => {
                    const v = l.parMatiere[m.id];
                    return <td key={m.id} className={`text-center ${couleur(v)}`}>{v === null ? '—' : format(v)}</td>;
                  })}
                  <td className={`text-center font-semibold border-l bg-muted/30 ${couleur(l.generale)}`}>
                    {l.generale === null ? '—' : format(l.generale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Chaque moyenne de matière suit toute la formule d'évaluation (contrôle continu, TP et examens de la période) ; une matière « Stage » prend la note du stage. La moyenne générale est pondérée par les coefficients.
        Une matière sans aucune note n'est pas comptée (jamais 0) ; un élève sans aucune note n'est pas classé.
      </p>
    </div>
  );
};
