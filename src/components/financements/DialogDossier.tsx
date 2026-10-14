import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, FolderOpen, Info, Loader2, Trash2, UserX } from 'lucide-react';
import { useFinancements, type ModifDossier } from '@/contexts/FinancementsContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  COULEUR_STATUT_DOSSIER, LIBELLES_STATUT_DOSSIER, STATUTS_DOSSIER, manquesDuDossier,
  type Dossier, type PieceDossier, type StatutDossier,
} from '@/lib/financements';
import { FichierJoint } from '@/components/financements/FichierJoint';

// ═══════════════════════════════════════════════════════════════════════════
// Le dossier administratif d'un apprenant financé : son statut, le contrat,
// la lettre d'engagement et les pièces. Tant qu'il n'est pas VALIDÉ, la prise
// en charge ne s'applique pas. Les fichiers s'enregistrent dès qu'on les
// joint ; le reste avec « Enregistrer ». (Le suivi de la formation et
// l'insertion ont chacun leur fenêtre.)
// ═══════════════════════════════════════════════════════════════════════════

interface Formulaire {
  statut: StatutDossier;
  contratNumero: string; contratDate: string; contratSigne: boolean;
  engagementDate: string; engagementSigne: boolean;
  note: string;
  pieces: PieceDossier[];
}

const formulaireDe = (d: Dossier): Formulaire => ({
  statut: d.statut,
  contratNumero: d.contratNumero ?? '', contratDate: d.contratDate ?? '', contratSigne: d.contratSigne,
  engagementDate: d.engagementDate ?? '', engagementSigne: d.engagementSigne,
  note: d.note ?? '',
  pieces: d.pieces,
});

export const DialogDossier = ({ eleve, onFermer }: { eleve: Student | null; onFermer: () => void }) => {
  const fin = useFinancements();
  const dossier = eleve ? fin.dossierDe(eleve.id) : undefined;
  const organisme = dossier ? fin.organisme(dossier.organismeId) : undefined;
  const [f, setF] = useState<Formulaire | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  // Le formulaire repart du dossier à l'ouverture (pas à chaque fichier joint).
  const ouvert = dossier?.id;
  useEffect(() => { setF(dossier ? formulaireDe(dossier) : null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

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
    setEnregistrement(true);
    try {
      // Les fichiers déjà enregistrés gardent leur chemin actuel.
      const pieces = f.pieces.map(p => ({ ...p, fichier: dossier.pieces.find(x => x.pieceId === p.pieceId)?.fichier }));
      await fin.modifier(dossier.id, {
        statut: f.statut, contratNumero: f.contratNumero, contratDate: f.contratDate, contratSigne: f.contratSigne,
        engagementDate: f.engagementDate, engagementSigne: f.engagementSigne, note: f.note, pieces,
      });
      toast({
        title: 'Dossier enregistré',
        description: f.statut === 'valide' && dossier.statut !== 'valide' && organisme
          ? `Validé : ${eleve.lastName} ${eleve.firstName} ne paie plus que ${100 - organisme.partFinancee} % des frais concernés.`
          : `${eleve.lastName} ${eleve.firstName}`,
      });
      onFermer();
    } catch (e) { erreur('Dossier non enregistré', e); } finally { setEnregistrement(false); }
  };

  const retirer = async () => {
    try { await fin.desactiver(eleve); toast({ title: 'Financement retiré', description: `${eleve.lastName} ${eleve.firstName} paie de nouveau ses frais en entier.` }); onFermer(); }
    catch (e) { erreur('Financement non retiré', e); }
  };

  return (
    <>
      <Dialog open onOpenChange={o => { if (!o) onFermer(); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <FolderOpen className="h-5 w-5 text-primary" />{eleve.lastName} {eleve.firstName}
            </DialogTitle>
            <DialogDescription>Dossier {organisme?.nom ?? ''} · matricule {eleve.studentId}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 -mx-1 px-1">
            {/* Statut */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Statut du dossier</h3>
              <div className="flex flex-wrap gap-1.5">
                {STATUTS_DOSSIER.map(s => (
                  <button key={s} type="button" onClick={() => setF({ ...f, statut: s })} aria-pressed={f.statut === s}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${f.statut === s ? 'bg-primary text-primary-foreground shadow-sm' : `${COULEUR_STATUT_DOSSIER[s]} hover:opacity-80`}`}>
                    {LIBELLES_STATUT_DOSSIER[s]}
                  </button>
                ))}
              </div>
              {f.statut === 'valide' ? (
                <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />Prise en charge active{organisme ? ` : l'apprenant paie ${100 - organisme.partFinancee} % à la caisse, ${organisme.nom} le reste sur facture.` : '.'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" />Tant que le dossier n'est pas validé, la prise en charge ne s'applique pas : l'apprenant paie ses frais en entier.
                </p>
              )}
              {manques.length > 0 && (
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
                <p className="text-sm text-muted-foreground">Aucune pièce exigée. La liste se règle dans les règles de l'organisme (bouton « Modifier »).</p>
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
              Son dossier et ses fichiers sont supprimés, et il paie de nouveau ses frais en entier sur ce qui reste à payer.
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
