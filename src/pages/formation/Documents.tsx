import { useMemo, useState } from 'react';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useExamens } from '@/contexts/ExamensContext';
import { useStages } from '@/contexts/StagesContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { Loader2, Search, FileText, Award, ScrollText, FileBadge, Stamp, UserRound, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { peutGererMatieres, triExamens, LIBELLES_TYPE_EXAMEN, type Examen } from '@/lib/formationPro';
import {
  type DocumentOfficiel, type TypeDocumentOfficiel, LIBELLES_DOCUMENT_OFFICIEL, numeroDocument, raisonNonEmettable,
} from '@/lib/documentsFormationPro';
import { dateDakar } from '@/lib/documentsEcole';
import { BoutonDocument } from '@/components/formation/BoutonDocument';
import { BoutonBulletins } from '@/components/formation/BoutonBulletins';
import { useDonneesDocuments, useDocumentsOfficiels } from '@/hooks/useDocumentsFormation';

const ICONES: Record<TypeDocumentOfficiel, typeof FileText> = {
  attestation_inscription: FileBadge, attestation_reussite: Award, diplome: ScrollText,
};

/**
 * La rubrique Documents : on cherche un élève, et on trouve TOUS ses
 * documents — ceux qui se fabriquent à la demande (bulletin, convocation,
 * attestation de stage) et les documents officiels numérotés (attestation
 * d'inscription, attestation de réussite, diplôme), avec leur historique.
 * Un document officiel déjà émis se RÉIMPRIME à l'identique, jamais renuméroté.
 */
