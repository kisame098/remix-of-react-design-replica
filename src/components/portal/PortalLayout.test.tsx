import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PortalLayout from './PortalLayout';

// ════════════════════════════════════════════════════════════════════════════
// DEUX MISES EN PAGE, PAS UNE COLONNE ÉTIRÉE.
//
// Le portail est conçu pour le téléphone — 90 % des élèves et professeurs — et
// bascule sur une colonne latérale à partir de la tablette. Le basculement
// passe par des points de rupture CSS, donc ce qui se vérifie ici est la
// STRUCTURE : que les deux mises en page existent, qu'elles s'excluent, et
// qu'aucune ne perde la navigation.
//
// L'apparence elle-même se juge à l'œil, pas dans un test.
// ════════════════════════════════════════════════════════════════════════════

const useAuthMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('@/lib/linkedAccounts', () => ({ upsertLinkedAccount: vi.fn() }));

const monter = (accountRole: 'student' | 'teacher' = 'student') => {
  useAuthMock.mockReturnValue({
    session: null,
    accountRole,
    schoolAccount: {
      displayName: 'Noha Sane', displayId: 'ETU-2026-00001',
      schoolName: 'École Teranga', className: 'CI A',
      authUserId: 'u1', email: 'n@t.com', role: accountRole,
    },
  });
  return render(
    <MemoryRouter initialEntries={['/portail']}>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/portail" element={<p>contenu</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

/** Le conteneur d'une mise en page, reconnu à sa classe de bascule. */
const barreBasse = (c: HTMLElement) => c.querySelector('nav.md\\:hidden');
const colonneLaterale = (c: HTMLElement) => c.querySelector('aside');
const enTeteMobile = (c: HTMLElement) => c.querySelector('header.md\\:hidden');

beforeEach(() => useAuthMock.mockReset());

describe('les deux mises en page coexistent', () => {
  it('le TÉLÉPHONE garde sa barre de navigation en bas', () => {
    const { container } = monter();
    expect(barreBasse(container)).not.toBeNull();
  });

  it('l\'ORDINATEUR reçoit une colonne latérale', () => {
    const { container } = monter();
    const aside = colonneLaterale(container);
    expect(aside).not.toBeNull();
    // Masquée sur téléphone, affichée à partir de la tablette.
    expect(aside!.className).toContain('hidden');
    expect(aside!.className).toContain('md:flex');
  });

  it('ELLES S\'EXCLUENT : jamais les deux navigations en même temps', () => {
    const { container } = monter();
    // La barre basse disparaît là où la colonne apparaît, et inversement.
    expect(barreBasse(container)!.className).toContain('md:hidden');
    expect(colonneLaterale(container)!.className).toContain('hidden');
  });

  it('l\'en-tête mobile s\'efface sur ordinateur — la colonne porte déjà l\'école', () => {
    const { container } = monter();
    expect(enTeteMobile(container)).not.toBeNull();
    expect(enTeteMobile(container)!.className).toContain('md:hidden');
  });

  it('le contenu S\'ÉLARGIT sur ordinateur au lieu de rester en colonne de téléphone', () => {
    const { container } = monter();
    const main = container.querySelector('main')!;
    expect(main.className).toContain('max-w-lg');      // téléphone
    expect(main.className).toMatch(/md:max-w-\w+/);     // ordinateur : plus large
  });

  it('la marge réservée à la barre basse disparaît quand la barre disparaît', () => {
    const { container } = monter();
    const main = container.querySelector('main')!;
    expect(main.className).toContain('pb-20');    // place pour la barre
    expect(main.className).toContain('md:pb-10'); // plus de barre, moins de marge
  });
});

describe('aucune mise en page ne perd de fonctionnalité', () => {
  it('les MÊMES entrées de navigation existent des deux côtés', () => {
    const { container } = monter('student');
    const dansLaBarre = [...barreBasse(container)!.querySelectorAll('a')].map(a => a.getAttribute('href'));
    const dansLaColonne = [...colonneLaterale(container)!.querySelectorAll('a')]
      .map(a => a.getAttribute('href'))
      .filter(h => h !== '/portail/profil');   // le profil est à part dans la colonne
    expect(dansLaColonne).toEqual(dansLaBarre);
    expect(dansLaBarre.length).toBeGreaterThan(3);
  });

  it('le profil reste atteignable dans les deux mises en page', () => {
    const { container } = monter();
    const liens = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(liens.filter(h => h === '/portail/profil').length).toBeGreaterThanOrEqual(2);
  });

  it('le PROFESSEUR n\'a pas l\'onglet Paiements, des deux côtés', () => {
    // Règle existante : les paiements ne concernent que l'élève.
    const { container } = monter('teacher');
    const liens = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(liens).not.toContain('/portail/paiements');
  });

  it('l\'élève, lui, a bien l\'onglet Paiements', () => {
    const { container } = monter('student');
    const liens = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(liens).toContain('/portail/paiements');
  });

  it('le contenu de la page s\'affiche, quelle que soit la mise en page', () => {
    monter();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('l\'école et l\'élève sont nommés dans la colonne latérale', () => {
    const { container } = monter();
    const texte = colonneLaterale(container)!.textContent ?? '';
    expect(texte).toContain('École Teranga');
    expect(texte).toContain('CI A');
    expect(texte).toContain('Noha Sane');
  });
});
