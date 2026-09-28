import { describe, it, expect } from 'vitest';
import { relanceAFaire, numeroWhatsApp, filtrerProspects, apercuMessage, emailValide, type Prospect } from './prospects';
import {
  personnaliser, verifierRequete, messageResend, versHtml, MAX_DESTINATAIRES, EXPEDITEUR,
} from '../../supabase/functions/envoyer-email/email';

const p = (o: Partial<Prospect>): Prospect => ({ id: 'x', ecole: 'École', statut: 'nouveau', createdAt: '2026-09-01', ...o });
const AUJ = '2026-09-27';

describe('prospects — relances', () => {
  it('à faire le jour même ou en retard, jamais pour un client ou un perdu', () => {
    expect(relanceAFaire(p({ relanceLe: '2026-09-27' }), AUJ)).toBe(true);
    expect(relanceAFaire(p({ relanceLe: '2026-09-20' }), AUJ)).toBe(true);
    expect(relanceAFaire(p({ relanceLe: '2026-09-28' }), AUJ)).toBe(false);
    expect(relanceAFaire(p({}), AUJ)).toBe(false);
    expect(relanceAFaire(p({ relanceLe: '2026-09-20', statut: 'client' }), AUJ)).toBe(false);
    expect(relanceAFaire(p({ relanceLe: '2026-09-20', statut: 'perdu' }), AUJ)).toBe(false);
  });
  it('filtre « à relancer » et recherche ; les relances en retard en tête', () => {
    const liste = [
      p({ id: 'a', ecole: 'Lycée Blaise Diagne', relanceLe: '2026-10-10', createdAt: '2026-09-10' }),
      p({ id: 'b', ecole: 'Collège Sacré-Cœur', ville: 'Dakar', relanceLe: '2026-09-25' }),
      p({ id: 'c', ecole: 'IFHO', statut: 'client', relanceLe: '2026-09-01' }),
    ];
    expect(filtrerProspects(liste, 'a_relancer', '', AUJ).map(x => x.id)).toEqual(['b']);
    expect(filtrerProspects(liste, 'tous', 'dakar', AUJ).map(x => x.id)).toEqual(['b']);
    expect(filtrerProspects(liste, 'tous', '', AUJ)[0].id).toBe('b');
    expect(filtrerProspects(liste, 'client', '', AUJ).map(x => x.id)).toEqual(['c']);
  });
});

describe('prospects — WhatsApp et e-mail', () => {
  it('numéro sénégalais sans indicatif → 221…', () => {
    expect(numeroWhatsApp('77 123 45 67')).toBe('221771234567');
    expect(numeroWhatsApp('33 825 12 35')).toBe('221338251235');
    expect(numeroWhatsApp('+221 70 681 12 77')).toBe('221706811277');
    expect(numeroWhatsApp('00221 77 123 45 67')).toBe('221771234567');
    expect(numeroWhatsApp('12')).toBeNull();
    expect(numeroWhatsApp(undefined)).toBeNull();
  });
  it('adresse e-mail', () => {
    expect(emailValide('direction@ecole.sn')).toBe(true);
    expect(emailValide('pas une adresse')).toBe(false);
    expect(emailValide(undefined)).toBe(false);
  });
});

describe('envoyer-email — personnalisation et contrôles (logique de la fonction serveur)', () => {
  it('remplace {{ecole}} et {{responsable}} ; valeur manquante → formule neutre', () => {
    expect(personnaliser('Bonjour {{responsable}}, au sujet de {{ ecole }}.', { ecole: 'IFHO', responsable: 'M. Gueye' }))
      .toBe('Bonjour M. Gueye, au sujet de IFHO.');
    expect(personnaliser('Bonjour {{responsable}}, {{ecole}}', {})).toBe('Bonjour Madame, Monsieur, votre école');
    // L'aperçu à l'écran fait exactement la même chose.
    expect(apercuMessage('Bonjour {{responsable}}, {{ecole}}')).toBe('Bonjour Madame, Monsieur, votre école');
  });
  it('refuse une requête vide, sans destinataire, trop grosse ou avec une adresse invalide', () => {
    expect(verifierRequete(null)).toEqual(['Requête illisible']);
    expect(verifierRequete({ objet: '', contenu: '', destinataires: [] })).toHaveLength(3);
    const trop = Array.from({ length: MAX_DESTINATAIRES + 1 }, (_, i) => ({ email: `e${i}@ecole.sn` }));
    expect(verifierRequete({ objet: 'o', contenu: 'c', destinataires: trop })).toEqual([`${MAX_DESTINATAIRES} destinataires au plus par envoi`]);
    expect(verifierRequete({ objet: 'o', contenu: 'c', destinataires: [{ email: 'faux' }] })).toEqual(['1 adresse(s) e-mail invalide(s)']);
    expect(verifierRequete({ objet: 'o', contenu: 'c', destinataires: [{ email: 'ok@ecole.sn' }] })).toEqual([]);
  });
  it('message Resend : expéditeur contact@senclass.com, réponse au même, texte et HTML échappé', () => {
    const m = messageResend({ objet: 'Pour {{ecole}}', contenu: 'Bonjour <b>{{responsable}}</b>\n\nFin', destinataires: [] },
      { email: ' direction@ecole.sn ', ecole: 'IFHO', responsable: 'Awa' });
    expect(m.from).toBe(EXPEDITEUR);
    expect(m.reply_to).toBe('contact@senclass.com');
    expect(m.to).toEqual(['direction@ecole.sn']);
    expect(m.subject).toBe('Pour IFHO');
    expect(m.text).toBe('Bonjour <b>Awa</b>\n\nFin');
    expect(m.html).toContain('&lt;b&gt;Awa&lt;/b&gt;');
    expect(versHtml('a\nb\n\nc')).toContain('a<br>b');
  });

  it('rend les liens cliquables, sans la ponctuation finale ni de code injecté', () => {
    const h = versHtml('La vidéo : https://www.youtube.com/watch?v=8kpE2SjFqjg.\nSite https://senclass.com');
    expect(h).toContain('<a href="https://www.youtube.com/watch?v=8kpE2SjFqjg" style="color:#1d4ed8">https://www.youtube.com/watch?v=8kpE2SjFqjg</a>.');
    expect(h).toContain('<a href="https://senclass.com"');
    expect(versHtml('https://x.com/"><script>')).not.toContain('<script>');
  });
});

import { readFileSync } from 'node:fs';

describe('garde-fous — prospects réservés au chef du système, clé jamais en table', () => {
  const sql = readFileSync('docs/sql/platform_prospects.sql', 'utf8');
  const fonction = readFileSync('supabase/functions/envoyer-email/index.ts', 'utf8');
  it('les 3 tables : lecture et écriture par le seul chef du système', () => {
    expect(sql).toContain("array['platform_prospects', 'platform_echanges', 'platform_modeles_email']");
    expect(sql).toContain('using (get_is_platform_admin()) with check (get_is_platform_admin())');
  });
  it('la fonction vérifie le rôle avec le jeton de l\'appelant et lit la clé dans les secrets', () => {
    expect(fonction).toContain("rpc('get_is_platform_admin')");
    expect(fonction).toContain("Deno.env.get('RESEND_API_KEY')");
    expect(fonction).not.toMatch(/re_[A-Za-z0-9]{10,}/);   // aucune clé Resend écrite dans le code
  });
});
