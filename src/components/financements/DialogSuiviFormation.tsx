import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useExamens } from '@/contexts/ExamensContext';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { useStages } from '@/contexts/StagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { LIBELLES_SITUATION, SITUATIONS, situationAvecMotif, type Situation } from '@/lib/financements';
import { assiduite } from '@/lib/financementsSuivi';
import {
  LIBELLES_DECISION, LIBELLES_MENTION, LIBELLES_TYPE_EXAMEN, evaluationsDepuisExamens, recapitulatifComplet, triPeriodes,
} from '@/lib/formationPro';
import { messageDe } from '@/components/financements/donneesOrganisme';

// ═══════════════════════════════════════════════════════════════════════════
// Le suivi de la formation d'un apprenant financé, sans rien ressaisir :
// présences (Présences), moyenne et rang de chaque période (Évaluations),
// résultats d'examens (Examens). Seule sa situation (en formation, abandon,
// exclusion…) se saisit ici.
// ═══════════════════════════════════════════════════════════════════════════

const virgule = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleur = (m: number | null | undefined) => (m == null ? 'text-muted-foreground' : m >= 10 ? 'text-green-600' : 'text-red-500');

export const DialogSuiviFormation = ({ eleve, onFermer }: { eleve: Student | null; onFermer: () => void }) => {
  const fin = useFinancements();
  const { students } = useSchool();
  const { studentAttendances } = useAttendance();
  const fp = useFormationPro();
  const ex = useExamens();
  const st = useStages();
  const dossier = eleve ? fin.dossierDe(eleve.id) : undefined;

  const [situation, setSituation] = useState<Situation>('en_formation');
  const [date, setDate] = useState('');
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    if (!dossier) return;
    setSituation(dossier.situation); setDate(dossier.situationDate ?? ''); setMotif(dossier.situationMotif ?? '');
  }, [dossier]);

  const promotion = eleve ? fp.promotions.find(p => p.classId === eleve.classId) : undefined;
  const niveau = promotion ? fp.niveaux.find(n => n.id === promotion.niveauId) : undefined;

  // Moyenne générale et rang de l'apprenant, période par période.
  const periodes = useMemo(() => {
    if (!eleve || !promotion || !niveau) return [];
    const matieres = fp.niveauMatieres.filter(m => m.niveauId === niveau.id);
    const categories = fp.baremeCategories.filter(c => c.formationId === niveau.formationId);
    const depuisExamens = evaluationsDepuisExamens(promotion.id, categories, ex.examens, ex.tours, ex.epreuves, ex.notes);
    const eleveIds = students.filter(s => s.classId === promotion.classId).map(s => s.id);
    return triPeriodes(fp.periodes.filter(p => p.promotionId === promotion.id)).map(periode => {
      const lignes = recapitulatifComplet({
        promotionId: promotion.id, periodeId: periode.id, eleveIds, matieres, categories,
        evaluations: fp.evaluations, notes: fp.notes, depuisExamens, stages: st.stages,
      });
      const sienne = lignes.find(l => l.studentEnrollmentId === eleve.id);
      return { periode, generale: sienne?.generale ?? null, rang: sienne?.rang ?? null, classes: lignes.filter(l => l.rang !== null).length };
    });
  }, [eleve, promotion, niveau, fp, ex, st.stages, students]);

  const examens = useMemo(() => {
    if (!eleve || !promotion) return [];
    return ex.examens
      .filter(e => e.promotionId === promotion.id && ex.candidats.some(c => c.examenId === e.id && c.studentEnrollmentId === eleve.id))
      .map(e => ({ examen: e, resultat: ex.resultats.find(r => r.examenId === e.id && r.studentEnrollmentId === eleve.id) }));
  }, [eleve, promotion, ex]);

  if (!eleve || !dossier) return null;
  const presence = assiduite(studentAttendances, eleve.id);
  const modifiee = situation !== dossier.situation || date !== (dossier.situationDate ?? '') || motif !== (dossier.situationMotif ?? '');

  const enregistrer = async () => {
    if (situationAvecMotif(situation) && (!date || !motif.trim())) {
      toast({ title: 'Situation incomplète', description: `${LIBELLES_SITUATION[situation]} : indiquez la date et le motif.`, variant: 'destructive' });
      return;
    }
    setEnCours(true);
    try {
      await fin.modifier(dossier.id, {
        situation, situationDate: situation === 'en_formation' ? '' : date, situationMotif: situationAvecMotif(situation) ? motif : '',
      });
      toast({ title: 'Situation enregistrée', description: LIBELLES_SITUATION[situation] });
    } catch (e) { toast({ title: 'Situation non enregistrée', description: messageDe(e), variant: 'destructive' }); } finally { setEnCours(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onFermer(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />{eleve.lastName} {eleve.firstName}</DialogTitle>
          <DialogDescription>Suivi de la formation{promotion ? ` · ${promotion.name}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 -mx-1 px-1">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Assiduité</h3>
            {presence.taux === null ? (
              <p className="text-sm text-muted-foreground">Aucune séance pointée pour l'instant.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {([
                  ['Présence', `${presence.taux} %`, presence.taux < 80 ? 'text-amber-700' : 'text-green-700'],
                  ['Absences', String(presence.absences), presence.absences > 0 ? 'text-red-600' : ''],
                  ['Retards', String(presence.retards), ''],
                ] as const).map(([titre, valeur, c]) => (
                  <div key={titre} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{titre}</p>
                    <p className={`text-lg font-bold ${c}`}>{valeur}</p>
                  </div>
                ))}
              </div>
            )}
            {presence.taux !== null && <p className="text-xs text-muted-foreground">Sur {presence.seances} séance{presence.seances > 1 ? 's' : ''} pointée{presence.seances > 1 ? 's' : ''}.</p>}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Évolution pédagogique</h3>
              {promotion && <Link to={`/formation/evaluations/${promotion.id}`} className="text-xs text-primary hover:underline">Voir ses notes →</Link>}
            </div>
            {periodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune période créée dans Évaluations.</p>
            ) : (
              <div className="rounded-lg border divide-y text-sm">
                {periodes.map(({ periode, generale, rang, classes }) => (
                  <div key={periode.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>{periode.name}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">{rang ? `${rang}${rang === 1 ? 'er' : 'e'} / ${classes}` : ''}</span>
                      <span className={`font-semibold w-16 text-right ${couleur(generale)}`}>{generale === null ? '—' : `${virgule(generale)}/20`}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {examens.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Examens</h3>
              <div className="rounded-lg border divide-y text-sm">
                {examens.map(({ examen, resultat }) => (
                  <div key={examen.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{examen.name}</span>
                      <span className="text-xs text-muted-foreground"> · {LIBELLES_TYPE_EXAMEN[examen.type]}</span>
                    </span>
                    <span className="text-xs whitespace-nowrap">
                      {resultat?.decision ? (
                        <span className={resultat.decision === 'admis' ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                          {LIBELLES_DECISION[resultat.decision]}{resultat.mention ? ` · ${LIBELLES_MENTION[resultat.mention]}` : ''}
                          {resultat.moyenne != null ? ` · ${virgule(resultat.moyenne)}/20` : ''}
                        </span>
                      ) : <span className="text-muted-foreground">Pas encore délibéré</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Situation dans la formation</h3>
            <div className="flex flex-wrap gap-1.5">
              {SITUATIONS.map(s => (
                <button key={s} type="button" onClick={() => setSituation(s)} aria-pressed={situation === s}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${situation === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70'}`}>
                  {LIBELLES_SITUATION[s]}
                </button>
              ))}
            </div>
            {situation !== 'en_formation' && (
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <div className="space-y-1.5"><Label htmlFor="sit-date">Date{situationAvecMotif(situation) ? ' *' : ''}</Label>
                  <Input id="sit-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                {situationAvecMotif(situation) && (
                  <div className="space-y-1.5"><Label htmlFor="sit-motif">Motif *</Label>
                    <Input id="sit-motif" value={motif} placeholder="Raison de l'abandon, de l'exclusion…" onChange={e => setMotif(e.target.value)} /></div>
                )}
              </div>
            )}
            {modifiee && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => void enregistrer()} disabled={enCours}>
                  {enCours && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer la situation
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
