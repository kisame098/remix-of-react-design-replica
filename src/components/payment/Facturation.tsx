import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { infosEcole } from '@/lib/documentsEcole';
import {
  aujourdhuiDakar, documentDeFacture, etatFacture, finDuMois, jourEnLettres, LIBELLES_STATUT, lignesAFacturer, lignesDeRappel,
  lireFacture, numeroDeFacture, totalDesLignes,
  type EleveFacture, type FactureEnregistree, type LigneFacture, type StatutFacture, type TypeFacture,
} from '@/lib/facture';
import type { FactureDoc } from '@/lib/facturePdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { BellRing, ClipboardList, FileText, Loader2, Printer, School, Search, User, Users } from 'lucide-react';
import FichesPaiement from '@/components/payment/FichesPaiement';

// ═══════════════════════════════════════════════════════════════════════════
// FACTURATION — factures et rappels remis aux familles.
//
// Générer : un élève, une classe ou toute l'école, avec une date limite. Une
// facture réclame tout ce qui reste dû jusqu'au mois de cette date (voir
// src/lib/facture.ts). Les élèves à jour n'en reçoivent pas. Tout sort dans
// UN seul PDF, une facture par page.
//
// Suivre : chaque facture est numérotée et enregistrée (docs/sql/factures.sql) ;
// son reste à payer est recalculé à partir des paiements. Une facture en
// retard se relance par un rappel, qui cite la facture d'origine.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Portee = 'eleve' | 'classe' | 'ecole';
type FiltreStatut = 'tous' | StatutFacture;

