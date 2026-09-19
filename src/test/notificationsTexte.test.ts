import { describe, it, expect } from 'vitest';
import {
  composerNotifications, enumeration, libelleMois, type LigneFile,
} from '../../supabase/functions/send-notifications/notifications';

// ════════════════════════════════════════════════════════════════════════════
// Ce que lit un élève — ou n'importe qui à côté de lui — sur l'écran verrouillé
// d'un téléphone. Deux exigences : ne jamais y montrer de note ni de montant,
// et ne jamais sonner quarante fois parce qu'un professeur a validé sa classe.
// ════════════════════════════════════════════════════════════════════════════

let n = 0;
const ligne = (kind: LigneFile['kind'], payload: Record<string, unknown>): LigneFile =>
  ({ id: `l${++n}`, kind, payload });

describe('nouvelles notes', () => {
  it('une matière : la nomme, au singulier', () => {
    const [notif] = composerNotifications([ligne('grade', { matiere: 'Mathématiques' })]);
    expect(notif.title).toBe('Nouvelle note');
    expect(notif.body).toBe('Une nouvelle note a été saisie en Mathématiques.');
    expect(notif.url).toBe('/portail/notes');
  });

  it('quarante lignes pour la même matière = UNE notification', () => {
    const lignes = Array.from({ length: 40 }, () => ligne('grade', { matiere: 'Français' }));
    const notifs = composerNotifications(lignes);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].body).toBe('Une nouvelle note a été saisie en Français.');
  });

  it('plusieurs matières : une seule notification, au pluriel', () => {
    const [notif] = composerNotifications([
      ligne('grade', { matiere: 'Maths' }), ligne('grade', { matiere: 'Français' }),
    ]);
    expect(notif.title).toBe('Nouvelles notes');
    expect(notif.body).toBe('Nouvelles notes en Maths et Français.');
  });

  it('beaucoup de matières : tronque proprement', () => {
    const [notif] = composerNotifications(
      ['Maths', 'Français', 'SVT', 'Anglais', 'Histoire'].map(m => ligne('grade', { matiere: m })),
    );
    expect(notif.body).toBe('Nouvelles notes en Maths, Français, SVT et 2 autres.');
  });

  it('une matière absente ne casse rien', () => {
    const [notif] = composerNotifications([ligne('grade', {})]);
    expect(notif.body).toBe('De nouvelles notes ont été saisies.');
  });
});

describe('bulletins', () => {
  it('nomme la période', () => {
    const [notif] = composerNotifications([ligne('bulletin', { periode: '1er trimestre' })]);
    expect(notif.title).toBe('Bulletin disponible');
    expect(notif.body).toBe('Votre bulletin (1er trimestre) est disponible.');
    expect(notif.url).toBe('/portail/notes');
  });

  it('deux périodes publiées ensemble : une seule notification', () => {
    const notifs = composerNotifications([
      ligne('bulletin', { periode: '1er trimestre' }), ligne('bulletin', { periode: '2e trimestre' }),
    ]);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe('Bulletins disponibles');
  });
});

describe('paiements', () => {
  it('scolarité : nomme le mois en toutes lettres', () => {
    const [notif] = composerNotifications([ligne('payment', { type: 'tuition', mois: '2026-09' })]);
    expect(notif.body).toBe('Votre paiement pour la scolarité de septembre 2026 a bien été enregistré.');
    expect(notif.url).toBe('/portail/paiements');
  });

  it("inscription et service annexe ont leur propre libellé", () => {
    expect(composerNotifications([ligne('payment', { type: 'inscription' })])[0].body)
      .toBe("Votre paiement pour l'inscription a bien été enregistré.");
    expect(composerNotifications([ligne('payment', { type: 'service', mois: '2026-10' })])[0].body)
      .toBe('Votre paiement pour un service annexe (octobre 2026) a bien été enregistré.');
  });

  it('plusieurs paiements : un total, sans détail', () => {
    const [notif] = composerNotifications([
      ligne('payment', { type: 'tuition', mois: '2026-09' }), ligne('payment', { type: 'tuition', mois: '2026-10' }),
    ]);
    expect(notif.title).toBe('Paiements enregistrés');
    expect(notif.body).toBe('2 paiements ont été enregistrés.');
  });

  it("un mois mal formé ne fait pas planter le texte", () => {
    const [notif] = composerNotifications([ligne('payment', { type: 'tuition', mois: 'n-importe-quoi' })]);
    expect(notif.body).toBe('Votre paiement pour la scolarité a bien été enregistré.');
  });
});

describe('regroupement par genre', () => {
  it('trois genres mêlés : trois notifications, dans un ordre stable', () => {
    const notifs = composerNotifications([
      ligne('payment', { type: 'inscription' }),
      ligne('bulletin', { periode: 'S1' }),
      ligne('grade', { matiere: 'Maths' }),
    ]);
    expect(notifs.map(x => x.tag)).toEqual(['notes', 'bulletin', 'paiements']);
  });

  it('aucune ligne : aucune notification', () => {
    expect(composerNotifications([])).toEqual([]);
  });
});

describe('confidentialité — rien de sensible sur un écran verrouillé', () => {
  it('ni valeur de note ni montant ne peuvent apparaître, même si la file en contenait', () => {
    // La file ne contient pas ces valeurs (voir docs/sql). Ce test verrouille
    // l'autre moitié : même glissées dans la charge, elles ne sont pas relues.
    const notifs = composerNotifications([
      ligne('grade', { matiere: 'Maths', note: 17.5, devoir1: 12 }),
      ligne('payment', { type: 'tuition', mois: '2026-09', amount: 25000, montant: 25000 }),
    ]);
    const texte = notifs.map(x => `${x.title} ${x.body}`).join(' ');
    expect(texte).not.toMatch(/17|12|25\s?000|\bFCFA\b|\bF\b/);
  });

  it("les liens restent internes au site", () => {
    const notifs = composerNotifications([
      ligne('grade', { matiere: 'A' }), ligne('bulletin', { periode: 'B' }), ligne('payment', { type: 'inscription' }),
    ]);
    for (const x of notifs) expect(x.url).toMatch(/^\/(?!\/)/);
  });
});

describe('petits utilitaires', () => {
  it('libelleMois', () => {
    expect(libelleMois('2026-01')).toBe('janvier 2026');
    expect(libelleMois('2026-12')).toBe('décembre 2026');
    expect(libelleMois('2026-13')).toBeNull();
    expect(libelleMois('2026-9')).toBeNull();
    expect(libelleMois(undefined)).toBeNull();
  });

  it('enumeration', () => {
    expect(enumeration([])).toBe('');
    expect(enumeration(['A'])).toBe('A');
    expect(enumeration(['A', 'B', 'C'])).toBe('A, B et C');
    expect(enumeration(['A', 'B', 'C', 'D'])).toBe('A, B, C et 1 autre');
  });
});
