import { useCallback, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { infosEcole, nomDeFichier } from '@/lib/documentsEcole';
import { construireFiche } from '@/lib/ficheInscription';
import { chargerIdentifiantsEleve } from '@/lib/identifiantsEleve';
import { DocumentDialog } from '@/components/documents/DocumentDialog';

/** Adresse imprimée sur la fiche : celle du site public, pas celle de l'onglet ouvert (aperçu, test…). */
export const ADRESSE_SITE_PUBLIC = 'https://senclass.com';

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Un élève réinscrit garde son profil (createdAt ancien) mais reçoit une nouvelle
 * inscription pour l'année : un écart d'un jour ou plus les distingue. Sert à la
 * RÉÉDITION d'une fiche ; à l'inscription même, on connaît la réponse.
 */
export const estReinscription = (s: Pick<Student, 'createdAt' | 'enrolledAt'>): boolean => {
  const inscrit = new Date(s.enrolledAt).getTime();
  const cree = s.createdAt.getTime();
  return Number.isFinite(inscrit) && Number.isFinite(cree) && inscrit - cree > UN_JOUR_MS;
};

interface FicheOuverte { eleve: Student; reinscription: boolean }

/**
 * La fiche d'inscription d'un élève, prête à imprimer.
 *
 *   const { montrerFiche, dialogueFiche } = useFicheInscription();
 *   montrerFiche(eleve, { reinscription: false });
 *   return <>{…}{dialogueFiche}</>;
 */
export function useFicheInscription(): {
  montrerFiche: (eleve: Student, options?: { reinscription?: boolean }) => void;
  dialogueFiche: ReactNode;
} {
  const { school } = useAuth();
  const { classes, filieres, getClassFiliereAssignment } = useSchool();
  const { getTuitionConfig, hasPaidInscription } = usePayment();
  const { currentYear } = useSchoolYear();
  const [ouverte, setOuverte] = useState<FicheOuverte | null>(null);

  const montrerFiche = useCallback((eleve: Student, options: { reinscription?: boolean } = {}) => {
    setOuverte({ eleve, reinscription: options.reinscription ?? estReinscription(eleve) });
  }, []);

  const dialogueFiche = ouverte && (() => {
    const { eleve, reinscription } = ouverte;
    const classe = eleve.classId ? classes.find(c => c.id === eleve.classId) : undefined;
    const annee = currentYear?.name || currentYear?.id || '';
    const affectation = classe && currentYear ? getClassFiliereAssignment(classe.id, currentYear.id) : undefined;
    const filiere = affectation ? filieres.find(f => f.id === affectation.filiereId)?.name : undefined;
    const tarifs = eleve.classId ? getTuitionConfig(eleve.classId) : undefined;

    return (
      <DocumentDialog
        ouvert
        onFermer={() => setOuverte(null)}
        titre="Fiche d'inscription"
        description={`${eleve.lastName.toUpperCase()} ${eleve.firstName} — ${eleve.studentId}. La page 2, avec les identifiants de connexion, est à remettre à la famille.`}
        nomFichier={`Fiche_inscription_${nomDeFichier(`${eleve.lastName}_${eleve.firstName}`)}`}
        generer={async () => {
          // Le compte se crée en arrière-plan juste après l'inscription : on lui
          // laisse un court instant avant de conclure qu'il n'y a pas d'identifiants.
          const [compte, { genererFicheInscriptionPdf }] = await Promise.all([
            chargerIdentifiantsEleve(eleve.id),
            import('@/lib/ficheInscriptionPdf'),
          ]);
          return genererFicheInscriptionPdf(construireFiche({
            ecole: infosEcole(school),
            anneeScolaire: annee,
            dateInscription: eleve.enrolledAt,
            reinscription,
            eleve,
            classe: classe ? { name: classe.name, niveau: classe.niveau } : undefined,
            filiere,
            tarifs,
            inscriptionPayee: hasPaidInscription(eleve.id),
            compte,
            adresseSite: ADRESSE_SITE_PUBLIC,
          }));
        }}
      />
    );
  })();

  return { montrerFiche, dialogueFiche: dialogueFiche || null };
}
