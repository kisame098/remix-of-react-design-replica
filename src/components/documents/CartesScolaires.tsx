import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Download, FileText, Loader2, Printer, RotateCcw, RectangleHorizontal, RectangleVertical, Save, Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { paletteDepuis, type Palette } from '@/lib/couleurLogo';
import { imprimerPdf, nomDeFichier, type InfosEcole } from '@/lib/documentsEcole';
import {
  ELEVE_EXEMPLE, FORMAT_STANDARD, LONGUEUR_MAX_TITRE, LONGUEUR_MAX_VERSO, PT_EN_MM, REGLAGES_PAR_DEFAUT, TAILLE_MAX, TAILLE_MIN,
  borner, dessinerFace, eleveCarte, estDebout, planche,
  type EleveCarte, type EleveSourceCarte, type Face, type Mesure, type ReglagesCarte, type Trace,
} from '@/lib/carteScolaire';
import type { Sortie } from '@/lib/carteScolairePdf';
import { estUneErreurDeChargement } from '@/lib/rechargementApresDeploiement';

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Cartes scolaires » de la rubrique Documents : régler la carte de
// l'école (taille, couleur, textes), la voir recto verso, et la produire pour
// les élèves choisis — PDF à la taille de la carte pour une imprimante à
// cartes, ou feuille A4 à découper.
// ═══════════════════════════════════════════════════════════════════════════

const messageErreur = (e: unknown) =>
  estUneErreurDeChargement(e)
    ? 'Une nouvelle version de SenClass a été installée : rechargez la page, puis recommencez.'
    : e instanceof Error ? e.message : String(e);

type EleveListe = EleveSourceCarte & { id: string; classId: string | null };
interface ClasseListe { id: string; name: string }

const TOUTES = '__toutes__';

const parNom = (x: EleveListe, y: EleveListe) => x.lastName.localeCompare(y.lastName, 'fr') || x.firstName.localeCompare(y.firstName, 'fr');

/** Le module PDF, chargé une fois : sa mesure du texte sert aussi à l'aperçu. */
type ModulePdf = typeof import('@/lib/carteScolairePdf');

// ─── Aperçu (SVG) ───────────────────────────────────────────────────────────

const POLICE = 'Helvetica, Arial, sans-serif';

/** Une face dessinée en SVG, à partir des mêmes tracés que le PDF. */
export const FaceCarte = ({ traces, largeur, hauteur, titre }: { traces: Trace[]; largeur: number; hauteur: number; titre: string }) => (
  <svg
    viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={titre}
    className="w-full h-auto rounded-[3.5%/5.5%] shadow-md ring-1 ring-black/10 bg-white"
    style={{ aspectRatio: `${largeur} / ${hauteur}` }}
  >
    {traces.map((t, i) => {
      if (t.type === 'rect') {
        return (
          <rect
            key={i} x={t.x} y={t.y} width={t.l} height={t.h} rx={t.arrondi} ry={t.arrondi}
            fill={t.fond ?? 'none'} stroke={t.trait ?? 'none'} strokeWidth={t.epaisseur ?? 0.2}
            strokeDasharray={t.pointille ? '0.8 0.6' : undefined}
          />
        );
      }
      if (t.type === 'courbe') return <polyline key={i} points={t.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={t.couleur} strokeWidth={t.epaisseur} />;
      if (t.type === 'ligne') return <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.couleur} strokeWidth={t.epaisseur} />;
      if (t.type === 'texte') {
        const ancre = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
        return (
          <text
            key={i} x={t.x} y={t.y} fill={t.couleur} fontFamily={POLICE} fontSize={t.taille * PT_EN_MM}
            fontWeight={t.style === 'bold' ? 700 : 400} fontStyle={t.style === 'italic' ? 'italic' : 'normal'} textAnchor={ancre}
          >
            {t.lignes.map((l, j) => <tspan key={j} x={t.x} dy={j === 0 ? 0 : t.interligne}>{l}</tspan>)}
          </text>
        );
      }
      if (t.type === 'photo') return <image key={i} href={t.src} x={t.x} y={t.y} width={t.l} height={t.h} preserveAspectRatio="xMidYMid slice" />;
      // Logo, ou monogramme aux initiales quand l'école n'en a pas.
      if (t.src) return <image key={i} href={t.src} x={t.x} y={t.y} width={t.l} height={t.h} preserveAspectRatio="xMidYMid meet" />;
      const r = Math.min(t.l, t.h) / 2;
      return (
        <g key={i}>
          <circle cx={t.x + t.l / 2} cy={t.y + t.h / 2} r={r} fill="none" stroke={t.couleur} strokeWidth={0.5} />
          <text x={t.x + t.l / 2} y={t.y + t.h / 2 + r * 0.28} fill={t.couleur} fontFamily={POLICE} fontWeight={700} fontSize={r * 1.5 * PT_EN_MM} textAnchor="middle">
            {t.initiales}
          </text>
        </g>
      );
    })}
  </svg>
);

