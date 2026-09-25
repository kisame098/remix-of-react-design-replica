// ═══════════════════════════════════════════════════════════════════════════
// TÉLÉCHARGER SENCLASS — version à installer dans l'école (hors ligne)
//
// Liens FIXES : ils mènent toujours à la dernière version publiée, on ne les
// modifie jamais. Aucun fichier n'est hébergé ni appelé par le site.
// ═══════════════════════════════════════════════════════════════════════════

export type Ordinateur = 'windows' | 'mac-arm' | 'mac-intel';

export interface Version {
  id: Ordinateur;
  titre: string;
  detail: string;
  fichier: string;
  lien: string;
}

export const VERSIONS: Version[] = [
  {
    id: 'windows', titre: 'Windows', detail: 'Windows 10 / 11 (64 bits)',
    fichier: 'SenClass-Windows.exe', lien: 'https://maj.senclass.com/telecharger/SenClass-Windows.exe',
  },
  {
    id: 'mac-arm', titre: 'Mac puce Apple', detail: 'Mac avec puce Apple (M1, M2, M3, M4…)',
    fichier: 'SenClass-Mac-Apple-Silicon.dmg', lien: 'https://maj.senclass.com/telecharger/SenClass-Mac-Apple-Silicon.dmg',
  },
  {
    id: 'mac-intel', titre: 'Mac Intel', detail: 'Mac avec processeur Intel',
    fichier: 'SenClass-Mac-Intel.dmg', lien: 'https://maj.senclass.com/telecharger/SenClass-Mac-Intel.dmg',
  },
];

/** Ce que le navigateur laisse voir de l'ordinateur (fourni par la page, remplaçable en test). */
export interface IndicesOrdinateur {
  userAgent: string;
  /** `navigator.userAgentData.getHighEntropyValues(['architecture'])` — Chrome, Edge… */
  architecture?: () => Promise<string | undefined>;
  /** Nom de la carte graphique via WebGL (`WEBGL_debug_renderer_info`). */
  carteGraphique?: () => string | undefined;
}

/** Nom de la carte graphique : « Apple M… » / « Apple GPU » → puce Apple ; Intel, AMD, Radeon, NVIDIA → Intel. */
export const architectureDepuisCarte = (carte: string | undefined): Ordinateur | null => {
  if (!carte) return null;
  if (/Apple M|Apple GPU/i.test(carte)) return 'mac-arm';
  if (/Intel|AMD|Radeon|NVIDIA/i.test(carte)) return 'mac-intel';
  return null;
};

/**
 * L'ordinateur du visiteur, ou `null` s'il n'est pas reconnu (téléphone,
 * tablette, Linux, Mac dont la puce reste inconnue) : la page ne propose
 * alors pas de bouton principal, seulement les trois choix.
 */
export const detecterOrdinateur = async (i: IndicesOrdinateur): Promise<Ordinateur | null> => {
  const ua = i.userAgent;
  // Téléphones et tablettes d'abord : un iPad se présente parfois comme un Mac.
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return null;
  if (/Windows/i.test(ua)) return 'windows';
  if (!/Macintosh|Mac OS X/i.test(ua)) return null;
  try {
    const arch = await i.architecture?.();
    if (arch === 'arm') return 'mac-arm';
    if (arch === 'x86') return 'mac-intel';
  } catch { /* indisponible : on regarde la carte graphique */ }
  try {
    return architectureDepuisCarte(i.carteGraphique?.());
  } catch {
    return null;
  }
};

/** Les indices réels du navigateur. */
export const indicesDuNavigateur = (): IndicesOrdinateur => ({
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  architecture: async () => {
    const uad = (navigator as unknown as { userAgentData?: { getHighEntropyValues: (h: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
    return uad ? (await uad.getHighEntropyValues(['architecture'])).architecture : undefined;
  },
  carteGraphique: () => {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined;
  },
});
