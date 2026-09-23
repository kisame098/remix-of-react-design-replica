import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useExamens } from '@/contexts/ExamensContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Loader2, Check, AlertCircle, ArrowLeft, ChevronRight, Pencil, Trash2, CalendarRange, Lock, LockOpen, Users, FileCheck2, Wand2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  triExamens, triTours, triEpreuves, epreuvesDepuisProgramme, etatCandidat, propositionJury, decisionRetenue, mentionRetenue,
  bilanExamen, analyserSaisieNoteExamen, peutGererMatieres, LIBELLES_TYPE_EXAMEN, triPeriodes, type Decision, type StatutNoteExamen,
} from '@/lib/formationPro';
import { GrilleExamen } from '@/components/formation/GrilleExamen';
import { DialogExamen } from '@/components/formation/DialogExamen';
import { DialogCandidats } from '@/components/formation/DialogCandidats';
import { useSauvegardeNotes } from '@/components/formation/useSauvegardeNotes';
import type { ResultatAFiger } from '@/contexts/ExamensContext';

const dateFr = (iso?: string) => { if (!iso) return null; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const format = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/**
 * Page 2 du module Examens : l'espace de travail d'une promotion.
 *
 *   Examen (pastilles)  →  une seule grille  (candidats × épreuves par tour
 *                                             + moyenne, décision, mention)
 *
 * Même logique que les évaluations : on voit tout l'examen d'un coup, on
 * ajoute une épreuve avec « + » dans l'en-tête de son tour, la saisie
 * s'enregistre seule. Le directeur règle les épreuves (coefficients, notes
 * éliminatoires) et verrouille l'examen une fois les décisions arrêtées.
 */
const ExamensPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const { accountRole } = useAuth();
  const estDirecteur = peutGererMatieres(accountRole);
  const { loading: chargementFp, promotions, formations, niveaux, niveauMatieres, periodes, baremeCategories } = useFormationPro();
  const ex = useExamens();
  const { students } = useSchool();

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : undefined;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : undefined;

  const examensPromo = useMemo(() => triExamens(ex.examens.filter(e => e.promotionId === promotionId)), [ex.examens, promotionId]);
  const [examenId, setExamenId] = useState<string | null>(null);
  const examen = examensPromo.find(e => e.id === examenId) ?? examensPromo[examensPromo.length - 1] ?? null;

  const elevesPromotion = useMemo(() => students.filter(s => promotion && s.classId === promotion.classId), [students, promotion]);
  const idsCandidats = useMemo(
    () => new Set(ex.candidats.filter(c => examen && c.examenId === examen.id).map(c => c.studentEnrollmentId)),
    [ex.candidats, examen],
  );
  const candidats = useMemo(() => students.filter(s => idsCandidats.has(s.id)), [students, idsCandidats]);
  const tours = useMemo(() => triTours(ex.tours.filter(t => examen && t.examenId === examen.id)), [ex.tours, examen]);
  const epreuvesExamen = useMemo(() => {
    const ids = new Set(tours.map(t => t.id));
    return triEpreuves(ex.epreuves.filter(e => ids.has(e.tourId)));
  }, [ex.epreuves, tours]);

  const matieresNiveau = useMemo(
    () => niveauMatieres.filter(m => niveau && m.niveauId === niveau.id).sort((a, b) => a.ordering - b.ordering),
    [niveauMatieres, niveau],
  );
  const periodesPromo = useMemo(() => triPeriodes(periodes.filter(p => p.promotionId === promotionId)), [periodes, promotionId]);
  const categoriesFormation = useMemo(
    () => baremeCategories.filter(c => formation && c.formationId === formation.id).sort((a, b) => a.ordering - b.ordering),
    [baremeCategories, formation],
  );
  const programme = useMemo(
    () => epreuvesDepuisProgramme(niveauMatieres.filter(m => niveau && m.niveauId === niveau.id)),
    [niveauMatieres, niveau],
  );
  const resumeProgramme = programme.map(b => `${b.tour} : ${b.epreuves.length} épreuve${b.epreuves.length > 1 ? 's' : ''}`).join(' · ');

  const sauvegarde = useSauvegardeNotes({
    enregistrer: (epreuveId, studentId, data) => ex.saisirNote(epreuveId, studentId, { valeur: data.valeur, statut: data.statut as StatutNoteExamen }),
    supprimer: ex.supprimerNote,
    analyser: analyserSaisieNoteExamen,
  });

  // Ce que la grille affiche : sert au bilan et au verrouillage.
  const decisions = useMemo(() => candidats.map(s => {
    const etat = etatCandidat(epreuvesExamen, ex.notes, s.id);
    const proposition = propositionJury(etat, examen?.seuilAdmission ?? 10);
    const resultat = ex.resultats.find(r => examen && r.examenId === examen.id && r.studentEnrollmentId === s.id);
    return { eleve: s, etat, decision: decisionRetenue(resultat, proposition), mention: mentionRetenue(resultat, proposition) };
  }), [candidats, epreuvesExamen, ex.notes, ex.resultats, examen]);
  const bilan = bilanExamen(decisions.map(d => d.decision));

  // ── Dialogues ────────────────────────────────────────────────────────────
  const [dialogExamen, setDialogExamen] = useState<'create' | 'edit' | null>(null);
  const [dialogCandidats, setDialogCandidats] = useState(false);
  const [confirmation, setConfirmation] = useState<'supprimer' | 'verrouiller' | 'deverrouiller' | null>(null);
  const [preparation, setPreparation] = useState(false);

  const preparerDepuisProgramme = async () => {
    if (!examen) return;
    setPreparation(true);
    try {
      for (const bloc of programme) {
        const tour = await ex.addTour(examen.id, bloc.tour);
        for (const ep of bloc.epreuves) await ex.addEpreuve(tour.id, { ...ep, bareme: 20 });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setPreparation(false);
    }
  };

  const demanderVerrouillage = async () => {
    await sauvegarde.envoyer();   // aucune note tapée ne doit rester en route
    const sansDecision = decisions.filter(d => !d.decision).length;
    if (sansDecision > 0) {
      toast({
        title: 'Décisions manquantes',
        description: `${sansDecision} candidat${sansDecision > 1 ? 's n\'ont' : ' n\'a'} pas encore de décision : choisissez-la dans la colonne « Décision » avant de verrouiller.`,
        variant: 'destructive',
      });
      return;
    }
    setConfirmation('verrouiller');
  };

  const executer = async () => {
    if (!examen || !confirmation) return;
    try {
      if (confirmation === 'supprimer') {
        await ex.deleteExamen(examen.id);
        setExamenId(null);
        toast({ title: `« ${examen.name} » supprimé` });
      } else if (confirmation === 'verrouiller') {
        const aFiger: ResultatAFiger[] = decisions.map(d => ({
          studentEnrollmentId: d.eleve.id, decision: d.decision as Decision, mention: d.mention,
          moyenne: d.etat.moyenne, elimine: d.etat.epreuvesEliminatoires.length > 0,
        }));
        await ex.verrouiller(examen.id, aFiger);
        toast({ title: 'Examen verrouillé', description: 'Notes et décisions sont désormais en lecture seule.' });
      } else {
        await ex.deverrouiller(examen.id);
        toast({ title: 'Examen déverrouillé' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmation(null);
    }
  };

  if (chargementFp || ex.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!promotion) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/examens" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Examens</Link>
        <p className="text-destructive text-sm">Promotion introuvable.</p>
      </div>
    );
  }

  const aDesNotes = examen ? ex.notes.some(n => epreuvesExamen.some(e => e.id === n.epreuveId)) : false;
  const peutSupprimer = examen && (estDirecteur || (!aDesNotes && !examen.verrouille));
  const { etat } = sauvegarde;

  return (
    <div className="h-full flex flex-col">
      {/* ── En-tête ── */}
      <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between flex-shrink-0 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate('/formation/examens')} aria-label="Retour aux promotions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
              <button onClick={() => navigate('/formation/examens')} className="hover:text-foreground transition-colors">Examens</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{formation?.name} · {niveau?.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground truncate">{promotion.name}</h1>
          </div>
        </div>
        <span className="text-sm text-muted-foreground min-w-[110px] text-right pt-2">
          {etat === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
          {etat === 'saved' && <span className="flex items-center gap-1 justify-end text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
          {etat === 'error' && <span className="flex items-center gap-1 justify-end text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
        </span>
      </div>

      {!ex.disponible ? (
        <div className="m-4 md:m-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Le module Examens n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.
        </div>
      ) : !examen ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="border-dashed max-w-md w-full">
            <CardContent className="py-12 text-center">
              <FileCheck2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground mb-1">Aucun examen</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Créez un examen blanc ou officiel : les élèves de la promotion deviennent ses candidats, et les épreuves peuvent reprendre le programme.
              </p>
              <Button className="gap-2" onClick={() => setDialogExamen('create')}><Plus className="h-4 w-4" />Créer un examen</Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* ── Examens : pastilles + actions de l'examen choisi ── */}
          <div className="px-4 md:px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {examensPromo.map(e => (
                <button
                  key={e.id}
                  onClick={() => setExamenId(e.id)}
                  className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                    e.id === examen.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'
                  }`}
                >
                  {e.verrouille && <Lock className="h-3 w-3" />}{e.name}
                </button>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Nouvel examen" onClick={() => setDialogExamen('create')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setDialogCandidats(true)}>
                <Users className="h-3.5 w-3.5" />Candidats ({candidats.length})
              </Button>
              {!examen.verrouille && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier l'examen" onClick={() => setDialogExamen('edit')}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {peutSupprimer && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer l'examen" onClick={() => setConfirmation('supprimer')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {estDirecteur && (examen.verrouille ? (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setConfirmation('deverrouiller')}>
                  <LockOpen className="h-3.5 w-3.5" />Déverrouiller
                </Button>
              ) : (
                <Button size="sm" className="h-8 gap-1.5" onClick={() => void demanderVerrouillage()} disabled={candidats.length === 0 || epreuvesExamen.length === 0}>
                  <Lock className="h-3.5 w-3.5" />Verrouiller les résultats
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Fiche de l'examen + bilan */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>
                  <span className="font-medium text-foreground">{LIBELLES_TYPE_EXAMEN[examen.type]}</span>
                  {examen.reference && <> · {examen.reference}</>}
                  {' '}· admis à partir de {String(examen.seuilAdmission).replace('.', ',')}/20
                </p>
                <CompteDans
                  periode={periodesPromo.find(p => p.id === examen.periodeId)}
                  categorie={categoriesFormation.find(c => c.sourceExamen === examen.type)}
                  promotionId={promotion.id}
                />
                <p className="flex items-center gap-1 text-xs">
                  <CalendarRange className="h-3 w-3" />
                  {examen.dateDebut || examen.dateFin ? `${dateFr(examen.dateDebut) ?? '…'} → ${dateFr(examen.dateFin) ?? '…'}` : 'Dates non définies'}
                </p>
              </div>
              {candidats.length > 0 && epreuvesExamen.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-2.5 py-1 font-medium">{bilan.admis} admis</span>
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 font-medium">{bilan.ajournes} ajourné{bilan.ajournes !== 1 ? 's' : ''}</span>
                  <span className="rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-2.5 py-1 font-medium">{bilan.refuses} refusé{bilan.refuses !== 1 ? 's' : ''}</span>
                  {bilan.sansDecision > 0 && <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{bilan.sansDecision} à décider</span>}
                  {bilan.tauxReussite !== null && <span className="font-semibold text-foreground">Réussite : {format(bilan.tauxReussite)} %</span>}
                </div>
              )}
            </div>

            {examen.verrouille && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                Résultats verrouillés{examen.verrouilleLe ? ` le ${new Date(examen.verrouilleLe).toLocaleDateString('fr-FR')}` : ''} : notes, moyennes et décisions sont figées.
                {estDirecteur ? ' Seul le directeur peut déverrouiller.' : ''}
              </div>
            )}

            {tours.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-4">
                  <p className="text-muted-foreground">Aucune épreuve dans cet examen.</p>
                  {estDirecteur ? (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {programme.length > 0 && (
                        <Button className="gap-2" disabled={preparation} onClick={() => void preparerDepuisProgramme()}>
                          {preparation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                          Reprendre le programme ({resumeProgramme})
                        </Button>
                      )}
                      <Button variant="outline" className="gap-2" onClick={() => void ex.addTour(examen.id, 'Écrit').catch(err => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }))}>
                        <Plus className="h-4 w-4" />Commencer par un tour vide
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Les épreuves (coefficients, notes éliminatoires) sont définies par le directeur.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <GrilleExamen
                examen={examen} tours={tours} candidats={candidats} matieres={matieresNiveau}
                sauvegarde={sauvegarde} estDirecteur={estDirecteur}
              />
            )}
          </div>
        </>
      )}

      <DialogExamen
        open={dialogExamen !== null}
        onOpenChange={o => !o && setDialogExamen(null)}
        examen={dialogExamen === 'edit' ? examen ?? undefined : undefined}
        nbExistants={examensPromo.length}
        periodes={periodesPromo}
        categories={categoriesFormation}
        resumeProgramme={dialogExamen === 'create' ? resumeProgramme : ''}
        onValider={async (data, depuisProgramme) => {
          if (dialogExamen === 'edit' && examen) {
            await ex.updateExamen(examen.id, data);
            toast({ title: 'Examen modifié' });
          } else {
            const structure = depuisProgramme
              ? programme.map(b => ({ tour: b.tour, epreuves: b.epreuves.map(e => ({ ...e, bareme: 20 })) }))
              : undefined;
            const nouveau = await ex.addExamen(promotion.id, data, elevesPromotion.map(s => s.id), structure);
            setExamenId(nouveau.id);
            toast({ title: 'Examen créé', description: `${elevesPromotion.length} candidat${elevesPromotion.length !== 1 ? 's' : ''} inscrit${elevesPromotion.length !== 1 ? 's' : ''}.` });
          }
        }}
      />

      {examen && (
        <DialogCandidats
          open={dialogCandidats} onOpenChange={setDialogCandidats}
          elevesPromotion={elevesPromotion} tousLesEleves={students} candidats={idsCandidats} verrouille={examen.verrouille}
          onAjouter={id => ex.ajouterCandidat(examen.id, id)} onRetirer={id => ex.retirerCandidat(examen.id, id)}
        />
      )}

      <AlertDialog open={confirmation !== null} onOpenChange={o => !o && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === 'supprimer' && `Supprimer « ${examen?.name} » ?`}
              {confirmation === 'verrouiller' && 'Verrouiller les résultats ?'}
              {confirmation === 'deverrouiller' && 'Déverrouiller l\'examen ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === 'supprimer' && 'Ses épreuves, toutes les notes et les décisions seront supprimées. Cette action ne peut pas être défaite.'}
              {confirmation === 'verrouiller' && `${bilan.admis} admis, ${bilan.ajournes} ajourné(s), ${bilan.refuses} refusé(s). Moyennes, décisions et mentions seront figées ; plus aucune note ne pourra être modifiée tant que vous n'aurez pas déverrouillé.`}
              {confirmation === 'deverrouiller' && 'Les notes et les décisions redeviennent modifiables. À réserver à la correction d\'une erreur.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={confirmation === 'supprimer' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => void executer()}
            >
              {confirmation === 'supprimer' ? 'Supprimer' : confirmation === 'verrouiller' ? 'Verrouiller' : 'Déverrouiller'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/** Où comptent les notes de l'examen dans les moyennes d'Évaluations — dit clairement, jamais deviné. */
const CompteDans = ({ periode, categorie, promotionId }: {
  periode?: { name: string }; categorie?: { name: string; pourcentage: number }; promotionId: string;
}) => {
  if (periode && categorie) {
    return (
      <p className="text-xs">
        Compte pour <span className="font-medium text-foreground">{categorie.name} ({categorie.pourcentage} %)</span> dans la moyenne de{' '}
        <Link to={`/formation/evaluations/${promotionId}`} className="text-primary hover:underline">{periode.name}</Link>
      </p>
    );
  }
  return <p className="text-xs text-amber-700">Ne compte dans aucune moyenne{!periode ? ' (aucune période choisie — Modifier l\'examen)' : ' (la formule n\'a pas de catégorie pour ce type d\'examen)'}</p>;
};

export default ExamensPromotion;