const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} F`;
const nomEleve = (e: Student) => `${e.lastName.toUpperCase()} ${e.firstName}`;

const COULEUR_STATUT: Record<StatutFacture, string> = {
  payee: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partielle: 'bg-amber-100 text-amber-800 border-amber-200',
  en_attente: 'bg-slate-100 text-slate-700 border-slate-200',
  en_retard: 'bg-red-100 text-red-800 border-red-200',
};

/** Les rappels partent en lots : un appel ne doit pas porter des milliers de lignes. */
const LOT = 400;

interface Brouillon { eleve: Student; lignes: LigneFacture[]; total: number; origine?: FactureEnregistree }
interface Impression { titre: string; description: string; nomFichier: string; docs: FactureDoc[] }

const Facturation = () => {
  const { students, studentsRetires, classes } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const { mois, elementsDe } = useElementsAPayer();
  const aujourdhui = aujourdhuiDakar();

  const [factures, setFactures] = useState<FactureEnregistree[]>([]);
  const [chargement, setChargement] = useState(true);
  const [impression, setImpression] = useState<Impression | null>(null);
  // Deux documents remis aux familles : la facture (ce qu'il faut payer) et la
  // fiche de paiement (le bilan de l'année).
  const [vue, setVue] = useState<'factures' | 'fiches'>('factures');

  // ── Génération ──
  const [portee, setPortee] = useState<Portee>('classe');
  const [classeId, setClasseId] = useState('');
  const [rechercheEleve, setRechercheEleve] = useState('');
  const [eleveId, setEleveId] = useState<string | null>(null);
  const [dateLimite, setDateLimite] = useState(() => finDuMois(aujourdhuiDakar()));
  const [emission, setEmission] = useState(false);

  // ── Suivi ──
  const [filtre, setFiltre] = useState<FiltreStatut>('tous');
  const [filtreClasse, setFiltreClasse] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [rappel, setRappel] = useState<{ cibles: FactureEnregistree[]; dateLimite: string } | null>(null);

  const tousLesEleves = useMemo(() => [...students, ...studentsRetires], [students, studentsRetires]);
  const eleveParId = useMemo(() => new Map(tousLesEleves.map(e => [e.id, e])), [tousLesEleves]);
  const nomClasse = useCallback((id: string | null) => (id ? classes.find(c => c.id === id)?.name : undefined), [classes]);

  const charger = useCallback(async () => {
    if (!currentYear || !school?.id) return;
    const { data, error } = await sb.from('factures').select('*')
      .eq('school_id', school.id).eq('academic_year_label', currentYear.id)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Factures indisponibles', description: error.message, variant: 'destructive' });
    setFactures(((data ?? []) as Record<string, unknown>[]).map(lireFacture));
    setChargement(false);
  }, [currentYear, school?.id]);

  useEffect(() => { void charger(); }, [charger]);

  const infosDe = useCallback((e: Student | undefined): EleveFacture => e
    ? { nom: nomEleve(e), matricule: e.studentId, classe: nomClasse(e.classId), tuteur: { nom: e.tutor1?.fullName, telephone: e.tutor1?.phone } }
    : { nom: 'Élève introuvable', matricule: '—' }, [nomClasse]);

  // ── Ce que la génération va produire ──
  const cibles = useMemo((): Student[] => {
    if (portee === 'ecole') return students;
    if (portee === 'classe') return classeId ? students.filter(s => s.classId === classeId) : [];
    return eleveId ? students.filter(s => s.id === eleveId) : [];
  }, [portee, classeId, eleveId, students]);

  const apercu = useMemo((): Brouillon[] => {
    if (!dateLimite) return [];
    return cibles
      .map(eleve => { const lignes = lignesAFacturer(elementsDe(eleve), mois, dateLimite); return { eleve, lignes, total: totalDesLignes(lignes) }; })
      .filter(b => b.total > 0)
      .sort((a, b) => (nomClasse(a.eleve.classId) ?? '').localeCompare(nomClasse(b.eleve.classId) ?? '') || nomEleve(a.eleve).localeCompare(nomEleve(b.eleve)));
  }, [cibles, dateLimite, elementsDe, mois, nomClasse]);
  const totalApercu = apercu.reduce((s, b) => s + b.total, 0);

  const elevesTrouves = useMemo(() => {
    const q = rechercheEleve.trim().toLowerCase();
    if (q.length < 2) return [];
    return students.filter(s => `${s.firstName} ${s.lastName} ${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q)).slice(0, 8);
  }, [rechercheEleve, students]);

  /** Enregistre (numérote) puis ouvre l'impression — un seul PDF pour tout le lot. */
  const emettre = async (type: TypeFacture, brouillons: Brouillon[], limite: string) => {
    if (!currentYear || brouillons.length === 0) return;
    setEmission(true);
    try {
      const creees: FactureEnregistree[] = [];
      for (let i = 0; i < brouillons.length; i += LOT) {
        const lot = brouillons.slice(i, i + LOT);
        const { data, error } = await sb.rpc('emettre_factures', {
          p_annee: currentYear.id, p_type: type, p_date_limite: limite,
          p_factures: lot.map(b => ({ enrollment_id: b.eleve.id, lignes: b.lignes, total: b.total, facture_origine_id: b.origine?.id ?? null })),
        });
        if (error) throw error;
        creees.push(...((data ?? []) as Record<string, unknown>[]).map(lireFacture));
      }
      const origines = new Map(brouillons.filter(b => b.origine).map(b => [b.eleve.id, b.origine!]));
      const docs = creees.map(f => documentDeFacture(f, infosDe(eleveParId.get(f.studentEnrollmentId)), origines.get(f.studentEnrollmentId)));
      const premier = docs[0];
      setImpression({
        titre: docs.length === 1 ? `${type === 'rappel' ? 'Rappel' : 'Facture'} ${premier.numero}` : `${docs.length} ${type === 'rappel' ? 'rappels' : 'factures'}`,
        description: `${docs.length > 1 ? 'Enregistrés et numérotés' : 'Enregistrée et numérotée'} : imprimez et remettez aux familles. Date limite : ${jourEnLettres(limite)}.`,
        nomFichier: docs.length === 1 ? `${type === 'rappel' ? 'Rappel' : 'Facture'}_${premier.numero}_${premier.eleve.nom}` : `${type === 'rappel' ? 'Rappels' : 'Factures'}_${limite}`,
        docs,
      });
      await charger();
    } catch (err) {
      toast({ title: 'Émission impossible', description: (err as Error).message ?? String(err), variant: 'destructive' });
    } finally {
      setEmission(false);
    }
  };

  // ── Suivi des factures émises ──
  const lignesSuivi = useMemo(() => factures.map(f => {
    const eleve = eleveParId.get(f.studentEnrollmentId);
    const etat = eleve ? etatFacture(f, elementsDe(eleve), aujourdhui) : { resteActuel: f.total, statut: 'en_attente' as StatutFacture, joursDeRetard: 0 };
    return { f, eleve, etat };
  }), [factures, eleveParId, elementsDe, aujourdhui]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignesSuivi.filter(({ f, eleve, etat }) =>
      (filtre === 'tous' || etat.statut === filtre)
      && (filtreClasse === 'toutes' || eleve?.classId === filtreClasse)
      && (!q || `${eleve ? nomEleve(eleve) : ''} ${eleve?.studentId ?? ''} ${numeroDeFacture(f.type, f.academicYearLabel, f.number)}`.toLowerCase().includes(q)));
  }, [lignesSuivi, filtre, filtreClasse, recherche]);

  const compte = (s: StatutFacture) => lignesSuivi.filter(l => l.etat.statut === s).length;
  /** Factures (pas les rappels) en retard, dans le filtre de classe courant : ce que « Relancer » vise. */
  const enRetard = lignesSuivi.filter(l => l.f.type === 'facture' && l.etat.statut === 'en_retard'
    && (filtreClasse === 'toutes' || l.eleve?.classId === filtreClasse));

  const reimprimer = (f: FactureEnregistree) => {
    const origine = f.factureOrigineId ? factures.find(x => x.id === f.factureOrigineId) : undefined;
    const doc = documentDeFacture(f, infosDe(eleveParId.get(f.studentEnrollmentId)), origine, true);
    setImpression({ titre: `${f.type === 'rappel' ? 'Rappel' : 'Facture'} ${doc.numero}`, description: 'Duplicata d\'une pièce déjà remise.', nomFichier: `${doc.numero}_${doc.eleve.nom}`, docs: [doc] });
  };

  const lancerRappels = () => {
    if (!rappel) return;
    const brouillons: Brouillon[] = [];
    for (const f of rappel.cibles) {
      const eleve = eleveParId.get(f.studentEnrollmentId);
      if (!eleve) continue;
      const lignes = lignesDeRappel(f, elementsDe(eleve));
      if (lignes.length > 0) brouillons.push({ eleve, lignes, total: totalDesLignes(lignes), origine: f });
    }
    if (brouillons.length === 0) {
      toast({ title: 'Rien à relancer', description: 'Ces factures ont été réglées entre-temps.' });
      setRappel(null);
      return;
    }
    void emettre('rappel', brouillons, rappel.dateLimite).then(() => setRappel(null));
  };

  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateLimite);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex rounded-lg border p-0.5 bg-muted/30 w-fit">
          {([['factures', 'Factures et rappels', FileText], ['fiches', 'Fiches de paiement', ClipboardList]] as const).map(([id, label, Icone]) => (
            <button key={id} type="button" onClick={() => setVue(id)}
              className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-colors ${vue === id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icone className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {vue === 'fiches' ? <FichesPaiement /> : (<>
        {/* ── Générer ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Générer des factures</CardTitle>
            <p className="text-sm text-muted-foreground">
              Chaque facture réclame tout ce qui reste dû jusqu'au mois de la date limite : inscription, mois en retard,
              mois en cours, services, et le reste des paiements partiels. Les élèves à jour n'en reçoivent pas.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex rounded-lg border p-0.5 bg-muted/30 w-fit">
              {([['eleve', 'Un élève', User], ['classe', 'Une classe', Users], ['ecole', 'Toute l\'école', School]] as const).map(([id, label, Icone]) => (
                <button key={id} type="button" onClick={() => setPortee(id)}
                  className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 transition-colors ${portee === id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icone className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {portee === 'classe' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Classe</Label>
                  <Select value={classeId} onValueChange={setClasseId}>
                    <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {portee === 'eleve' && (
                <div className="space-y-1.5 relative">
                  <Label className="text-xs">Élève</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Nom ou matricule…" value={rechercheEleve}
                      onChange={e => { setRechercheEleve(e.target.value); setEleveId(null); }} />
                  </div>
                  {!eleveId && elevesTrouves.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-md">
                      {elevesTrouves.map(s => (
                        <button key={s.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => { setEleveId(s.id); setRechercheEleve(`${nomEleve(s)} — ${nomClasse(s.classId) ?? 'sans classe'}`); }}>
                          <span className="font-medium">{nomEleve(s)}</span>
                          <span className="text-muted-foreground"> · {s.studentId} · {nomClasse(s.classId) ?? 'sans classe'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Date limite de paiement</Label>
                <Input type="date" value={dateLimite} onChange={e => setDateLimite(e.target.value)} />
                {dateValide && dateLimite < aujourdhui && (
                  <p className="text-xs text-amber-700">Cette date est déjà passée.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm">
                {cibles.length === 0 ? (
                  <span className="text-muted-foreground">Choisissez {portee === 'classe' ? 'une classe' : 'un élève'}.</span>
                ) : apercu.length === 0 ? (
                  <span className="text-muted-foreground">Aucune facture à émettre : {cibles.length > 1 ? 'tous les élèves sont à jour' : 'l\'élève est à jour'} pour cette date.</span>
                ) : (
                  <>
                    <span className="font-semibold">{apercu.length} facture{apercu.length > 1 ? 's' : ''}</span>
                    {' · '}total <span className="font-semibold">{fmt(totalApercu)}</span>
                    {cibles.length > apercu.length && (
                      <span className="text-muted-foreground"> · {cibles.length - apercu.length} élève{cibles.length - apercu.length > 1 ? 's' : ''} à jour</span>
                    )}
                  </>
                )}
              </p>
              <Button className="gap-2" disabled={!dateValide || apercu.length === 0 || emission}
                onClick={() => void emettre('facture', apercu, dateLimite)}>
                {emission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Émettre et imprimer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Suivre ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Factures émises</CardTitle>
              <Button variant="outline" className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={enRetard.length === 0 || emission}
                onClick={() => setRappel({ cibles: enRetard.map(l => l.f), dateLimite: finDuMois(aujourdhui) > aujourdhui ? finDuMois(aujourdhui) : aujourdhui })}>
                <BellRing className="h-4 w-4" />
                Relancer les factures en retard{enRetard.length > 0 ? ` (${enRetard.length})` : ''}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Élève, matricule, n°…" value={recherche} onChange={e => setRecherche(e.target.value)} />
              </div>
              <div className="flex rounded-lg border p-0.5 bg-muted/30">
                {(['tous', 'en_retard', 'en_attente', 'partielle', 'payee'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setFiltre(s)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filtre === s ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                    {s === 'tous' ? 'Toutes' : LIBELLES_STATUT[s]}{s !== 'tous' && compte(s) > 0 ? ` (${compte(s)})` : ''}
                  </button>
                ))}
              </div>
              <Select value={filtreClasse} onValueChange={setFiltreClasse}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes les classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {chargement ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : visibles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {factures.length === 0 ? 'Aucune facture émise cette année.' : 'Aucune facture ne correspond à ces filtres.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Date limite</TableHead>
                    <TableHead className="text-right">Facturé</TableHead>
                    <TableHead className="text-right">Reste dû</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map(({ f, eleve, etat }) => (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-mono text-xs">{numeroDeFacture(f.type, f.academicYearLabel, f.number)}</p>
                        {f.type === 'rappel' && <p className="text-[11px] text-red-700 font-medium">Rappel</p>}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{eleve ? nomEleve(eleve) : 'Élève introuvable'}</p>
                        <p className="text-xs text-muted-foreground">{eleve?.studentId}{eleve?.classId ? ` · ${nomClasse(eleve.classId)}` : ''}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {jourEnLettres(f.dateLimite)}
                        {etat.joursDeRetard > 0 && <p className="text-xs text-red-700">{etat.joursDeRetard} j de retard</p>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">{fmt(f.total)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">{fmt(etat.resteActuel)}</TableCell>
                      <TableCell><Badge variant="outline" className={COULEUR_STATUT[etat.statut]}>{LIBELLES_STATUT[etat.statut]}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => reimprimer(f)}>
                          <Printer className="h-3.5 w-3.5" />Réimprimer
                        </Button>
                        {f.type === 'facture' && etat.statut === 'en_retard' && (
                          <Button size="sm" variant="ghost" className="gap-1.5 text-red-700 hover:text-red-800"
                            onClick={() => setRappel({ cibles: [f], dateLimite: finDuMois(aujourdhui) })}>
                            <BellRing className="h-3.5 w-3.5" />Rappel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </>)}
      </div>

      {/* ── Rappel : nouvelle date limite ── */}
      <Dialog open={!!rappel} onOpenChange={o => { if (!o && !emission) setRappel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rappel && rappel.cibles.length > 1 ? `Relancer ${rappel.cibles.length} factures` : 'Émettre un rappel'}</DialogTitle>
            <DialogDescription>
              Le rappel cite la facture d'origine et ne réclame que ce qui en reste à payer aujourd'hui.
              Les factures réglées entre-temps sont ignorées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Nouvelle date limite</Label>
            <Input type="date" value={rappel?.dateLimite ?? ''} onChange={e => rappel && setRappel({ ...rappel, dateLimite: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={emission} onClick={() => setRappel(null)}>Annuler</Button>
            <Button className="gap-2 bg-red-700 hover:bg-red-800" disabled={emission || !/^\d{4}-\d{2}-\d{2}$/.test(rappel?.dateLimite ?? '')} onClick={lancerRappels}>
              {emission ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Émettre et imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {impression && (
        <DocumentDialog
          ouvert
          onFermer={() => setImpression(null)}
          titre={impression.titre}
          description={impression.description}
          nomFichier={impression.nomFichier}
          typeDocument="facture"
          generer={async ({ economique }) => {
            const { genererFacturesPdf } = await import('@/lib/facturePdf');
            return genererFacturesPdf(infosEcole(school), impression.docs, undefined, { economique });
          }}
        />
      )}
    </div>
  );
};

export default Facturation;
