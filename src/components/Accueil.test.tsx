import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Hero from './Hero';
import CTA from './CTA';
import Pricing from './Pricing';
import Footer from './Footer';
import FAQ from './FAQ';
import { QUESTIONS, donneesStructureesFAQ } from '@/lib/faq';
import { Referencement } from './Referencement';
import { TITRE_ACCUEIL } from '@/lib/referencement';
import { TARIF_MENSUEL, FORMULES, prixPlein } from '@/lib/subscriptionPlans';
import { WHATSAPP_NUMERO, ADRESSE_INSCRIPTION, EMAIL_CONTACT } from '@/lib/contact';

// ════════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL — celle que trouvent les directeurs d'école sur Google.
// Être trouvé ne sert à rien si les boutons ne mènent nulle part : ceux du
// haut de page ne faisaient rien avant la mise en ligne.
// ════════════════════════════════════════════════════════════════════════════

const OuSuisJe = () => <p data-testid="adresse">{useLocation().pathname + useLocation().search}</p>;

const monter = (element: React.ReactNode, depart = '/') => render(
  <MemoryRouter initialEntries={[depart]}>
    <Routes>
      <Route path="/" element={<>{element}<OuSuisJe /></>} />
      <Route path="/auth" element={<OuSuisJe />} />
      <Route path="*" element={<>{element}<OuSuisJe /></>} />
    </Routes>
  </MemoryRouter>,
);

describe('boutons de l\'accueil', () => {
  it('« Commencer Gratuitement » ouvre la création d\'école', () => {
    monter(<Hero />);
    fireEvent.click(screen.getByRole('button', { name: 'Commencer Gratuitement' }));
    expect(screen.getByTestId('adresse')).toHaveTextContent(ADRESSE_INSCRIPTION);
  });

  it('« Demander une démo » ouvre WhatsApp, avec le vrai numéro', () => {
    monter(<Hero />);
    const lien = screen.getByRole('link', { name: 'Demander une démo' });
    expect(lien.getAttribute('href')).toContain(`wa.me/${WHATSAPP_NUMERO}`);
    expect(lien.getAttribute('target')).toBe('_blank');
  });

  it('« Créer mon compte gratuit » ouvre la création d\'école', () => {
    monter(<CTA />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte gratuit' }));
    expect(screen.getByTestId('adresse')).toHaveTextContent(ADRESSE_INSCRIPTION);
  });

  it('« Contacter l\'équipe commerciale » ouvre WhatsApp', () => {
    monter(<CTA />);
    expect(screen.getByRole('link', { name: 'Contacter l\'équipe commerciale' }).getAttribute('href'))
      .toContain(`wa.me/${WHATSAPP_NUMERO}`);
  });

  it('plus de promesse d\'essai de « 30 jours » : l\'essai vaut 7 jours par défaut', () => {
    const { container } = monter(<CTA />);
    expect(container.textContent).not.toMatch(/30 jours/);
  });
});

describe('titre principal (h1)', () => {
  it('un seul h1, qui porte le mot-clé recherché sur Google', () => {
    monter(<Hero />);
    const titres = screen.getAllByRole('heading', { level: 1 });
    expect(titres).toHaveLength(1);
    expect(titres[0]).toHaveTextContent('Logiciel de gestion scolaire au Sénégal');
  });

  it('le texte d\'accroche nomme ce que cherchent les écoles', () => {
    const { container } = monter(<Hero />);
    expect(container.textContent).toContain('logiciel de gestion scolaire');
    expect(container.textContent).toContain('du CI à la Terminale');
  });
});

describe('FAQ', () => {
  it('toutes les réponses sont dans la page, même repliées — Google les lit', () => {
    monter(<FAQ />);
    // Les montants sont formatés avec l'espace fine insécable du français
    // (25 000) ; testing-library normalise les espaces de la page, on
    // normalise donc aussi le texte attendu.
    const normaliser = (texte: string) => texte.replace(/\s+/g, ' ');
    for (const q of QUESTIONS) {
      expect(screen.getByText(q.question)).toBeInTheDocument();
      expect(screen.getByText(normaliser(q.reponse))).toBeInTheDocument();   // présent sans clic
    }
  });

  it('le prix annoncé est celui de la grille réelle', () => {
    const prix = QUESTIONS.find(q => q.question.startsWith('Combien'))!.reponse;
    const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
    expect(prix).toContain(fcfa(TARIF_MENSUEL));
    const annuel = FORMULES.find(f => f.mois === 12)!;
    expect(prix).toContain(fcfa(annuel.prix));
    expect(prix).toContain(fcfa(prixPlein(12)));
    expect(prix).toContain(`${Math.round((1 - annuel.prix / prixPlein(12)) * 100)} %`);
  });

  it('aucun nombre de jours d\'essai promis', () => {
    for (const q of QUESTIONS) expect(q.reponse, q.question).not.toMatch(/\d+ jours/);
  });

  it('les données structurées reprennent exactement les questions affichées', () => {
    const d = donneesStructureesFAQ();
    expect(d['@type']).toBe('FAQPage');
    expect(d.mainEntity.map(e => e.name)).toEqual(QUESTIONS.map(q => q.question));
  });

  it('le lien « FAQ » du pied de page a sa cible', () => {
    const { container } = monter(<FAQ />);
    expect(container.querySelector('section#faq')).not.toBeNull();
  });
});

describe('Referencement — titre et consigne robots page par page', () => {
  const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');

  it('accueil : titre à mot-clé, indexable', () => {
    monter(<Referencement />, '/');
    expect(document.title).toBe(TITRE_ACCUEIL);
    expect(robots()).toContain('index, follow');
  });

  it('espace privé : jamais indexé', () => {
    monter(<Referencement />, '/dashboard');
    expect(document.title).toBe('Tableau de bord | SenClass');
    expect(robots()).toBe('noindex, nofollow');
  });
});

describe('pied de page', () => {
  it('l\'e-mail de contact est cliquable et ouvre la messagerie', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: EMAIL_CONTACT }).getAttribute('href')).toBe(`mailto:${EMAIL_CONTACT}`);
  });

  it('plus aucune adresse sur un domaine qui n\'est pas le nôtre', () => {
    const { container } = render(<Footer />);
    expect(container.textContent).not.toMatch(/terangaschool|terranga/i);
  });
});

describe('carte Tarifs — abonnement en libre-service', () => {
  it('« S\'abonner » ouvre la création de compte : l\'école s\'inscrit, puis active son abonnement', () => {
    monter(<Pricing />);
    fireEvent.click(screen.getByRole('button', { name: "S'abonner" }));
    expect(screen.getByTestId('adresse')).toHaveTextContent(ADRESSE_INSCRIPTION);
  });

  it('plus de « paiement bientôt disponible » : le paiement en ligne existe', () => {
    const { container } = monter(<Pricing />);
    expect(container.textContent).not.toMatch(/bientôt disponible/i);
  });

  it('plus de passage obligé par WhatsApp pour s\'abonner', () => {
    const { container } = monter(<Pricing />);
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(container.textContent).not.toMatch(/WhatsApp/i);
  });

  it('le tarif affiché reste celui de la grille réelle', () => {
    const { container } = monter(<Pricing />);
    expect(container.textContent?.replace(/\D/g, '')).toContain(String(TARIF_MENSUEL));
  });
});
