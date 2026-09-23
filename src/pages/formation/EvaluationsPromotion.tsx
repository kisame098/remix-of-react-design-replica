import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useExamens } from '@/contexts/ExamensContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Loader2, ClipboardList, Users, Check, AlertCircle, ArrowLeft, ChevronRight, Pencil, Trash2, CalendarRange, Trophy, BookOpen,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { triPeriodes, baremeComplet, sommeBareme, analyserSaisieNote, evaluationsDepuisExamens, LIBELLES_TYPE_EXAMEN } from '@/lib/formationPro';
import { GrilleNotesMatiere } from '@/components/formation/GrilleNotesMatiere';
import { RecapitulatifPeriode } from '@/components/formation/RecapitulatifPeriode';
import { DialogPeriode } from '@/components/formation/DialogPeriode';
import { useSauvegardeNotes } from '@/components/formation/useSauvegardeNotes';

const dateFr = (iso?: string) => { if (!iso) return null; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

type Vue = { kind: 'recap' } | { kind: 'matiere'; id: string };

/**
 * Page 2 du module Évaluations : l'espace de travail d'une promotion.
 *
 *   Période (pastilles)  →  Matière (colonne de gauche)  →  une seule grille
 *
 * La grille montre TOUTES les évaluations de la matière sur la période,
 * rangées par catégorie de la formule (Contrôle continu, TP, Examen…), et la
 * moyenne de chaque élève — comme le tableau Devoirs/Composition/Moyenne du
 * système classique. La catégorie n'est donc plus un filtre à choisir avant
 * de voir quoi que ce soit : c'est un groupe de colonnes, et « + » dans son
 * en-tête y ajoute une évaluation sans rien redemander.
 * « Récapitulatif » donne les moyennes de toutes les matières et le rang.
 */
const EvaluationsPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories,
    periodes, evaluations, notes, addPeriode, updatePeriode, deletePeriode, saisirNote, supprimerNote,
  } = useFormationPro();
  const { students } = useSchool();
  const examens = useExamens();
  const sauvegarde = useSauvegardeNotes({ enregistrer: saisirNote, supprimer: supprimerNote, analyser: analyserSaisieNote });

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : undefined;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : undefined;

  const matieres = useMemo(
    () => niveauMatieres.filter(m => niveau && m.niveauId === niveau.id).sort((a, b) => a.ordering - b.ordering),
    [niveauMatieres, niveau],
  );
  const categories = useMemo(
    () => baremeCategories.filter(c => formation && c.formationId === formation.id).sort((a, b) => a.ordering - b.ordering),
    [baremeCategories, formation],
  );
  const periodesPromo = useMemo(
    () => triPeriodes(periodes.filter(p => promotion && p.promotionId === promotion.id)),
    [periodes, promotion],
  );
  const eleves = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId),
    [students, promotion],
  );
  // Examen blanc / Examen final : leurs notes viennent de la rubrique Examens.
  const depuisExamens = useMemo(
    () => evaluationsDepuisExamens(promotionId ?? '', categories, examens.examens, examens.tours, examens.epreuves, examens.notes),
    [promotionId, categories, examens.examens, examens.tours, examens.epreuves, examens.notes],
  );

  const [periodeId, setPeriodeId] = useState<string | null>(null);
  const periode = periodesPromo.find(p => p.id === periodeId) ?? periodesPromo[0] ?? null;

  // Une matière est ouverte d'emblée : on arrive directement sur une grille.
  const [vue, setVue] = useState<Vue | null>(null);
  const vueEffective: Vue | null =
    vue?.kind === 'recap' ? vue
    : vue?.kind === 'matiere' && matieres.some(m => m.id === vue.id) ? vue
    : matieres[0] ? { kind: 'matiere', id: matieres[0].id } : null;
  const matiere = vueEffective?.kind === 'matiere' ? matieres.find(m => m.id === vueEffective.id) ?? null : null;

  const evaluationsPeriode = useMemo(
    () => evaluations.filter(e => e.promotionId === promotionId && periode && e.periodeId === periode.id),
    [evaluations, promotionId, periode],
  );
  // Un point par matière : vert si au moins une note est saisie sur la période.
  const matieresNotees = useMemo(() => {
    const idsEvals = new Map(evaluationsPeriode.map(e => [e.id, e.niveauMatiereId]));
    const set = new Set<string>();
    for (const n of notes) { const m = idsEvals.get(n.evaluationId); if (m) set.add(m); }
    return set;
  }, [evaluationsPeriode, notes]);

  // ── Périodes : créer, modifier, supprimer ────────────────────────────────
  const [dialogPeriode, setDialogPeriode] = useState<'create' | 'edit' | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const supprimerPeriode = async () => {
    if (!periode) return;
    try {
      await deletePeriode(periode.id);
      toast({ title: `« ${periode.name} » supprimée` });
      setPeriodeId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmerSuppression(false);
    }
  };

  if (loading || examens.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!promotion) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/evaluations" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Évaluations</Link>
        <p className="text-destructive text-sm">Promotion introuvable.</p>
      </div>
    );
  }

  const choisirVue = (valeur: string) => setVue(valeur === '__recap' ? { kind: 'recap' } : { kind: 'matiere', id: valeur });
  const { etat } = sauvegarde;

  return (
    <div className="h-full flex flex-col">
      {/* ── En-tête ── */}
      <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between flex-shrink-0 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate('/formation/evaluations')} aria-label="Retour aux promotions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
              <button onClick={() => navigate('/formation/evaluations')} className="hover:text-foreground transition-colors">Évaluations</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{formation?.name} · {niveau?.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground truncate">{promotion.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" />{eleves.length} élève{eleves.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <span className="text-sm text-muted-foreground min-w-[110px] text-right pt-2">
          {etat === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
          {etat === 'saved' && <span className="flex items-center gap-1 justify-end text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
          {etat === 'error' && <span className="flex items-center gap-1 justify-end text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
        </span>
      </div>

      {/* ── Périodes ── */}
      {periodesPromo.length > 0 && periode && (
        <div className="px-4 md:px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {periodesPromo.map(per => (
              <button
                key={per.id}
                onClick={() => setPeriodeId(per.id)}
                className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-all ${
                  per.id === periode.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'
                }`}
              >
                {per.name}
              </button>
            ))}
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Nouvelle période" onClick={() => setDialogPeriode('create')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {periode.startDate || periode.endDate ? `${dateFr(periode.startDate) ?? '…'} → ${dateFr(periode.endDate) ?? '…'}` : 'Dates non définies'}
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier la période" onClick={() => setDialogPeriode('edit')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Supprimer la période" onClick={() => setConfirmerSuppression(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {!periode ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="border-dashed max-w-md w-full">
            <CardContent className="py-12 text-center">
              <CalendarRange className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground mb-1">Aucune période</h3>
              <p className="text-sm text-muted-foreground mb-5">Découpez l'année de cette promotion (semestres, trimestres…) pour commencer à noter.</p>
              <Button className="gap-2" onClick={() => setDialogPeriode('create')}><Plus className="h-4 w-4" />Créer une période</Button>
            </CardContent>
          </Card>
        </div>
      ) : categories.length === 0 ? (
        <div className="m-4 md:m-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Aucune formule d'évaluation définie pour « {formation?.name} ». Le directeur doit d'abord définir les catégories
          (contrôle continu, TP, examen…) sur la{' '}
          <Link to={`/formation/formations/${formation?.id}`} className="text-primary hover:underline">page de la formation</Link>.
        </div>
      ) : matieres.length === 0 ? (
        <div className="m-4 md:m-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Aucune matière au programme de « {niveau?.name} ».{' '}
          <Link to={`/formation/formations/${formation?.id}/niveaux/${niveau?.id}`} className="text-primary hover:underline">Gérer le programme</Link>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* ── Colonne de gauche : récapitulatif + matières (écran large) ── */}
          <div className="hidden md:flex w-56 border-r flex-shrink-0 flex-col bg-muted/10 overflow-hidden">
            <div className="p-2 border-b">
              <button
                onClick={() => setVue({ kind: 'recap' })}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
                  vueEffective?.kind === 'recap' ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-foreground'
                }`}
              >
                <Trophy className="h-4 w-4 flex-shrink-0" />Récapitulatif
              </button>
            </div>
            <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matières</p>
            <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-0.5">
              {matieres.map(m => {
                const actif = matiere?.id === m.id;
                const notee = matieresNotees.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setVue({ kind: 'matiere', id: m.id })}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-sm ${
                      actif ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      notee ? (actif ? 'bg-primary-foreground' : 'bg-green-500') : (actif ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30')
                    }`} />
                    <span className="truncate flex-1">{m.matiereName}</span>
                    <span className={`text-xs flex-shrink-0 ${actif ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>×{m.coefficient}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Contenu ── */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Choix de la matière sur téléphone */}
            <div className="md:hidden">
              <Select value={vueEffective?.kind === 'recap' ? '__recap' : matiere?.id} onValueChange={choisirVue}>
                <SelectTrigger aria-label="Matière"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__recap">Récapitulatif</SelectItem>
                  {matieres.map(m => <SelectItem key={m.id} value={m.id}>{m.matiereName} (×{m.coefficient})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {eleves.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-14">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Aucun élève dans cette promotion</p>
                  <Button variant="link" onClick={() => navigate('/inscription')}>Inscrire des élèves</Button>
                </CardContent>
              </Card>
            ) : vueEffective?.kind === 'recap' ? (
              <>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Récapitulatif — {periode.name}</h2>
                  <p className="text-sm text-muted-foreground">Moyennes par matière, moyenne générale et rang.</p>
                </div>
                <RecapitulatifPeriode
                  promotionId={promotion.id} periode={periode} matieres={matieres} categories={categories} depuisExamens={depuisExamens} eleves={eleves}
                  onChoisirMatiere={id => setVue({ kind: 'matiere', id })}
                />
              </>
            ) : matiere ? (
              <>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
                    <BookOpen className="h-5 w-5 text-primary" />{matiere.matiereName}
                    <span className="text-sm font-normal text-muted-foreground">coefficient {matiere.coefficient} · {periode.name}</span>
                  </h2>
                  {/* La formule en un coup d'œil : ce qu'on saisit ici, et ce qui vient des examens. */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-muted-foreground mr-0.5">Moyenne =</span>
                    {categories.map(c => (
                      <span
                        key={c.id}
                        className={`rounded-full px-2.5 py-0.5 ${c.sourceExamen ? 'border border-dashed text-muted-foreground' : 'bg-primary/10 text-primary font-medium'}`}
                        title={c.sourceExamen ? `Notes reprises des ${LIBELLES_TYPE_EXAMEN[c.sourceExamen].toLowerCase()}s de la rubrique Examens` : 'Saisi dans ce tableau'}
                      >
                        {c.name} {c.pourcentage} %
                      </span>
                    ))}
                    {categories.some(c => c.sourceExamen) && (
                      <Link to={`/formation/examens/${promotion.id}`} className="text-primary hover:underline ml-1">Saisir les examens →</Link>
                    )}
                  </div>
                  {!baremeComplet(categories) && (
                    <p className="text-xs text-amber-600">
                      La formule d'évaluation totalise {sommeBareme(categories)} % au lieu de 100 % — à corriger par le directeur sur la{' '}
                      <Link to={`/formation/formations/${formation?.id}`} className="underline">page de la formation</Link>.
                    </p>
                  )}
                </div>
                <GrilleNotesMatiere
                  promotionId={promotion.id} periode={periode} matiere={matiere} categories={categories} depuisExamens={depuisExamens}
                  eleves={eleves} sauvegarde={sauvegarde}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ClipboardList className="h-14 w-14 mb-4 opacity-30" />
                <p>Choisissez une matière</p>
              </div>
            )}
          </div>
        </div>
      )}

      <DialogPeriode
        open={dialogPeriode !== null}
        onOpenChange={o => !o && setDialogPeriode(null)}
        periode={dialogPeriode === 'edit' ? periode ?? undefined : undefined}
        nbExistantes={periodesPromo.length}
        onValider={async data => {
          if (dialogPeriode === 'edit' && periode) {
            await updatePeriode(periode.id, { name: data.name, startDate: data.startDate ?? '', endDate: data.endDate ?? '' });
            toast({ title: 'Période modifiée' });
          } else {
            const per = await addPeriode(promotion.id, data);
            setPeriodeId(per.id);
            toast({ title: 'Période créée', description: data.name });
          }
        }}
      />

      <AlertDialog open={confirmerSuppression} onOpenChange={setConfirmerSuppression}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {periode?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {evaluationsPeriode.length > 0
                ? `Ses ${evaluationsPeriode.length} évaluation${evaluationsPeriode.length > 1 ? 's' : ''} et toutes les notes saisies seront supprimées. `
                : 'Aucune évaluation n\'y a encore été créée. '}
              Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void supprimerPeriode()}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EvaluationsPromotion;
