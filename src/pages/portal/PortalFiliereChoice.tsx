import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Loader2, ListChecks, AlertCircle } from 'lucide-react';

// ─── Choix des matières optionnelles (LV1/LV2/…) ────────────────────────────
// L'élève choisit lui-même sa matière pour chaque créneau au choix défini par
// la filière de sa classe. Ré-éditable à tout moment (pas de verrou/deadline).

interface ChoiceGroup {
  id: string;
  label: string;
  coefficient: number;
  options: { subjectName: string }[];
}

export default function PortalFiliereChoice() {
  const { schoolAccount, accountRole } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [filiereName, setFiliereName] = useState('');
  const [groups, setGroups] = useState<ChoiceGroup[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({}); // choiceGroupId -> subjectName
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [noFiliere, setNoFiliere] = useState(false);

  useEffect(() => {
    if (accountRole !== 'student' || !schoolAccount?.studentEnrollmentId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('class_id, academic_year_label')
          .eq('id', schoolAccount.studentEnrollmentId)
          .single();

        if (!enr?.class_id) { setNoFiliere(true); return; }

        const { data: cls } = await supabase
          .from('classes').select('niveau').eq('id', enr.class_id).single();
        const niveau = cls?.niveau;
        if (!niveau) { setNoFiliere(true); return; }

        const { data: assignment } = await supabase
          .from('class_filiere_assignments')
          .select('id, filiere_id')
          .eq('class_id', enr.class_id)
          .eq('academic_year_label', enr.academic_year_label)
          .maybeSingle();

        if (!assignment) { setNoFiliere(true); return; }

        const { data: filiere } = await supabase
          .from('filieres').select('name').eq('id', assignment.filiere_id).single();
        setFiliereName(filiere?.name ?? '');

        // Une filière peut redéfinir ses groupes par niveau (ex: "S1" en 1ère vs
        // en Tle) — charger la base ('' = tous niveaux) + les ajouts propres à
        // ce niveau, puis fusionner (le spécifique remplace la base par label).
        const { data: rawGroups } = await supabase
          .from('filiere_choice_groups')
          .select('id, label, coefficient, niveau')
          .eq('filiere_id', assignment.filiere_id)
          .in('niveau', ['', niveau])
          .order('ordering');

        const byLabel = new Map<string, { id: string; label: string; coefficient: number; niveau: string }>();
        for (const g of (rawGroups ?? [])) {
          const existing = byLabel.get(g.label);
          if (!existing || (g.niveau !== '' && existing.niveau === '')) byLabel.set(g.label, g);
        }
        const groupsData = [...byLabel.values()];

        if (groupsData.length === 0) { setNoFiliere(true); return; }

        const { data: optionsData } = await supabase
          .from('filiere_choice_options')
          .select('choice_group_id, subject_name')
          .in('choice_group_id', groupsData.map(g => g.id))
          .order('ordering');

        const optionsByGroup = new Map<string, { subjectName: string }[]>();
        for (const o of (optionsData ?? [])) {
          if (!optionsByGroup.has(o.choice_group_id)) optionsByGroup.set(o.choice_group_id, []);
          optionsByGroup.get(o.choice_group_id)!.push({ subjectName: o.subject_name });
        }

        setGroups(groupsData.map(g => ({
          id: g.id, label: g.label, coefficient: Number(g.coefficient),
          options: optionsByGroup.get(g.id) ?? [],
        })));

        const { data: choicesData } = await supabase
          .from('filiere_student_choices')
          .select('choice_group_id, chosen_subject_name')
          .eq('student_enrollment_id', schoolAccount.studentEnrollmentId);

        const map: Record<string, string> = {};
        for (const c of (choicesData ?? [])) map[c.choice_group_id] = c.chosen_subject_name;
        setChoices(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolAccount?.studentEnrollmentId, accountRole]);

  const handlePick = async (groupId: string, subjectName: string) => {
    if (!schoolAccount?.studentEnrollmentId) return;
    setSavingGroupId(groupId);
    try {
      const { error } = await supabase.rpc('resolve_filiere_choice', {
        p_choice_group_id: groupId,
        p_student_enrollment_id: schoolAccount.studentEnrollmentId,
        p_subject_name: subjectName,
        p_actor: 'student',
      });
      if (error) throw error;
      setChoices(prev => ({ ...prev, [groupId]: subjectName }));
    } catch {
      // L'erreur la plus probable est l'exclusion croisée (même matière déjà
      // choisie dans un autre créneau) — déjà empêchée côté UI, donc rare ici.
    } finally {
      setSavingGroupId(null);
    }
  };

  // Une matière déjà choisie dans un AUTRE créneau de la même filière est
  // désactivée ici (contrainte : pas deux fois la même matière).
  const takenElsewhere = (groupId: string, subjectName: string): string | null => {
    for (const [gId, name] of Object.entries(choices)) {
      if (gId !== groupId && name === subjectName) {
        return groups.find(g => g.id === gId)?.label ?? null;
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center
                       hover:bg-gray-100 transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Matières optionnelles</h1>
        </div>
      </header>

      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : noFiliere ? (
          <div className="bg-white rounded-2xl py-16 flex flex-col items-center gap-3 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ListChecks className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600">Aucun choix à faire</p>
            <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed">
              Votre classe n'a pas de matière optionnelle configurée pour le moment.
            </p>
          </div>
        ) : (
          <>
            {filiereName && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Cursus {filiereName}
              </p>
            )}

            {groups.map(group => {
              const current = choices[group.id];
              const isSaving = savingGroupId === group.id;
              return (
                <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
                    <p className="font-bold text-gray-900">{group.label}</p>
                    <span className="text-xs font-semibold text-gray-400">Coef. {group.coefficient}</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {group.options.map(opt => {
                      const isChosen = current === opt.subjectName;
                      const takenIn = !isChosen ? takenElsewhere(group.id, opt.subjectName) : null;
                      const disabled = !!takenIn || isSaving;
                      return (
                        <button
                          key={opt.subjectName}
                          disabled={disabled}
                          onClick={() => handlePick(group.id, opt.subjectName)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all',
                            isChosen
                              ? 'bg-blue-50 border-2 border-blue-500'
                              : disabled
                              ? 'bg-gray-50 border-2 border-transparent opacity-50 cursor-not-allowed'
                              : 'bg-gray-50 border-2 border-transparent hover:border-gray-200 active:scale-[.98]',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-semibold text-sm', isChosen ? 'text-blue-700' : 'text-gray-700')}>
                              {opt.subjectName}
                            </p>
                            {takenIn && (
                              <p className="text-[11px] text-gray-400 mt-0.5">Déjà choisi(e) pour {takenIn}</p>
                            )}
                          </div>
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                          ) : isChosen ? (
                            <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          ) : takenIn ? (
                            <AlertCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <p className="text-center text-xs text-gray-400 pb-2">
              Vous pouvez changer d'avis à tout moment en revenant sur cette page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
