import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AcademicProfileRow } from '@/lib/academicProfile';

interface ProfilMatieresProps {
  lignes: AcademicProfileRow[];
  /** Désactive (`false`) ou réactive (`true`) la matière pour cet élève, à toutes les périodes. */
  onBasculer: (ligne: AcademicProfileRow, actif: boolean) => void;
  /** Nouveau coefficient personnalisé pour cet élève. */
  onCoefficient: (ligne: AcademicProfileRow, coefficient: string) => void;
}

/**
 * Les matières d'un élève (collège / lycée) : une ligne par matière, avec son
 * interrupteur.
 *
 * Une matière DÉSACTIVÉE reste dans la liste, grisée et barrée, avec son
 * interrupteur — c'est ce qui permet de la réactiver. (Elle disparaissait, et on ne
 * pouvait plus jamais la retrouver.)
 */
export const ProfilMatieres = ({ lignes, onBasculer, onCoefficient }: ProfilMatieresProps) => (
  <div className="space-y-2">
    {lignes.map(ligne => (
      <div
        key={ligne.subject.id}
        className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${ligne.active ? '' : 'bg-muted/40'}`}
      >
        <div className="min-w-0">
          <p className={`font-medium text-sm truncate ${ligne.active ? '' : 'text-muted-foreground line-through'}`}>
            {ligne.subject.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px]">{ligne.source}</Badge>
            {ligne.desactivee && (
              <Badge variant="secondary" className="text-[10px]">Désactivée pour cet élève</Badge>
            )}
            {ligne.partielle && (
              <Badge variant="destructive" className="text-[10px]">Réglage différent selon les périodes</Badge>
            )}
          </div>
          {ligne.partielle && (
            <p className="mt-1 text-xs text-muted-foreground">
              Active dans certaines périodes seulement. L'interrupteur l'applique à toutes.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Input
            type="number" min="0" step="0.5"
            className="w-16 h-8 text-center text-sm"
            defaultValue={ligne.coefficient}
            disabled={!ligne.active}
            aria-label={`Coefficient de ${ligne.subject.name}`}
            onBlur={(e) => {
              const v = e.target.value;
              if (v && Number(v) !== ligne.coefficient) onCoefficient(ligne, v);
            }}
          />
          <Switch
            checked={ligne.active}
            aria-label={`${ligne.active ? 'Désactiver' : 'Réactiver'} ${ligne.subject.name} pour cet élève`}
            onCheckedChange={(actif) => onBasculer(ligne, actif)}
          />
        </div>
      </div>
    ))}
  </div>
);
