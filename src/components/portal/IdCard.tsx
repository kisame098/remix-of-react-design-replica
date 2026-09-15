import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { initials } from '@/pages/portal/portalHelpers';
import { GraduationCap } from 'lucide-react';

interface IdCardProps {
  displayName: string;
  displayId: string;
  photoUrl?: string;
  className?: string;      // classe de l'élève (optionnel, absent pour un prof)
  schoolName: string;
  schoolLogoUrl?: string;
  academicYearLabel?: string;
  isStudent: boolean;
  /** Taille du rendu — 'normal' pour la vue profil, 'large' pour la vue plein écran/impression */
  size?: 'normal' | 'large';
}

/**
 * Carte d'identité scolaire — élève ou professeur.
 * Le QR code encode l'identifiant lisible (ETU-/PROF-...) pour être scanné
 * directement (ex: à l'encaissement des paiements).
 */
export const IdCard = ({
  displayName, displayId, photoUrl, className, schoolName, schoolLogoUrl,
  academicYearLabel, isStudent, size = 'normal',
}: IdCardProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(displayId, { margin: 0, width: 256, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [displayId]);

  const roleLabel = isStudent ? "Carte d'élève" : 'Carte professeur';
  const accent = isStudent
    ? 'from-blue-600 to-blue-800'
    : 'from-violet-600 to-violet-800';

  const isLarge = size === 'large';

  // ── Agrandissement sur ordinateur et tablette ────────────────────────────
  // Uniquement pour la carte du profil, qui suit la largeur de son conteneur.
  //
  // Les points de rupture Tailwind regardent la LARGEUR DE L'ÉCRAN, pas celle
  // du parent : appliqués à la carte d'impression — enfermée dans une boîte de
  // dialogue de 448 px — ils gonflaient la photo et le QR jusqu'à écraser le
  // nom (« PIG … » sur une ligne, l'identifiant coupé sur trois). D'où ce
  // garde-fou : la vue plein écran garde ses dimensions fixes.
  const grandir = (classes: string) => (isLarge ? '' : classes);

  return (
    <div className={cn(
      'w-full rounded-2xl overflow-hidden shadow-lg border border-black/5 bg-white',
      // Téléphone : largeur de carte, centrée.
      // Ordinateur et tablette : la carte GRANDIT pour occuper toute la
      // largeur disponible, au lieu de rester une vignette collée à gauche
      // avec un vide à sa droite.
      'mx-auto',
      isLarge ? 'max-w-md' : 'max-w-sm md:max-w-none',
    )}>
      {/* Bandeau supérieur */}
      <div className={cn('bg-gradient-to-r px-4 py-3 flex items-center gap-2.5', grandir('md:px-6 md:py-4 md:gap-4'), accent)}>
        <div className={cn('w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 overflow-hidden', grandir('md:w-11 md:h-11 md:rounded-xl'))}>
          {schoolLogoUrl ? (
            <img src={schoolLogoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <GraduationCap className={cn('h-4 w-4 text-white', grandir('md:h-6 md:w-6'))} />
          )}
        </div>
        <div className="min-w-0">
          <p className={cn('text-white font-bold text-sm truncate leading-tight', grandir('md:text-lg'))}>{schoolName}</p>
          <p className={cn('text-white/80 text-[10px] uppercase tracking-widest font-semibold leading-tight', grandir('md:text-xs'))}>{roleLabel}</p>
        </div>
      </div>

      {/* Corps de la carte */}
      <div className={cn('p-4 flex items-center gap-4', grandir('md:p-7 md:gap-8'))}>
        <div className={cn('w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border bg-muted', grandir('md:w-32 md:h-40 md:rounded-xl'))}>
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className={cn(
              'w-full h-full flex items-center justify-center text-white font-black text-xl',
              grandir('md:text-4xl'),
              isStudent ? 'bg-blue-600' : 'bg-violet-600',
            )}>
              {initials(displayName)}
            </div>
          )}
        </div>

        <div className={cn('flex-1 min-w-0 space-y-1.5', grandir('md:space-y-3'))}>
          <p className={cn('font-black text-foreground text-sm leading-tight truncate', grandir('md:text-2xl'))}>{displayName}</p>
          {className && (
            <p className={cn('text-xs text-muted-foreground', grandir('md:text-base'))}>Classe : <span className="font-semibold text-foreground">{className}</span></p>
          )}
          {/* `break-all` : sans lui, l'identifiant déborde de la carte étroite
              de la boîte de dialogue au lieu d'y tenir. */}
          <p className={cn('text-xs text-muted-foreground font-mono break-all', grandir('md:text-base'))}>{displayId}</p>
        </div>

        <div className={cn(
          'flex-shrink-0 rounded-md border border-border bg-white p-1',
          grandir('md:rounded-lg md:p-2'),
          isLarge ? 'w-28 h-28' : 'w-24 h-24 md:w-40 md:h-40',
        )}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
          ) : (
            <div className="w-full h-full bg-muted animate-pulse rounded-sm" />
          )}
        </div>
      </div>

      {/* Bandeau inférieur */}
      {academicYearLabel && (
        <div className={cn('px-4 py-1.5 bg-muted/50 border-t border-border', grandir('md:py-3'))}>
          <p className={cn('text-[10px] text-muted-foreground text-center font-medium', grandir('md:text-sm'))}>
            Valide pour l'année scolaire {academicYearLabel}
          </p>
        </div>
      )}
    </div>
  );
};
