import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IdCard } from './IdCard';

// ════════════════════════════════════════════════════════════════════════════
// LA CARTE D'ÉLÈVE : une largeur de carte sur téléphone, une VRAIE grande
// carte sur ordinateur et tablette.
//
// Défaut signalé : bornée à `max-w-sm` sur tous les écrans, elle laissait un
// grand vide à sa droite sur un écran d'ordinateur. La correction demandée est
// de l'AGRANDIR — pas de la déplacer ailleurs dans la page.
//
// Agrandir la boîte sans agrandir son contenu donnerait une vignette étirée :
// les éléments internes (photo, QR, textes) montent donc aussi au point de
// rupture `md:`.
// ════════════════════════════════════════════════════════════════════════════

const carte = (props: Record<string, unknown> = {}) => {
  const { container } = render(
    <IdCard
      displayName="Pig Man Bear" displayId="ETU-2026-00002"
      className="CI A" schoolName="LA MIFF" academicYearLabel="2026-2027"
      isStudent {...props}
    />,
  );
  return container.firstElementChild as HTMLElement;
};

describe('IdCard — largeur et centrage', () => {
  it('garde une largeur de carte sur TÉLÉPHONE', () => {
    expect(carte().className).toMatch(/(^|\s)max-w-\w+/);
  });

  it('S\'AGRANDIT sur ordinateur et tablette au lieu de rester une vignette', () => {
    // `md:max-w-none` : la carte occupe la largeur que son conteneur lui donne.
    expect(carte().className).toContain('md:max-w-none');
  });

  it('EST CENTRÉE dans son conteneur, quelle que soit la taille', () => {
    // Sans cela, un vide asymétrique apparaît à droite sur grand écran.
    expect(carte().className, 'taille normale').toContain('mx-auto');
    expect(carte({ size: 'large' }).className, 'grande taille').toContain('mx-auto');
  });

  it('la vue plein écran garde sa borne — elle est déjà dimensionnée pour ça', () => {
    // `size: 'large'` sert la carte imprimable : elle ne suit pas le conteneur.
    expect(carte({ size: 'large' }).className).not.toContain('md:max-w-none');
  });
});

describe('IdCard — la carte d\'impression ne grandit JAMAIS', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // Régression vécue : les points de rupture Tailwind regardent la largeur de
  // l'ÉCRAN, pas celle du parent. La carte plein écran vit dans une boîte de
  // dialogue de 448 px ; sur un écran d'ordinateur, tous les `md:` se
  // déclenchaient quand même et gonflaient la photo (128×160) et le QR
  // (160×160) jusqu'à écraser le texte — le nom tronqué en « PIG … »,
  // l'identifiant coupé sur trois lignes.
  //
  // Règle : aucune classe `md:` nulle part dans la variante `large`.
  // ══════════════════════════════════════════════════════════════════════════
  const classesDeToutLArbre = (el: HTMLElement) =>
    [el, ...el.querySelectorAll<HTMLElement>('*')]
      .map(n => (typeof n.className === 'string' ? n.className : ''))
      .join(' ');

  it('aucune classe responsive dans la variante plein écran', () => {
    const fautives = classesDeToutLArbre(carte({ size: 'large' }))
      .split(/\s+/)
      .filter(c => /^(sm|md|lg|xl|2xl):/.test(c));
    expect(fautives, 'classes responsives interdites ici').toEqual([]);
  });

  it('elle garde ses dimensions d\'origine, photo et QR compris', () => {
    const classes = classesDeToutLArbre(carte({ size: 'large' }));
    expect(classes).toContain('w-20 h-24');   // photo
    expect(classes).toContain('w-28 h-28');   // QR, un peu plus grand qu'en profil
  });

  it('la carte de profil, elle, garde bien ses classes responsives', () => {
    // Garde-fou symétrique : que la correction ci-dessus n'ait pas aplati les
    // deux variantes d'un coup.
    expect(classesDeToutLArbre(carte())).toMatch(/\bmd:/);
  });

  it('l\'identifiant peut se couper : il ne déborde pas de la carte étroite', () => {
    expect(classesDeToutLArbre(carte({ size: 'large' }))).toContain('break-all');
  });
});

describe('IdCard — le contenu grandit avec la carte', () => {
  const toutesLesClasses = (el: HTMLElement) =>
    [...el.querySelectorAll('*')].map(n => n.className).join(' ');

  it('la PHOTO grandit sur ordinateur', () => {
    const photo = carte().querySelector('.w-20')!;
    expect(photo.className).toMatch(/md:w-\d+/);
    expect(photo.className).toMatch(/md:h-\d+/);
  });

  it('le QR CODE grandit sur ordinateur — il doit rester scannable de loin', () => {
    expect(toutesLesClasses(carte())).toMatch(/w-24 h-24 md:w-\d+ md:h-\d+/);
  });

  it('les TEXTES grandissent : sinon la carte paraît vide', () => {
    const classes = toutesLesClasses(carte());
    for (const attendu of ['md:text-lg', 'md:text-2xl', 'md:text-base'])
      expect(classes, attendu).toContain(attendu);
  });

  it('l\'intérieur respire : les marges internes montent aussi', () => {
    expect(toutesLesClasses(carte())).toMatch(/md:p-\d+/);
  });
});

describe('IdCard — identité', () => {
  it('affiche bien l\'identité de l\'élève', () => {
    const c = carte();
    expect(c.textContent).toContain('Pig Man Bear');
    expect(c.textContent).toContain('ETU-2026-00002');
    expect(c.textContent).toContain('LA MIFF');
  });

  it('affiche la classe et l\'année de validité', () => {
    const c = carte();
    expect(c.textContent).toContain('CI A');
    expect(c.textContent).toContain('2026-2027');
  });

  it('sans photo, affiche les initiales — jamais un cadre vide', () => {
    expect(carte().textContent).toContain('PM');
  });
});
