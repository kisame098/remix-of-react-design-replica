import { describe, expect, it } from 'vitest';
import { alerteAbonnement, dureeEnLettres, peutMasquer } from '@/lib/alerteAbonnement';

const H = 3_600_000;
const J = 24 * H;
const maintenant = Date.parse('2026-10-05T10:00:00Z');
const dans = (ms: number) => new Date(maintenant + ms).toISOString();

describe('alerte de fin d\'essai ou d\'abonnement', () => {
  it('essai : prévenu pendant tout l\'essai, urgent dans les dernières 24 h', () => {
    expect(alerteAbonnement('trial', dans(6 * J), maintenant)).toMatchObject({ essai: true, niveau: 'info' });
    expect(alerteAbonnement('trial', dans(5 * H), maintenant)).toMatchObject({ essai: true, niveau: 'urgent' });
  });

  it('essai écoulé : plus de bandeau (l\'écran « abonnement requis » prend le relais)', () => {
    expect(alerteAbonnement('trial', dans(-H), maintenant)).toBeNull();
  });

  it('abonnement payé : rien avant les 7 derniers jours', () => {
    expect(alerteAbonnement('active', dans(8 * J), maintenant)).toBeNull();
    expect(alerteAbonnement('active', dans(7 * J), maintenant)).toMatchObject({ essai: false, niveau: 'info' });
    expect(alerteAbonnement('active', dans(2 * H), maintenant)).toMatchObject({ niveau: 'urgent' });
  });

  it('abonnement payé échu : signalé comme expiré (jamais bloqué tout seul)', () => {
    expect(alerteAbonnement('active', dans(-3 * J), maintenant)).toMatchObject({ niveau: 'expire' });
  });

  it('suspendu, annulé, sans date : pas de bandeau', () => {
    expect(alerteAbonnement('suspended', dans(J), maintenant)).toBeNull();
    expect(alerteAbonnement('cancelled', dans(J), maintenant)).toBeNull();
    expect(alerteAbonnement('active', null, maintenant)).toBeNull();
    expect(alerteAbonnement('trial', 'pas une date', maintenant)).toBeNull();
  });

  it('masquable seulement quand ce n\'est pas urgent', () => {
    expect(peutMasquer(alerteAbonnement('trial', dans(3 * J), maintenant)!)).toBe(true);
    expect(peutMasquer(alerteAbonnement('trial', dans(3 * H), maintenant)!)).toBe(false);
    expect(peutMasquer(alerteAbonnement('active', dans(-H), maintenant)!)).toBe(false);
  });

  it('durée restante en toutes lettres', () => {
    expect(dureeEnLettres(2 * J + 3 * H + 10 * 60_000)).toBe('2 jours et 3 h');
    expect(dureeEnLettres(J)).toBe('1 jour');
    expect(dureeEnLettres(5 * H + 7 * 60_000)).toBe('5 h 07 min');
    expect(dureeEnLettres(12 * 60_000)).toBe('12 min');
    expect(dureeEnLettres(20_000)).toBe('moins d\'une minute');
  });
});
