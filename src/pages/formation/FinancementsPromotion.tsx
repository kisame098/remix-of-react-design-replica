import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FileCheck, Landmark, Loader2, Plus, Search, Users } from 'lucide-react';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DialogDossier } from '@/components/financements/DialogDossier';
import { DialogActiver } from '@/components/financements/DialogActiver';
import {
  COULEUR_STATUT_DOSSIER, LIBELLES_SITUATION, LIBELLES_STATUT_DOSSIER, STATUTS_DOSSIER, type StatutDossier,
} from '@/lib/financements';

type Filtre = 'tous' | StatutDossier | 'sortis';

/**
 * Page 2 du module Financements : les apprenants financés d'une promotion,
 * l'état de leur dossier d'un coup d'œil. Un clic ouvre le dossier.
 */
const FinancementsPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const { loading, promotions, formations, niveaux } = useFormationPro();
  const fin = useFinancements();
  const { students } = useSchool();

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : undefined;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : undefined;
  const eleves = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')),
    [students, promotion],
  );
  const lignes = useMemo(() => eleves.flatMap(e => {
    const d = fin.dossierDe(e.id);
    return d ? [{ eleve: e, dossier: d, organisme: fin.organisme(d.organismeId) }] : [];
  }), [eleves, fin]);
  const nonFinances = useMemo(() => eleves.filter(e => !fin.dossierDe(e.id)), [eleves, fin]);

  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const compte = (f: Filtre) => f === 'tous' ? lignes.length
    : f === 'sortis' ? lignes.filter(l => l.dossier.situation !== 'en_formation' && l.dossier.situation !== 'terminee').length
    : lignes.filter(l => l.dossier.statut === f).length;
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter(l => {
      if (filtre === 'sortis' ? (l.dossier.situation === 'en_formation' || l.dossier.situation === 'terminee') : filtre !== 'tous' && l.dossier.statut !== filtre) return false;
      return !q || `${l.eleve.lastName} ${l.eleve.firstName} ${l.eleve.studentId} ${l.dossier.contratNumero ?? ''}`.toLowerCase().includes(q);
    });
  }, [lignes, filtre, recherche]);

  const [ouvert, setOuvert] = useState<Student | null>(null);
  const [activer, setActiver] = useState(false);

  if (loading || fin.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!promotion) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/financements" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Financements</Link>
        <p className="text-destructive text-sm">Promotion introuvable.</p>
      </div>
    );
  }

  const filtres: Filtre[] = ['tous', ...STATUTS_DOSSIER, 'sortis'];
  const libelleFiltre = (f: Filtre) => f === 'tous' ? 'Tous' : f === 'sortis' ? 'Sortis de formation' : LIBELLES_STATUT_DOSSIER[f];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate('/formation/financements')} aria-label="Retour aux promotions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
              <button onClick={() => navigate('/formation/financements')} className="hover:text-foreground transition-colors">Financements</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{formation?.name} · {niveau?.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground truncate">{promotion.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" />{eleves.length} élève{eleves.length !== 1 ? 's' : ''} · {lignes.length} financé{lignes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setActiver(true)} disabled={!fin.disponible || nonFinances.length === 0}>
          <Plus className="h-3.5 w-3.5" />Activer un financement
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {!fin.disponible ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Le module Financements n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.
          </div>
        ) : lignes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <Landmark className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Aucun apprenant financé dans cette promotion</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Activez le financement ici pour plusieurs apprenants, ou un par un à l'inscription et dans Gestion des élèves.
              </p>
              {nonFinances.length > 0 && <Button variant="link" onClick={() => setActiver(true)}>Activer un financement</Button>}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {filtres.map(f => (
                  <button key={f} onClick={() => setFiltre(f)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${filtre === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                    {libelleFiltre(f)} <span className="opacity-70">{compte(f)}</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Apprenant ou n° de contrat…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-56 h-8 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium min-w-[170px]">Apprenant</th>
                    <th className="px-3 py-2 font-medium">Organisme</th>
                    <th className="px-3 py-2 font-medium text-center">Contrat</th>
                    <th className="px-3 py-2 font-medium text-center">Engagement</th>
                    <th className="px-3 py-2 font-medium text-center">Pièces</th>
                    <th className="px-3 py-2 font-medium">Dossier</th>
                    <th className="px-3 py-2 font-medium">Situation</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Aucun dossier pour ce filtre.</td></tr>
                  ) : visibles.map(({ eleve: e, dossier: d, organisme: o }) => {
                    const exigees = o?.pieces ?? [];
                    const conformes = exigees.filter(p => d.pieces.find(x => x.pieceId === p.id)?.conforme).length;
                    return (
                      <tr key={d.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setOuvert(e)}>
                        <td className="px-3 py-2">
                          <div className="font-medium leading-tight">{e.lastName}</div>
                          <div className="text-xs text-muted-foreground">{e.firstName}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{o?.nom ?? <span className="text-destructive text-xs">Organisme supprimé</span>}</td>
                        <td className="px-3 py-2 text-center">
                          {d.contratSigne ? <FileCheck className="h-4 w-4 text-green-600 mx-auto" aria-label="Contrat signé" /> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {d.engagementSigne ? <FileCheck className="h-4 w-4 text-green-600 mx-auto" aria-label="Lettre signée" /> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-center whitespace-nowrap text-xs font-medium ${exigees.length === 0 ? 'text-muted-foreground' : conformes === exigees.length ? 'text-green-600' : 'text-amber-700'}`}>
                          {exigees.length === 0 ? '—' : `${conformes}/${exigees.length}`}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_STATUT_DOSSIER[d.statut]}`}>{LIBELLES_STATUT_DOSSIER[d.statut]}</span>
                        </td>
                        <td className={`px-3 py-2 text-xs whitespace-nowrap ${d.situation === 'en_formation' ? 'text-muted-foreground' : d.situation === 'terminee' ? 'text-green-700' : 'text-red-600 font-medium'}`}>
                          {LIBELLES_SITUATION[d.situation]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <DialogDossier eleve={ouvert} onFermer={() => setOuvert(null)} />
      <DialogActiver ouvert={activer} eleves={nonFinances} onFermer={() => setActiver(false)} />
    </div>
  );
};

export default FinancementsPromotion;
