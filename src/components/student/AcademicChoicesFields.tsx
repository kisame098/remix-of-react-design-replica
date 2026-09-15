import {
  useSchool, mergeFiliereChoiceGroups, mergeFiliereFacultativeSubjects,
  FiliereChoiceGroup, FiliereFacultativeSubject,
} from '@/contexts/SchoolContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ListChecks } from 'lucide-react';

// ─── Choix de matières optionnelles à l'inscription ─────────────────────────
// Si la classe cible a une filière assignée avec des créneaux au choix ou des
// matières facultatives pour son niveau, l'élève (ou son tuteur, via le
// personnel) doit répondre MAINTENANT — pas laissé en suspens indéfiniment
// côté portail. `validateForm()` de l'appelant doit bloquer tant que tous les
// groupes retournés par `useAcademicChoicesRequirement` n'ont pas de choix.

export function useAcademicChoicesRequirement(classId: string | null): {
  groups: FiliereChoiceGroup[];
  facultatives: FiliereFacultativeSubject[];
} {
  const { classes, classFiliereAssignments, filiereChoiceGroups, filiereFacultativeSubjects } = useSchool();
  const cls = classId ? classes.find(c => c.id === classId) : undefined;
  if (!cls?.niveau) return { groups: [], facultatives: [] };

  const assignment = classFiliereAssignments.find(a => a.classId === classId);
  if (!assignment) return { groups: [], facultatives: [] };

  return {
    groups: mergeFiliereChoiceGroups(filiereChoiceGroups, assignment.filiereId, cls.niveau),
    facultatives: mergeFiliereFacultativeSubjects(filiereFacultativeSubjects, assignment.filiereId, cls.niveau),
  };
}

interface AcademicChoicesFieldsProps {
  classId: string | null;
  groupChoices: Record<string, string>;         // choiceGroupId -> subjectName
  onGroupChoiceChange: (groupId: string, subjectName: string) => void;
  facultativeChoices: Record<string, boolean>;   // subjectName -> actif
  onFacultativeToggle: (subjectName: string, active: boolean) => void;
  disabled?: boolean;
}

export default function AcademicChoicesFields({
  classId, groupChoices, onGroupChoiceChange, facultativeChoices, onFacultativeToggle, disabled,
}: AcademicChoicesFieldsProps) {
  const { groups, facultatives } = useAcademicChoicesRequirement(classId);
  if (groups.length === 0 && facultatives.length === 0) return null;

  // Une même matière ne peut être choisie que dans un seul créneau de la filière.
  const takenElsewhere = (groupId: string, subjectName: string): string | null => {
    for (const [gId, name] of Object.entries(groupChoices)) {
      if (gId !== groupId && name === subjectName) {
        return groups.find(g => g.id === gId)?.label ?? null;
      }
    }
    return null;
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          Matières optionnelles
        </CardTitle>
        <CardDescription>
          Cette classe impose un choix pour certaines matières — à répondre maintenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map(group => (
          <div key={group.id} className="space-y-1.5">
            <Label>
              {group.label} <span className="text-xs text-muted-foreground font-normal">(coef {group.coefficient})</span>
            </Label>
            <Select
              value={groupChoices[group.id] ?? ''}
              onValueChange={v => onGroupChoiceChange(group.id, v)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full md:w-1/2">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {group.options.map(opt => {
                  const isChosen = groupChoices[group.id] === opt.subjectName;
                  const taken = !isChosen ? takenElsewhere(group.id, opt.subjectName) : null;
                  return (
                    <SelectItem key={opt.subjectName} value={opt.subjectName} disabled={!!taken}>
                      {opt.subjectName}{taken ? ` — déjà pris pour ${taken}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ))}

        {facultatives.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-border/60">
            <Label className="text-sm text-muted-foreground">Matières facultatives (au choix de l'élève)</Label>
            {facultatives.map(f => (
              <div key={f.id} className="flex items-center gap-2">
                <Checkbox
                  id={`facultative-${f.id}`}
                  checked={facultativeChoices[f.name] ?? false}
                  onCheckedChange={checked => onFacultativeToggle(f.name, checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor={`facultative-${f.id}`} className="font-normal cursor-pointer">
                  {f.name} <span className="text-xs text-muted-foreground">(coef {f.coefficient})</span>
                </Label>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
