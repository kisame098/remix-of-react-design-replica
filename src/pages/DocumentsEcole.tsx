import { useEffect, useMemo, useState } from 'react';
import {
  Code2, Copy, Download, Eye, FilePlus2, FileText, FileType2, FileUp, Loader2, Pencil, Printer, Search, Trash2, TriangleAlert, Wand2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { ApercuHtml } from '@/components/documents/ApercuHtml';
import { EditeurModele } from '@/components/documents/EditeurModele';
import { EditeurVisuel } from '@/components/documents/EditeurVisuel';
import { ImportWord } from '@/components/documents/ImportWord';
import { useModelesDocuments } from '@/hooks/useModelesDocuments';
import { infosEcole, nomDeFichier, type EcoleSource } from '@/lib/documentsEcole';
import { contexteExemple, eleveDocument, type ContexteDocument, type Production } from '@/lib/modelesDocuments';
import { documentVierge, type DocumentVisuel } from '@/lib/documentVisuel';
import {
  LIBELLES_GENRE, produire, telechargerWordOriginal, telechargerWordRempli, type SourceModele,
} from '@/lib/modeleDocument';
import { MODELES_PAR_DEFAUT } from '@/lib/modelesDocumentsParDefaut';
import { estUneErreurDeChargement } from '@/lib/rechargementApresDeploiement';

type Onglet = 'produire' | 'modeles';

const ONGLETS: { id: Onglet; label: string; description: string; icon: typeof FileText }[] = [
  { id: 'produire', label: 'Produire', description: 'Certificats, attestations…', icon: Printer },
  { id: 'modeles', label: 'Modèles', description: 'Créer, importer, modifier', icon: FileText },
];

/** Un modèle tel que l'écran le manipule, qu'il soit fourni par SenClass ou à l'école. */
interface ModeleListe { id: string; nom: string; source: SourceModele; fourni: boolean }

type Edition =
  | { genre: 'visuel'; id: string | null; initial: { nom: string; contenu: DocumentVisuel } }
  | { genre: 'html'; id: string | null; titre: string; initial: { nom: string; html: string }; importer?: boolean }
  | { genre: 'word'; id: string | null; titre: string; initial?: { nom: string; fichier: string } };

const MODELE_HTML_VIERGE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Nouveau document</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; }
  .page { width: 210mm; min-height: 297mm; padding: 15mm; background: white; }
