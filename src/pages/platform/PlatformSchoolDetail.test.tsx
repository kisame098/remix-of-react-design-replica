import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const DETAIL = {
  ecole: { id: 's1', nom: 'Collège Test', ville: 'Dakar', pays: 'SN', creee_le: '2026-09-01T10:00:00Z', statut: 'active', plan: 'mensuel', expire_le: null },
  effectifs: { eleves: 1002, eleves_par_annee: [{ annee: '2026-2027', eleves: 1002 }], professeurs: 46, directeurs: 1, personnel: 12, caisses: 0, classes: 31, matieres: 14, creneaux_emploi_du_temps: 308 },
  comptes: { eleves: 1000, eleves_connectes: 1, professeurs: 46, professeurs_connectes: 0 },
  saisie: { notes: 14560, notes_elementaire: 0, seances_presence: 309, presences_eleves: 11036, paiements: 2703, paiements_annules: 1, total_encaisse: 92550000, recus: 0, bulletins_publies: 0 },
  dates: { derniere_activite: '2026-09-14T11:38:37Z', derniere_connexion: '2026-09-14T11:38:37Z', derniere_presence_appli: null, derniere_saisie_notes: '2026-09-12T21:31:22Z', derniere_saisie_presences: '2026-09-12T20:17:02Z', dernier_paiement: '2026-09-05T14:59:16Z', premiere_activite: '2026-09-05', suivi_appli_depuis: null, jours_actifs_30: 2, jours_actifs_90: 2 },
  historique: [
    { jour: '2026-09-20', connectes: 0, notes: 0, seances: 0, paiements: 0, inscriptions: 0 },
    { jour: '2026-09-14', connectes: 1, notes: 0, seances: 0, paiements: 0, inscriptions: 0 },
    { jour: '2026-09-05', connectes: 0, notes: 0, seances: 0, paiements: 2703, inscriptions: 1002 },
  ],
};
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('recharts', () => {
  const Vide = () => null;
  return { BarChart: Vide, Bar: Vide, XAxis: Vide, YAxis: Vide, Tooltip: Vide, CartesianGrid: Vide, Legend: Vide, ResponsiveContainer: Vide };
});

import PlatformSchoolDetail from './PlatformSchoolDetail';

const ouvrir = () => render(
  <MemoryRouter initialEntries={['/platform/ecoles/s1']}>
    <Routes><Route path="/platform/ecoles/:schoolId" element={<PlatformSchoolDetail />} /></Routes>
  </MemoryRouter>,
);

describe('PlatformSchoolDetail', () => {
  it('affiche effectifs, saisies, dernière activité et historique — sans donnée individuelle', async () => {
    rpc.mockResolvedValue({ data: DETAIL, error: null });
    ouvrir();
    expect(await screen.findByText('Collège Test')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('platform_school_detail', { p_school_id: 's1' });
    expect(screen.getByText('Élèves inscrits')).toBeInTheDocument();
    expect(screen.getByText('Professeurs')).toBeInTheDocument();
    expect(screen.getByText('Notes saisies')).toBeInTheDocument();
    expect(screen.getByText('Dernière activité (toutes sources)')).toBeInTheDocument();
    expect(screen.getByText(/aucune trace depuis 1 jour/)).toBeInTheDocument();
    expect(screen.getByText(/Aucun nom, note ou montant individuel|aucun nom, note ou montant individuel/i)).toBeInTheDocument();
    // seules les journées avec activité figurent dans le journal
    expect(screen.getAllByRole('row').length).toBe(1 + 2);   // en-tête + 2 jours actifs
  });

  it('erreur du serveur : message, pas d\'écran blanc', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Non autorisé' } });
    ouvrir();
    expect(await screen.findByText('Non autorisé')).toBeInTheDocument();
  });
});
