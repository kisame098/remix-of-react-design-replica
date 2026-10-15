import { useId } from 'react';

/**
 * Motifs géométriques inspirés des tissus wax, dessinés en SVG et colorés par
 * `currentColor` : ils prennent la couleur de l'école.
 */
export type TypeMotif = 'cercles' | 'losanges' | 'eventails' | 'points';

const DESSINS: Record<TypeMotif, { taille: number; contenu: JSX.Element }> = {
  cercles: {
    taille: 48,
    contenu: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="11" /><circle cx="24" cy="24" r="4" fill="currentColor" />
        <circle cx="0" cy="0" r="6" /><circle cx="48" cy="0" r="6" /><circle cx="0" cy="48" r="6" /><circle cx="48" cy="48" r="6" />
      </g>
    ),
  },
  losanges: {
    taille: 40,
    contenu: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 2 L38 20 L20 38 L2 20 Z" /><path d="M20 11 L29 20 L20 29 L11 20 Z" fill="currentColor" />
      </g>
    ),
  },
  eventails: {
    taille: 40,
    contenu: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M0 40 A40 40 0 0 1 40 0" /><path d="M0 40 A28 28 0 0 1 28 12" /><path d="M0 40 A16 16 0 0 1 16 24" />
      </g>
    ),
  },
  points: {
    taille: 22,
    contenu: <circle cx="11" cy="11" r="3" fill="currentColor" />,
  },
};

export function Motif({ type = 'cercles', className = '', echelle = 1 }: { type?: TypeMotif; className?: string; echelle?: number }) {
  const id = useId().replace(/:/g, '');
  const { taille, contenu } = DESSINS[type];
  return (
    <svg className={`pointer-events-none ${className}`} aria-hidden="true" width="100%" height="100%">
      <defs>
        <pattern id={id} width={taille * echelle} height={taille * echelle} patternUnits="userSpaceOnUse">
          <g transform={`scale(${echelle})`}>{contenu}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Badge rond dont le texte tourne lentement (« Inscriptions ouvertes • … »). */
export function BadgeTournant({ texte, className = '', children }: { texte: string; className?: string; children?: React.ReactNode }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className={className.includes('absolute') ? className : `relative ${className}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full animate-[spin_18s_linear_infinite]" aria-hidden="true">
        <defs><path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
        <text className="fill-current" style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>
          {/* Le texte est réparti sur tout le tour du cercle (2π × 78 ≈ 490). */}
          <textPath href={`#${id}`} textLength={486} lengthAdjust="spacing">{texte}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
