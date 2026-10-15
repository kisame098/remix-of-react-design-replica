import { describe, it, expect } from 'vitest';
import { estPageFacebook, identifiant, integrationDepuisUrl, lienWhatsApp, routeDepuisHash } from './utilitaires';

describe('utilitaires du site', () => {
  it('WhatsApp : chiffres seuls, message encodé', () => {
    expect(lienWhatsApp('+221 77 000 00 00', 'Bonjour à tous')).toBe('https://wa.me/221770000000?text=Bonjour%20%C3%A0%20tous');
    expect(lienWhatsApp('+221 77 000 00 00')).toBe('https://wa.me/221770000000');
  });

  it('route : page et sous-page', () => {
    expect(routeDepuisHash('#/actualites/semaine-culturelle')).toEqual({ page: 'actualites', sous: 'semaine-culturelle' });
    expect(routeDepuisHash('#/')).toEqual({ page: '', sous: '' });
    expect(routeDepuisHash('')).toEqual({ page: '', sous: '' });
  });

  it('identifiant lisible et unique', () => {
    expect(identifiant('Résultats du BFEM : 96 % !', [])).toBe('resultats-du-bfem-96');
    expect(identifiant('Fête', ['fete', 'fete-2'])).toBe('fete-3');
    expect(identifiant('!!!', [])).toBe('actualite');
  });

  it('intègre YouTube sous toutes ses formes', () => {
    for (const u of ['https://www.youtube.com/watch?v=abc123', 'https://youtu.be/abc123', 'https://youtube.com/shorts/abc123', 'https://m.youtube.com/watch?v=abc123']) {
      expect(integrationDepuisUrl(u)).toMatchObject({ type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/abc123' });
    }
  });

  it('intègre Facebook : vidéo ou publication', () => {
    const video = integrationDepuisUrl('https://www.facebook.com/ecole/videos/123');
    expect(video).toMatchObject({ type: 'iframe', ratio: '16/9' });
    expect(video && 'src' in video && video.src).toContain('/plugins/video.php?href=');
    const post = integrationDepuisUrl('https://www.facebook.com/ecole/posts/456');
    expect(post && 'src' in post && post.src).toContain('/plugins/post.php?href=');
  });

  it('intègre TikTok, Instagram et un fichier vidéo', () => {
    expect(integrationDepuisUrl('https://www.tiktok.com/@ecole/video/7300000000000000000')).toMatchObject({ src: 'https://www.tiktok.com/embed/v2/7300000000000000000' });
    expect(integrationDepuisUrl('https://www.instagram.com/p/C0d3/')).toMatchObject({ src: 'https://www.instagram.com/p/C0d3/embed' });
    expect(integrationDepuisUrl('https://exemple.sn/fete.mp4')).toEqual({ type: 'video', src: 'https://exemple.sn/fete.mp4' });
  });

  it('un lien ordinaire ou invalide ne s\'intègre pas', () => {
    expect(integrationDepuisUrl('https://www.seneweb.com/article')).toBeNull();
    expect(integrationDepuisUrl('pas un lien')).toBeNull();
    expect(integrationDepuisUrl('https://www.tiktok.com/@ecole')).toBeNull();
  });

  it('page Facebook : jamais l\'accueil de Facebook', () => {
    expect(estPageFacebook('https://www.facebook.com/GroupeScolaireExcellence')).toBe(true);
    expect(estPageFacebook('https://www.facebook.com/')).toBe(false);
    expect(estPageFacebook('https://instagram.com/x')).toBe(false);
  });
});