</style>
</head>
<body>
<div class="page">
  <h2>{NOM DE L'ÉTABLISSEMENT}</h2>
  <p>{VILLE}, le {DATE}</p>
  <p>{NOM ET PRÉNOM DE L'ÉLÈVE} — classe de {CLASSE} — année scolaire {ANNÉE SCOLAIRE}</p>
</div>
</body>
</html>
`;

const ICONES_GENRE = { visuel: FileText, html: Code2, word: FileType2 } as const;

const messageErreur = (e: unknown) =>
  estUneErreurDeChargement(e)
    ? 'Une nouvelle version de SenClass a été installée : rechargez la page, puis recommencez.'
    : e instanceof Error ? e.message : String(e);

/**
 * La rubrique Documents (écoles classiques) : produire des documents pour des
 * élèves à partir de modèles — pages créées dans l'éditeur, fichiers Word ou
 * HTML. Le directeur crée et modifie les modèles ; le personnel produit.
 */
const DocumentsEcole = () => {
  const { school, accountRole } = useAuth();
  const estDirecteur = accountRole === 'admin';
  const { students, classes } = useSchool();
  const { currentYear } = useSchoolYear();
  const ecole = useMemo(() => infosEcole(school as EcoleSource | null), [school]);
  const anneeScolaire = currentYear?.id;
  const exemple = useMemo(() => contexteExemple(ecole, anneeScolaire), [ecole, anneeScolaire]);
  const { modeles: modelesEcole, loading, disponible, creer, modifier, supprimer } = useModelesDocuments();

  const [onglet, setOnglet] = useState<Onglet>('produire');
  const [edition, setEdition] = useState<Edition | null>(null);
  const [apercuModele, setApercuModele] = useState<ModeleListe | null>(null);
  const [aSupprimer, setASupprimer] = useState<ModeleListe | null>(null);

  const tousModeles: ModeleListe[] = useMemo(() => [
    ...modelesEcole.map(m => ({ id: m.id, nom: m.nom, source: m.source, fourni: false })),
    ...MODELES_PAR_DEFAUT.map(m => ({ id: m.id, nom: m.nom, source: { genre: 'visuel' as const, contenu: m.contenu }, fourni: true })),
  ], [modelesEcole]);

  const enregistrer = async (id: string | null, nom: string, source: SourceModele) => {
    if (id) await modifier(id, nom, source);
    else await creer(nom, source);
    toast({ title: 'Modèle enregistré', description: nom });
  };

  const ouvrirEdition = (m: ModeleListe, copie = false) => {
    const id = copie ? null : m.id;
    const nom = copie ? `${m.nom} (copie)` : m.nom;
    if (m.source.genre === 'visuel') setEdition({ genre: 'visuel', id, initial: { nom, contenu: structuredClone(m.source.contenu) } });
    else if (m.source.genre === 'html') setEdition({ genre: 'html', id, titre: 'Modifier le modèle HTML', initial: { nom, html: m.source.html } });
    else setEdition({ genre: 'word', id, titre: 'Modifier le modèle Word', initial: { nom, fichier: m.source.fichier } });
  };

  const confirmerSuppression = async () => {
    if (!aSupprimer) return;
    try {
      await supprimer(aSupprimer.id);
      toast({ title: 'Modèle supprimé', description: aSupprimer.nom });
    } catch (e) {
      toast({ title: 'Suppression impossible', description: messageErreur(e), variant: 'destructive' });
    }
    setASupprimer(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Certificats, attestations et autres documents de l'école</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <nav className="md:w-56 border-b md:border-b-0 md:border-r flex-shrink-0 flex md:flex-col p-3 gap-1 bg-muted/10">
          {ONGLETS.map(o => {
            const actif = o.id === onglet;
            return (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={`flex-1 md:flex-none md:w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                  actif ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                }`}
              >
                <o.icon className={`h-4 w-4 flex-shrink-0 ${actif ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className={`text-xs truncate hidden md:block ${actif ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{o.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:p-6">
          {onglet === 'produire' && (
            <Produire
              modeles={tousModeles} students={students} classes={classes}
              ecole={ecole} anneeScolaire={anneeScolaire} estDirecteur={estDirecteur}
              onAllerAuxModeles={() => setOnglet('modeles')}
            />
          )}

          {onglet === 'modeles' && (
            <div className="space-y-6 max-w-4xl">
              {estDirecteur ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEdition({ genre: 'visuel', id: null, initial: { nom: '', contenu: documentVierge() } })} disabled={!disponible}>
                    <FilePlus2 className="h-4 w-4 mr-2" /> Créer un document
                  </Button>
                  <Button variant="outline" onClick={() => setEdition({ genre: 'word', id: null, titre: 'Importer un modèle Word' })} disabled={!disponible}>
                    <FileType2 className="h-4 w-4 mr-2" /> Importer un Word
                  </Button>
                  <Button variant="outline" onClick={() => setEdition({ genre: 'html', id: null, titre: 'Nouveau modèle HTML', initial: { nom: '', html: MODELE_HTML_VIERGE } })} disabled={!disponible}>
                    <Code2 className="h-4 w-4 mr-2" /> Écrire du HTML
                  </Button>
                  <Button variant="outline" onClick={() => setEdition({ genre: 'html', id: null, titre: 'Importer un modèle HTML', initial: { nom: '', html: '' }, importer: true })} disabled={!disponible}>
                    <FileUp className="h-4 w-4 mr-2" /> Importer du HTML
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Seul le directeur peut créer ou modifier les modèles.</p>
              )}

              {!disponible && (
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  Les modèles de l'école ne sont pas encore disponibles (mise à jour de la base en attente). Les modèles fournis par SenClass restent utilisables.
                </p>
              )}

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Modèles de l'école</h2>
                {loading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
                ) : modelesEcole.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun modèle pour l'instant.</p>
                ) : (
                  tousModeles.filter(m => !m.fourni).map(m => (
                    <CarteModele key={m.id} modele={m} onApercu={() => setApercuModele(m)}>
                      {m.source.genre === 'word' && (
                        <Button size="sm" variant="ghost" onClick={() => m.source.genre === 'word' && telechargerWordOriginal(m.source.fichier, m.nom)} title="Télécharger le Word pour le retoucher">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Word
                        </Button>
                      )}
                      {estDirecteur && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => ouvrirEdition(m)}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setASupprimer(m)} aria-label={`Supprimer ${m.nom}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </CarteModele>
                  ))
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Fournis par SenClass</h2>
                {tousModeles.filter(m => m.fourni).map(m => (
                  <CarteModele key={m.id} modele={m} onApercu={() => setApercuModele(m)}>
                    {estDirecteur && disponible && (
                      <Button size="sm" variant="outline" onClick={() => ouvrirEdition(m, true)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copier pour le modifier
                      </Button>
                    )}
                  </CarteModele>
                ))}
              </section>
            </div>
          )}
        </div>
      </div>

      {edition?.genre === 'visuel' && (
        <EditeurVisuel
          ouvert onFermer={() => setEdition(null)} initial={edition.initial} logo={ecole.logo} exemple={exemple}
          onEnregistrer={(nom, contenu) => enregistrer(edition.id, nom, { genre: 'visuel', contenu })}
        />
      )}
      {edition?.genre === 'html' && (
        <EditeurModele
          ouvert onFermer={() => setEdition(null)} titre={edition.titre} initial={edition.initial}
          importerAuDemarrage={edition.importer} exemple={exemple}
          onEnregistrer={(nom, html) => enregistrer(edition.id, nom, { genre: 'html', html })}
        />
      )}
      {edition?.genre === 'word' && (
        <ImportWord
          ouvert onFermer={() => setEdition(null)} titre={edition.titre} initial={edition.initial}
          onEnregistrer={(nom, fichier) => enregistrer(edition.id, nom, { genre: 'word', fichier })}
        />
      )}

      <Dialog open={apercuModele !== null} onOpenChange={o => { if (!o) setApercuModele(null); }}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{apercuModele?.nom}</DialogTitle>
            <DialogDescription>Rempli avec un élève d'exemple ({exemple.eleve.prenom} {exemple.eleve.nom}).</DialogDescription>
          </DialogHeader>
          {apercuModele && <ApercuModele source={apercuModele.source} exemple={exemple} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={aSupprimer !== null} onOpenChange={o => { if (!o) setASupprimer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {aSupprimer?.nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le modèle disparaît pour toute l'école.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmerSuppression} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CarteModele = ({ modele, onApercu, children }: { modele: ModeleListe; onApercu: () => void; children?: React.ReactNode }) => {
  const Icone = ICONES_GENRE[modele.source.genre];
  return (
    <Card>
      <CardContent className="p-3 flex flex-wrap items-center gap-2">
        <Icone className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium flex-1 min-w-0 truncate">{modele.nom}</span>
        {modele.fourni ? <Badge variant="secondary">SenClass</Badge> : <Badge variant="outline">{LIBELLES_GENRE[modele.source.genre]}</Badge>}
        <Button size="sm" variant="ghost" onClick={onApercu}><Eye className="h-3.5 w-3.5 mr-1.5" /> Aperçu</Button>
        {children}
      </CardContent>
    </Card>
  );
};

/** Production asynchrone (un Word se redessine) avec son état de chargement. */
const useProduction = (source: SourceModele | null, contextes: ContexteDocument[] | null) => {
  const [p, setP] = useState<Production | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    setP(null); setErreur(null);
    if (!source || !contextes) return;
    produire(source, contextes).then(r => { if (!annule) setP(r); }, e => { if (!annule) setErreur(messageErreur(e)); });
    return () => { annule = true; };
  }, [source, contextes]);
  return { p, erreur };
};

const ApercuModele = ({ source, exemple }: { source: SourceModele; exemple: ContexteDocument }) => {
  const contextes = useMemo(() => [exemple], [exemple]);
  const { p, erreur } = useProduction(source, contextes);
  if (erreur) return <p className="text-sm text-destructive">{erreur}</p>;
  if (!p) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Préparation…</p>;
  if (p.refus) return <Refus production={p} estDirecteur={false} />;
  return <ApercuHtml html={p.html} />;
};

const Refus = ({ production, estDirecteur, onAllerAuxModeles }: { production: Production; estDirecteur: boolean; onAllerAuxModeles?: () => void }) => (
  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
    <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> Ce modèle ne peut pas être utilisé.</p>
    {production.refus?.erreur && <p>{production.refus.erreur}</p>}
    {production.refus && production.refus.inconnus.length > 0 && (
      <p>Champs inconnus de SenClass : {production.refus.inconnus.map(c => `{${c}}`).join(', ')}.</p>
    )}
    {production.refus && production.refus.imagesMalPlacees.length > 0 && <p>Le logo doit être placé dans une image.</p>}
    <p className="text-xs">
      {estDirecteur ? 'Corrigez-le dans l\'onglet « Modèles ».' : 'Demandez au directeur de le corriger.'}
      {estDirecteur && onAllerAuxModeles && <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={onAllerAuxModeles}>Aller aux modèles</Button>}
    </p>
  </div>
);

// ─── Produire ───────────────────────────────────────────────────────────────

type Eleve = ReturnType<typeof useSchool>['students'][number];
type Classe = ReturnType<typeof useSchool>['classes'][number];

const TOUTES = '__toutes__';

interface Demande { source: SourceModele; contextes: ContexteDocument[]; nomFichier: string }

const Produire = ({
  modeles, students, classes, ecole, anneeScolaire, estDirecteur, onAllerAuxModeles,
}: {
  modeles: ModeleListe[]; students: Eleve[]; classes: Classe[]; ecole: ContexteDocument['ecole'];
  anneeScolaire?: string; estDirecteur: boolean; onAllerAuxModeles: () => void;
}) => {
  const [modeleId, setModeleId] = useState<string>('');
  const [classeId, setClasseId] = useState<string>(TOUTES);
  const [recherche, setRecherche] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [demande, setDemande] = useState<Demande | null>(null);

  const nomClasse = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
  const modele = modeles.find(m => m.id === modeleId) ?? modeles[0];

  const eleves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return students
      .filter(s => classeId === TOUTES || s.classId === classeId)
      .filter(s => !q || `${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));
  }, [students, classeId, recherche]);

  const tousCoches = eleves.length > 0 && eleves.every(e => coches.has(e.id));
  const basculerTous = () => setCoches(prev => {
    const s = new Set(prev);
    for (const e of eleves) { if (tousCoches) s.delete(e.id); else s.add(e.id); }
    return s;
  });
  const basculer = (id: string) => setCoches(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const choisis = students.filter(s => coches.has(s.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));

  const lancer = () => {
    if (!modele || choisis.length === 0) return;
    const date = new Date().toISOString();
    const contextes: ContexteDocument[] = choisis.map(s => ({
      ecole, anneeScolaire, date,
      eleve: eleveDocument(s, s.classId ? nomClasse.get(s.classId) : undefined),
    }));
    const pour = choisis.length === 1
      ? `${choisis[0].lastName} ${choisis[0].firstName}`
      : classeId !== TOUTES ? nomClasse.get(classeId) ?? '' : `${choisis.length} élèves`;
    setDemande({ source: modele.source, contextes, nomFichier: `${modele.nom} ${pour}` });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Modèle</Label>
          <Select value={modele?.id ?? ''} onValueChange={setModeleId}>
            <SelectTrigger><SelectValue placeholder="Choisir un modèle" /></SelectTrigger>
            <SelectContent>
              {modeles.some(m => !m.fourni) && (
                <SelectGroup>
                  <SelectLabel>Modèles de l'école</SelectLabel>
                  {modeles.filter(m => !m.fourni).map(m => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectLabel>Fournis par SenClass</SelectLabel>
                {modeles.filter(m => m.fourni).map(m => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Classe</Label>
          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUTES}>Toutes les classes</SelectItem>
              {[...classes].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
                .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <Checkbox checked={tousCoches} onCheckedChange={basculerTous} aria-label="Tout cocher" disabled={eleves.length === 0} />
            <span className="text-sm text-muted-foreground">{eleves.length} élève{eleves.length > 1 ? 's' : ''}</span>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, prénom ou matricule" className="pl-8" />
            </div>
          </div>
          <div className="max-h-[45vh] overflow-y-auto divide-y">
            {eleves.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Aucun élève.</p>
            ) : eleves.map(s => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={coches.has(s.id)} onCheckedChange={() => basculer(s.id)} aria-label={`${s.lastName} ${s.firstName}`} />
                <span className="flex-1 min-w-0 truncate text-sm"><span className="font-medium">{s.lastName}</span> {s.firstName}</span>
                <span className="text-xs text-muted-foreground">{s.classId ? nomClasse.get(s.classId) : '—'}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={lancer} disabled={!modele || choisis.length === 0}>
          <Wand2 className="h-4 w-4 mr-2" /> Produire {choisis.length > 0 ? `(${choisis.length})` : ''}
        </Button>
        {coches.size > 0 && <Button variant="ghost" size="sm" onClick={() => setCoches(new Set())}>Tout décocher</Button>}
      </div>

      <DialogProduction
        demande={demande} onFermer={() => setDemande(null)}
        estDirecteur={estDirecteur} onAllerAuxModeles={() => { setDemande(null); onAllerAuxModeles(); }}
      />
    </div>
  );
};

const DialogProduction = ({
  demande, onFermer, estDirecteur, onAllerAuxModeles,
}: {
  demande: Demande | null; onFermer: () => void; estDirecteur: boolean; onAllerAuxModeles: () => void;
}) => {
  const [action, setAction] = useState<'imprimer' | 'pdf' | 'word' | null>(null);
  const { p, erreur } = useProduction(demande?.source ?? null, demande?.contextes ?? null);

  const lancer = async (quoi: 'imprimer' | 'pdf' | 'word') => {
    if (!demande) return;
    setAction(quoi);
    try {
      if (quoi === 'word') {
        if (demande.source.genre === 'word') telechargerWordRempli(demande.source.fichier, demande.contextes, demande.nomFichier);
      } else if (p?.html) {
        const sortie = await import('@/lib/modelesDocumentsPdf');
        if (quoi === 'imprimer') await sortie.imprimerHtml(p.html);
        else await sortie.telechargerPdfHtml(p.html, nomDeFichier(demande.nomFichier));
      }
    } catch (e) {
      const titres = { imprimer: "L'impression n'a pas pu s'ouvrir", pdf: "Le PDF n'a pas pu être fabriqué", word: "Le Word n'a pas pu être fabriqué" };
      toast({ title: titres[quoi], description: messageErreur(e), variant: 'destructive' });
    } finally {
      setAction(null);
    }
  };

  const pret = p && !p.refus;

  return (
    <Dialog open={demande !== null} onOpenChange={o => { if (!o) onFermer(); }}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{demande?.nomFichier}</DialogTitle>
          <DialogDescription className="sr-only">Aperçu avant impression</DialogDescription>
        </DialogHeader>

        {erreur ? <p className="text-sm text-destructive">{erreur}</p>
          : !p ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Préparation…</p>
          : p.refus ? <Refus production={p} estDirecteur={estDirecteur} onAllerAuxModeles={onAllerAuxModeles} />
          : <ApercuHtml html={p.html} />}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFermer}>Fermer</Button>
          {pret && (
            <>
              {demande?.source.genre === 'word' && (
                <Button variant="outline" onClick={() => lancer('word')} disabled={action !== null}>
                  {action === 'word' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileType2 className="h-4 w-4 mr-2" />} Télécharger en Word
                </Button>
              )}
              <Button variant="outline" onClick={() => lancer('pdf')} disabled={action !== null}>
                {action === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Télécharger le PDF
              </Button>
              <Button onClick={() => lancer('imprimer')} disabled={action !== null}>
                {action === 'imprimer' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} Imprimer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsEcole;
