import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useStages } from '@/contexts/StagesContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, ChevronRight, Plus, Search, Building2, FileCheck, Users } from 'lucide-react';
import {
  type Stage, type StatutStage, statutStage, LIBELLES_STATUT_STAGE, triPeriodes, matieresStage as filtrerMatieresStage,
  dureeStageJours, libelleDuree,
} from '@/lib/formationPro';
import { DialogStage } from '@/components/formation/DialogStage';
import { DialogEntreprises } from '@/components/formation/DialogEntreprises';

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateCourte = (iso?: string) => { if (!iso) return '…'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');

const COULEUR_STATUT: Record<StatutStage, string> = {
  a_planifier: 'bg-muted text-muted-foreground',
  a_venir: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  a_noter: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  note: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  abandonne: 'bg-muted text-muted-foreground line-through',
};

type Filtre = 'tous' | StatutStage | 'sans_stage';

/**
 * Page 2 du module Stages : les élèves d'une promotion et leurs stages.
 * Un stage concerne UN élève (son entreprise, ses dates) : l'écran est donc
 * un tableau d'élèves, pas une grille de notes. Un clic ouvre la fiche du
 * stage ; sa note (une seule, sur 20) remplit la matière « Stage »
 * d'Évaluations.
 */
const StagesPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const { loading, promotions, formations, niveaux, niveauMatieres, periodes } = useFormationPro();
  const st = useStages();
  const { students } = useSchool();
  const auj = aujourdhui();

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : undefined;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : undefined;
  const eleves = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')),
    [students, promotion],
  );
  const periodesPromo = useMemo(() => triPeriodes(periodes.filter(p => p.promotionId === promotionId)), [periodes, promotionId]);
  const matieresStage = useMemo(
    () => filtrerMatieresStage(niveauMatieres.filter(m => niveau && m.niveauId === niveau.id)),
    [niveauMatieres, niveau],
  );
  const stagesPromo = useMemo(
    () => st.stages.filter(s => s.promotionId === promotionId)
      .sort((a, b) => (a.dateDebut ?? '9999').localeCompare(b.dateDebut ?? '9999')),
    [st.stages, promotionId],
  );

  // Une ligne par stage ; un élève sans stage garde une ligne « Aucun stage ».
  const lignes = useMemo(() => eleves.flatMap(e => {
    const siens = stagesPromo.filter(s => s.studentEnrollmentId === e.id);
    return siens.length === 0
      ? [{ eleve: e, stage: null as Stage | null, statut: null as StatutStage | null, premier: true, nb: 1 }]
      : siens.map((s, i) => ({ eleve: e, stage: s as Stage | null, statut: statutStage(s, auj) as StatutStage | null, premier: i === 0, nb: siens.length }));
  }), [eleves, stagesPromo, auj]);

  const compte = (f: Filtre) => f === 'tous' ? lignes.length
    : f === 'sans_stage' ? lignes.filter(l => !l.stage).length
    : lignes.filter(l => l.statut === f).length;

  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter(l => {
      if (filtre === 'sans_stage' ? !!l.stage : filtre !== 'tous' && l.statut !== filtre) return false;
      if (!q) return true;
      const entreprise = l.stage?.entrepriseId ? st.entreprises.find(e => e.id === l.stage!.entrepriseId)?.nom ?? '' : '';
      return `${l.eleve.lastName} ${l.eleve.firstName} ${entreprise}`.toLowerCase().includes(q);
    });
  }, [lignes, filtre, recherche, st.entreprises]);
  // Après un filtre, le nom de l'élève s'affiche sur chacune de ses lignes.
  const regroupe = filtre === 'tous' && !recherche.trim();

  const notes = stagesPromo.filter(s => !s.abandonne && s.note != null).map(s => s.note as number);

  const [fiche, setFiche] = useState<{ stage?: Stage; eleveId?: string } | null>(null);
  const [carnet, setCarnet] = useState(false);

  if (loading || st.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!promotion) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/stages" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Stages</Link>
        <p className="text-destructive text-sm">Promotion introuvable.</p>
      </div>
    );
  }

  const filtres: Filtre[] = ['tous', 'a_planifier', 'a_venir', 'en_cours', 'a_noter', 'note', 'sans_stage'];
  const libelleFiltre = (f: Filtre) => f === 'tous' ? 'Tous' : f === 'sans_stage' ? 'Sans stage' : LIBELLES_STATUT_STAGE[f];
  const matiere = matieresStage[0];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate('/formation/stages')} aria-label="Retour aux promotions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
              <button onClick={() => navigate('/formation/stages')} className="hover:text-foreground transition-colors">Stages</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{formation?.name} · {niveau?.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground truncate">{promotion.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" />{eleves.length} élève{eleves.length !== 1 ? 's' : ''} · {stagesPromo.length} stage{stagesPromo.length !== 1 ? 's' : ''}
              {notes.length > 0 && <> · moyenne des notes {format(notes.reduce((a, b) => a + b, 0) / notes.length)}/20</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCarnet(true)}>
            <Building2 className="h-3.5 w-3.5" />Entreprises ({st.entreprises.length})
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setFiche({})} disabled={!st.disponible || eleves.length === 0}>
            <Plus className="h-3.5 w-3.5" />Nouveau stage
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {!st.disponible ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Le module Stages n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.
          </div>
        ) : eleves.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Aucun élève dans cette promotion</p>
              <Button variant="link" onClick={() => navigate('/inscription')}>Inscrire des élèves</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {matiere
                ? <>La note de chaque stage remplit « {matiere.matiereName} » (×{matiere.coefficient}) dans <Link to={`/formation/evaluations/${promotion.id}`} className="text-primary hover:underline">Évaluations</Link>, pour la période choisie dans sa fiche.</>
                : 'Le programme de ce niveau n\'a pas de matière de nature « Stage » : les notes de stage ne comptent dans aucune moyenne.'}
            </p>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {filtres.map(f => (
                  <button
                    key={f} onClick={() => setFiltre(f)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${filtre === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'}`}
                  >
                    {libelleFiltre(f)} <span className="opacity-70">{compte(f)}</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Élève ou entreprise…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-52 h-8 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium min-w-[170px]">Élève</th>
                    <th className="px-3 py-2 font-medium min-w-[180px]">Entreprise</th>
                    <th className="px-3 py-2 font-medium min-w-[150px]">Dates</th>
                    <th className="px-3 py-2 font-medium text-center">Convention</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium text-center">Note /20</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucune ligne pour ce filtre.</td></tr>
                  ) : visibles.map(({ eleve: e, stage: s, statut, premier, nb }) => {
                    const entreprise = s?.entrepriseId ? st.entreprises.find(x => x.id === s.entrepriseId) : undefined;
                    const duree = libelleDuree(dureeStageJours(s?.dateDebut, s?.dateFin));
                    return (
                      <tr key={s?.id ?? `sans-${e.id}`} className={`border-t hover:bg-muted/20 ${s ? 'cursor-pointer' : ''}`} onClick={() => s && setFiche({ stage: s })}>
                        {(!regroupe || premier) && (
                          <td rowSpan={regroupe ? nb : 1} className="px-3 py-2 align-top border-r bg-background" onClick={ev => ev.stopPropagation()}>
                            <div className="font-medium leading-tight">{e.lastName}</div>
                            <div className="text-xs text-muted-foreground">{e.firstName}</div>
                            <button className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5" onClick={() => setFiche({ eleveId: e.id })}>
                              <Plus className="h-3 w-3" />{s ? 'Autre stage' : 'Ajouter un stage'}
                            </button>
                          </td>
                        )}
                        {!s ? (
                          <td colSpan={5} className="px-3 py-2 text-muted-foreground italic">Aucun stage</td>
                        ) : (
                          <>
                            <td className="px-3 py-2">
                              <div className="font-medium">{entreprise?.nom ?? <span className="text-muted-foreground italic font-normal">Entreprise à préciser</span>}</div>
                              {(s.poste || s.tuteur) && <div className="text-xs text-muted-foreground">{[s.poste, s.tuteur && `tuteur : ${s.tuteur}`].filter(Boolean).join(' · ')}</div>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {s.dateDebut || s.dateFin ? `${dateCourte(s.dateDebut)} → ${dateCourte(s.dateFin)}` : <span className="text-muted-foreground">—</span>}
                              {duree && <div className="text-xs text-muted-foreground">{duree}</div>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {s.conventionSignee ? <FileCheck className="h-4 w-4 text-green-600 mx-auto" aria-label="Convention signée" /> : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {statut && <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_STATUT[statut]}`}>{LIBELLES_STATUT_STAGE[statut]}</span>}
                            </td>
                            <td className={`px-3 py-2 text-center font-semibold ${s.note == null ? 'text-muted-foreground' : s.note >= 10 ? 'text-green-600' : 'text-red-500'}`}>
                              {s.note == null ? '—' : format(s.note)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <DialogStage
        open={fiche !== null} onOpenChange={o => !o && setFiche(null)}
        promotionId={promotion.id} stage={fiche?.stage} eleveId={fiche?.eleveId}
        eleves={eleves} periodes={periodesPromo} matieresStage={matieresStage}
      />
      <DialogEntreprises open={carnet} onOpenChange={setCarnet} />
    </div>
  );
};

export default StagesPromotion;
