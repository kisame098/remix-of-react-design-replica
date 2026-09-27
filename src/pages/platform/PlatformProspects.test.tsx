import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Prospects du chef du système : liste, relances, e-mail via `envoyer-email`.
// ════════════════════════════════════════════════════════════════════════════

const hier = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
const tables: Record<string, unknown[]> = {
  platform_prospects: [
    { id: 'p1', ecole: 'Collège Sainte-Marie', responsable: 'M. Diallo', telephone: '77 123 45 67', email: 'direction@saintemarie.sn', ville: 'Thiès', statut: 'contacte', relance_le: hier, created_at: '2026-09-01' },
    { id: 'p2', ecole: 'Lycée du Plateau', statut: 'nouveau', created_at: '2026-09-02' },
  ],
  platform_echanges: [],
  platform_modeles_email: [{ id: 'm1', nom: 'Présentation', objet: 'SenClass pour {{ecole}}', contenu: 'Bonjour {{responsable}}', ordre: 0 }],
};
const invoke = vi.fn().mockResolvedValue({ data: { envoyes: 1, echecs: 0 }, error: null });

// Chaîne Supabase minimale : chaque appel renvoie la même promesse, résolue sur la table.
const requete = (table: string) => {
  const r = { data: tables[table] ?? [], error: null };
  const chaine: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'not', 'limit', 'eq', 'update', 'insert', 'single', 'delete']) chaine[m] = () => chaine;
  chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok);
  return chaine;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => requete(t), rpc: () => Promise.resolve({ data: [], error: null }), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import PlatformProspects from './PlatformProspects';

describe('Prospects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('liste les prospects et signale ceux à relancer', async () => {
    render(<PlatformProspects />);
    expect(await screen.findByText('Collège Sainte-Marie')).toBeInTheDocument();
    expect(screen.getByText('Lycée du Plateau')).toBeInTheDocument();
    expect(screen.getByText(/à relancer aujourd'hui/)).toBeInTheDocument();
  });

  it('e-mail : un modèle, l\'aperçu personnalisé, puis l\'envoi par la fonction envoyer-email', async () => {
    const user = userEvent.setup();
    render(<PlatformProspects />);
    await user.click(await screen.findByRole('button', { name: 'E-mail — Collège Sainte-Marie' }));
    await user.click(screen.getByRole('combobox', { name: 'Modèle' }));
    await user.click(screen.getByRole('option', { name: 'Présentation' }));
    const apercu = screen.getByText(/Aperçu pour Collège Sainte-Marie/).parentElement!;
    expect(within(apercu).getByText('SenClass pour Collège Sainte-Marie')).toBeInTheDocument();
    expect(within(apercu).getByText('Bonjour M. Diallo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Envoyer/ }));
    expect(invoke).toHaveBeenCalledWith('envoyer-email', { body: {
      objet: 'SenClass pour {{ecole}}', contenu: 'Bonjour {{responsable}}',
      destinataires: [{ email: 'direction@saintemarie.sn', ecole: 'Collège Sainte-Marie', responsable: 'M. Diallo', prospectId: 'p1', schoolId: undefined }],
    } });
  });

  it('sans e-mail ni téléphone, les boutons E-mail et WhatsApp sont grisés', async () => {
    render(<PlatformProspects />);
    expect(await screen.findByRole('button', { name: 'E-mail — Lycée du Plateau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'WhatsApp — Lycée du Plateau' })).toBeDisabled();
  });
});