const Documents = () => {
  const { accountRole, school } = useAuth();
  const estDirecteur = peutGererMatieres(accountRole);
  const fp = useFormationPro();
  const ex = useExamens();
  const st = useStages();
  const { students } = useSchool();
  const donnees = useDonneesDocuments();

  // Les élèves des promotions de formation professionnelle.
  const eleves = useMemo(() => {
    const parClasse = new Map(fp.promotions.map(p => [p.classId, p]));
    return students
      .filter(s => s.classId && parClasse.has(s.classId))
      .map(s => ({ eleve: s, promotion: parClasse.get(s.classId as string)! }))
      .sort((a, b) => a.eleve.lastName.localeCompare(b.eleve.lastName, 'fr') || a.eleve.firstName.localeCompare(b.eleve.firstName, 'fr'));
  }, [students, fp.promotions]);

  const [recherche, setRecherche] = useState('');
  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? eleves.filter(({ eleve: e, promotion: p }) => `${e.lastName} ${e.firstName} ${e.studentId} ${p.name}`.toLowerCase().includes(q)) : eleves;
  }, [eleves, recherche]);

  const [eleveId, setEleveId] = useState<string | null>(null);
  const choix = eleves.find(x => x.eleve.id === eleveId) ?? null;

  if (fp.loading || ex.loading || st.loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Choisissez un élève pour imprimer ses documents</p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* ── Élèves ── */}
        <div className={`md:w-72 md:border-r flex-shrink-0 flex flex-col bg-muted/10 ${choix ? 'hidden md:flex' : 'flex'} min-h-0`}>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Nom, matricule, promotion…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {trouves.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucun élève trouvé.</p>}
            {trouves.map(({ eleve: e, promotion: p }) => (
              <button
                key={e.id} onClick={() => setEleveId(e.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-sm ${
                  e.id === eleveId ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                }`}
              >
                <div className="font-medium truncate">{e.lastName} {e.firstName}</div>
                <div className={`text-xs truncate ${e.id === eleveId ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{p.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Documents de l'élève ── */}
        <div className={`flex-1 min-w-0 overflow-y-auto p-4 md:p-6 ${choix ? 'block' : 'hidden md:block'}`}>
          {!choix ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <UserRound className="h-14 w-14 mb-4 opacity-30" />
              <p className="font-medium">Choisissez un élève</p>
              <p className="text-sm mt-1 opacity-70">Bulletins, convocations, attestations et diplômes</p>
            </div>
          ) : (
            <DocumentsEleve
              key={choix.eleve.id} eleveId={choix.eleve.id} promotionId={choix.promotion.id}
              estDirecteur={estDirecteur} logo={school?.logo_url ?? null} donnees={donnees}
              onRetour={() => setEleveId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const DocumentsEleve = ({ eleveId, promotionId, estDirecteur, logo, donnees, onRetour }: {
  eleveId: string; promotionId: string; estDirecteur: boolean; logo: string | null;
  donnees: ReturnType<typeof useDonneesDocuments>; onRetour: () => void;
}) => {
  const fp = useFormationPro();
  const ex = useExamens();
  const st = useStages();
  const { students } = useSchool();
  const eleve = students.find(s => s.id === eleveId)!;
  const promotion = fp.promotions.find(p => p.id === promotionId)!;
  const niveau = fp.niveaux.find(n => n.id === promotion.niveauId);
  const formation = niveau ? fp.formations.find(f => f.id === niveau.formationId) : undefined;
  const { documents, loading, disponible, emettre } = useDocumentsOfficiels(eleveId);

  const periodes = donnees.periodesDe(promotionId);
  const [periodeId, setPeriodeId] = useState<string>(periodes[periodes.length - 1]?.id ?? '');

  const examensCandidat = useMemo(() => triExamens(ex.examens.filter(x =>
    ex.candidats.some(c => c.examenId === x.id && c.studentEnrollmentId === eleveId))), [ex.examens, ex.candidats, eleveId]);
  // Pour la réussite et le diplôme : les examens verrouillés, l'examen final d'abord.
  const examensClos = examensCandidat.filter(x => x.verrouille).sort((a, b) => (a.type === b.type ? 0 : a.type === 'officiel' ? -1 : 1));
  const [examenId, setExamenId] = useState<string>(examensClos[0]?.id ?? '');
  const examen: Examen | undefined = examensClos.find(x => x.id === examenId) ?? examensClos[0];
  const resultat = examen ? ex.resultats.find(r => r.examenId === examen.id && r.studentEnrollmentId === eleveId) : undefined;
  const stages = st.stages.filter(s => s.studentEnrollmentId === eleveId);

  // ── Émission d'un document officiel ─────────────────────────────────────
  const [aConfirmer, setAConfirmer] = useState<TypeDocumentOfficiel | null>(null);
  const [emission, setEmission] = useState(false);
  const [aOuvrir, setAOuvrir] = useState<DocumentOfficiel | null>(null);

  const dejaEmis = (type: TypeDocumentOfficiel) =>
    documents.find(d => d.type === type && (type === 'attestation_inscription' || d.examenId === examen?.id));

  const raison = (type: TypeDocumentOfficiel): string | null => {
    const r = raisonNonEmettable(type, { estDirecteur, typeDiplome: formation?.diplomaType, examen, resultat });
    if (r) return r;
    const deja = type !== 'attestation_inscription' ? dejaEmis(type) : undefined;
    return deja ? `Déjà émis (${numeroDocument(deja.type, deja.annee, deja.numero)}) : réimprimez-le dans l'historique.` : null;
  };

  const emettreDocument = async () => {
    if (!aConfirmer) return;
    const type = aConfirmer;
    const avecExamen = type !== 'attestation_inscription';
    const contenu = donnees.contenuOfficiel(eleveId, promotionId, avecExamen ? examen?.id : undefined);
    if (!contenu) { toast({ title: 'Erreur', description: 'Données de l\'élève introuvables.', variant: 'destructive' }); return; }
    setEmission(true);
    try {
      const doc = await emettre(type, eleveId, promotionId, avecExamen ? examen?.id ?? null : null, contenu);
      toast({ title: `${LIBELLES_DOCUMENT_OFFICIEL[type]} émis`, description: numeroDocument(doc.type, doc.annee, doc.numero) });
      setAOuvrir(doc);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEmission(false);
      setAConfirmer(null);
    }
  };

  const nom = `${eleve.lastName}_${eleve.firstName}`;
  const pdf = () => import('@/lib/documentsFormationProPdf');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="link" className="md:hidden px-0 h-auto mb-1" onClick={onRetour}>← Élèves</Button>
          <h2 className="text-xl font-bold">{eleve.lastName} {eleve.firstName}</h2>
          <p className="text-sm text-muted-foreground">
            {eleve.studentId} · {formation?.name} — {niveau?.name} · {promotion.name}
          </p>
        </div>
      </div>

      {/* ── À la demande ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Imprimés à la demande</h3>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" />Bulletin de notes</div>
              {periodes.length === 0 ? (
                <span className="text-sm text-muted-foreground">Aucune période dans cette promotion.</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={periodeId} onValueChange={setPeriodeId}>
                    <SelectTrigger className="h-8 w-40 text-sm" aria-label="Période"><SelectValue /></SelectTrigger>
                    <SelectContent>{periodes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <BoutonBulletins
                    promotionId={promotionId} periodeId={periodeId} periodeNom={periodes.find(p => p.id === periodeId)?.name ?? ''}
                    eleveIds={[eleveId]} libelle="Bulletin" nomFichier={`Bulletin_${nom}`} className="gap-1.5"
                  />
                </div>
              )}
            </div>
            {examensCandidat.map(x => (
              <div key={x.id} className="flex items-center justify-between gap-3 flex-wrap border-t pt-3">
                <div className="text-sm"><span className="font-medium">{LIBELLES_TYPE_EXAMEN[x.type]}</span> <span className="text-muted-foreground">« {x.name} »</span></div>
                <div className="flex items-center gap-2">
                <BoutonDocument
                  titre={`Relevé de notes — ${x.name}`} nomFichier={`Releve_${nom}`} className="gap-1.5"
                  fabriquer={async () => {
                    const d = donnees.releves(x.id, [eleveId]);
                    if (!d) throw new Error('Examen introuvable');
                    return (await pdf()).genererRelevesPdf(d);
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />Relevé de notes
                </BoutonDocument>
                <BoutonDocument
                  titre={`Convocation — ${x.name}`} nomFichier={`Convocation_${nom}`} className="gap-1.5"
                  fabriquer={async () => {
                    const d = donnees.convocations(x.id, [eleveId]);
                    if (!d) throw new Error('Examen introuvable');
                    return (await pdf()).genererConvocationsPdf(d);
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />Convocation
                </BoutonDocument>
                </div>
              </div>
            ))}
            {stages.map(s => {
              const incomplet = !s.entrepriseId || !s.dateDebut || !s.dateFin;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap border-t pt-3">
                  <div className="text-sm"><span className="font-medium">Attestation de stage</span> <span className="text-muted-foreground">— {st.entreprises.find(e => e.id === s.entrepriseId)?.nom ?? 'entreprise à préciser'}</span></div>
                  <BoutonDocument
                    titre="Attestation de stage" nomFichier={`Attestation_stage_${nom}`} className="gap-1.5"
                    disabled={incomplet} title={incomplet ? 'Il faut l\'entreprise et les dates du stage.' : undefined}
                    fabriquer={async () => {
                      const d = donnees.attestationStage(s.id);
                      if (!d) throw new Error('Stage introuvable');
                      return (await pdf()).genererAttestationStagePdf(d);
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />Attestation
                  </BoutonDocument>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* ── Documents officiels numérotés ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Stamp className="h-3.5 w-3.5" />Documents officiels numérotés</h3>
        {!disponible ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Les documents officiels ne sont pas encore activés pour la base de données de l'école. Contactez l'assistance SenClass.
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              {examensClos.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Examen :</span>
                  <Select value={examen?.id ?? ''} onValueChange={setExamenId}>
                    <SelectTrigger className="h-8 w-64 text-sm" aria-label="Examen"><SelectValue /></SelectTrigger>
                    <SelectContent>{examensClos.map(x => <SelectItem key={x.id} value={x.id}>{LIBELLES_TYPE_EXAMEN[x.type]} — {x.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {(['attestation_inscription', 'attestation_reussite', 'diplome'] as TypeDocumentOfficiel[]).map((type, i) => {
                const Icone = ICONES[type];
                const pourquoi = raison(type);
                return (
                  <div key={type} className={`flex items-center justify-between gap-3 flex-wrap ${i > 0 ? 'border-t pt-3' : ''}`}>
                    <div className="text-sm">
                      <div className="flex items-center gap-2 font-medium"><Icone className="h-4 w-4 text-primary" />{LIBELLES_DOCUMENT_OFFICIEL[type]}</div>
                      {pourquoi && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{pourquoi}</p>}
                    </div>
                    <Button size="sm" className="gap-1.5" disabled={!!pourquoi || emission} onClick={() => setAConfirmer(type)}>
                      <Stamp className="h-3.5 w-3.5" />Émettre
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {disponible && (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Numéro</th>
                  <th className="px-3 py-2 font-medium">Document</th>
                  <th className="px-3 py-2 font-medium">Émis le</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Aucun document officiel émis pour cet élève.</td></tr>
                ) : documents.map(d => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{numeroDocument(d.type, d.annee, d.numero)}</td>
                    <td className="px-3 py-2">{LIBELLES_DOCUMENT_OFFICIEL[d.type]}{d.contenu.examen ? <span className="text-muted-foreground"> — {d.contenu.examen.nom}</span> : null}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dateDakar(d.emisLe)}</td>
                    <td className="px-3 py-2 text-right">
                      <BoutonDocument
                        variant="ghost" titre={`${LIBELLES_DOCUMENT_OFFICIEL[d.type]} ${numeroDocument(d.type, d.annee, d.numero)}`}
                        description="Réimpression à l'identique du document émis." nomFichier={numeroDocument(d.type, d.annee, d.numero)}
                        className="gap-1.5 h-7"
                        fabriquer={async () => (await pdf()).genererDocumentOfficielPdf(d, logo)}
                      >
                        <Printer className="h-3.5 w-3.5" />Réimprimer
                      </BoutonDocument>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={aConfirmer !== null} onOpenChange={o => !o && setAConfirmer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Émettre {aConfirmer ? LIBELLES_DOCUMENT_OFFICIEL[aConfirmer].toLowerCase() : ''} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un numéro lui est attribué définitivement et son contenu est figé : vérifiez l'identité de l'élève
              (nom, date et lieu de naissance) avant. Il pourra ensuite être réimprimé à l'identique autant de fois que nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void emettreDocument()}>Émettre</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {aOuvrir && (
        <DocumentDialog
          ouvert onFermer={() => setAOuvrir(null)}
          titre={`${LIBELLES_DOCUMENT_OFFICIEL[aOuvrir.type]} ${numeroDocument(aOuvrir.type, aOuvrir.annee, aOuvrir.numero)}`}
          nomFichier={numeroDocument(aOuvrir.type, aOuvrir.annee, aOuvrir.numero)}
          generer={async () => (await pdf()).genererDocumentOfficielPdf(aOuvrir, logo)}
        />
      )}
    </div>
  );
};

export default Documents;
