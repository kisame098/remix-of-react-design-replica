import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStages } from '@/contexts/StagesContext';
import type { Student } from '@/contexts/SchoolContext';
import { type NiveauMatiere, type Periode, notesStageParMatiere } from '@/lib/formationPro';
import { Hotel } from 'lucide-react';

const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');

interface Props {
  promotionId: string;
  periode: Periode;
  matiere: NiveauMatiere;
  eleves: Student[];
}

/**
 * Une matière « Stage » dans Évaluations : rien à saisir ici — la note vient
 * de la rubrique Stages (une seule saisie). On la montre, avec l'entreprise.
 */
export const NotesStageMatiere = ({ promotionId, periode, matiere, eleves }: Props) => {
  const { stages, entreprises } = useStages();
  const stagesPromo = useMemo(() => stages.filter(s => s.promotionId === promotionId), [stages, promotionId]);
  const notes = useMemo(() => notesStageParMatiere(stagesPromo, periode.id)[matiere.id] ?? {}, [stagesPromo, periode.id, matiere.id]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-3 text-sm flex items-start gap-2">
        <Hotel className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <p>
          La note de cette matière est celle du <strong>stage</strong>, saisie dans la rubrique{' '}
          <Link to={`/formation/stages/${promotionId}`} className="text-primary hover:underline">Stages</Link> — rien à taper ici.
          {' '}Seuls les stages notés comptant pour {periode.name} apparaissent.
        </p>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium min-w-[170px]">Élève</th>
              <th className="px-3 py-2 font-medium">Entreprise</th>
              <th className="px-3 py-2 font-medium text-center min-w-[90px]">Note /20</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map(e => {
              const siens = stagesPromo.filter(s => s.studentEnrollmentId === e.id && s.periodeId === periode.id && s.niveauMatiereId === matiere.id && !s.abandonne);
              const noms = siens.map(s => entreprises.find(x => x.id === s.entrepriseId)?.nom).filter(Boolean).join(', ');
              const n = notes[e.id];
              return (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <div className="font-medium leading-tight">{e.lastName}</div>
                    <div className="text-xs text-muted-foreground">{e.firstName}</div>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{noms || (siens.length ? 'Entreprise à préciser' : 'Aucun stage pour cette période')}</td>
                  <td className={`px-3 py-1.5 text-center font-semibold ${n == null ? 'text-muted-foreground' : n >= 10 ? 'text-green-600' : 'text-red-500'}`}>
                    {n == null ? '—' : format(n)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
