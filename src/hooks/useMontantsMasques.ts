import { useCallback, useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Masquer les montants encaissés à l'écran (quelqu'un regarde par-dessus
// l'épaule). Le choix est gardé sur CET ordinateur et vaut partout à la fois :
// tableau de bord et Gestion des paiements.
// ═══════════════════════════════════════════════════════════════════════════

const CLE = 'senclass.montants-masques';
const EVENEMENT = 'senclass:montants-masques';

const lire = (): boolean => {
  try { return localStorage.getItem(CLE) === '1'; } catch { return false; }
};

/** Ce qui s'affiche à la place d'un montant masqué. */
export const MONTANT_MASQUE = '••••••';

export const useMontantsMasques = (): [boolean, () => void] => {
  const [masques, setMasques] = useState(lire);

  useEffect(() => {
    const relire = () => setMasques(lire());
    window.addEventListener(EVENEMENT, relire);
    window.addEventListener('storage', relire);
    return () => { window.removeEventListener(EVENEMENT, relire); window.removeEventListener('storage', relire); };
  }, []);

  const basculer = useCallback(() => {
    const nouveau = !lire();
    try { localStorage.setItem(CLE, nouveau ? '1' : '0'); } catch { /* navigation privée : le choix ne dure que la page */ }
    setMasques(nouveau);
    window.dispatchEvent(new Event(EVENEMENT));
  }, []);

  return [masques, basculer];
};
