import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ExternalLink, FileSignature, FileText, Landmark, Loader2, Paperclip, RefreshCw, Trash2, UserX, X,
} from 'lucide-react';
import { useFinancements, type ModifDossier } from '@/contexts/FinancementsContext';
import { usePayment } from '@/contexts/PaymentContext';
import type { Student } from '@/contexts/SchoolContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  COULEUR_STATUT_DOSSIER, LIBELLES_SITUATION, LIBELLES_STATUT_DOSSIER, SITUATIONS, STATUTS_DOSSIER, fraisDejaPersonnalises, fraisFinance, manquesDuDossier,
  montantFinance, montantsDesTranches, situationAvecMotif,
  type Dossier, type PieceDossier, type Situation, type StatutDossier,
} from '@/lib/financements';
import { cleElement } from '@/lib/tarifsEleve';

// ═══════════════════════════════════════════════════════════════════════════
// Fiche du dossier d'un apprenant financé : ce que l'organisme prend en
// charge, le statut, le contrat, la lettre d'engagement, les pièces et la
// situation (abandon, exclusion…). Les fichiers s'enregistrent dès qu'on les
// joint ; le reste avec « Enregistrer ».
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} F`;
const nomFichier = (chemin: string) => chemin.split('/').pop()?.replace(/-[a-z0-9]{6,}(\.[a-z0-9]+)?$/, '$1') ?? chemin;

/** Un fichier joint : ouvrir, retirer, ou en joindre un. Enregistré aussitôt. */
const FichierJoint = ({ dossierId, chemin, onChange, libelle }: {
  dossierId: string; chemin?: string; onChange: (chemin: string | undefined) => Promise<void>; libelle: string;
}) => {
  const { televerser, lienFichier, supprimerFichier } = useFinancements();
  const entree = useRef<HTMLInputElement>(null);
  const [occupe, setOccupe] = useState(false);
  const erreur = (titre: string, e: unknown) => toast({ title: titre, description: (e as { message?: string })?.message ?? String(e), variant: 'destructive' });

  const joindre = async (f: File | undefined) => {
    if (!f) return;
    setOccupe(true);
    try {
      const nouveau = await televerser(dossierId, f);
      await onChange(nouveau);
      // L'ancien fichier, remplacé, ne sert plus.
      if (chemin) await supprimerFichier(chemin).catch(() => undefined);
    } catch (e) { erreur('Fichier non joint', e); } finally { setOccupe(false); }
  };
  const ouvrir = async () => {
    if (!chemin) return;
    // Fenêtre ouverte AVANT l'attente : sinon le navigateur la bloque.
    const fenetre = window.open('', '_blank');
    try {
      const lien = await lienFichier(chemin);
      if (fenetre) fenetre.location.href = lien; else window.location.assign(lien);
    } catch (e) { fenetre?.close(); erreur('Fichier introuvable', e); }
  };
  const retirer = async () => {
    if (!chemin) return;
    setOccupe(true);
    try { await onChange(undefined); await supprimerFichier(chemin).catch(() => undefined); }
    catch (e) { erreur('Fichier non retiré', e); } finally { setOccupe(false); }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <input ref={entree} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        onChange={e => { void joindre(e.target.files?.[0]); e.target.value = ''; }} />
      {chemin ? (
        <>
          <button type="button" onClick={() => void ouvrir()} className="text-xs text-primary hover:underline flex items-center gap-1 min-w-0" title={`Ouvrir ${libelle}`}>
            <FileText className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate max-w-[160px]">{nomFichier(chemin)}</span><ExternalLink className="h-3 w-3 flex-shrink-0" />
          </button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={occupe} onClick={() => void retirer()} aria-label={`Retirer le fichier : ${libelle}`}>
            {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={occupe} onClick={() => entree.current?.click()} aria-label={`Joindre un fichier : ${libelle}`}>
          {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Joindre
        </Button>
      )}
    </div>
  );
};

interface Formulaire {
  statut: StatutDossier;
  contratNumero: string; contratDate: string; contratSigne: boolean;
  engagementDate: string; engagementSigne: boolean;
  situation: Situation; situationDate: string; situationMotif: string;
  note: string;
  pieces: PieceDossier[];
}

const formulaireDe = (d: Dossier): Formulaire => ({
  statut: d.statut,
  contratNumero: d.contratNumero ?? '', contratDate: d.contratDate ?? '', contratSigne: d.contratSigne,
  engagementDate: d.engagementDate ?? '', engagementSigne: d.engagementSigne,
  situation: d.situation, situationDate: d.situationDate ?? '', situationMotif: d.situationMotif ?? '',
  note: d.note ?? '',
  pieces: d.pieces,
});

export const DialogDossier = ({ eleve, onFermer }: { eleve: Student | null; onFermer: () => void }) => {
  const fin = useFinancements();
  const { elementsDe } = useElementsAPayer();
  const dossier = eleve ? fin.dossierDe(eleve.id) : undefined;
  const organisme = dossier ? fin.organisme(dossier.organismeId) : undefined;
  const [f, setF] = useState<Formulaire | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [action, setAction] = useState<'reappliquer' | 'organisme' | null>(null);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  // Le formulaire repart du dossier à l'ouverture (pas à chaque fichier joint).
  const ouvert = dossier?.id;
  useEffect(() => { setF(dossier ? formulaireDe(dossier) : null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const elements = useMemo(() => (eleve ? elementsDe(eleve) : []), [eleve, elementsDe]);
  const montants = organisme ? montantFinance(organisme, elements) : null;
  const tranches = organisme && montants ? montantsDesTranches(organisme, montants.finance) : [];
  // Les frais qui portent déjà une réduction de CE financement.
  const { getAjustementsEleve } = usePayment();
  const propres = useMemo(() => new Set(eleve && dossier
    ? [...getAjustementsEleve(eleve.id).values()].filter(a => a.id && dossier.ajustementIds.includes(a.id)).map(a => cleElement(a))
    : []), [eleve, dossier, getAjustementsEleve]);
  // Frais concernés gardant un tarif personnalisé posé à la main : l'école doit trancher.
  const autres = organisme ? fraisDejaPersonnalises(organisme, elements, propres) : [];
  // Frais concernés encore au tarif plein (apparus depuis l'activation) : à couvrir.
  const nonCouverts = organisme ? elements.filter(e => !e.paid && !e.personnalise && fraisFinance(organisme, e)) : [];

  if (!eleve || !dossier || !f) return null;
  const manques = manquesDuDossier({ contratSigne: f.contratSigne, engagementSigne: f.engagementSigne, pieces: f.pieces }, organisme);
  const piece = (id: string) => f.pieces.find(p => p.pieceId === id) ?? { pieceId: id, fournie: false, conforme: false };
  const changerPiece = (id: string, p: Partial<PieceDossier>) => setF({
    ...f, pieces: [...f.pieces.filter(x => x.pieceId !== id), { ...piece(id), ...p }],
  });
  const erreur = (titre: string, e: unknown) => toast({ title: titre, description: (e as { message?: string })?.message ?? String(e), variant: 'destructive' });

  /** Un fichier joint s'enregistre tout de suite, sans toucher au reste du formulaire. */
  const enregistrerFichier = async (champ: 'contratFichier' | 'engagementFichier' | { piece: string }, chemin: string | undefined) => {
    if (typeof champ === 'string') {
      await fin.modifier(dossier.id, { [champ]: chemin } as ModifDossier);
      return;
    }
    const pieces = [...dossier.pieces.filter(x => x.pieceId !== champ.piece), { ...(dossier.pieces.find(x => x.pieceId === champ.piece) ?? { pieceId: champ.piece, fournie: false, conforme: false }), fichier: chemin, ...(chemin ? { fournie: true } : {}) }];
    await fin.modifier(dossier.id, { pieces });
    changerPiece(champ.piece, { fichier: chemin, ...(chemin ? { fournie: true } : {}) });
  };

  const enregistrer = async () => {
    if (situationAvecMotif(f.situation) && (!f.situationDate || !f.situationMotif.trim())) {
      toast({ title: 'Situation incomplète', description: `${LIBELLES_SITUATION[f.situation]} : indiquez la date et le motif.`, variant: 'destructive' });
      return;
    }
    setEnregistrement(true);
    try {
      // Les fichiers déjà enregistrés gardent leur chemin actuel.
      const pieces = f.pieces.map(p => ({ ...p, fichier: dossier.pieces.find(x => x.pieceId === p.pieceId)?.fichier }));
      await fin.modifier(dossier.id, {
        statut: f.statut, contratNumero: f.contratNumero, contratDate: f.contratDate, contratSigne: f.contratSigne,
        engagementDate: f.engagementDate, engagementSigne: f.engagementSigne,
        situation: f.situation, situationDate: f.situation === 'en_formation' ? '' : f.situationDate,
        situationMotif: situationAvecMotif(f.situation) ? f.situationMotif : '', note: f.note, pieces,
      });
      toast({ title: 'Dossier enregistré', description: `${eleve.lastName} ${eleve.firstName}` });
      onFermer();
    } catch (e) { erreur('Dossier non enregistré', e); } finally { setEnregistrement(false); }
  };

  const reappliquer = async () => {
    setAction('reappliquer');
    try {
      const n = await fin.reappliquer(eleve);
      toast({ title: n > 0 ? `Part de l'apprenant appliquée sur ${n} frais` : 'Rien à mettre à jour' });
    } catch (e) { erreur('Part non appliquée', e); } finally { setAction(null); }
  };
  const changerOrganisme = async (id: string) => {
    setAction('organisme');
    try { await fin.changerOrganisme(eleve, id); toast({ title: 'Organisme changé', description: fin.organisme(id)?.nom }); }
    catch (e) { erreur("Organisme non changé", e); } finally { setAction(null); }
  };
  const retirer = async () => {
    try { await fin.desactiver(eleve); toast({ title: 'Financement retiré', description: `${eleve.lastName} ${eleve.firstName} paie de nouveau le tarif normal sur ce qui reste à payer.` }); onFermer(); }
    catch (e) { erreur('Financement non retiré', e); }
  };

  return (
    <>
      <Dialog open onOpenChange={o => { if (!o) onFermer(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Landmark className="h-5 w-5 text-primary" />{eleve.lastName} {eleve.firstName}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_DOSSIER[dossier.statut]}`}>{LIBELLES_STATUT_DOSSIER[dossier.statut]}</span>
            </DialogTitle>
            <DialogDescription>Dossier de financement · matricule {eleve.studentId}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 -mx-1 px-1">
            {/* Prise en charge */}
            <section className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1.5 min-w-[180px]">
                  <Label>Organisme</Label>
                  <Select value={dossier.organismeId} onValueChange={v => void changerOrganisme(v)} disabled={action !== null || fin.reglages.organismes.length < 2}>
                    <SelectTrigger className="w-56" aria-label="Organisme"><SelectValue placeholder="Organisme supprimé" /></SelectTrigger>
                    <SelectContent>{fin.reglages.organismes.map(o => <SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={action !== null || !organisme} onClick={() => void reappliquer()}
                  title="Met à jour la part de l'apprenant sur ses frais (part modifiée, nouveaux frais…)">
                  {action === 'reappliquer' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Réappliquer la part
                </Button>
              </div>
              {!organisme ? (
                <p className="text-sm text-destructive">Cet organisme n'existe plus dans Paramètres → Financements : choisissez-en un autre.</p>
              ) : montants && (
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Frais concernés (année)</p><p className="font-semibold">{fmt(montants.base)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pris en charge ({organisme.partFinancee} %)</p><p className="font-semibold text-primary">{fmt(montants.finance)}</p>
                    <p className="text-xs text-muted-foreground">{tranches.map(t => `${t.tranche.libelle} ${fmt(t.montant)}`).join(' · ')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Part de l'apprenant</p><p className="font-semibold">{fmt(montants.partApprenant)}</p>
                    <p className="text-xs text-muted-foreground">payée à la caisse</p></div>
                </div>
              )}
              {nonCouverts.length > 0 && (
                <p className="text-xs text-amber-700 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {nonCouverts.length} frais au tarif plein (nouveaux depuis l'activation) : cliquez sur « Réappliquer la part ».</p>
              )}
              {autres.length > 0 && (
                <p className="text-xs text-amber-700 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {autres.length} frais gardent une réduction accordée à la main ({autres.slice(0, 3).map(e => e.label).join(', ')}{autres.length > 3 ? '…' : ''}) : vérifiez-la dans Paiements → Réductions.</p>
              )}
            </section>

            {/* Statut */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Statut du dossier</h3>
              <div className="flex flex-wrap gap-1.5">
                {STATUTS_DOSSIER.map(s => (
                  <button key={s} type="button" onClick={() => setF({ ...f, statut: s })}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${f.statut === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70'}`}>
                    {LIBELLES_STATUT_DOSSIER[s]}
                  </button>
                ))}
              </div>
              {manques.length === 0 ? (
                <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Contrat, lettre et pièces : tout est en ordre.</p>
              ) : (
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {manques.map(m => <li key={m} className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 flex-shrink-0" />{m}</li>)}
                </ul>
              )}
            </section>

            {/* Contrat et lettre */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileSignature className="h-4 w-4 text-primary" />Contrat et engagement</h3>
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Contrat de formation</p>
                  <FichierJoint dossierId={dossier.id} chemin={dossier.contratFichier} libelle="contrat de formation" onChange={c => enregistrerFichier('contratFichier', c)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] items-end">
                  <div className="space-y-1.5"><Label htmlFor="dos-contrat-num">Numéro</Label>
                    <Input id="dos-contrat-num" value={f.contratNumero} onChange={e => setF({ ...f, contratNumero: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="dos-contrat-date">Date</Label>
                    <Input id="dos-contrat-date" type="date" value={f.contratDate} onChange={e => setF({ ...f, contratDate: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <Checkbox checked={f.contratSigne} onCheckedChange={v => setF({ ...f, contratSigne: v === true })} />Signé
                  </label>
                </div>
              </div>
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Lettre d'engagement</p>
                  <FichierJoint dossierId={dossier.id} chemin={dossier.engagementFichier} libelle="lettre d'engagement" onChange={c => enregistrerFichier('engagementFichier', c)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_auto] items-end">
                  <div className="space-y-1.5"><Label htmlFor="dos-eng-date">Date</Label>
                    <Input id="dos-eng-date" type="date" value={f.engagementDate} onChange={e => setF({ ...f, engagementDate: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <Checkbox checked={f.engagementSigne} onCheckedChange={v => setF({ ...f, engagementSigne: v === true })} />Signée
                  </label>
                </div>
              </div>
            </section>

            {/* Pièces */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Pièces administratives</h3>
              {!organisme || organisme.pieces.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune pièce exigée. La liste se règle dans Paramètres → Financements.</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {organisme.pieces.map(p => {
                    const etat = piece(p.id);
                    const fichier = dossier.pieces.find(x => x.pieceId === p.id)?.fichier;
                    return (
                      <div key={p.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium">{p.nom}</p>
                          <FichierJoint dossierId={dossier.id} chemin={fichier} libelle={p.nom} onChange={c => enregistrerFichier({ piece: p.id }, c)} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={etat.fournie} onCheckedChange={v => changerPiece(p.id, { fournie: v === true, ...(v === true ? {} : { conforme: false }) })} />Fournie
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={etat.conforme} disabled={!etat.fournie} onCheckedChange={v => changerPiece(p.id, { conforme: v === true })} />Conforme
                          </label>
                          <Input className="h-8 text-sm flex-1 min-w-[180px]" placeholder="Remarque (pièce expirée, illisible…)" aria-label={`Remarque sur ${p.nom}`}
                            value={etat.commentaire ?? ''} onChange={e => changerPiece(p.id, { commentaire: e.target.value })} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Situation */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Situation dans la formation</h3>
              <div className="flex flex-wrap gap-1.5">
                {SITUATIONS.map(s => (
                  <button key={s} type="button" onClick={() => setF({ ...f, situation: s })}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${f.situation === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70'}`}>
                    {LIBELLES_SITUATION[s]}
                  </button>
                ))}
              </div>
              {f.situation !== 'en_formation' && (
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div className="space-y-1.5"><Label htmlFor="dos-sit-date">Date{situationAvecMotif(f.situation) ? ' *' : ''}</Label>
                    <Input id="dos-sit-date" type="date" value={f.situationDate} onChange={e => setF({ ...f, situationDate: e.target.value })} /></div>
                  {situationAvecMotif(f.situation) && (
                    <div className="space-y-1.5"><Label htmlFor="dos-sit-motif">Motif *</Label>
                      <Input id="dos-sit-motif" value={f.situationMotif} placeholder="Raison de l'abandon, de l'exclusion…" onChange={e => setF({ ...f, situationMotif: e.target.value })} /></div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-1.5">
              <Label htmlFor="dos-note">Note interne</Label>
              <Textarea id="dos-note" rows={2} value={f.note} placeholder="Ce que l'équipe doit savoir sur ce dossier…" onChange={e => setF({ ...f, note: e.target.value })} />
            </section>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t">
            <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmerRetrait(true)}>
              <UserX className="h-4 w-4" />Retirer le financement
            </Button>
            <Button onClick={() => void enregistrer()} disabled={enregistrement}>
              {enregistrement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmerRetrait} onOpenChange={setConfirmerRetrait}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le financement de {eleve.lastName} {eleve.firstName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Son dossier et ses fichiers sont supprimés, et il repaie le tarif normal sur ce qui reste à payer.
              Ce qu'il a déjà payé ne change pas. Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void retirer()}>
              <Trash2 className="h-4 w-4 mr-1.5" />Retirer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
