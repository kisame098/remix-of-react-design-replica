import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Landmark, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancements } from '@/contexts/FinancementsContext';
import { DialogOrganisme } from '@/components/financements/Organismes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { CLE_FINANCEMENTS, type Organisme } from '@/lib/financements';

/**
 * Page 1 du module Financements : un bloc par organisme financeur (3FPT…),
 * comme les promotions. Un clic ouvre l'espace de l'organisme.
 */
const Financements = () => {
  const navigate = useNavigate();
  const { accountRole, updateSchoolSettings } = useAuth();
  const { actif, loading, disponible, dossiers, reglages } = useFinancements();
  const directeur = accountRole === 'admin';
  const [edition, setEdition] = useState<{ organisme?: Organisme } | null>(null);
  const [aSupprimer, setASupprimer] = useState<Organisme | null>(null);

  if (!actif) {
    return (
      <div className="p-6 max-w-xl">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-medium">Les financements ne sont pas activés</p>
            <p className="text-sm text-muted-foreground">Le directeur les active dans <Link to="/parametres" className="text-primary hover:underline">Paramètres → Financements</Link>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supprimer = async (o: Organisme) => {
    try {
      await updateSchoolSettings({ [CLE_FINANCEMENTS]: { actif: true, organismes: reglages.organismes.filter(x => x.id !== o.id) } });
      toast({ title: 'Organisme supprimé', description: o.nom });
    } catch (e) {
      toast({ title: 'Suppression impossible', description: (e as { message?: string })?.message, variant: 'destructive' });
    } finally {
      setASupprimer(null);
    }
  };
  const demanderSuppression = (o: Organisme) => {
    const n = dossiers.filter(d => d.organismeId === o.id).length;
    if (n > 0) {
      toast({ title: 'Suppression impossible', description: `${o.nom} prend encore en charge ${n} apprenant${n > 1 ? 's' : ''} : retirez d'abord leur financement.`, variant: 'destructive' });
      return;
    }
    setASupprimer(o);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Financements
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Les organismes qui prennent en charge la formation de vos apprenants (3FPT…). Ouvrez-en un pour suivre ses
            apprenants, ses factures et ses rapports.
          </p>
        </div>
        {directeur && (
          <Button size="sm" className="gap-2" onClick={() => setEdition({})}>
            <Plus className="h-3.5 w-3.5" />Nouvel organisme
          </Button>
        )}
      </div>

      {!disponible ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Le module Financements n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement…
        </div>
      ) : reglages.organismes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Landmark className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucun organisme financeur</h3>
            <p className="text-muted-foreground mb-6">Créez le premier (3FPT, ONFP, une entreprise…) pour y rattacher des apprenants.</p>
            {directeur && <Button onClick={() => setEdition({})} className="gap-2"><Plus className="h-4 w-4" />Nouvel organisme</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reglages.organismes.map(o => {
            const siens = dossiers.filter(d => d.organismeId === o.id);
            const aTraiter = siens.filter(d => d.statut !== 'valide').length;
            return (
              <Card
                key={o.id} role="link" tabIndex={0}
                className="group h-full flex flex-col cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                onClick={() => navigate(`/formation/financements/${o.id}`)}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/formation/financements/${o.id}`); }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{o.nom}</CardTitle>
                      <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                        {o.partFinancee} % pris en charge
                      </span>
                    </div>
                    {directeur && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => setEdition({ organisme: o })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer" onClick={() => demanderSuppression(o)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end gap-2">
                  {aTraiter > 0 && (
                    <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{aTraiter} dossier{aTraiter > 1 ? 's' : ''} à valider</p>
                  )}
                  <Badge variant="outline" className="w-fit gap-1"><Users className="h-3 w-3" />{siens.length} apprenant{siens.length > 1 ? 's' : ''}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DialogOrganisme
        open={edition !== null} organisme={edition?.organisme}
        onOpenChange={v => { if (!v) setEdition(null); }}
        onEnregistre={o => { if (!edition?.organisme) navigate(`/formation/financements/${o.id}`); }}
      />

      <AlertDialog open={!!aSupprimer} onOpenChange={v => { if (!v) setASupprimer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {aSupprimer?.nom} ?</AlertDialogTitle>
            <AlertDialogDescription>Aucun apprenant n'y est rattaché. Ses règles (part, tranches, pièces) seront perdues.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => aSupprimer && void supprimer(aSupprimer)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Financements;
