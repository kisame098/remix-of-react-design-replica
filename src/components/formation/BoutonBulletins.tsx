import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { FileText, Info } from 'lucide-react';
import { LIBELLES_TYPE_EXAMEN } from '@/lib/formationPro';
import { useDonneesDocuments } from '@/hooks/useDocumentsFormation';

interface Props {
  promotionId: string;
  periodeId: string;
  periodeNom: string;
  /** Un seul élève (rubrique Documents) ; absent : toute la promotion. */
  eleveIds?: string[];
  libelle: string;
  nomFichier: string;
  variant?: ButtonProps['variant'];
  className?: string;
}

const pct = (n: number) => `${(Math.round(n * 100) / 100).toString().replace('.', ',')} %`;

/**
 * « Préparer les bulletins » : avant d'imprimer, le logiciel DIT ce qui a été
 * fait dans la période et ce qui ne l'a pas été (pas de TP, pas d'examen
 * blanc…), et le poids réellement appliqué à chaque partie — celui de ce qui
 * manque est réparti sur le reste. L'école peut aussi écarter une partie faite.
 * Le bulletin sort toujours, et la formule appliquée y est imprimée.
 */
export const BoutonBulletins = ({ promotionId, periodeId, periodeNom, eleveIds, libelle, nomFichier, variant = 'outline', className }: Props) => {
  const donnees = useDonneesDocuments();
  const [preparation, setPreparation] = useState(false);
  const [ecartees, setEcartees] = useState<string[]>([]);
  const [apercu, setApercu] = useState(false);

  const formule = preparation ? donnees.formule(promotionId, periodeId, ecartees) : [];
  const retenues = formule.filter(l => l.retenue);

  const basculer = (id: string, compter: boolean) =>
    setEcartees(prev => (compter ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={() => { setEcartees([]); setPreparation(true); }}>
        <FileText className="h-3.5 w-3.5" />{libelle}
      </Button>

      <Dialog open={preparation} onOpenChange={setPreparation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Préparer les bulletins — {periodeNom}</DialogTitle>
            <DialogDescription>
              Ce qui n'a pas été fait ce semestre ne bloque rien : son poids est réparti sur le reste, et la formule appliquée est imprimée sur le bulletin.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border divide-y">
            {formule.map(l => {
              const faite = l.nbEvaluations > 0;
              return (
                <label key={l.categorie.id} className={`flex items-center gap-3 px-3 py-2.5 ${faite ? 'cursor-pointer' : 'opacity-70'}`}>
                  <Checkbox
                    checked={l.retenue} disabled={!faite}
                    onCheckedChange={v => basculer(l.categorie.id, v === true)}
                    aria-label={`Compter ${l.categorie.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {l.categorie.name} <span className="font-normal text-muted-foreground">· {l.categorie.pourcentage} % prévus</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {!faite
                        ? `Non faite ce semestre${l.categorie.sourceExamen ? ` (aucun ${LIBELLES_TYPE_EXAMEN[l.categorie.sourceExamen].toLowerCase()} rattaché à ${periodeNom})` : ''} — son poids est réparti`
                        : l.ecartee
                          ? `${l.nbEvaluations} évaluation${l.nbEvaluations > 1 ? 's' : ''}, écartée pour ce bulletin`
                          : `${l.nbEvaluations} ${l.categorie.sourceExamen ? 'épreuve' : 'évaluation'}${l.nbEvaluations > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${l.retenue ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                    {l.retenue ? pct(l.poidsApplique) : pct(l.categorie.pourcentage)}
                  </div>
                </label>
              );
            })}
          </div>

          {retenues.length === 0 ? (
            <p className="text-sm text-destructive flex items-center gap-1.5"><Info className="h-4 w-4" />Rien n'a encore été noté pour {periodeNom}.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Matière par matière, une partie sans note pour cette matière est aussi ignorée (jamais comptée 0).
            </p>
          )}

          <div className="flex justify-end">
            <Button disabled={retenues.length === 0} onClick={() => { setPreparation(false); setApercu(true); }} className="gap-1.5">
              <FileText className="h-4 w-4" />Générer {eleveIds ? 'le bulletin' : 'les bulletins'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentDialog
        ouvert={apercu} onFermer={() => setApercu(false)}
        titre={`Bulletins — ${periodeNom}`} nomFichier={nomFichier}
        generer={async () => {
          const d = donnees.bulletins(promotionId, periodeId, eleveIds, ecartees);
          if (!d) throw new Error('Données introuvables');
          const { genererBulletinsPdf } = await import('@/lib/documentsFormationProPdf');
          return genererBulletinsPdf(d);
        }}
      />
    </>
  );
};