const Apercu = ({ mesure, reglages, eleve, ecole, anneeScolaire, palette, exemple }: {
  mesure: Mesure | null; reglages: ReglagesCarte; eleve: EleveCarte; ecole: InfosEcole; anneeScolaire?: string; palette: Palette; exemple: boolean;
}) => {
  const faces = useMemo(() => {
    if (!mesure) return null;
    const d = { reglages, eleve, ecole, anneeScolaire, palette };
    return (['recto', 'verso'] as Face[]).map(f => ({ face: f, traces: dessinerFace(f, mesure, d) }));
  }, [mesure, reglages, eleve, ecole, anneeScolaire, palette]);

  if (!faces) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Préparation de l'aperçu…</p>;
  const debout = estDebout(reglages);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {exemple ? 'Exemple avec un élève fictif — cochez un élève pour voir sa carte.' : `Carte de ${eleve.nom} ${eleve.prenom}.`}
        {' '}Taille réelle : {reglages.largeur.toLocaleString('fr-FR')} × {reglages.hauteur.toLocaleString('fr-FR')} mm.
      </p>
      <div className={`grid gap-4 ${debout ? 'grid-cols-2 max-w-md' : 'sm:grid-cols-2'}`}>
        {faces.map(f => (
          <figure key={f.face} className="space-y-1">
            <FaceCarte traces={f.traces} largeur={reglages.largeur} hauteur={reglages.hauteur} titre={`${f.face === 'recto' ? 'Recto' : 'Verso'} de la carte`} />
            <figcaption className="text-xs text-center text-muted-foreground">{f.face === 'recto' ? 'Recto' : 'Verso'}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

// ─── Réglages ───────────────────────────────────────────────────────────────

const Reglages = ({ brouillon, onChange, modifiable, modifie, enregistrement, onEnregistrer, onAnnuler }: {
  brouillon: ReglagesCarte; onChange: (r: ReglagesCarte) => void; modifiable: boolean; modifie: boolean;
  enregistrement: boolean; onEnregistrer: () => void; onAnnuler: () => void;
}) => {
  const standard = (brouillon.largeur === FORMAT_STANDARD.largeur && brouillon.hauteur === FORMAT_STANDARD.hauteur)
    || (brouillon.largeur === FORMAT_STANDARD.hauteur && brouillon.hauteur === FORMAT_STANDARD.largeur);
  // Saisie libre des dimensions : bornée seulement en quittant le champ (on peut taper « 9 » avant « 90 »).
  const [largeurTexte, setLargeurTexte] = useState(String(brouillon.largeur));
  const [hauteurTexte, setHauteurTexte] = useState(String(brouillon.hauteur));
  useEffect(() => { setLargeurTexte(String(brouillon.largeur).replace('.', ',')); setHauteurTexte(String(brouillon.hauteur).replace('.', ',')); }, [brouillon.largeur, brouillon.hauteur]);

  const tourner = () => onChange({ ...brouillon, largeur: brouillon.hauteur, hauteur: brouillon.largeur });
  const formatStandard = () => onChange({ ...brouillon, ...(estDebout(brouillon) ? { largeur: FORMAT_STANDARD.hauteur, hauteur: FORMAT_STANDARD.largeur } : FORMAT_STANDARD) });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Réglages de la carte</h2>
          {!modifiable && <span className="text-xs text-muted-foreground">Seul le directeur peut les modifier.</span>}
        </div>

        <div className="space-y-1.5">
          <Label>Taille (mm)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Largeur en mm" className="w-20" inputMode="decimal" disabled={!modifiable}
              value={largeurTexte} onChange={e => setLargeurTexte(e.target.value)}
              onBlur={() => onChange({ ...brouillon, largeur: borner(largeurTexte, brouillon.largeur) })}
            />
            <span className="text-muted-foreground">×</span>
            <Input
              aria-label="Hauteur en mm" className="w-20" inputMode="decimal" disabled={!modifiable}
              value={hauteurTexte} onChange={e => setHauteurTexte(e.target.value)}
              onBlur={() => onChange({ ...brouillon, hauteur: borner(hauteurTexte, brouillon.hauteur) })}
            />
            <Button type="button" variant="outline" size="sm" onClick={tourner} disabled={!modifiable} title="Couchée (comme une carte d'identité) ou debout (comme un badge)">
              {estDebout(brouillon) ? <RectangleVertical className="h-4 w-4 mr-1.5" /> : <RectangleHorizontal className="h-4 w-4 mr-1.5" />}
              {estDebout(brouillon) ? 'Debout' : 'Couchée'}
            </Button>
            {!standard && (
              <Button type="button" variant="ghost" size="sm" onClick={formatStandard} disabled={!modifiable}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Format standard
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {standard ? 'Format standard des cartes plastiques (85,6 × 54 mm), celui des imprimantes à cartes.' : `Taille libre, entre ${TAILLE_MIN} et ${TAILLE_MAX} mm.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="carte-couleur">Couleur</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={brouillon.couleur === null ? 'secondary' : 'outline'} disabled={!modifiable}
              onClick={() => onChange({ ...brouillon, couleur: null })} aria-pressed={brouillon.couleur === null}>
              Couleur du logo
            </Button>
            <input
              id="carte-couleur" type="color" disabled={!modifiable} aria-label="Choisir une couleur"
              value={brouillon.couleur ?? '#1F3A5F'} onChange={e => onChange({ ...brouillon, couleur: e.target.value.toUpperCase() })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {brouillon.couleur && <span className="text-xs text-muted-foreground font-mono">{brouillon.couleur}</span>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Arrière-plan</Label>
          <div className="flex flex-wrap items-center gap-2">
            {([['motif', 'Motif de sécurité'], ['uni', 'Blanc uni']] as const).map(([valeur, libelle]) => (
              <Button
                key={valeur} type="button" size="sm" variant={brouillon.fond === valeur ? 'secondary' : 'outline'} disabled={!modifiable}
                onClick={() => onChange({ ...brouillon, fond: valeur })} aria-pressed={brouillon.fond === valeur}
              >
                {libelle}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Lignes ondulées et rosace très pâles, aux couleurs de l'école, comme sur les cartes officielles.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="carte-titre">Titre du recto</Label>
          <Input id="carte-titre" value={brouillon.titre} maxLength={LONGUEUR_MAX_TITRE} disabled={!modifiable}
            onChange={e => onChange({ ...brouillon, titre: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="carte-verso">Texte du verso</Label>
          <Textarea id="carte-verso" rows={3} value={brouillon.texteVerso} maxLength={LONGUEUR_MAX_VERSO} disabled={!modifiable}
            onChange={e => onChange({ ...brouillon, texteVerso: e.target.value })} />
        </div>

        {modifiable && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onEnregistrer} disabled={!modifie || enregistrement}>
              {enregistrement ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Enregistrer
            </Button>
            {modifie && <Button variant="ghost" onClick={onAnnuler} disabled={enregistrement}>Annuler</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── L'onglet ───────────────────────────────────────────────────────────────

export const CartesScolaires = ({ students, classes, ecole, anneeScolaire, estDirecteur, reglages, onEnregistrer }: {
  students: EleveListe[]; classes: ClasseListe[]; ecole: InfosEcole; anneeScolaire?: string; estDirecteur: boolean;
  /** Les réglages enregistrés de l'école. */
  reglages: ReglagesCarte;
  onEnregistrer: (r: ReglagesCarte) => Promise<void>;
}) => {
  const [brouillon, setBrouillon] = useState<ReglagesCarte>(reglages);
  const enregistres = JSON.stringify(reglages);
  useEffect(() => { setBrouillon(JSON.parse(enregistres) as ReglagesCarte); }, [enregistres]);
  // Un titre ou un texte vidé reprend celui par défaut (comme à la lecture des réglages).
  const effectifs: ReglagesCarte = useMemo(() => ({
    ...brouillon,
    titre: brouillon.titre.trim() || REGLAGES_PAR_DEFAUT.titre,
    texteVerso: brouillon.texteVerso.trim() || REGLAGES_PAR_DEFAUT.texteVerso,
  }), [brouillon]);
  const modifie = JSON.stringify(effectifs) !== enregistres;
  const [enregistrement, setEnregistrement] = useState(false);

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await onEnregistrer(effectifs);
      toast({ title: 'Réglages de la carte enregistrés' });
    } catch (e) {
      toast({ title: 'Réglages non enregistrés', description: messageErreur(e), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  // Le module PDF : sa mesure du texte fait l'aperçu.
  const [module, setModule] = useState<ModulePdf | null>(null);
  const [erreurModule, setErreurModule] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    import('@/lib/carteScolairePdf').then(m => { if (!annule) setModule(m); }, e => { if (!annule) setErreurModule(messageErreur(e)); });
    return () => { annule = true; };
  }, []);
  const mesure = useMemo(() => (module ? module.creerMesure() : null), [module]);

  // La palette : couleur choisie, sinon celle du logo (lue de façon asynchrone).
  const [palette, setPalette] = useState<Palette>(() => paletteDepuis(effectifs.couleur));
  useEffect(() => {
    let annule = false;
    if (!module) { setPalette(paletteDepuis(effectifs.couleur)); return; }
    module.paletteCarte(effectifs, ecole.logo).then(p => { if (!annule) setPalette(p); });
    return () => { annule = true; };
  }, [module, effectifs, ecole.logo]);

  // Sélection des élèves.
  const [classeId, setClasseId] = useState<string>(TOUTES);
  const [recherche, setRecherche] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const nomClasse = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return students
      .filter(s => classeId === TOUTES || s.classId === classeId)
      .filter(s => !q || `${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q))
      .sort(parNom);
  }, [students, classeId, recherche]);
  const tousCoches = visibles.length > 0 && visibles.every(s => coches.has(s.id));
  const basculerTous = () => setCoches(prev => {
    const s = new Set(prev);
    for (const e of visibles) { if (tousCoches) s.delete(e.id); else s.add(e.id); }
    return s;
  });
  const basculer = (id: string) => setCoches(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const choisis = useMemo(() => students.filter(s => coches.has(s.id)).sort(parNom), [students, coches]);
  const cartes = useMemo(() => choisis.map(s => eleveCarte(s, s.classId ? nomClasse.get(s.classId) : undefined)), [choisis, nomClasse]);
  const sansPhoto = cartes.filter(c => !c.photo);

  // L'aperçu : le premier élève coché (photo recadrée), sinon l'élève fictif.
  const [eleveApercu, setEleveApercu] = useState<EleveCarte>(ELEVE_EXEMPLE);
  useEffect(() => {
    let annule = false;
    const premier = cartes[0];
    if (!premier) { setEleveApercu(ELEVE_EXEMPLE); return; }
    if (!premier.photo || !module) { setEleveApercu(premier); return; }
    module.preparerPhoto(premier.photo).then(photo => { if (!annule) setEleveApercu({ ...premier, photo }); });
    return () => { annule = true; };
  }, [cartes, module]);

  const [sortie, setSortie] = useState<Sortie>('carte');
  const [action, setAction] = useState<'pdf' | 'imprimer' | null>(null);
  const pl = planche(effectifs);
  const parFeuille = pl.colonnes * pl.rangees;

  const produire = async (quoi: 'pdf' | 'imprimer') => {
    if (cartes.length === 0) return;
    setAction(quoi);
    try {
      const m = module ?? await import('@/lib/carteScolairePdf');
      const eleves = await m.preparerEleves(cartes);
      const doc = m.fabriquerCartesPdf({ reglages: effectifs, eleves, ecole, anneeScolaire, palette, sortie });
      const pour = choisis.length === 1 ? `${choisis[0].lastName} ${choisis[0].firstName}`
        : classeId !== TOUTES && choisis.every(s => s.classId === classeId) ? nomClasse.get(classeId) ?? '' : `${choisis.length} eleves`;
      const nom = nomDeFichier(`Cartes scolaires ${pour}`);
      if (quoi === 'pdf' || !imprimerPdf(doc)) {
        doc.save(`${nom}.pdf`);
        if (quoi === 'imprimer') toast({ title: 'Le PDF a été téléchargé', description: "Le navigateur a bloqué l'ouverture de l'impression : ouvrez le fichier pour l'imprimer." });
      }
    } catch (e) {
      toast({ title: quoi === 'imprimer' ? "L'impression n'a pas pu s'ouvrir" : "Le PDF n'a pas pu être fabriqué", description: messageErreur(e), variant: 'destructive' });
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3 min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Aperçu</h2>
          {erreurModule ? <p className="text-sm text-destructive">{erreurModule}</p> : (
            <Apercu
              mesure={mesure} reglages={effectifs} eleve={eleveApercu} ecole={ecole} anneeScolaire={anneeScolaire}
              palette={palette} exemple={cartes.length === 0}
            />
          )}
        </section>
        <Reglages
          brouillon={brouillon} onChange={setBrouillon} modifiable={estDirecteur} modifie={modifie}
          enregistrement={enregistrement} onEnregistrer={enregistrer} onAnnuler={() => setBrouillon(reglages)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Produire les cartes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="space-y-1">
            <Label>Impression</Label>
            <Select value={sortie} onValueChange={v => setSortie(v as Sortie)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="carte">Imprimante à cartes (une page par face)</SelectItem>
                <SelectItem value="feuille">Feuille A4 à découper ({parFeuille} cartes par feuille)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b">
              <Checkbox checked={tousCoches} onCheckedChange={basculerTous} aria-label="Tout cocher" disabled={visibles.length === 0} />
              <span className="text-sm text-muted-foreground">{visibles.length} élève{visibles.length > 1 ? 's' : ''}</span>
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, prénom ou matricule" className="pl-8" />
              </div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto divide-y">
              {visibles.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucun élève.</p>
              ) : visibles.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={coches.has(s.id)} onCheckedChange={() => basculer(s.id)} aria-label={`${s.lastName} ${s.firstName}`} />
                  <span className="flex-1 min-w-0 truncate text-sm"><span className="font-medium">{s.lastName}</span> {s.firstName}</span>
                  {!s.photoUrl?.startsWith('data:image/') && <span className="text-xs text-amber-600">sans photo</span>}
                  <span className="text-xs text-muted-foreground truncate max-w-[35%]">{s.classId ? nomClasse.get(s.classId) ?? '—' : '—'}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {sansPhoto.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              {sansPhoto.length === 1 ? '1 élève n\'a pas de photo' : `${sansPhoto.length} élèves n'ont pas de photo`} : sa carte sortira avec un cadre « PHOTO » où coller une photo d'identité.
              Pour l'imprimer directement, ajoutez la photo dans la fiche de l'élève (Gestion des élèves).
            </p>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
          {sortie === 'carte' ? <CreditCard className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
          {sortie === 'carte' ? (
            <p>
              Le PDF a une page par face, à la taille exacte de la carte : recto puis verso de chaque élève. À l'impression,
              choisissez l'imprimante à cartes, le format de la carte (CR80 pour le format standard), <b>« Taille réelle »</b> (jamais
              « Ajuster à la page ») et l'impression recto verso.
            </p>
          ) : (
            <p>
              Chaque feuille porte {parFeuille} recto, et la page suivante leurs verso. Imprimez la première page, remettez la
              feuille dans l'imprimante en la retournant sur le grand côté, imprimez la seconde ; choisissez <b>« Taille réelle »</b>.
              Découpez le long des traits gris, puis plastifiez.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => produire('imprimer')} disabled={choisis.length === 0 || action !== null}>
            {action === 'imprimer' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            Imprimer {choisis.length > 0 ? `(${choisis.length})` : ''}
          </Button>
          <Button variant="outline" onClick={() => produire('pdf')} disabled={choisis.length === 0 || action !== null}>
            {action === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Télécharger le PDF
          </Button>
          {coches.size > 0 && <Button variant="ghost" size="sm" onClick={() => setCoches(new Set())}>Tout décocher</Button>}
          {modifie && <span className="text-xs text-amber-600">Réglages non enregistrés : les cartes sortiront avec ceux affichés.</span>}
        </div>
      </section>
    </div>
  );
};
